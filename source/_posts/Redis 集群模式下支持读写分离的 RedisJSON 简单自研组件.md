title: Redis 支持读写分离的 RedisJSON 客户端组件

author: kinglyjn

mathjax: true

tags:

  - RedisJSON
  - redis
  - springdata
  - mvc
  - lettuce

categories:

  - db_cache

  - redis

date: 2023-02-12 10:42:10

---



### 简单说明

**为什么需要 RedisJSON？**

在没有 RedisJSON 之前，我们要存储一个 User 对象，通常有两种苦逼做法：

* 方案 A（String 序列化）：把整个对象转成 JSON 字符串存入。痛点是如果你只想修改一个字段，你必须本地处理和网络传输整个字符串。在高并发下，这极其浪费带宽且存在并发覆盖风险。
* 方案 B（Hash 散列）：用 Redis Hash 存。痛点是无法处理嵌套结构。如果用户的address是个复杂的嵌套对象，Hash就没辙了。

RedisJSON 的出现： 让你能像操作 MongoDB 一样，直接在 Redis 内部解析、查询和部分修改 JSON 文档。并且 JSON.SET (NX/XX) 更新某个字段是原子的，这完美解决了 “读取-修改-写回” 产生的并发冲突。

<br>



<!--more-->



**避坑指南**

* 索引警告：虽然RedisJSON很快，但如果你对几万个JSON文档进行全量扫描，依然会阻塞单线程。建议配合 RediSearch 模块建立二级索引。

* 内存占用：RedisJSON 在内存中以树状结构（Binary 格式）存储，通常比存储压缩后的字符串要稍微多占用一点空间，但换来的是极高的处理效率。

<br>



### 核心代码

依赖和配置：

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

<!--redis-->
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
  <groupId>org.projectlombok</groupId>
  <artifactId>lombok</artifactId>
  <version>${lombok.version}</version>
  <scope>compile</scope>
  <optional>true</optional>
</dependency>
```

<br>



application.yml

```yaml
spring:
  data:
    redis:
      password: xxxx
      cluster:
        # 建议列出所有种子节点，增加握手成功率
        nodes:
          - 192.168.1.149:7001
          - 192.168.1.149:7002
          - 192.168.1.166:7001
          - 192.168.1.166:7002
          - 192.168.1.224:7001
          - 192.168.1.224:7002
        max-redirects: 3           # 最大重定向次数
      lettuce:
        cluster:
          refresh:
            adaptive: true         # 开启自适应刷新（触发 MOVED/ASK 时）
            period: 60s            # 开启周期性刷新（每隔60秒，Lettuce就发起一次 CLUSTER NODES 全量拓扑刷新）
        pool:
          enabled: true
          max-active: 32           # 最大并发连接数，根据 QPS 调整
          max-idle: 16             # 最大连接数，根据 QPS 调整
          min-idle: 8              # 最小空闲连接
          max-wait: 3000ms         # 连接耗尽时等待时长
      timeout: 2000ms              # 命令超时
      connect-timeout: 3000ms      # 连接超时

logging:
  level:
    com.demo.config.RedisClusterMonitor: info
    io.lettuce.core: info
    org.springframework.data.redis: info
```

<br>



DynamicRedisJsonTemplate

```java
import com.demo.aop.RedisRouteContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.lettuce.core.RedisFuture;
import io.lettuce.core.api.async.BaseRedisAsyncCommands;
import io.lettuce.core.codec.ByteArrayCodec;
import io.lettuce.core.output.IntegerOutput;
import io.lettuce.core.output.StatusOutput;
import io.lettuce.core.protocol.CommandArgs;
import io.lettuce.core.protocol.CommandType;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 专门用于设置和读取 ReJSON-RL 类型数据的 RedisTemplate
 * 基于 RedisJSON 模块提供对JSON文档的原子操作能力
 * 
 * 1. 支持读写分离
 * 2. 支持 JSON.SET NX XX
 * 3. JSONPath 支持：支持部分更新和复杂查询
 * 4. 原子操作：数字递增、数组追加等原子操作
 * 5. 过期时间请结合 {@link DynamicRedisTemplate#opsForValue()} 或 {@link DynamicRedisTemplate#opsForHash()}
 *
 * @author KJ
 * @description
 */
@Component
public class DynamicRedisJsonTemplate extends RedisTemplate<String, Object> {

    private final RedisTemplate<String, Object> masterTemplate;
    private final RedisTemplate<String, Object> slaveTemplate;
    private final ObjectMapper objectMapper;

    public DynamicRedisJsonTemplate(
            @Qualifier("masterRedisTemplate") RedisTemplate<String, Object> masterTemplate,
            @Qualifier("slaveRedisTemplate") RedisTemplate<String, Object> slaveTemplate,
            ObjectMapper objectMapper) {
        this.masterTemplate = masterTemplate;
        this.slaveTemplate = slaveTemplate;
        this.objectMapper = objectMapper;
        // 防御代码：同步序列化器设置，防止父类原生方法（如 getExpire）出现空指针异常
        this.setKeySerializer(masterTemplate.getKeySerializer());
        this.setValueSerializer(masterTemplate.getValueSerializer());
        this.setHashKeySerializer(masterTemplate.getHashKeySerializer());
        this.setHashValueSerializer(masterTemplate.getHashValueSerializer());
        this.setConnectionFactory(masterTemplate.getConnectionFactory());
    }

    /**
     * 核心路由逻辑：基于 ThreadLocal 上下文选择模板
     */
    private RedisTemplate<String, Object> getActualTemplate() {
        return RedisRouteContext.isReadOnly() ? slaveTemplate : masterTemplate;
    }

    // ==================== JSON.SET 相关操作 ====================

    /**
     * 设置 JSON 文档到根路径
     *
     * @param key   Redis key
     * @param value Java 对象，将被序列化为 JSON
     * @return 操作是否成功
     */
    public <T> Boolean jsonSet(@NonNull String key, @NonNull T value) {
        return jsonSet(key, "$", value);
    }

    /**
     * 设置 JSON 文档到指定路径
     *
     * @param key   Redis key
     * @param path  JSONPath 路径（使用 $ 开头表示根路径）
     * @param value Java 对象
     * @return 操作是否成功
     */
    public <T> Boolean jsonSet(@NonNull String key, @NonNull String path, @NonNull T value) {
        try {
            String json = objectMapper.writeValueAsString(value);
            return masterTemplate.execute((RedisCallback<Boolean>) connection -> executeJsonCommand(
                    connection, "JSON.SET",
                    key.getBytes(StandardCharsets.UTF_8),
                    path.getBytes(StandardCharsets.UTF_8),
                    json.getBytes(StandardCharsets.UTF_8)));
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize object to JSON", e);
        }
    }

    /**
     * 设置 JSON 文档，仅当 key 不存在时
     */
    public <T> Boolean jsonSetNX(@NonNull String key, @NonNull T value) {
        try {
            String json = objectMapper.writeValueAsString(value);
            return masterTemplate.execute((RedisCallback<Boolean>) connection -> executeJsonCommand(
                    connection, "JSON.SET",
                    key.getBytes(StandardCharsets.UTF_8),
                    "$".getBytes(StandardCharsets.UTF_8),
                    json.getBytes(StandardCharsets.UTF_8),
                    "NX".getBytes(StandardCharsets.UTF_8)));
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize object to JSON", e);
        }
    }

    /**
     * 设置 JSON 文档，仅当 key 已存在时
     */
    public <T> Boolean jsonSetXX(@NonNull String key, @NonNull T value) {
        try {
            String json = objectMapper.writeValueAsString(value);
            return masterTemplate.execute((RedisCallback<Boolean>) connection -> executeJsonCommand(
                    connection, "JSON.SET",
                    key.getBytes(StandardCharsets.UTF_8),
                    "$".getBytes(StandardCharsets.UTF_8),
                    json.getBytes(StandardCharsets.UTF_8),
                    "XX".getBytes(StandardCharsets.UTF_8)));
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize object to JSON", e);
        }
    }

    // ==================== JSON.GET 相关操作 ====================

    /**
     * 获取整个 JSON 文档
     */
    @Nullable
    public <T> T jsonGet(@NonNull String key, @NonNull Class<T> clazz) {
        return jsonGet(key, "$", clazz);
    }

    /**
     * 获取 JSON 文档的指定路径
     */
    @Nullable
    public <T> T jsonGet(@NonNull String key, @NonNull String path, @NonNull Class<T> clazz) {
        byte[] jsonBytes = getActualTemplate().execute((RedisCallback<byte[]>) connection -> executeJsonGetCommand(
                connection,
                key.getBytes(StandardCharsets.UTF_8),
                path.getBytes(StandardCharsets.UTF_8)));

        if (jsonBytes == null) {
            return null;
        }

        String json = new String(jsonBytes, StandardCharsets.UTF_8);
        if (json.equals("null")) {
            return null;
        }

        try {
            if (path.startsWith("$")) {
                json = extractFirstElement(json);
            }
            return objectMapper.readValue(json, clazz);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to deserialize JSON to object", e);
        }
    }

    /**
     * 获取多个路径的值（以 JSON 字符串形式返回）
     */
    @Nullable
    public String jsonGetMultiPath(@NonNull String key, @NonNull String... paths) {
        byte[] jsonBytes = getActualTemplate().execute((RedisCallback<byte[]>) connection -> {
            byte[][] args = new byte[1 + paths.length][];
            args[0] = key.getBytes(StandardCharsets.UTF_8);
            for (int i = 0; i < paths.length; i++) {
                args[i + 1] = paths[i].getBytes(StandardCharsets.UTF_8);
            }
            return executeJsonGetCommand(connection, args);
        });

        return jsonBytes != null ? new String(jsonBytes, StandardCharsets.UTF_8) : null;
    }

    // ==================== JSON.MGET 批量获取 ====================

    /**
     * 批量获取多个 key 的 JSON 文档
     */
    @NonNull
    public <T> List<T> jsonMGet(@NonNull List<String> keys, @NonNull Class<T> clazz) {
        return jsonMGet(keys, "$", clazz);
    }

    /**
     * 批量获取多个 key 的指定路径
     */
    @NonNull
    public <T> List<T> jsonMGet(@NonNull List<String> keys, @NonNull String path, @NonNull Class<T> clazz) {
        if (keys.isEmpty()) {
            return Collections.emptyList();
        }
        List<byte[]> results = getActualTemplate().execute((RedisCallback<List<byte[]>>) connection ->
                executeJsonMGetCommand(connection, keys, path));
        if (results == null || results.isEmpty()) {
            return Collections.emptyList();
        }
        return results.stream()
                .map(bytes -> {
                    if (bytes == null) {
                        return null;
                    }
                    String json = new String(bytes, StandardCharsets.UTF_8);
                    if (json.equals("null")) {
                        return null;
                    }
                    try {
                        if (path.startsWith("$")) {
                            json = extractFirstElement(json);
                        }
                        return objectMapper.readValue(json, clazz);
                    } catch (JsonProcessingException e) {
                        throw new RuntimeException("Failed to deserialize JSON", e);
                    }
                })
                .collect(Collectors.toList());
    }

    // ==================== JSON.DEL 删除操作 ====================

    /**
     * 删除整个 JSON 文档
     */
    @NonNull
    public Long jsonDel(@NonNull String key) {
        return jsonDel(key, "$");
    }

    /**
     * 删除 JSON 文档的指定路径
     */
    @NonNull
    public Long jsonDel(@NonNull String key, @NonNull String path) {
        Long result = masterTemplate.execute((RedisCallback<Long>) connection -> executeJsonDelCommand(
                connection,
                key.getBytes(StandardCharsets.UTF_8),
                path.getBytes(StandardCharsets.UTF_8)));
        return result != null ? result : 0L;
    }

    // ==================== JSON.TYPE 类型查询 ====================

    /**
     * 获取 JSON 路径的数据类型
     */
    @Nullable
    public String jsonType(@NonNull String key, @NonNull String path) {
        byte[] result = getActualTemplate().execute((RedisCallback<byte[]>) connection -> executeJsonTypeCommand(
                connection,
                key.getBytes(StandardCharsets.UTF_8),
                path.getBytes(StandardCharsets.UTF_8)));
        return result != null ? new String(result, StandardCharsets.UTF_8) : null;
    }

    // ==================== JSON.ARRAPPEND 数组追加 ====================

    /**
     * 向 JSON 数组追加元素
     */
    @SafeVarargs
    public final <T> Long jsonArrAppend(@NonNull String key, @NonNull String path, @NonNull T... values) {
        try {
            byte[][] jsonValues = new byte[values.length][];
            for (int i = 0; i < values.length; i++) {
                jsonValues[i] = objectMapper.writeValueAsString(values[i]).getBytes(StandardCharsets.UTF_8);
            }

            Long result = masterTemplate.execute((RedisCallback<Long>) connection -> {
                byte[][] args = new byte[2 + jsonValues.length][];
                args[0] = key.getBytes(StandardCharsets.UTF_8);
                args[1] = path.getBytes(StandardCharsets.UTF_8);
                System.arraycopy(jsonValues, 0, args, 2, jsonValues.length);

                return executeJsonArrAppendCommand(connection, args);
            });
            return result != null ? result : 0L;
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize values", e);
        }
    }

    // ==================== JSON.ARRLEN 数组长度 ====================

    /**
     * 获取 JSON 数组的长度
     */
    @Nullable
    public Long jsonArrLen(@NonNull String key, @NonNull String path) {
        return getActualTemplate().execute((RedisCallback<Long>) connection -> executeJsonArrLenCommand(
                connection,
                key.getBytes(StandardCharsets.UTF_8),
                path.getBytes(StandardCharsets.UTF_8)));
    }

    // ==================== JSON.NUMINCRBY 数字递增 ====================

    /**
     * 对 JSON 中的数字字段进行原子递增
     */
    @Nullable
    public Double jsonNumIncrBy(@NonNull String key, @NonNull String path, double increment) {
        return masterTemplate.execute((RedisCallback<Double>) connection -> executeJsonNumIncrByCommand(
                connection,
                key.getBytes(StandardCharsets.UTF_8),
                path.getBytes(StandardCharsets.UTF_8),
                String.valueOf(increment).getBytes(StandardCharsets.UTF_8)));
    }

    // ==================== JSON.STRLEN 字符串长度 ====================

    /**
     * 获取 JSON 字符串的长度
     */
    @Nullable
    public Long jsonStrLen(@NonNull String key, @NonNull String path) {
        return getActualTemplate().execute((RedisCallback<Long>) connection -> executeJsonStrLenCommand(
                connection,
                key.getBytes(StandardCharsets.UTF_8),
                path.getBytes(StandardCharsets.UTF_8)));
    }

    // ==================== JSON.OBJLEN 对象键数量 ====================

    /**
     * 获取 JSON 对象的键数量
     */
    @Nullable
    public Long jsonObjLen(@NonNull String key, @NonNull String path) {
        return getActualTemplate().execute((RedisCallback<Long>) connection -> executeJsonObjLenCommand(
                connection,
                key.getBytes(StandardCharsets.UTF_8),
                path.getBytes(StandardCharsets.UTF_8)));
    }

    // ==================== 底层命令执行方法 ====================

    /**
     * 获取原生 Lettuce Cluster 异步命令对象
     * 处理动态代理对象的情况
     */
    @SuppressWarnings("unchecked")
    private BaseRedisAsyncCommands<byte[], byte[]> getAsyncCommands(RedisConnection connection) {
        Object nativeConnection = connection.getNativeConnection();
        if (nativeConnection instanceof BaseRedisAsyncCommands) {
            return (BaseRedisAsyncCommands<byte[], byte[]>) nativeConnection;
        } else {
            throw new UnsupportedOperationException("Cannot get BaseRedisAsyncCommands from connection type: " + connection.getClass().getName());
        }
    }

    /**
     * 执行返回 OK 状态的 JSON 命令（如 JSON.SET）
     */
    private Boolean executeJsonCommand(RedisConnection connection, String command, byte[]... args) {
        try {
            BaseRedisAsyncCommands<byte[], byte[]> commands = getAsyncCommands(connection);
            CommandArgs<byte[], byte[]> cmdArgs = new CommandArgs<>(ByteArrayCodec.INSTANCE);
            for (byte[] arg : args) {
                cmdArgs.add(arg);
            }
            RedisFuture<String> future = commands.dispatch(
                    CommandType.valueOf(command.replace(".", "_")), // 将命令转换为 Lettuce 命令类型，如 JSON.SET 转换为 JSON_SET
                    new StatusOutput<>(ByteArrayCodec.INSTANCE),
                    cmdArgs
            );
            String result = future.get();
            return "OK".equals(result);
        } catch (InterruptedException | ExecutionException e) {
            throw new RuntimeException("Failed to execute " + command, e);
        }
    }

    /**
     * 执行 JSON.GET 命令
     */
    private byte[] executeJsonGetCommand(RedisConnection connection, byte[]... args) {
        try {
            BaseRedisAsyncCommands<byte[], byte[]> commands = getAsyncCommands(connection);
            CommandArgs<byte[], byte[]> cmdArgs = new CommandArgs<>(ByteArrayCodec.INSTANCE);
            for (byte[] arg : args) {
                cmdArgs.add(arg);
            }
            RedisFuture<byte[]> future = commands.dispatch(
                    CommandType.valueOf("JSON_GET"),
                    new io.lettuce.core.output.ByteArrayOutput<>(ByteArrayCodec.INSTANCE),
                    cmdArgs
            );
            return future.get();
        } catch (InterruptedException | ExecutionException e) {
            throw new RuntimeException("Failed to execute JSON.GET", e);
        }
    }

    /**
     * 执行 JSON.MGET 命令
     */
    @SuppressWarnings("unchecked")
    private List<byte[]> executeJsonMGetCommand(RedisConnection connection, List<String> keys, String path) {
        try {
            BaseRedisAsyncCommands<byte[], byte[]> commands = getAsyncCommands(connection);

            CommandArgs<byte[], byte[]> cmdArgs = new CommandArgs<>(ByteArrayCodec.INSTANCE);
            for (String key : keys) {
                cmdArgs.add(key.getBytes(StandardCharsets.UTF_8));
            }
            cmdArgs.add(path.getBytes(StandardCharsets.UTF_8));

            io.lettuce.core.output.ArrayOutput<byte[], byte[]> output =
                    new io.lettuce.core.output.ArrayOutput<>(ByteArrayCodec.INSTANCE);

            RedisFuture<List<Object>> future = commands.dispatch(
                    CommandType.valueOf("JSON_MGET"),
                    output,
                    cmdArgs
            );

            List<Object> resultList = future.get();
            if (resultList == null) {
                return Collections.emptyList();
            }

            return resultList.stream()
                    .map(obj -> obj != null ? (byte[]) obj : null)
                    .collect(Collectors.toList());
        } catch (InterruptedException | ExecutionException e) {
            throw new RuntimeException("Failed to execute JSON.MGET", e);
        }
    }

    /**
     * 执行 JSON.DEL 命令
     */
    private Long executeJsonDelCommand(RedisConnection connection, byte[]... args) {
        try {
            BaseRedisAsyncCommands<byte[], byte[]> commands = getAsyncCommands(connection);

            CommandArgs<byte[], byte[]> cmdArgs = new CommandArgs<>(ByteArrayCodec.INSTANCE);
            for (byte[] arg : args) {
                cmdArgs.add(arg);
            }

            RedisFuture<Long> future = commands.dispatch(
                    CommandType.valueOf("JSON_DEL"),
                    new IntegerOutput<>(ByteArrayCodec.INSTANCE),
                    cmdArgs
            );

            return future.get();
        } catch (InterruptedException | ExecutionException e) {
            throw new RuntimeException("Failed to execute JSON.DEL", e);
        }
    }

    /**
     * 执行 JSON.TYPE 命令
     */
    private byte[] executeJsonTypeCommand(RedisConnection connection, byte[]... args) {
        try {
            BaseRedisAsyncCommands<byte[], byte[]> commands = getAsyncCommands(connection);

            CommandArgs<byte[], byte[]> cmdArgs = new CommandArgs<>(ByteArrayCodec.INSTANCE);
            for (byte[] arg : args) {
                cmdArgs.add(arg);
            }

            RedisFuture<byte[]> future = commands.dispatch(
                    CommandType.valueOf("JSON_TYPE"),
                    new io.lettuce.core.output.ByteArrayOutput<>(ByteArrayCodec.INSTANCE),
                    cmdArgs
            );

            return future.get();
        } catch (InterruptedException | ExecutionException e) {
            throw new RuntimeException("Failed to execute JSON.TYPE", e);
        }
    }

    /**
     * 执行 JSON.ARRAPPEND 命令
     */
    private Long executeJsonArrAppendCommand(RedisConnection connection, byte[]... args) {
        try {
            BaseRedisAsyncCommands<byte[], byte[]> commands = getAsyncCommands(connection);

            CommandArgs<byte[], byte[]> cmdArgs = new CommandArgs<>(ByteArrayCodec.INSTANCE);
            for (byte[] arg : args) {
                cmdArgs.add(arg);
            }

            RedisFuture<Long> future = commands.dispatch(
                    CommandType.valueOf("JSON_ARRAPPEND"),
                    new IntegerOutput<>(ByteArrayCodec.INSTANCE),
                    cmdArgs
            );

            return future.get();
        } catch (InterruptedException | ExecutionException e) {
            throw new RuntimeException("Failed to execute JSON.ARRAPPEND", e);
        }
    }

    /**
     * 执行 JSON.ARRLEN 命令
     */
    private Long executeJsonArrLenCommand(RedisConnection connection, byte[]... args) {
        try {
            BaseRedisAsyncCommands<byte[], byte[]> commands = getAsyncCommands(connection);

            CommandArgs<byte[], byte[]> cmdArgs = new CommandArgs<>(ByteArrayCodec.INSTANCE);
            for (byte[] arg : args) {
                cmdArgs.add(arg);
            }

            RedisFuture<Long> future = commands.dispatch(
                    CommandType.valueOf("JSON_ARRLEN"),
                    new IntegerOutput<>(ByteArrayCodec.INSTANCE),
                    cmdArgs
            );

            return future.get();
        } catch (InterruptedException | ExecutionException e) {
            throw new RuntimeException("Failed to execute JSON.ARRLEN", e);
        }
    }

    /**
     * 执行 JSON.NUMINCRBY 命令
     */
    private Double executeJsonNumIncrByCommand(RedisConnection connection, byte[]... args) {
        try {
            BaseRedisAsyncCommands<byte[], byte[]> commands = getAsyncCommands(connection);

            CommandArgs<byte[], byte[]> cmdArgs = new CommandArgs<>(ByteArrayCodec.INSTANCE);
            for (byte[] arg : args) {
                cmdArgs.add(arg);
            }

            RedisFuture<Double> future = commands.dispatch(
                    CommandType.valueOf("JSON_NUMINCRBY"),
                    new io.lettuce.core.output.DoubleOutput<>(ByteArrayCodec.INSTANCE),
                    cmdArgs
            );
            return future.get();
        } catch (InterruptedException | ExecutionException e) {
            throw new RuntimeException("Failed to execute JSON.NUMINCRBY", e);
        }
    }

    /**
     * 执行 JSON.STRLEN 命令
     */
    private Long executeJsonStrLenCommand(RedisConnection connection, byte[]... args) {
        try {
            BaseRedisAsyncCommands<byte[], byte[]> commands = getAsyncCommands(connection);

            CommandArgs<byte[], byte[]> cmdArgs = new CommandArgs<>(ByteArrayCodec.INSTANCE);
            for (byte[] arg : args) {
                cmdArgs.add(arg);
            }

            RedisFuture<Long> future = commands.dispatch(
                    CommandType.valueOf("JSON_STRLEN"),
                    new IntegerOutput<>(ByteArrayCodec.INSTANCE),
                    cmdArgs
            );

            return future.get();
        } catch (InterruptedException | ExecutionException e) {
            throw new RuntimeException("Failed to execute JSON.STRLEN", e);
        }
    }

    /**
     * 执行 JSON.OBJLEN 命令
     */
    private Long executeJsonObjLenCommand(RedisConnection connection, byte[]... args) {
        try {
            BaseRedisAsyncCommands<byte[], byte[]> commands = getAsyncCommands(connection);

            CommandArgs<byte[], byte[]> cmdArgs = new CommandArgs<>(ByteArrayCodec.INSTANCE);
            for (byte[] arg : args) {
                cmdArgs.add(arg);
            }

            RedisFuture<Long> future = commands.dispatch(
                    CommandType.valueOf("JSON_OBJLEN"),
                    new IntegerOutput<>(ByteArrayCodec.INSTANCE),
                    cmdArgs
            );

            return future.get();
        } catch (InterruptedException | ExecutionException e) {
            throw new RuntimeException("Failed to execute JSON.OBJLEN", e);
        }
    }

    /**
     * 从 JSONPath 查询结果中提取第一个元素
     */
    private String extractFirstElement(String json) {
        if (json == null || json.isEmpty()) {
            return json;
        }
        if (json.startsWith("[") && json.endsWith("]")) {
            json = json.substring(1, json.length() - 1);
        }
        return json;
    }

    // ==================== 其他辅助方法 ====================

    /**
     * 检查 key 是否存在
     */
    public Boolean exists(@NonNull String key) {
        return getActualTemplate().hasKey(key);
    }

    /**
     * 删除 key（使用主库）
     */
    public Boolean delete(@NonNull String key) {
        return masterTemplate.delete(key);
    }

    /**
     * 批量删除 key（使用主库）
     */
    public Long delete(@NonNull Collection<String> keys) {
        return masterTemplate.delete(keys);
    }

    /**
     * 设置过期时间
     */
    public Boolean expire(@NonNull String key, long timeout, TimeUnit unit) {
        return masterTemplate.expire(key, timeout, unit);
    }

    /**
     * 设置到什么时间过期
     */
    public Boolean expireAt(@NonNull String key, Date date) {
        return masterTemplate.expireAt(key, date);
    }
}
```

<br>



### 使用和测试类

User

```java
@Data
public class User {
    private Long id;
    private String name;
    private Integer points;
    private List<Role> roles;
}

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class Role {
    private Long id;
    private String name;
    private Integer orderNum;
    private List<String> permissions;
}
```

<br>



UserService

```java
/**
 * @author KJ
 * @description
 */
@Service
public class UserService {

    @Resource
    private DynamicRedisJsonTemplate dynamicRedisJsonTemplate;

    /**
     * 示例 1: 保存完整对象
     */
    public Boolean saveUser(User user) {
        return dynamicRedisJsonTemplate.jsonSet("user:" + user.getId(), user);
    }

    public Boolean saveUserNX(User user) {
        return dynamicRedisJsonTemplate.jsonSetNX("user:" + user.getId(), user);
    }

    public Boolean saveUserXX(User user) {
        return dynamicRedisJsonTemplate.jsonSetXX("user:" + user.getId(), user);
    }

    /**
     * 示例 2: 读取对象（从库）
     */
    @RedisReadOnly
    public User getUser(Long userId) {
        try {
            return dynamicRedisJsonTemplate.jsonGet("user:" + userId, User.class);
        } finally {
            RedisRouteContext.clear();
        }
    }

    public String getUserNameRoleNamePermissionList(Long userId) {
        // {"$.roles[0].permissions":[["system:user:view","system:user:save"]],"$.name":["zhangsan"],"$.roles[0].name":["haha"]}
        return dynamicRedisJsonTemplate.jsonGetMultiPath("user:" + userId, "$.name", "$.roles[0].name", "$.roles[0].permissions");
    }

    /**
     * 示例 3: 更新部分字段
     */
    public Boolean updateUserName(Long userId, String newName) {
        return dynamicRedisJsonTemplate.jsonSet("user:" + userId, "$.name", newName);
    }

    public Boolean updateFirstRoleName(Long userId, String newRoleName) {
        return dynamicRedisJsonTemplate.jsonSet("user:" + userId, "$.roles[0].name", newRoleName);
    }

    /**
     * 示例 4: 数字字段原子递增（如积分）
     */
    public Double incrementUserPoints(Long userId, double points) {
        return dynamicRedisJsonTemplate.jsonNumIncrBy("user:" + userId, "$.points", points);
    }

    /**
     * 示例 5: 数组操作（添加角色）
     */
    public void addUserRoles(Long userId, String... roles) {
        dynamicRedisJsonTemplate.jsonArrAppend("user:" + userId, "$.roles", (Object[]) roles);
    }

    /**
     * 示例 6: 批量获取
     */
    public List<User> batchGetUsers(List<Long> userIds) {
        RedisRouteContext.setReadOnly(true);
        try {
            List<String> keys = userIds.stream()
                    .map(id -> "user:" + id)
                    .collect(Collectors.toList());
            return dynamicRedisJsonTemplate.jsonMGet(keys, User.class);
        } finally {
            RedisRouteContext.clear();
        }
    }

    /**
     * 示例 6: 删除用户文档
     */
    public Long deleteById(Long userId) {
        return dynamicRedisJsonTemplate.jsonDel("user:" + userId);
    }

    /**
     * 示例 7: 获取角色的数据类型
     */
    public String getFirstRoleType(Long userId) {
        return dynamicRedisJsonTemplate.jsonType("user:" + userId, "$.roles[0]");
    }

    /**
     * 示例 8: 数组追加元素
     */
    public Long appendPermission(Long id, List<String> permissions) {
        return dynamicRedisJsonTemplate.jsonArrAppend("user:" + id, "$.roles[0].permissions", permissions.toArray());
    }

    /**
     * 示例 9: 获取数组长度
     */
    public Long countPermission(Long id) {
        return dynamicRedisJsonTemplate.jsonArrLen("user:" + id, "$.roles[0].permissions");
    }

    public Long userFieldsLength(Long userId) {
        return dynamicRedisJsonTemplate.jsonObjLen("user:" + userId, "$");
    }

    public Long firstRoleNameStrLength(Long userId) {
        return dynamicRedisJsonTemplate.jsonStrLen("user:" + userId, "$.roles[0].name");
    }
}
```

<br>