title: Redis 基于 RedisJSON 的缓存方案

author: kinglyjn

mathjax: true

tags:

  - redis
  - cache
  - cap_base
  - lock
  - lettuce

categories:

  - db_cache

  - redis

date: 2023-03-01 14:12:52

---



## 方案介绍

### 数据选型

首先声明：以下我要介绍的这套缓存方案，它的缓存数据是基于 RedisJSON 实现的。之所以选择 RedisJSON 而非传统的 String (Plain KV)，本质上是从把 Redis 当成一个简单的缓存盒子进化到了 把 Redis 当成一个**可索引的文档数据库**。这使得它具备如下的核心优势： <!--more-->

* **文档局部更新能力**：普通 KV 如果你只想修改 EmployeeDoc 里的 salary 字段，你必须先 GET 整个对象，反序列化，修改值，再 SET 回去。这存在并发覆盖风险（ABA问题）且浪费带宽。而 RedisJSON 可以直接执行 "JSON.SET key $.salary 5000"。它是原子性的局部更新，只传输改变的字段，性能极高。
* **深度查询与索引（与RediSearch 联动）**：普通 KV 缓存是黑盒。除非你知道确定的 Key，否则无法搜出 “所有工资 > 5000 的员工”，除非你把所有数据拉到 Java 内存里过滤。而 RedisJSON 配合 RediSearch，可以直接对 JSON 内部的属性建立索引。你可以像 SQL 一样查询缓存：FT.SEARCH idx:emp "@salary:[5000 +inf]"。
* **减少应用端的序列化负担**：普通 KV 应用端每次读写都要进行繁重的 JSON 序列化/反序列化（Jackson/Fastjson）。RedisJSON 数据以二进制树状结构存在 Redis 内存中。Redis 负责解析路径，应用端在很多场景下可以直接获取部分片段，减轻了 CPU 压力。

当然，任何事情都是有代价的，使用 RedisJSON 的代价是：

* 内存开销稍大：普通 String 只是存储原始字节。RedisJSON 为了支持快速路径访问，会在内存中维护一个树状结构（JAX解析树）。这通常比纯 String 存储多消耗 **10% - 30%** 的内存。
* 模块依赖性：Redis 原生并不自带 JSON 功能。你必须确保你的 Redis 环境安装了 RedisStack 或手动加载了 RedisJSON 模块。这在某些受到严格限制的云托管 Redis 服务上可能无法使用。
* 客户端选型限制：传统的 Jedis 或老版本的 Lettuce 对 RedisJSON 指令支持并不全。需要像你定制化开发，使用 masterRedisTemplate.execute() 配合 Lua 脚本或者专门的客户端驱动。

<br>



### 技术设计

这套缓存架构的设计哲学是 `非侵入式的防御性缓存架构`，其核心逻辑可以用 `1-2-3 模式` 概括：

**1 个核心目标**：在保障 RedisJSON 高性能检索的同时，维护数据的一致性与 DB 的安全性。

**2 个解耦切面**：

- **读切面 (Reading)**：策略为 *Cache-Aside*。内置 “滑动窗口续期” 与 “双重检查锁定”。
- **写切面 (Writing)**：策略为 *Write-Behind / Evict*。支持异步双写与强制失效。

**3 重防御机制**：

- **防穿透**：空对象占位符隔离无效请求。
- **防击穿**：分段锁控制回源频率。
- **防雪崩**：通过不同方法的 TTL 配置实现过期时间微扰。

<br>

此外关于并发安全，我放弃了性能较差的 `synchronized(this)`，也没有使用可能导致内存风险的 `synchronized (redisKey.intern())`，而是引入了 **Guava 的 Striped 分段锁** 来实现 key 级别的细粒度并发控制，这让系统在热点数据失效时，依然能保持个位数的 DB 回源压力。

关于性能优化，我利用了 Redis Lua 脚本将 JSON.SET 和 EXPIRE 封装为原子操作，并通过 StringRedisTemplate  解决了 Spring Data Redis 常见的二次序列化（转义引号）问题。

这套方案是完全声明式的。业务开发人员只需要在 Service 方法上挂一个注解，配置 SpEL 表达式，所有的缓存同步、异步回填、异常重试逻辑都会在切面中自动完成，代码侵入性几乎为零。

好了，废话不多少，直接上菜。

<br>



## 核心代码

### 缓存切面

#### 写缓存切面

主要功能：处理数据的增删改，数据新增时同步缓存，数据更新或删除时移除过期缓存

```java
import com.demo.componet.DynamicRedisJsonTemplate;
import com.demo.componet.RedisLuaExecutor;
import com.demo.componet.jsoncache.RedisJsonWritingCache;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import java.util.concurrent.CompletableFuture;

/**
 * RedisJSON 写缓存切面
 * 处理数据的增删改，数据新增时同步缓存，数据更新或删除时移除过期缓存
 *
 * @author KJ
 */
@Aspect
@Order(10)
@Component
@Slf4j
public class RedisCacheForWritingAspect {

    @Resource
    private DynamicRedisJsonTemplate dynamicRedisJsonTemplate;
    @Resource
    private RedisLuaExecutor redisLuaExecutor;

    /**
     * 环绕通知：处理数据同步
     */
    @Around("@annotation(writingCache)")
    public Object syncCache(ProceedingJoinPoint joinPoint, RedisJsonWritingCache writingCache) throws Throwable {
        // 1. 执行原业务逻辑 (写数据库)
        Object result = joinPoint.proceed();

        // 2. 获取实体对象和 Key
        String id = SpringExpressionUtils.parseSpel(writingCache.keyExpression(), joinPoint);
        String redisKey = writingCache.prefix() + id;

        if (writingCache.evict()) {
            // 移除缓存
            dynamicRedisJsonTemplate.delete(redisKey);
            log.info("RedisJsonCache Evict | Key: {}", redisKey);
        } else if (result != null){
            // 异步同步缓存
            CompletableFuture.runAsync(() -> {
                boolean success;
                if (writingCache.expireTime() == -1) {
                    success = dynamicRedisJsonTemplate.jsonSet(redisKey, result);
                } else {
                    success = redisLuaExecutor.jsonSetAndExpire(redisKey, result, writingCache.expireTime());
                }
                if (success) {
                    log.debug("RedisJsonCache Sync Success | Key: {}, expireTime: {}", redisKey, writingCache.expireTime());
                }
            });
        }
        return result;
    }
}
```

<br>



#### 读缓存切面

主要功能：处理数据的读取，先读缓存数据，缓存中不存在则查库，并且将查询结果缓存起来。

```java
import com.demo.componet.DynamicRedisJsonTemplate;
import com.demo.componet.RedisLuaExecutor;
import com.demo.componet.jsoncache.RedisJsonReadingCache;
import com.google.common.util.concurrent.Striped;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import java.util.Map;
import java.util.concurrent.locks.Lock;

/**
 * RedisJSON 读缓存切面
 * 处理数据的读取，先读缓存数据，缓存中不存在则查库，并且将查询结果缓存起来；
 *
 * 缓存穿透处理：如果数据库数据也不存在，则对该数据适当进行缓存穿透处理
 * 缓存击穿处理：【双重检查锁 DCL 实现】，解决某个热点Key过期，瞬间大量相同Key请求过来的问题
 *
 * @author KJ
 */
@Aspect
@Order(10)
@Component
@Slf4j
public class RedisCacheForReadingAspect {

    @Resource
    private RedisLuaExecutor redisLuaExecutor;

    @Resource
    private DynamicRedisJsonTemplate dynamicRedisJsonTemplate;
    private static final String PROTECTED_PLACEHOLDER = "{}";

    /**
     * 虽然 synchronized (redisKey.intern()) 能确保相同key的请求才竞争同一把锁，
     * 它的性能也比 synchronized(this) 的性能高出几个数量级，但存在字符串常量池被撑爆的风险！
     * 我们这里使用 Guava 的 Striped 锁，它是基于 ConcurrentHashMap 的分段锁管理器，在内存占用和并发粒度之间取得了完美的平衡。
     * Striped 内部使用了类似于哈希表的桶机制。无论你的业务 Key 有多少（千万级或亿级），锁对象的数量始终固定在这里设定的1024个，不会像 intern() 那样撑爆内存。
     *
     * 创建 1024 个弱引用分段锁。
     * 1. 1024 个桶位足以支撑极高的并发，减少锁碰撞几率。
     * 2. 使用 lock() 而不是 lazyWeakLock() 可以保证在压力大时锁的稳定性。
     */
    private final Striped<Lock> stripedLocks = Striped.lock(1024);


    @Around("@annotation(readingCache)")
    public Object readCacheHandler(ProceedingJoinPoint joinPoint, RedisJsonReadingCache readingCache) throws Throwable {
        // 提取 Key
        String id = SpringExpressionUtils.parseSpel(readingCache.keyExpression(), joinPoint);
        String redisKey = readingCache.prefix() + id;

        // 获取方法返回类型（用于反序列化）
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Class<?> returnType = signature.getReturnType();

        // --- 第一重检查：尝试从缓存读取 ---
        Object cacheData = dynamicRedisJsonTemplate.jsonGet(redisKey, returnType);
        if (cacheData != null) {
            if (isPlaceholder(cacheData)) return null;
            return cacheData;
        }

        // --- 缓存未命中，进入双重检查锁定区间 ---
        // 单机环境下：这里的锁完是美的，绝对能保证只有一个请求打到数据库。
        // 集群环境下（多节点部署）：这里的锁只能锁住当前 JVM 进程。如果有 10 个节点并行运行，当一个热点 Key 失效时，每个节点都会有一个请求穿透到数据库。
        // 对于大多数中型项目，10 次请求对数据库（MySQL/Oracle）来说只是毛毛雨。只要能拦截住 99% 的请求，它就是合适的。
        Lock lock = stripedLocks.get(redisKey);
        lock.lock();
        try {
            // --- 第二重检查（DCL）：再次尝试从缓存读取 ---
            cacheData = dynamicRedisJsonTemplate.jsonGet(redisKey, returnType);
            if (cacheData != null) {
                if (isPlaceholder(cacheData)) return null;
                return cacheData;
            }

            // 缓存未命中，执行原方法（查库）
            Object dbResult = joinPoint.proceed();

            // 数据回填逻辑
            if (dbResult != null) {
                if (readingCache.expireTime() > 0) {
                    redisLuaExecutor.jsonSetAndExpire(redisKey, dbResult, readingCache.expireTime());
                } else {
                    dynamicRedisJsonTemplate.jsonSet(redisKey, result);
                }
            } else if (readingCache.preventPenetration()) {
                // --- 核心：穿透处理 ---
                // 存入空对象占位符 "{}"，设置较短的 preventTtl
                redisLuaExecutor.jsonSetAndExpire(redisKey, PROTECTED_PLACEHOLDER, readingCache.preventTtl());
            }
            return dbResult;
        } finally {
            // 确保锁被释放
            lock.unlock();
        }
    }

    /**
     * 判定是否为防穿透的空值占位符
     * 逻辑：RedisJSON 存储 "{}" 后，读取出来可能是空的 Map 或特定字符串
     */
    private boolean isPlaceholder(Object data) {
        if (data instanceof String) {
            return PROTECTED_PLACEHOLDER.equals(data);
        }
        if (data instanceof Map) {
            return ((Map<?, ?>) data).isEmpty();
        }
        return false;
    }
}
```

<br>



#### SpringEL支持

```java
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.context.expression.MethodBasedEvaluationContext;
import org.springframework.core.DefaultParameterNameDiscoverer;
import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import java.lang.reflect.Method;

/**
 * @author KJ
 * @description
 */
public class SpringExpressionUtils {

    private static final ExpressionParser PARSER = new SpelExpressionParser();
    private static final DefaultParameterNameDiscoverer PARAMETER_NAME_DISCOVERER = new DefaultParameterNameDiscoverer();

    /**
     * 使用 Spring Expression Language
     * 精准地从方法参数中提取 ID（如 #emp.id 或 #id）
     */
    public static String parseSpel(String expression, JoinPoint joinPoint) {
        // 1. 获取被拦截方法的信息
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        Object[] args = joinPoint.getArgs();

        // 2. 创建上下文，并绑定方法参数名和值
        // MethodBasedEvaluationContext 能自动处理 #argName 这种形式
        MethodBasedEvaluationContext context = new MethodBasedEvaluationContext(joinPoint.getTarget(), method, args, PARAMETER_NAME_DISCOVERER);

        // 3. 解析表达式并求值
        Expression exp = PARSER.parseExpression(expression);
        Object value = exp.getValue(context);
        return value != null ? value.toString() : "";
    }
}
```

<br>



#### Lua 脚本支持

```java
/**
 * Redis Lua 脚本执行器
 *
 * 避坑指南：
 * 在 Redis Cluster 环境下执行 Lua 脚本有一个硬性限制：那就是脚本涉及的所有 KEYS 必须位于同一个哈希槽（Slot）中，
 * 否则会抛出 cross slot keys in request don't hash to the same slot 错误。
 *
 * 如果你的业务需要同时操作两个 Key，请确保它们带有相同的标识。
 * 例如 order:{1001}:info 和 stock:{1001}:detail 这两个Key 都会被哈希到同一个 Slot，从而支持 Lua 的原子性操作。
 *
 * @author KJ
 * @description
 */
@Component
public class RedisLuaExecutor {
    private static final Logger log = LoggerFactory.getLogger(RedisLuaExecutor.class);

    // 显式注入 Master 模板，因为 Lua 脚本通常涉及写操作
    private final RedisTemplate<String, Object> masterTemplate;
    private final StringRedisTemplate masterStringRedisTemplate;
    // 显式注入 ObjectMapper
    private final ObjectMapper objectMapper;
    public RedisLuaExecutor(@Qualifier("masterRedisTemplate") RedisTemplate<String, Object> masterTemplate,
                            @Qualifier("masterStringRedisTemplate") StringRedisTemplate masterStringRedisTemplate,
                            ObjectMapper objectMapper) {
        this.masterTemplate = masterTemplate;
        this.masterStringRedisTemplate = masterStringRedisTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * 脚本：原子设置JSON数据并设置TTL
     */
    public static final String JSON_SET_AND_EXPIRE_LUA = "redis.call('JSON.SET', KEYS[1], '$', ARGV[1]); " +
                    "return redis.call('EXPIRE', KEYS[1], ARGV[2]);"; // 返回 expire 的结果 (1 或 0)
    private static final DefaultRedisScript<Long> JSON_SET_AND_EXPIRE_SCRIPT;

    /**
     * 脚本：获取数据并重置过期时间
     * 返回：[JSON字符串, EXPIRE结果]
     */
    private static final String JSON_GET_AND_TOUCH_LUA = "local val = redis.call('JSON.GET', KEYS[1]); " +
                    " if (val and val ~= 'null') then " +
                    "   redis.call('EXPIRE', KEYS[1], ARGV[1]); " +
                    "end; " +
                    "return val;";
    private static final DefaultRedisScript<Map> JSON_GET_AND_TOUCH_SCRIPT;


    static {
        // 预热脚本实例，避免重复解析
        JSON_SET_AND_EXPIRE_SCRIPT = new DefaultRedisScript<>();
        JSON_SET_AND_EXPIRE_SCRIPT.setScriptText(JSON_SET_AND_EXPIRE_LUA);
        JSON_SET_AND_EXPIRE_SCRIPT.setResultType(Long.class);

        JSON_GET_AND_TOUCH_SCRIPT = new DefaultRedisScript<>(JSON_GET_AND_TOUCH_LUA, Map.class);
    }

    /**
     * 业务功能：原子设置JSON数据并设置TTL
     */
    public boolean jsonSetAndExpire(String key, String jsonValue, Long ttl) {
        // StringRedisTemplate 由于使用了 StringRedisSerializer，它强制要求传入的所有参数必须都是 String 类型。
        Long result = masterStringRedisTemplate.execute(JSON_SET_AND_EXPIRE_SCRIPT, Collections.singletonList(key), jsonValue, String.valueOf(ttl));
        return Long.valueOf(1).equals(result);
    }

    /**
     * 业务功能：原子设置JSON数据并设置TTL
     */
    public <T> boolean jsonSetAndExpire(String key, T value, Long ttl) {
        Long result = masterTemplate.execute(JSON_SET_AND_EXPIRE_SCRIPT, Collections.singletonList(key), value, ttl);
        return Long.valueOf(1).equals(result);
    }

    /**
     * 业务功能：获取数据并重置过期时间
     */
    public <T> T jsonGetAndTouch(String key, Long ttl, Class<T> clazz) {
        try {
            Map<?, ?> resultMap = masterTemplate.execute(JSON_GET_AND_TOUCH_SCRIPT, Collections.singletonList(key), ttl); // {} --> map.size() == 0
            return objectMapper.convertValue(resultMap, clazz); // 利用 Jackson 的 convertValue 将 Map 优雅地转换为 POJO，这比手动转换更安全，且支持复杂的泛型嵌套
        } catch (Exception e) {
            log.error("Lua jsonGetAndTouch Error | key: {}", key, e);
            return null;
        }
    }

    public <T> T jsonGetAndTouch(String key, Long ttl, TypeReference<T> type) {
        try {
            Map<?, ?> resultMap = masterTemplate.execute(JSON_GET_AND_TOUCH_SCRIPT, Collections.singletonList(key), ttl); // {} --> map.size() == 0
            return objectMapper.convertValue(resultMap, type);
        } catch (Exception e) {
            log.error("Lua jsonGetAndTouch Error | key: {}", key, e);
            return null;
        }
    }
}
```

<br>



### 核心应用组件

RedisJsonWritingCache：

```java
/**
 * @author KJ
 * @description RedisJSON 写缓存注解
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RedisJsonWritingCache {
    String prefix();               // Redis Key 前缀，如 "employee:"
    String keyExpression();        // SpEL 表达式，用于提取 ID，如 "#employee.id"
    long expireTime() default -1;  // 缓存过期时间（秒），默认 -1 表示不设置
    boolean evict() default true;  // 是否强制删除缓存，强烈建议数据更新、删除时为true
}
```

<br>

RedisJsonReadingCache：

```java
/**
 * @author KJ
 * @description 缓存读取注解
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RedisJsonReadingCache {
    String prefix();               // Redis Key 前缀，如 "employee:"
    String keyExpression();        // SpEL 表达式，用于提取 ID，如 "#employee.id"
    long expireTime() default -1;  // 缓存过期时间（秒），默认 -1 表示不设置

    // --- 防穿透配置 ---
    boolean preventPenetration() default true; // 默认开启
    long preventTtl() default 10;              // 空值缓存时间（秒），建议设短一点
}
```

<br>



## 相关测试代码

### 实体演示类

```java
@Data
@JsonIgnoreProperties(ignoreUnknown = true) 
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

### 业务演示类

```java
/**
 * @author KJ
 */
@Service
public class EmployeeService {

    @Resource
    private DynamicRediSearchTemplate searchTemplate;

    @RedisJsonWritingCache(prefix = "emp:", keyExpression = "#emp.id", evict = false, expireTime = 900L)
    public EmployeeDoc saveEmployee(EmployeeDoc emp) {
        // 这里只管写 DB，AOP 会自动同步到 RedisJSON 并更新 RediSearch 索引
        return repositorySave(emp);
    }

    @RedisJsonWritingCache(prefix = "emp:", keyExpression = "#emp.id", evict = true)
    public EmployeeDoc updateEmployee(EmployeeDoc emp) {
        return repositoryUpdate(emp);
    }

    @RedisJsonWritingCache(prefix = "emp:", keyExpression = "#id", evict = true)
    public void deleteById(String id) {
        repositoryDelete(id);
    }

    @RedisReadOnly
    public List<EmployeeDoc> searchEmployees(String keyword) {
        // 直接从 RediSearch 索引中搜，搜出来的就是最新的缓存数据
        RediSearchOptions options = RediSearchOptions.builder()
                .resultType(RediSearchOptions.ResultType.ON_JSON)
                .query(keyword)
                .dialect(3)
                .build();
        // 这里的 search 内部已经处理了从 Redis 直接读取 JSON 并解析为对象
        List<EmployeeDoc> result = searchTemplate.search("idx:employee", options, EmployeeDoc.class);
        System.out.println("search result: " + result);
        return result;
    }

    @RedisJsonReadingCache(prefix = "emp:", keyExpression = "#id", expireTime = 900L)
    public EmployeeDoc getById(String id) {
        return repositoryGetById(id);
    }
}
```

<br>



### 压测单元

```java
/**
 * @author KJ
 */
@SpringBootTest(classes = App.class)
public class RedisCacheConcurrencyTest {

    @Resource
    private EmployeeService employeeService;

    @Test
    public void testCacheBreakdownProtection() throws InterruptedException {
        int threadCount = 1000; // 模拟 1000 个并发请求
        String testId = "999";

        // 计数器：记录请求成功的次数
        AtomicInteger successCount = new AtomicInteger(0);
        // 栅栏：确保所有线程同时开始执行
        CountDownLatch startGate = new CountDownLatch(1);
        // 门闩：等待所有线程执行完毕
        CountDownLatch endGate = new CountDownLatch(threadCount);
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);

        for (int i = 0; i < threadCount; i++) {
            executor.execute(() -> {
                try {
                    startGate.await(); // 所有线程在此等待指令

                    // 调用带缓存注解的方法
                    employeeService.getById(testId);

                    // 无论是否命中，只要没报错就算成功
                    successCount.incrementAndGet();
                } catch (Exception e) {
                    e.printStackTrace();
                } finally {
                    endGate.countDown();
                }
            });
        }

        long startTime = System.currentTimeMillis();
        startGate.countDown(); // 鸣枪起跑！
        endGate.await();       // 等待所有线程跑完
        long endTime = System.currentTimeMillis();

        System.out.println("===== 压测结果 =====");
        System.out.println("总请求数: " + threadCount);
        System.out.println("成功请求数: " + successCount.get());
        System.out.println("总耗时: " + (endTime - startTime) + "ms");
        System.out.println("====================");

        // 验证逻辑：
        // 你需要观察日志中 "repositoryGetById" 打印了几次。
        // 如果 DCL 生效，理论上控制台只会打印 1 次查询 DB 的日志。
    }
}
```

<br>







