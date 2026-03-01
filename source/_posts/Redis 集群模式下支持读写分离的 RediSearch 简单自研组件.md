title: Redis 集群模式下支持读写分离的 RediSearch 简单自研组件

author: kinglyjn

mathjax: true

tags:

  - RediSearch
  - redis
  - springdata
  - mvc
  - lettuce

categories:

  - db_cache

  - redis

date: 2023-02-13 09:43:41

---



## 环境和背景说明

### 依赖环境

Java Version：17

Spring Boot Version：3.5.9

Redis Server with RedisJSON and RediSearch：8.2.0

<!--more-->



```xml
<properties>
  <java.version>17</java.version>
  <maven.compiler.source>17</maven.compiler.source>
  <maven.compiler.target>17</maven.compiler.target>
  <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
  <spring-boot.version>3.5.9</spring-boot.version>
  <logback.version>1.5.25</logback.version>
  <lombok.version>1.18.42</lombok.version>
</properties>

<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-dependencies</artifactId>
      <version>${spring-boot.version}</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>


<!--redis 相关-->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
<dependency>
  <groupId>org.apache.commons</groupId>
  <artifactId>commons-pool2</artifactId>
</dependency>
<dependency>
  <groupId>com.fasterxml.jackson.core</groupId>
  <artifactId>jackson-databind</artifactId>
</dependency>
<dependency>
  <groupId>org.apache.commons</groupId>
  <artifactId>commons-lang3</artifactId>
  <version>3.20.0</version>
</dependency>
<dependency>
  <groupId>org.projectlombok</groupId>
  <artifactId>lombok</artifactId>
  <version>${lombok.version}</version>
  <scope>compile</scope>
  <optional>true</optional>
</dependency>
```

<br>



### 为什么不使用 Redis OM Spring

Redis OM Spring 的底层底层通讯库与 Jedis 深度耦合（强绑定），而我们当时的客户端缓存架构的基石是 Lettuce，这是最核心的原因。

* Redis OM Spring （版本 [v1.1.2](https://github.com/redis/redis-om-spring/tree/v1.1.2) 对 spring boot 3.5.x 支持较好）由 Redis 官方团队维护，他们在设计之初就选择了 Jedis 作为唯一的底层驱动。Redis OM 的逻辑接调用 Jedis 里的特定命令封装类（如 redis.clients.jedis.Search）。在做OM映射的时候，也是直接使用的 Jedis 的相关组件。
* 我们的项目都是使用的是 Lettuce，这也是当前主流比较推荐的组件库。Lettuce 基于 Netty，支持异步和响应式，在处理 Redis Cluster 路由时比 Jedis 稳定得多，查询和操作效率也要高出不少。
* 强行引入 Redis OM，它会通过依赖传递把整个 Jedis 库拉进来。在一个项目中同时存在两个 Redis 驱动（Lettuce 和 Jedis），会导致连接池管理混乱**、**内存占用翻倍，甚至可能引 ClassLoader 冲突。

为了使用纯净的 springboot + lettuce 作为客户端缓存的实现，我们不得不被迫 "造轮子"。

<br>



## 核心代码

### 读写分离切面

基于当前线程 ThreadLocal

```java
/**
 * @author KJ
 */
@Aspect
@Component
@Order(1) // 确保在事务切面之前执行
public class RedisReadOnlyAspect {
    @Around("@annotation(com.demo.componet.RedisReadOnly)")
    public Object around(ProceedingJoinPoint point) throws Throwable {
        try {
            RedisRouteContext.setReadOnly(true);
            return point.proceed();
        } finally {
            RedisRouteContext.clear();
        }
    }
}

/**
 * @author KJ
 */
public class RedisRouteContext {
    private static final ThreadLocal<Boolean> readOnly = ThreadLocal.withInitial(() -> false);

    public static void setReadOnly(boolean isReadOnly) {
        readOnly.set(isReadOnly);
    }

    public static boolean isReadOnly() {
        return readOnly.get();
    }

    public static void clear() {
        readOnly.remove();
    }
}


/**
 * 加这个注解，会根据我们在 {@link RedisClusterConfig} 中配置的 ReadFrom.REPLICA_PREFERRED
 * 优先走从库，如果从库都不可用，就会根据这个策略，去查询主库。
 *
 * @author KJ
 * @description 读写分离注解
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RedisReadOnly {
}
```

<br>



### 核心实现

#### DynamicRediSearchTemplate

支持读写分离的 RediSearch 索引操作组件，主要支持的功能：

* 支持读写分离
* 支持查询 redis JSON、redis HASH
* 支持常见的 query、geo、vector 搜索
* 支持返回特定字段
* 支持分页、支持排序
* 支持高亮
* 支持按特定语言的分词检索
* 支持对索引操作的常用的 DDL
* 支持蓝绿发布相关API

```java
import com.demo.aop.RedisRouteContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.lettuce.core.RedisFuture;
import io.lettuce.core.api.async.BaseRedisAsyncCommands;
import io.lettuce.core.codec.ByteArrayCodec;
import io.lettuce.core.output.ArrayOutput;
import io.lettuce.core.output.StatusOutput;
import io.lettuce.core.protocol.CommandArgs;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * RediSearch 组件（支持读写分离）
 *
 * @author KJ
 * @description 读写分离 RediSearch 操作模板
 */
@Component
public class DynamicRediSearchTemplate {
    private static final Logger log = LoggerFactory.getLogger(DynamicRediSearchTemplate.class);

    private final RedisTemplate<String, Object> masterTemplate;
    private final RedisTemplate<String, Object> slaveTemplate;
    private final ObjectMapper objectMapper;

    public DynamicRediSearchTemplate(
            @Qualifier("masterRedisTemplate") RedisTemplate<String, Object> masterTemplate,
            @Qualifier("slaveRedisTemplate") RedisTemplate<String, Object> slaveTemplate,
            ObjectMapper objectMapper) {
        this.masterTemplate = masterTemplate;
        this.slaveTemplate = slaveTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * 核心路由逻辑：基于 ThreadLocal 上下文选择模板
     */
    private RedisTemplate<String, Object> getActualTemplate() {
        return RedisRouteContext.isReadOnly() ? slaveTemplate : masterTemplate;
    }

    /**
     * 获取异步命令对象
     */
    @SuppressWarnings("unchecked")
    private BaseRedisAsyncCommands<byte[], byte[]> getAsyncCommands(RedisConnection connection) {
        Object nativeConnection = connection.getNativeConnection();
        return (BaseRedisAsyncCommands<byte[], byte[]>) nativeConnection;
    }

    /**
     * 在类中定义一个常量，模拟 FT.SEARCH 命令
     */
    private enum RediSearchCommand implements io.lettuce.core.protocol.ProtocolKeyword {
        FT_SEARCH("FT.SEARCH"),
        FT_CREATE("FT.CREATE"),
        FT_DROPINDEX("FT.DROPINDEX"),
        FT_INFO("FT.INFO"),
        FT_ALIASUPDATE("FT.ALIASUPDATE"),
        FT_ALIASDEL("FT.ALIASDEL");

        private final String name;
        RediSearchCommand(String name) {
            this.name = name;
        }

        @Override
        public byte[] getBytes() {
            return name.getBytes(StandardCharsets.UTF_8);
        }
    }

    /**
     * 搜索接口
     *
     * 1.支持读写分离
     * 2.支持查询 redis JSON、redis HASH
     * 3.支持常见的 query、geo、vector 搜索、支持返回特定字段、支持分页、支持排序、支持高亮、支持按特定语言的分词检索
     */
    public <T> List<T> search(String indexName, RediSearchOptions options, Class<T> clazz) {
        // 自动感知 ReadOnly 上下文，决定去主库还是从库
        return getActualTemplate().execute((RedisCallback<List<T>>) connection -> {
            try {
                BaseRedisAsyncCommands<byte[], byte[]> commands = getAsyncCommands(connection);

                // 构建标准参数流
                String finalQuery = options.getQuery();

                // 插入地理位置查询条件
                Geo geo = options.getGeo();
                if (geo != null) {
                    finalQuery = (finalQuery == null || finalQuery.isEmpty())
                            ? geo.toString()
                            : finalQuery + " " + geo.toString();
                }

                // 增强后的查询参数
                CommandArgs<byte[], byte[]> cmdArgs = new CommandArgs<>(ByteArrayCodec.INSTANCE)
                        .add(indexName)
                        .add(finalQuery);

                // 1. 动态处理 RETURN
                if (options.getReturnFields() != null) {
                    cmdArgs.add("RETURN").add(options.getReturnFields().size());
                    options.getReturnFields().forEach(cmdArgs::add);
                }

                // 2. 动态处理高亮逻辑
                // 针对 向量搜索 和 JSON 索引的兼容性防御，高亮只在 ON HASH，JSON TEXT 字段目前并不支持
                boolean isNativeHighlightApplied = false; // 高强度防御
                if (options.isHighlight()) {
                    // 防御 A：KNN 向量搜索不支持高亮
                    boolean isKnn = options.getQuery() != null && options.getQuery().contains("KNN");

                    // 防御 B：JSON 索引原生不支持 HIGHLIGHT 指令 (重要！)
                    // DIALECT 2 或 3 通常伴随 JSON 操作，RediSearch 2.x 版本下直接执行会报错
                    boolean isJsonMode = options.getDialect() >= 2;

                    if (isKnn) {
                        log.warn("RediSearch Warning: HIGHLIGHT skipped. Reason: KNN search detected.");
                        options.setHighlight(false); // 关闭标志，防止 parser 误处理
                    } else if (isJsonMode) {
                        // 核心拦截逻辑：对于 JSON 模式，不向 cmdArgs 注入 HIGHLIGHT 指令
                        log.info("RediSearch Note: Native HIGHLIGHT is disabled for JSON index. Will fallback to App-side highlighting.");

                        // 我们不执行 cmdArgs.add("HIGHLIGHT")，从而避免 Redis 报错
                        // 但我们保留 options.isHighlight() = true，留给 Parser 在 Java 层做正则替换
                    } else {
                        // 只有在 HASH 模式 (Dialect 1) 且非 KNN 时，才真正发送指令给 Redis
                        cmdArgs.add("HIGHLIGHT");

                        // 处理字段映射 (保持原样)
                        List<String> hFields = options.getHighlightFields();
                        if (hFields != null && !hFields.isEmpty()) {
                            cmdArgs.add("FIELDS").add(hFields.size());
                            hFields.forEach(cmdArgs::add);
                        }

                        // 处理自定义标签 (保持原样)
                        HighlightTags highlightTags = options.getHighlightTags();
                        if (highlightTags != null) {
                            cmdArgs.add("TAGS")
                                    .add(highlightTags.getOpenTag())
                                    .add(highlightTags.getCloseTag());
                        }
                        isNativeHighlightApplied = true;

                        // HASH 模式且需要高亮，建议强制使用 DIALECT 1，因为 1 对 HASH 的 HIGHLIGHT 支持最原生
                        if (options.getDialect() != 1) {
                            options.setDialect(1);
                        }
                    }
                }

                // 3. 动态处理排序
                if (options.getSortBy() != null) {
                    cmdArgs.add("SORTBY").add(options.getSortBy()).add(options.isAscending() ? "ASC" : "DESC");
                }

                // 4. 处理分页
                int offset = options.getOffset() != null ? options.getOffset() : 0;
                int limit = options.getLimit() != null ? options.getLimit() : 10;
                cmdArgs.add("LIMIT").add(offset).add(limit);

                // 5. 处理多语言分词
                if (options.getLanguage() != null && !options.getLanguage().isEmpty()) {
                    cmdArgs.add("LANGUAGE").add(options.getLanguage());
                }

                // 6. 注入向量 BLOB
                if (options.getVector() != null) {
                    cmdArgs.add("PARAMS").add(2).add(options.getVectorParamName())
                            .add(floatArrayToByteArray(options.getVector()));
                }

                // 7. 强制 Dialect
                cmdArgs.add("DIALECT").add(options.getDialect());

                // 8. 异步转同步执行，带超时控制
                RedisFuture<List<Object>> future = commands.dispatch(
                        RediSearchCommand.FT_SEARCH,
                        new ArrayOutput<>(ByteArrayCodec.INSTANCE),
                        cmdArgs
                );

                long timeout = options.getTimeout() != null ? options.getTimeout() : 5000L;
                List<Object> rawResult = future.get(timeout, TimeUnit.MILLISECONDS);

                if (options.getResultType() == RediSearchOptions.ResultType.ON_JSON) {
                    return RediSearchResultParser.parse(rawResult, clazz, options, isNativeHighlightApplied);
                } else if (options.getResultType() == RediSearchOptions.ResultType.ON_HASH) {
                    return RediSearchResultForHashParser.parse(rawResult, clazz, options, isNativeHighlightApplied);
                } else {
                    throw new IllegalArgumentException("Invalid ResultType: " + options.getResultType());
                }
            } catch (Exception e) {
                log.error("RediSearch Enterprise Search Failed | Index: {} | Query: {}", indexName, options.getQuery(), e);
                throw new RuntimeException("Search Execution Error", e);
            }
        });
    }

    private byte[] floatArrayToByteArray(float[] values) {
        java.nio.ByteBuffer buffer = java.nio.ByteBuffer.allocate(values.length * 4);
        buffer.order(java.nio.ByteOrder.LITTLE_ENDIAN);
        for (float v : values) buffer.putFloat(v);
        return buffer.array();
    }


    // --- 索引管理 (DDL) ---

    /**
     * 删除索引
     *
     * @param indexName 索引名称
     * @param dd 是否同时删除底层数据 (Delete Documents)
     */
    public boolean dropIndex(String indexName, boolean dd) {
        return Boolean.TRUE.equals(masterTemplate.execute((RedisCallback<Boolean>) connection -> {
            BaseRedisAsyncCommands<byte[], byte[]> commands = getAsyncCommands(connection);
            CommandArgs<byte[], byte[]> args = new CommandArgs<>(ByteArrayCodec.INSTANCE).add(indexName);
            if (dd) args.add("DD");

            try {
                String result = commands.dispatch(RediSearchCommand.FT_DROPINDEX, new StatusOutput<>(ByteArrayCodec.INSTANCE), args).get();
                return "OK".equalsIgnoreCase(result);
            } catch (Exception e) {
                log.error("FT.DROPINDEX failed: {}", indexName, e);
                return false;
            }
        }));
    }

    /**
     * 判断索引是否存在
     * @param indexName 索引名称
     */
    public boolean isIndexExist(String indexName) {
        return Boolean.TRUE.equals(masterTemplate.execute((RedisCallback<Boolean>) connection -> {
            try {
                BaseRedisAsyncCommands<byte[], byte[]> commands = getAsyncCommands(connection);
                // FT.INFO 执行成功说明索引存在，抛出异常或返回错误说明不存在
                RedisFuture<List<Object>> future = commands.dispatch(RediSearchCommand.FT_INFO,
                        new ArrayOutput<>(ByteArrayCodec.INSTANCE),
                        new CommandArgs<>(ByteArrayCodec.INSTANCE).add(indexName));

                List<Object> result = future.get(5, TimeUnit.SECONDS); // 最多等5秒就超时
                return result != null && !result.isEmpty();
            } catch (Exception e) {
                // 如果不存在则 future.get 会抛出异常，这里返回 false
                return false;
            }
        }));
    }

    /**
     * 索引别名指针重置（配合蓝绿发布功能使用）
     *
     * @param aliasName  索引别名
     * @param targetIndex  别名指向的真实索引
     * @return 索引别名更新成功与否
     */
    public boolean aliasUpdate(String aliasName, String targetIndex) {
        return Boolean.TRUE.equals(masterTemplate.execute((RedisCallback<Boolean>) connection -> {
            try {
                BaseRedisAsyncCommands<byte[], byte[]> commands = getAsyncCommands(connection);
                RedisFuture<List<Object>> future = commands.dispatch(RediSearchCommand.FT_ALIASUPDATE,
                        new ArrayOutput<>(ByteArrayCodec.INSTANCE),
                        new CommandArgs<>(ByteArrayCodec.INSTANCE).add(aliasName).add(targetIndex));
                List<Object> result = future.get(5, TimeUnit.SECONDS);
                return result != null && !result.isEmpty(); // list<byte[]> = [[OK]]
            } catch (Exception e) {
                log.warn("setup alias {} for index {} failed, fail info: {}", aliasName, targetIndex, e.getMessage());
                return false;
            }
        }));
    }

    /**
     * 索引别名删除（配合蓝绿发布功能使用）
     *
     * @param aliasName  索引别名
     * @return  删除索引别名成功与否
     */
    public boolean aliasDel(String aliasName) {
        return Boolean.TRUE.equals(masterTemplate.execute((RedisCallback<Boolean>) connection -> {
            try {
                BaseRedisAsyncCommands<byte[], byte[]> commands = getAsyncCommands(connection);
                RedisFuture<List<Object>> future = commands.dispatch(RediSearchCommand.FT_ALIASDEL,
                        new ArrayOutput<>(ByteArrayCodec.INSTANCE),
                        new CommandArgs<>(ByteArrayCodec.INSTANCE).add(aliasName));
                List<Object> result = future.get(5, TimeUnit.SECONDS);
                return result != null && !result.isEmpty(); // list<byte[]> = [[OK]]
            } catch (Exception e) {
                log.warn("drop alias {} for index failed, fail info: {}", aliasName, e.getMessage());
                return false;
            }
        }));
    }


    @PostConstruct
    private void indexInit() {
        initEmployeeIndex();
    }

    /**
     * 索引：idx:employee
     * 逻辑：主节点执行，如果索引已存在则跳过初始化，否则就创建在此处定义的索引
     */
    private void initEmployeeIndex() {
        String indexName = "idx:employee";
        try {
            // 1. 判断索引是否存在
            if (isIndexExist(indexName)) {
                // 如果是简单的索引已存在，直接返回
                // 如果涉及索引升级，则需要手动进行 todo 蓝绿发布
                log.info("RediSearch Index [{}] already exists. Skipping initialization to protect data.", indexName);
                return;
            }

            // 2. 执行索引创建 (原子化操作)
            log.info("Initializing RediSearch Index: {} ...", indexName);
            boolean success = Boolean.TRUE.equals(masterTemplate.execute((RedisCallback<Boolean>) connection -> {
                try {
                    BaseRedisAsyncCommands<byte[], byte[]> commands = getAsyncCommands(connection);
                    commands.dispatch(RediSearchCommand.FT_CREATE,
                            new StatusOutput<>(ByteArrayCodec.INSTANCE),
                            new CommandArgs<>(ByteArrayCodec.INSTANCE)
                                    .add(indexName).add("ON").add("JSON")
                                    .add("PREFIX").add(1).add("employee:")
                                    .add("SCHEMA")
                                    .add("$.name").add("AS").add("name").add("TEXT")
                                    .add("$.dept").add("AS").add("dept").add("TAG")
                                    .add("$.age").add("AS").add("age").add("NUMERIC")
                                    .add("$.location").add("AS").add("location").add("GEO")
                                    .add("$.skill_vec").add("AS").add("skill_vec").add("VECTOR").add("HNSW").add(6)
                                    .add("TYPE").add("FLOAT32").add("DIM").add(4).add("DISTANCE_METRIC").add("COSINE")
                    );
                    return true;
                } catch (Exception e) {
                    log.error("Failed to create index {}", indexName, e);
                    return false;
                }
            }));

            // 3. 后续处理
            if (success) {
                log.info("RediSearch Index [{}] created successfully.", indexName);
            }
        } catch (Exception e) {
            log.error("Fatal error during RediSearch index initialization", e);
        }
    }
}
```

<br>



#### RediSearchResultParser

RediSearch 针对 JSON 索引的解析器。

```java
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import lombok.extern.slf4j.Slf4j;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * RediSearch 针对 JSON 索引的解析器
 * 如果需要hash解析器，请移步至 {@link RediSearchResultForHashParser}
 * 适配兼容：DIALECT 2 & 3，支持复杂 JSON 投影、数组自动脱壳、物理 Key 隔离。
 *
 * @author KJ
 */
@Slf4j
public class RediSearchResultParser {

    protected static final ObjectMapper OBJECT_MAPPER = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    protected static final String TAG_ID = "id";
    protected static final String TAG_JSON_ROOT = "$";
    protected static final String TAG_VALUES = "values";

    protected static final Set<String> METADATA_TAGS = new HashSet<>(Arrays.asList(
            "attributes", "extra_attributes", "warning", "total_results", "format", "results"
    ));

    /**
     * 企业级通用解析入口
     *
     * @param rawResults Lettuce 返回的原始对象列表
     * @param clazz      目标实体类（如 EmployeeDoc.class）
     * @param <T>        泛型
     * @return 转换后的实体列表
     */
    public static <T> List<T> parse(List<Object> rawResults, Class<T> clazz,
                                    RediSearchOptions options, boolean isNativeHighlightApplied) {
        if (rawResults == null || rawResults.isEmpty()) return Collections.emptyList();

        List<Object> flatList = new ArrayList<>();
        flattenRecursive(rawResults, flatList);

        List<T> results = new ArrayList<>();
        int size = flatList.size();
        int i = 0;

        while (i < size) {
            String label = toSafeString(flatList.get(i));

            // 判定一个新文档的开始
            if (TAG_ID.equals(label) && i + 1 < size) {
                String docId = toSafeString(flatList.get(i + 1));
                Map<String, Object> fieldMap = new HashMap<>();
                fieldMap.put("__key__", docId);

                // 跳过 "id" 标签和 docId 值
                i += 2;

                // 2. 内层循环：消费 KV 对，直到撞上边界
                while (i < size) {
                    String attrName = toSafeString(flatList.get(i));

                    // 边界判定：遇到下一个 "id" 说明当前文档结束
                    if (TAG_ID.equals(attrName)) break;

                    // 边界判定：如果是元数据干扰词，跳过
                    if (METADATA_TAGS.contains(attrName) || TAG_VALUES.equals(attrName)) {
                        i++;
                        continue;
                    }

                    // 消费 Value
                    if (i + 1 < size) {
                        Object valObj = flatList.get(i + 1);
                        // 关键检查：如果 Value 居然是下一个 "id"，说明当前 attrName 是脏数据，跳过
                        if (TAG_ID.equals(toSafeString(valObj))) {
                            i++;
                            break;
                        }

                        String valStr = toSafeString(valObj);
                        if (TAG_JSON_ROOT.equals(attrName)) {
                            mergeJsonToMap(valStr, fieldMap);
                        } else {
                            processSmartValue(attrName, valStr, fieldMap);
                        }

                        // 补偿高亮
                        if (options != null && options.isHighlight() && !isNativeHighlightApplied) {
                            applyManualHighlight(attrName, fieldMap, options);
                        }
                        i += 2;
                    } else {
                        i++;
                    }
                }

                // 【核心修复】：只有当 fieldMap 包含实际业务字段时才添加
                // 除了 __key__，至少得有一个业务字段（如 name, id, description 等）
                if (fieldMap.size() > 1) {
                    try {
                        results.add(OBJECT_MAPPER.convertValue(fieldMap, clazz));
                    } catch (Exception e) {
                        log.error("RediSearch Mapping Failed. DocId: {}, Error: {}", docId, e.getMessage());
                    }
                }
            } else {
                i++; // 没看到 id 标签，继续向后滑行
            }
        }
        return results;
    }


    /**
     * 递归平铺：将所有嵌套的 List 展开为单层列表，保留 byte[] 和其他基本对象
     */
    @SuppressWarnings("unchecked")
    protected static void flattenRecursive(List<Object> source, List<Object> target) {
        for (Object item : source) {
            if (item instanceof List) {
                // version1.0: flattenRecursive((List<Object>) item, target);
                List<Object> subList = (List<Object>) item;
                // 关键判断：如果 List 内部第一个元素是 byte[] 且看起来像 JSON ([ 或 {)  或者这根本不是 Redis 协议层面的嵌套，就不要平铺它
                if (!subList.isEmpty() && isComplexData(subList.get(0))) {
                    target.add(item); // 作为整体加入，不展开
                } else {
                    flattenRecursive(subList, target);
                }
            } else {
                target.add(item);
            }
        }
    }

    // 辅助判断：是否是业务复杂的 JSON 数据
    private static boolean isComplexData(Object obj) {
        if (obj instanceof byte[]) {
            String s = new String((byte[]) obj, StandardCharsets.UTF_8);
            return s.startsWith("[") || s.startsWith("{");
        }
        return false;
    }

    /**
     * 针对 Dialect 2 的单对象转数组修复。
     */
    protected static void processSmartValue(String attrName, String valStr, Map<String, Object> fieldMap) {
        if (valStr == null || valStr.isEmpty()) return;

        String finalKey = resolveFinalKey(attrName);
        String trimmed = valStr.trim();

        if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
            try {
                JsonNode node = OBJECT_MAPPER.readTree(trimmed);
                if (node.isArray()) {
                    if (node.size() == 1) {
                        JsonNode firstLayer = node.get(0);
                        if (firstLayer.isArray()) {
                            fieldMap.put(finalKey, firstLayer);
                        } else if (firstLayer.isObject()) {
                            fieldMap.put(finalKey, firstLayer);
                        } else {
                            fieldMap.put(finalKey, extractBasicValue(firstLayer));
                        }
                    } else {
                        fieldMap.put(finalKey, node);
                    }
                } else if (node.isObject()) {
                    // 核心修复：针对 Dialect 2 的单元素 Object 强转 Array
                    if (isListField(finalKey)) {
                        ArrayNode wrapper = OBJECT_MAPPER.createArrayNode();
                        wrapper.add(node);
                        fieldMap.put(finalKey, wrapper);
                    } else {
                        fieldMap.put(finalKey, node);
                    }
                } else {
                    fieldMap.put(finalKey, extractBasicValue(node));
                }
            } catch (Exception e) {
                fieldMap.put(finalKey, cleanString(valStr));
            }
        } else {
            fieldMap.put(finalKey, cleanString(valStr));
        }
    }

    /**
     * 辅助逻辑：提取 JSONPath 中的别名或原始键名
     */
    private static String resolveFinalKey(String attrName) {
        if (attrName.startsWith("$.")) {
            if (attrName.contains(" AS ")) {
                return attrName.split("(?i) AS ")[1].trim();
            }
            return attrName.substring(attrName.lastIndexOf(".") + 1);
        }
        return attrName;
    }

    /**
     * 辅助逻辑：判断字段是否是列表类型（针对 Dialect 2 强制转数组）
     */
    private static boolean isListField(String key) {
        return "roles".equalsIgnoreCase(key) || "permissions".equalsIgnoreCase(key);
    }

    private static Object extractBasicValue(JsonNode node) {
        if (node.isNumber()) return node.numberValue();
        if (node.isBoolean()) return node.booleanValue();
        return node.asText();
    }

    /**
     * 处理并合并 RedisJSON 字符串
     */
    @SuppressWarnings("unchecked")
    protected static void mergeJsonToMap(String jsonStr, Map<String, Object> map) {
        if (jsonStr == null || jsonStr.isEmpty()) return;
        try {
            String cleaned = jsonStr.trim();
            // 兼容 Dialect 2 的包裹格式
            if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
                cleaned = cleaned.substring(1, cleaned.length() - 1);
            }
            if (cleaned.startsWith("\"") && cleaned.endsWith("\"")) {
                cleaned = cleaned.substring(1, cleaned.length() - 1).replace("\\\"", "\"");
            }
            Map<String, Object> jsonMap = OBJECT_MAPPER.readValue(cleaned, Map.class);
            if (jsonMap != null) map.putAll(jsonMap);
        } catch (Exception e) {
            log.warn("Failed to parse RedisJSON content: {}", jsonStr);
        }
    }

    protected static String toSafeString(Object obj) {
        if (obj == null) return "";
        if (obj instanceof String s) return s;
        if (obj instanceof byte[] bytes) return new String(bytes, StandardCharsets.UTF_8);
        return obj.toString();
    }

    private static String cleanString(String s) {
        if (s != null && s.startsWith("\"") && s.endsWith("\"")) {
            return s.substring(1, s.length() - 1);
        }
        return s;
    }

    /**
     * 手动高亮逻辑。
     * 仅处理 TEXT 类型的字段，且根据 options 中的标签进行替换。
     */
    protected static void applyManualHighlight(String attrName, Map<String, Object> fieldMap, RediSearchOptions options) {
        String finalKey = resolveFinalKey(attrName);

        if (options.getHighlightFields() != null && !options.getHighlightFields().contains(finalKey)) {
            return;
        }

        Object value = fieldMap.get(finalKey);
        if (value instanceof String text) {
            String query = options.getQuery();
            if (query == null || query.isEmpty()) return;

            // 1. 提取所有关键词：通过正则匹配出单词，过滤掉 @ : ( ) * | 等符号
            // 我们把 query 里的符号换成空格，然后按空格切割
            String cleanQuery = query.replaceAll("[@:()|*]", " ");
            String[] keywords = cleanQuery.split("\\s+");

            HighlightTags tags = options.getHighlightTags();
            String open = tags != null ? tags.getOpenTag() : "<b>";
            String close = tags != null ? tags.getCloseTag() : "</b>";

            String resultText = text;
            // 2. 迭代替换：对每一个关键词都跑一遍正则替换
            for (String kw : keywords) {
                String word = kw.trim();
                // 排除掉字段名（如 name）和太短的词
                if (word.isEmpty() || word.equalsIgnoreCase(finalKey) || word.length() < 2) continue;

                // 执行忽略大小写的全局替换
                resultText = resultText.replaceAll("(?i)(" + word + ")", open + "$1" + close);
            }

            fieldMap.put(finalKey, resultText);
        }
    }
}
```

<br>



#### RediSearchResultForHashParser

RediSearch 针对 JSON 索引的解析器

```java
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.extern.slf4j.Slf4j;
import java.lang.reflect.Field;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * RediSearch 针对 JSON 索引的解析器
 */
@Slf4j
public class RediSearchResultForHashParser extends RediSearchResultParser {

    private static final Map<Class<?>, Set<String>> FIELD_CACHE = new ConcurrentHashMap<>();

    public static <T> List<T> parse(List<Object> rawResults, Class<T> clazz,
                                    RediSearchOptions options, boolean isNativeHighlightApplied) {
        if (rawResults == null || rawResults.isEmpty()) return Collections.emptyList();

        List<Object> flatList = new ArrayList<>();
        RediSearchResultParser.flattenRecursive(rawResults, flatList);

        List<T> results = new ArrayList<>();
        int size = flatList.size();

        // 1. 确定数据起点：跳过第一个 Total Results 数字
        int i = (size > 0 && isNumeric(toSafeString(flatList.get(0)))) ? 1 : 0;

        // 2. 核心：计算物理步长
        List<String> returns = (options != null) ? options.getReturnFields() : null;
        boolean hasReturnFields = (returns != null && !returns.isEmpty());
        // 步长 = 1 (DocId) + (Return 字段对数 * 2)
        int step = hasReturnFields ? (1 + returns.size() * 2) : -1;

        Set<String> knownFields = getCachedFields(clazz);

        while (i < size) {
            Map<String, Object> fieldMap = new HashMap<>();
            String docId = toSafeString(flatList.get(i));

            // 物理 Key 隔离：存入特殊键，绝不污染实体类的 id 字段
            fieldMap.put("__key__", docId);

            if (hasReturnFields && (i + step <= size)) {
                // --- 策略 A：步长契约法 (针对你的 RETURN 场景) ---
                // 严格按照 Redis 返回的物理位置成对读取 KV
                for (int j = 1; j < step; j += 2) {
                    String attrName = toSafeString(flatList.get(i + j));
                    Object valObj = flatList.get(i + j + 1);
                    if (valObj != null) {
                        handleValue(attrName, toSafeString(valObj), fieldMap, options, isNativeHighlightApplied);
                    }
                }
                i += step; // 精准跳到下一个文档
            } else {
                // --- 策略 B：探测法 (全量查询场景) ---
                i++; // 消费 DocId
                while (i < size) {
                    String attrName = toSafeString(flatList.get(i));
                    if (!knownFields.contains(attrName) && !isNumeric(attrName) && !METADATA_TAGS.contains(attrName)) {
                        break;
                    }
                    if (knownFields.contains(attrName) && i + 1 < size) {
                        handleValue(attrName, toSafeString(flatList.get(i + 1)), fieldMap, options, isNativeHighlightApplied);
                        i += 2;
                    } else { i++; }
                }
            }

            // 3. 映射到实体类
            if (fieldMap.size() > 1) {
                try {
                    // 二次防御：如果 id 字段的值里包含冒号，说明由于各种原因抓错了 DocId，必须剔除
                    Object idVal = fieldMap.get("id");
                    if (idVal instanceof String s && s.contains(":")) {
                        fieldMap.remove("id");
                    }

                    results.add(OBJECT_MAPPER.convertValue(fieldMap, clazz));
                } catch (Exception e) {
                    log.error("RediSearch Mapping Error at {}: {}", docId, e.getMessage());
                }
            }
        }
        return results;
    }

    private static void handleValue(String attrName, String valStr, Map<String, Object> fieldMap,
                                    RediSearchOptions options, boolean isNativeHighlightApplied) {
        processSmartValue(attrName, valStr, fieldMap);
        if (options != null && options.isHighlight() && !isNativeHighlightApplied) {
            applyManualHighlight(attrName, fieldMap, options);
        }
    }

    private static boolean isNumeric(String str) {
        return str != null && str.matches("-?\\d+");
    }

    private static Set<String> getCachedFields(Class<?> clazz) {
        return FIELD_CACHE.computeIfAbsent(clazz, c -> {
            Set<String> fields = new HashSet<>();
            fields.add(TAG_JSON_ROOT); fields.add(TAG_ID);
            Class<?> current = clazz;
            while (current != null && current != Object.class) {
                for (Field f : current.getDeclaredFields()) {
                    fields.add(f.getName());
                    if (f.isAnnotationPresent(JsonProperty.class)) {
                        fields.add(f.getAnnotation(JsonProperty.class).value());
                    }
                }
                current = current.getSuperclass();
            }
            return fields;
        });
    }
}
```

<br>



### RediSearch 主要的应用组件

#### RediSearchQueryBuilder

类似 MyBatis-Plus 的 Wrapper，复杂的 KNN 语句的生成器

```java
/**
 * 类似 MyBatis-Plus 的 Wrapper，复杂的 KNN 语句的生成器
 *
 * @author KJ
 * @description
 */
public class RediSearchQueryBuilder {
    private StringBuilder filter = new StringBuilder();
    private String vectorField;
    private int topK;

    /**
     * 添加标签过滤
     * @param field
     * @param value
     * @return
     */
    public RediSearchQueryBuilder filterTag(String field, String value) { // 数组或字段的标签查询
        filter.append("@").append(field).append(":{").append(value).append("} ");
        return this;
    }

    /**
     * 增加范围过滤
     * @param field
     * @param min
     * @param max
     * @return
     */
    public RediSearchQueryBuilder filterRange(String field, int min, int max) {
        filter.append("@").append(field).append(":[").append(min).append(" ").append(max).append("] ");
        return this;
    }

    /**
     * 增加地理位置过滤
     * @param geo
     */
    public RediSearchQueryBuilder filterGeo(Geo  geo) {
        // 语法格式: @field:[lon lat radius unit]
        filter.append(String.format("@%s:[%f %f %f %s] ",
                geo.getField(), geo.getLongitude(), geo.getLatitude(), geo.getRadius(), geo.getUnit()));
        return this;
    }

    /**
     * 添加向量搜索
     * @param vectorField 向量字段名
     * @param topK 返回数量
     * @return
     */
    public RediSearchQueryBuilder knn(String vectorField, int topK) {
        this.vectorField = vectorField;
        this.topK = topK;
        return this;
    }

    /**
     * 构建查询语句
     * @return
     */
    public String build() {
        String base = filter.length() == 0 ? "*" : "(" + filter.toString().trim() + ")";
        if (vectorField != null) {
            // 自动生成符合 DIALECT 2 的 KNN 语法
            return String.format("%s=>[KNN %d @%s $BLOB AS score]", base, topK, vectorField);
        }
        return base;
    }
}
```

<br>



#### RediSearchOptions

```java
import lombok.Builder;
import lombok.Data;
import java.util.List;

/**
 * @author KJ
 * @description 搜索条件构建器
 */
@Data
@Builder
public class RediSearchOptions {
    // 默认使用 JSON 类型对结果解析
    @Builder.Default
    private ResultType resultType = ResultType.ON_JSON;

    @Builder.Default
    private int dialect = 2;              // 使用的 redis 指令协议 1、2、3

    private String query;                 // 搜索条件

    private Geo geo;                      // 地理位置查询支持

    private String language;              // 分词语言：支持 chinese、english、japanese 等

    private List<String> returnFields;    // 定义返回的 index 字段有哪些

    private boolean highlight;            // 是否高亮（只有 ON HASH 或者 在 SCHEMA 中定义为 TEXT 的字段才能被高亮）
    private List<String> highlightFields; // 指定高亮字段，若不指定则默认全部 TEXT 字段
    private HighlightTags highlightTags;  // 高亮标签，如 <mark> 和 </mark>。如果没有这个字段，Redis 会强制使用默认的 <b> 和 </b>

    private float[] vector;               // 向量查询支持
    @Builder.Default
    private final String vectorParamName = "BLOB";

    private Integer limit;      // 分页定义
    private Integer offset;
    private String sortBy;      // 排序字段
    private boolean ascending;  // 是否正序

    private Long timeout;       // 毫秒级查询超时控制


    /**
     * 索引类型
     */
    public enum ResultType {
        ON_JSON, ON_HASH
    }
}


/**
 * @author KJ
 * @description 地理位置查询参数
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class Geo {
    private String field;      // 对应 Redis 中的 GEO 字段名
    private double longitude;  // 经度
    private double latitude;   // 纬度
    private double radius;     // 半径
    private GeoUnit unit;      // 单位 m, km, mi, ft

    public enum GeoUnit {
        m, km, mi, ft
    }

    @Override
    public String toString() {
        return String.format("@%s:[%f %f %f %s]", field, longitude, latitude, radius, unit.name());
    }
}


/**
 * @author KJ
 * @description 高亮标签
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class HighlightTags {
    private String openTag = "<b>";  // 默认值
    private String closeTag = "</b>";
}
```

<br>



## 相关使用和测试

### 测试一：普通搜索、地理位置搜索、向量搜索

#### 准备索引和文档

```bash
# 初始化索引
FT.DROPINDEX idx:employee
FT.CREATE idx:employee
    ON JSON
    PREFIX 1 employee:
    SCHEMA
        $.name AS name TEXT
        $.dept AS dept TAG
        $.age AS age NUMERIC
        $.skills AS skills TEXT
        $.location AS location GEO
        $.skill_vec AS skill_vec VECTOR HNSW 6
            TYPE FLOAT32
            DIM 4
            DISTANCE_METRIC COSINE
 
 
# 插入开发部张三 (年龄 30，具备 Java 和 Python 技能)
JSON.SET employee:1 $ '{"name":"张三", "age":30, "dept":"IT", "skills":"Java, Python, Spring", "location":"116.40,39.90", "skill_vec":[0.1, 0.2, 0.3, 0.4]}'
# 插入开发部李四 (年龄 25，具备 Golang 技能)
JSON.SET employee:2 $ '{"name":"李四", "age":25, "dept":"IT", "skills":"Golang, Docker, K8s", "location":"121.47,31.23", "skill_vec":[0.5, 0.6, 0.7, 0.8]}'
# 插入销售部王五 (年龄 35，具备 Sales 技能)
JSON.SET employee:3 $ '{"name":"王五", "age":35, "dept":"Sales", "skills":"Sales, Marketing", "location":"114.05,22.54", "skill_vec":[0.9, 0.1, 0.2, 0.3]}'


# 查询 IT 部门中包含 Java 技能的员工
FT.SEARCH idx:employee "@dept:{IT} @skills:Java" DIALECT 2

# 注意：$BLOB 在 redis-cli 中不方便直接传二进制，通常配合脚本
FT.SEARCH idx:employee "(@dept:{IT})=>[KNN 2 @skill_vec $BLOB AS score]" PARAMS 2 BLOB "\xcd\xcc\xcc=\xcd\xccL>\xcd\xcc\x9a>\xcd\xcc\xcc>" RETURN 3 name age score DIALECT 2
```

<br>

#### 准备实体类

```java
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

/**
 * 对应 RedisSearch 中的 Document 映射对象
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true) // 关键：忽略搜索结果中多余的字段（如未映射的向量字节）
public class EmployeeDoc {

    @JsonProperty("__key__")
    private String redisKey; // redis 文档的 Key

    private String id; // 业务id

    private String name;
    private Integer age;
    private String dept;
    private String skills;
    private String location;
    private Double score;
}
```

<br>



#### 测试单元

```java
@SpringBootTest(classes = App.class)
public class RediSearch1Test {

    @Autowired
    private DynamicRediSearchTemplate searchTemplate;

    /**
     * 混合查询：一般搜索 + 向量检索
     * 寻找 “IT部、年龄20-40岁、且技能最匹配” 的人
     */
    @Test
    void testHybridSearch() {
        // 读写分离
        RedisRouteContext.setReadOnly(true);

        // 1. 动态构建混合查询语句
        // 生成的 query 字符串类似于: (@dept:{IT} @age:[20 40])=>[KNN 5 @skill_vec $BLOB AS score]
        String hybridQuery = new RediSearchQueryBuilder()
                .filterTag("dept", "IT")                  // 标签过滤：部门
                .filterRange("age", 20, 40)           // 数值过滤：年龄区间
                .knn("skill_vec", 5)                 // 向量搜索：前5名
                .build();

        // 2. 配置搜索选项
        float[] targetVector = {0.1f, 0.2f, 0.3f, 0.4f};
        RediSearchOptions options = RediSearchOptions.builder()
                .query(hybridQuery)
                .vector(targetVector)
                .limit(5)
                .highlight(false)
                .timeout(3000L)
                .dialect(2) // 必须是 2
                .build();

        // 3. 执行搜索
        List<EmployeeDoc> results = searchTemplate.search("idx:employee", options, EmployeeDoc.class);
        results.forEach(System.out::println);
        RedisRouteContext.clear();
    }

    /**
     * 地理位置查询：
     * 寻找在某地附近 5 公里内（地理）、部门为 IT（标签）、且技能向量最匹配（向量）的前 3 名员工。
     * FT.SEARCH idx:employee "(@loc:[116.39 39.90 5 km] @dept:{IT})=>[KNN 3 @skill_vec $BLOB AS score] PARAMS 2 BLOB ..."
     */
    @Test
    void testHybridSearchWithGeo() {
        RedisRouteContext.setReadOnly(true);
        String hybridQuery = new RediSearchQueryBuilder()
                .filterGeo(Geo.builder().field("location").longitude(116.39).latitude(39.90).radius(5).unit(Geo.GeoUnit.km).build()) // 语法格式: @field:[lon lat radius unit]
                .filterTag("dept", "IT")
                .knn("skill_vec", 3)
                .build();
        float[] targetVector = {0.1f, 0.2f, 0.3f, 0.4f};
        RediSearchOptions options = RediSearchOptions.builder()
                .query(hybridQuery)
                .vector(targetVector)
                .limit(10)
                .highlight(false)
                .timeout(3000L)
                .dialect(2)
                .build();
        List<EmployeeDoc> results = searchTemplate.search("idx:employee", options, EmployeeDoc.class);
        results.forEach(System.out::println);
        RedisRouteContext.clear();
    }

    @Test
    void testLogicAndGeoSearch() {
        RedisRouteContext.setReadOnly(true);
        // query: "@name:张* @age:[20 40]"
        RediSearchOptions options1 = RediSearchOptions.builder()
                .query("@name:张* @age:[20 40]")
                .build();
        List<EmployeeDoc> results1 = searchTemplate.search("idx:employee", options1, EmployeeDoc.class);
        results1.forEach(System.out::println);

        // query: "@name:李* | @dept:{IT | OPS}"
        RediSearchOptions options2 = RediSearchOptions.builder()
                .query("@name:李* | @dept:{IT | OPS}")
                .build();
        List<EmployeeDoc> results2 = searchTemplate.search("idx:employee", options2, EmployeeDoc.class);
        results2.forEach(System.out::println);

        // query: "@name:张* -@dept:{OPS}"
        RediSearchOptions options3 = RediSearchOptions.builder()
                .query("@name:张* -@dept:{OPS}")
                .build();
        List<EmployeeDoc> results3 = searchTemplate.search("idx:employee", options3, EmployeeDoc.class);
        results3.forEach(System.out::println);

        // query: "@location:[116.4 39.90 50 km]"
        RediSearchOptions options4 = RediSearchOptions.builder()
                .geo(Geo.builder().field("location").longitude(116.39).latitude(39.90).radius(50).unit(Geo.GeoUnit.km).build())
                .build();
        List<EmployeeDoc> results4 = searchTemplate.search("idx:employee", options4, EmployeeDoc.class);
        results4.forEach(System.out::println);

        RedisRouteContext.clear();
    }
}
```

<br>



### 测试二：Redis JSON 高亮

#### 准备索引和数据

```bash
# 创建索引
FT.CREATE idx:sys_user
     ON JSON
     PREFIX 1 user:
     SCHEMA
         $.id AS user_id NUMERIC
         $.name AS name TEXT
         $.points AS points NUMERIC
         $.roles[*].name AS role_name TAG
         $.roles[*].permissions[*] AS perms TAG
         
         
# 用户 1：超级管理员
JSON.SET user:1 $ '{"id":1,"name":"zhangsan","points":200,"roles":[{"id":1,"name":"admin","orderNum":1,"permissions":["system:user:view","system:user:update"]}]}'
# 用户 2：普通运维（拥有两个角色）
JSON.SET user:2 $ '{"id":2,"name":"lisi","points":150,"roles":[{"id":2,"name":"devops","orderNum":2,"permissions":["system:log:view"]},{"id":3,"name":"guest","orderNum":10,"permissions":["none"]}]}'
# 用户 3：纯净新用户
JSON.SET user:3 $ '{"id":3,"name":"wangwu","points":50,"roles":[]}'
```

<br>



#### 准备实体

```java
/**
 * @author KJ
 * @description
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class User {
    // 使用 __key__ 能接到文档的物理的 KEY
    private String __key__;

    // 处理索引字段和文档字段名称不一致的情况
    @JsonProperty("user_id")
    @JsonAlias({"id", "user_id"})
    private Long id;
    private String name;
    private Integer points;

    // @JsonAlias({"roles", "$.roles"})
    private List<Role> roles;

    //
    private Double score;
}
```

<br>



#### 测试单元

```java
@SpringBootTest(classes = App.class)
public class RediSearch2Test {

    @Autowired
    private DynamicRediSearchTemplate searchTemplate;

    @Test
    void testSearch01() {
        RedisRouteContext.setReadOnly(true);
        RediSearchOptions options = RediSearchOptions.builder()
                .query("@points:[20 200]")
                .returnFields(Arrays.asList("user_id", "name", "points", "$.roles")) // 这里的字段是 index 中的字段名
                .dialect(3) // 核心推荐：DIALECT 3，尤其应对这种 $.roles 字段嵌套
                .build();
        List<User> results = searchTemplate.search("idx:sys_user", options, User.class);
        results.forEach(System.out::println);
        RedisRouteContext.clear();
    }

    @Test
    void testSearchWithHighlight() {
        RedisRouteContext.setReadOnly(true);

        // 我们搜索名字中包含 "zhang" 的用户，并对 name 字段进行高亮
        RediSearchOptions options = RediSearchOptions.builder()
                .query("@name:(zhang* | lisi | wang*)")
                .language("chinese") // 指定中文分词
                .returnFields(Arrays.asList("user_id", "name", "$.roles"))
                // 开启高亮
                .highlight(true)
                // 指定需要高亮的字段（必须是 TEXT 类型）
                .highlightFields(Collections.singletonList("name"))
                // 可选：自定义标签，默认是 <b>...</b>
                .highlightTags(new HighlightTags("<span style='color:red'>", "</span>"))
                .dialect(3)
                .build();
        List<User> results = searchTemplate.search("idx:sys_user", options, User.class);

        System.out.println("--- 高亮搜索结果 ---");
        results.forEach(user -> {
            System.out.println("ID: " + user.getId() + ", Name: " + user.getName());
        });

        RedisRouteContext.clear();
    }
}
```

<br>



### 测试3：HASH 高亮

#### 准备索引和文档

```bash
FT.DROPINDEX idx:hash_user
FT.CREATE idx:hash_user ON HASH PREFIX 1 h_user: LANGUAGE chinese SCHEMA
    id TAG
    name TEXT
    points NUMERIC
    description TEXT
    
    
HSET h_user:1 id 101 points 1000 name "张三" description "这位员工名叫张三，他在分布式系统和 Redis 高性能缓存领域有深厚研究。"
HSET h_user:2 id 102 points 3000 name "李四" description "李四是一名资深的 DevOps 工程师，擅长 Docker 和 Kubernetes 自动化部署。"
HSET h_user:3 id 103 points 2000 name "王五" description "王五是一名资深的 Ops 工程师，擅长 Linux 系统。"
HSET h_user:4 id 104 points 1000 name "小娟" description "小娟是一名出色的前台小妹妹。"
HSET h_user:5 id 105 points 4000 name "小花" description "小花是一名漂亮的前端..."
```

<br>



#### 实体准备

```java
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserOnHash {

    private String __key__;

    @JsonAlias({"id", "user_id"})
    private Long id;

    private String name;

    private BigDecimal points;

    // 长文本字段，用于测试 ON HASH 检索高亮
    private String description;
}
```

<br>



#### 测试单元

```java
@SpringBootTest(classes = App.class)
public class RediSearch3Test {

    @Autowired
    private DynamicRediSearchTemplate searchTemplate;

    @Test
    void testHashLongTextHighlight() {
        RedisRouteContext.setReadOnly(true);

        // 搜索包含 "Redis" 或 "Docker" 的描述
        RediSearchOptions options = RediSearchOptions.builder()
                .resultType(RediSearchOptions.ResultType.ON_HASH)
                .query("小娟 | 工程师 | 漂亮")
                .language("chinese")
                .highlight(true)
                // 重点：对 description 字段进行高亮
                .highlightFields(Arrays.asList("name", "description"))
                .highlightTags(new HighlightTags("<b style='color:blue'>", "</b>"))
                //.returnFields(Arrays.asList("id", "name", "description")) // 由于 HGET 返回的信息太简陋，支持的准确性不太好，不建议使用 returnFields！
                .dialect(1)
                .build();

        List<UserOnHash> results = searchTemplate.search("idx:hash_user", options, UserOnHash.class);

        System.out.println("--- HASH 长文本高亮结果 ---");
        results.forEach(user -> {
            System.out.println("User: " + user.getName());
            System.out.println("Description: " + user.getDescription());
            System.out.println("---------------------------");
        });

        RedisRouteContext.clear();
    }
}
```

<br>



### DDL及蓝绿发布测试

```java
@SpringBootTest(classes = App.class)
public class RediSearchDDLTest {

    @Autowired
    private DynamicRediSearchTemplate searchTemplate;

    @Test
    public void testDropIndex() {
        boolean result = searchTemplate.dropIndex("idx:employee", true);
        System.out.println("Index dropped: " + result);
    }

    @Test
    public void testIsIndexExist() {
        boolean result = searchTemplate.isIndexExist("idx:employee");
        System.out.println("Index exists: " + result);
    }

    @Test
    public void testAliasUpdate() {
        boolean result = searchTemplate.aliasUpdate("idx:employee_v1", "idx:employee");
        System.out.println("Index exists: " + result);
    }

    @Test
    public void testAliasDel() {
        boolean result = searchTemplate.aliasDel("idx:employee");
        System.out.println("drop Index result: " + result);
    }
}
```

