title: Redis 高级客户端 Redisson 的使用

author: kinglyjn

mathjax: true

tags:

  - redis
  - redisson
  - cap_base
  - springdata

categories:

  - db_cache

  - redis

date: 2023-09-03 13:01:14

---



## 前置说明

这篇文章我将重点介绍在实际的业务开发中，我们如何构建一个真正干净的、基于 spring data + redisson 的应用客户端。在此基础上使用 `缓存组件` 和 `限流器组件` 看一下 redisson 的相关 API。redis 是集群环境，redisson 和 spring data 也都采用最新的前沿版本。



<!--more-->



## 核心的配置代码

### POM 依赖

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

<!--redisson-->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-data-redis</artifactId>
  <exclusions>
    <exclusion>
      <artifactId>jedis</artifactId>
      <groupId>redis.clients</groupId>
    </exclusion>
    <exclusion>
      <groupId>io.lettuce</groupId>
      <artifactId>lettuce-core</artifactId>
    </exclusion>
  </exclusions>
</dependency>

<dependency>
  <groupId>org.redisson</groupId>
  <artifactId>redisson-spring-boot-starter</artifactId>
  <version>4.1.0</version>
</dependency>
<dependency>
  <groupId>com.fasterxml.jackson.core</groupId>
  <artifactId>jackson-databind</artifactId>
</dependency>
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-configuration-processor</artifactId>
  <optional>true</optional>
</dependency>
<dependency>
  <groupId>org.projectlombok</groupId>
  <artifactId>lombok</artifactId>
  <version>${lombok.version}</version>
  <scope>compile</scope>
  <optional>true</optional>
</dependency>
<dependency>
  <groupId>io.netty</groupId>
  <artifactId>netty-resolver-dns-native-macos</artifactId>
  <version>4.2.10.Final</version>
  <classifier>osx-x86_64</classifier>
  <scope>runtime</scope>
</dependency>


<build>
  <plugins>
    <plugin>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-maven-plugin</artifactId>
      <version>${spring-boot.version}</version>
      <configuration>
        <mainClass>com.demo.App</mainClass>
      </configuration>
      <executions>
        <execution>
          <goals>
            <goal>repackage</goal>
          </goals>
        </execution>
      </executions>
    </plugin>
    <plugin>
      <groupId>org.apache.maven.plugins</groupId>
      <artifactId>maven-compiler-plugin</artifactId>
      <version>3.11.0</version>
      <configuration>
        <source>${java.version}</source>
        <target>${java.version}</target>
        <compilerArgs>
          <arg>-parameters</arg>
        </compilerArgs>
        <parameters>true</parameters>
        <annotationProcessorPaths>
          <path>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <version>${lombok.version}</version>
          </path>
        </annotationProcessorPaths>
      </configuration>
    </plugin>
  </plugins>
</build>
```

<br>



### 配置文件

application.yml

```yaml
spring:
  redisson:
    # --- [基础连接配置] ---
    # Redis 集群节点地址，只需配置部分种子节点，Redisson 会自动发现整个集群拓扑
    nodes:
      - 192.168.1.149:7001
      - 192.168.1.166:7001
      - 192.168.1.224:7001
    # Redis 访问密码，若无密码请删除或留空
    password: xxxxxx
    # 命令执行超时时间（毫秒）。建议根据业务响应要求设置，生产环境通常 3000ms 左右
    timeout: 3000
    # 建立连接的超时时间（毫秒）
    connect-timeout: 5000

    # --- [集群拓扑与重试] ---
    # 集群状态扫描间隔（毫秒）。自动监测集群主从切换、增减节点。建议 2000-5000ms
    scan-interval: 2000
    # DNS 监测间隔（毫秒）。如果你的 Redis 地址是域名，当底层 Redis 节点的 IP 发生变化时，Redisson 也能通过 DNS 自动更新连接。
    dns-monitoring-interval: 10000
    # 读取操作策略：
    # SLAVE: 只从从节点读取（推荐，实现读写分离，减轻主节点压力）
    # MASTER: 只从主节点读取
    # MASTER_SLAVE: 主从节点混读
    read-mode: MASTER_SLAVE
    # 负载均衡算法：RoundRobinLoadBalancer(轮询), WeightedRoundRobinBalancer(加权轮询)
    # load-balancer: RoundRobinLoadBalancer
    load-balancer: WeightedRoundRobinBalancer
    weights: # 配合 load-balancer = WeightedRoundRobinBalancer 使用
      # 比如 149 这台机器性能极强，给它分配 5 倍流量  ## redis:// or rediss:// (for SSL connection)
      # 使用 [] 包裹 Key，确保冒号和斜杠不被 Spring 拦截解析
      "[redis://192.168.1.149:7001]": 5
      "[redis://192.168.1.166:7001]": 2
      "[redis://192.168.1.224:7001]": 1
    # 命令失败重试次数。如果由于网络抖动导致执行失败，会进行重试
    retry-attempts: 3
    # 命令重试间隔时间（毫秒）
    retry-interval: 1500

    # --- [连接池精细化调优] ---
    # 单个主节点的最大连接池大小。根据业务并发量调整，一般 64-256 即可
    master-pool-size: 128
    # 单个从节点的最大连接池大小
    slave-pool-size: 128
    # 主节点最小空闲连接数。预热连接，避免高峰期频繁创建连接导致的耗时增长
    master-idle-size: 32
    # 从节点最小空闲连接数
    slave-idle-size: 32
    # 连接的最大空闲存活时间（毫秒）。超过此时间的空闲连接将被关闭
    idle-connection-timeout: 10000

    # --- [系统底层优化] ---
    # 业务线程池大小。默认值为 CPU 核数 * 2。处理数据编解码等任务
    threads: 16
    # Netty 网络线程池大小。默认值为 CPU 核数 * 2。负责网络 I/O 读写
    netty-threads: 32
```

<br>



### 配置类

**RedisClusterConfig**：

* 读写分离的支持：
  * setReadMode(ReadMode.SLAVE)：Redisson 会通过负载均衡算法（你配置的 LoadBalancer）将所有的读请求分发到从节点（Slave），而写请求始终路由到主节点（Master）。

* 支持容错的支持：
  * 重试机制： setRetryAttempts() 和 setRetryDelay() 这里使用了 EqualJitterDelay。在重试时引入了“随机抖动”，防止在大规模宕机时，所有客户端在同一时刻发起重试（即“惊群效应”），从而保护了 Redis 集群不被瞬间击垮。
  * 超时控制： connectTimeout 和 timeout 确保了请求不会因为某个节点的网络波动而导致业务线程无限期阻塞。

* 自动发现集群变更感知支持 ：
  * 核心参数：setScanInterval(2000)：定期执行 CLUSTER NODES 或 CLUSTER SLOTS。如果你的集群发生了主从切换、增加了新节点、或者某个节点下线，Redisson 会实时更新内部的路由表，业务代码对此完全无感知。

* 极度丰富的分布式锁的支持：
  * 基本可重入和可延时锁（RedissonLock）：它实现了标准的 java.util.concurrent.locks.Lock 接口，并扩展了 RLock。
  * 联锁 (MultiLock)：将多个锁合并成一个大锁，只有全部获取成功才算成功。常用于跨库事务控制。
  * 红锁 (RedLock)：针对 Redis 实例宕机场景的高可用锁算法。
  * 读写锁 (ReadWriteLock)：支持分布式环境下的并发读、互斥写，极大提升了缓存场景的吞吐量。

* 各种高级集合对象的支持：
  * Redisson 几乎把整个 java.util 搬到了 Redis 里：RMapCache / RSetCache：支持元素级别的过期时间（TTL）。比如你可以往一个 Map 里存 100 个 Key，每个 Key 的过期时间都不一样。
  * RBloomFilter (布隆过滤器)：防止缓存穿透的神器。Redisson 封装得极其简单易用，一句话就能初始化上亿量级的过滤器。

* 分布式服务支持：
  * RScheduledExecutorService：你可以像使用 Java 的 ScheduledExecutorService 一样，在集群中运行分布式定时任务。它支持任务重试、取消，并且能保证任务在集群中只运行一次。

* 远程服务调用支持：
  * 基于 Redis 实现的轻量级 RPC。你可以像调用本地方法一样调用另一个微服务中的方法，无需引入复杂的 Dubbo 或 Spring Cloud。

```java
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.jsontype.impl.LaissezFaireSubTypeValidator;
import org.redisson.Redisson;
import org.redisson.api.RedissonClient;
import org.redisson.codec.JsonJacksonCodec;
import org.redisson.config.Config;
import org.redisson.config.EqualJitterDelay;
import org.redisson.connection.balancer.LoadBalancer;
import org.redisson.connection.balancer.RoundRobinLoadBalancer;
import org.redisson.connection.balancer.WeightedRoundRobinBalancer;
import org.redisson.spring.data.connection.RedissonConnectionFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * @author KJ
 * @description redisson 基础配置类
 */
@Configuration
public class RedisClusterConfig {

    /**
     * 集群模式
     */
    @Bean(destroyMethod = "shutdown")
    public RedissonClient redissonClient(RedissonProperties redissonProps) {
        Config config = new Config();

        // 全局基础配置
        config.setThreads(redissonProps.getThreads())
                .setNettyThreads(redissonProps.getNettyThreads())
                .setCodec(new JsonJacksonCodec(redisObjectMapper())) // 默认是 SmileJacksonCodec，这里我们使用全局统一的序列化器
                .setPassword(redissonProps.getPassword());

        // 处理地址前缀
        String[] nodeAddresses = redissonProps.getNodes().stream()
                .map(node -> node.startsWith("redis://") ? node : "redis://" + node)
                .toArray(String[]::new);

        // 集群模式配置
        config.useClusterServers()
                .addNodeAddress(nodeAddresses)
                .setScanInterval(redissonProps.getScanInterval())
                .setDnsMonitoringInterval(redissonProps.getDnsMonitoringInterval())
                .setReadMode(redissonProps.getReadMode())
                .setLoadBalancer(getBalancer(redissonProps))
                .setRetryAttempts(redissonProps.getRetryAttempts())
                .setRetryDelay(new EqualJitterDelay(Duration.ofMillis(redissonProps.getRetryInterval()), Duration.ofSeconds(2)))
                .setConnectTimeout(redissonProps.getConnectTimeout())
                .setTimeout(redissonProps.getTimeout())
                .setMasterConnectionPoolSize(redissonProps.getMasterPoolSize())
                .setSlaveConnectionPoolSize(redissonProps.getSlavePoolSize())
                .setMasterConnectionMinimumIdleSize(redissonProps.getMasterIdleSize())
                .setSlaveConnectionMinimumIdleSize(redissonProps.getSlaveIdleSize())
                .setIdleConnectionTimeout(redissonProps.getIdleConnectionTimeout());
        return Redisson.create(config);
    }

    /**
     * 负载均衡算法工厂映射
     */
    private LoadBalancer getBalancer(RedissonProperties redissonProps) {
        String type = redissonProps.getLoadBalancer();
        if ("WeightedRoundRobinBalancer".equalsIgnoreCase(type)) {
            Map<String, Integer> originWeights = redissonProps.getWeights();
            Map<String, Integer> processedWeights = new HashMap<>();
            originWeights.forEach((key, value) -> {
                String cleanKey = key.replace("[", "").replace("]", "");
                if (!cleanKey.startsWith("redis://") && !cleanKey.startsWith("rediss://")) {
                    cleanKey = "redis://" + cleanKey;
                }
                processedWeights.put(cleanKey, value);
            });
            return new WeightedRoundRobinBalancer(processedWeights, redissonProps.getDefaultWeight());
        }
        // 默认返回轮询算法
        return new RoundRobinLoadBalancer();
    }

    /**
     * 将 Redisson 注入 Spring Data Redis
     * 这样你依然可以用熟悉的 RedisTemplate，但底层驱动是强大的 Redisson
     */
    @Bean
    public RedisConnectionFactory redisConnectionFactory(RedissonClient redissonClient) {
        // Redisson 提供了一个专门的适配器类
        return new RedissonConnectionFactory(redissonClient);
    }

    /**
     * spring data 标准的 RedisTemplate
     * 并且底层是 redisson，自动支持读写分离
     * 这样在应用层我们不仅可以用 redisson RedissonClient，也可以使用 spring data RedisTemplate
     */
    @Bean
    @Primary
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory,
                                                       @Qualifier("redisObjectMapper") ObjectMapper redisObjectMapper) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);

        // 使用同一个公共 ObjectMapper 构造序列化器
        GenericJackson2JsonRedisSerializer jsonSerializer = new GenericJackson2JsonRedisSerializer(redisObjectMapper);

        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(jsonSerializer);
        template.setHashValueSerializer(jsonSerializer);

        template.afterPropertiesSet();
        return template;
    }

    /**
     * 专门给 Redis 用的序列化器
     * 只有它才开启 activateDefaultTyping，用于解决缓存反序列化问题
     */
    @Bean("redisObjectMapper")
    public ObjectMapper redisObjectMapper() {
        ObjectMapper objectMapper = new ObjectMapper();
        // 1. 忽略未知属性，防止前端多传参数导致报错
        objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        // 2. 禁用时间戳，使用人类可读格式
        objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        // 3. 解决 LocalDateTime 等 Java8 时间类型的序列化问题
        objectMapper.registerModule(JacksonConfig.enhancedJavaTimeModule());
        // 4. 必须配置【独有配置】：激活全类名描述，这是跨客户端反序列化的关键（仅用于 Redis 内部存储）
        // 注意：Redisson 和 Spring 对此配置的默认行为必须对齐
        objectMapper.activateDefaultTyping(LaissezFaireSubTypeValidator.instance,
                ObjectMapper.DefaultTyping.NON_FINAL, JsonTypeInfo.As.PROPERTY);
        return objectMapper;
    }

    /**
     * 专供 API 接口使用的标准序列化器
     * 标记为 @Primary，Spring MVC 会默认使用它
     */
    @Bean
    @Primary
    public ObjectMapper springMvcObjectMapper() {
        ObjectMapper objectMapper = new ObjectMapper();
        objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        objectMapper.registerModule(JacksonConfig.enhancedJavaTimeModule());
        // 关键：不调用 activateDefaultTyping
        return objectMapper;
    }
}
```

<br>

JacksonConfig：

主要用于增强序列化器的相关配置，这里主要对时间字段格式的进行了处理。

```java
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;
import org.springframework.context.annotation.Configuration;
import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Jackson 配置类
 *
 * @author KJ
 */
@Configuration
public class JacksonConfig {

    public static final String DATETIME_FORMAT = "yyyy-MM-dd HH:mm:ss";
    public static final String DATE_FORMAT = "yyyy-MM-dd";

    /**
     * 这是一个增强版的时间模块
     * 它可以自动识别并解析 yyyy-MM-dd HH:mm:ss 和 yyyy-MM-dd (补全00:00:00)
     */
    public static JavaTimeModule enhancedJavaTimeModule() {
        JavaTimeModule module = new JavaTimeModule();

        // 1. 序列化：一律转换为 yyyy-MM-dd HH:mm:ss，方便阅读和 RediSearch 检索
        DateTimeFormatter dateTimeFormatter = DateTimeFormatter.ofPattern(DATETIME_FORMAT);
        module.addSerializer(LocalDateTime.class, new LocalDateTimeSerializer(dateTimeFormatter));

        // 2. 反序列化：适配多种格式
        module.addDeserializer(LocalDateTime.class, new JsonDeserializer<>() {
            @Override
            public LocalDateTime deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
                String dateStr = p.getText().trim();
                if (dateStr.isEmpty()) return null;

                // 兼容 yyyy-MM-dd (长度10)
                if (dateStr.length() == 10) {
                    return LocalDate.parse(dateStr, DateTimeFormatter.ofPattern(DATE_FORMAT)).atStartOfDay();
                }
                // 兼容 yyyy-MM-dd HH:mm:ss 或带 T 的格式
                return LocalDateTime.parse(dateStr.replace(" ", "T"));
            }
        });
        return module;
    }
}
```

<br>

RedissonProperties：

统一管理和收集 redisson 的配置参数。

```java
import lombok.Data;
import org.redisson.config.ReadMode;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * redisson 配置参数
 *
 * @author KJ
 */
@Data
@Component
@ConfigurationProperties(prefix = "spring.redisson")
public class RedissonProperties {

    // 1. 基础连接信息
    private List<String> nodes;
    private String password;
    private int timeout = 3000;
    private int connectTimeout = 3000;

    // 2. 集群特有配置
    private int scanInterval = 2000;
    private int dnsMonitoringInterval = 5000;
    private ReadMode readMode = ReadMode.SLAVE;
    private int retryAttempts = 3;
    private int retryInterval = 1500;

    // IF：WeightedRoundRobinBalancer
    // 权重配置：Key 例如 redis://192.168.1.149:7001，Value 是其权重值
    private String loadBalancer = "RoundRobinLoadBalancer";
    private Map<String, Integer> weights = new HashMap<>();
    private int defaultWeight = 1;

    // 3. 连接池精细化配置
    private int masterPoolSize = 64;
    private int slavePoolSize = 64;
    private int masterIdleSize = 24;
    private int slaveIdleSize = 24;
    private int idleConnectionTimeout = 10000;

    // 4. 线程池配置
    private int threads = 16;
    private int nettyThreads = 32;
}
```

<br>



## 缓存组件的实现

### 切面实现

RedisCacheForWritingAspect

```java
import com.demo.component.jsoncache.RedisWritingCache;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.redisson.api.RBucket;
import org.redisson.api.RedissonClient;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import java.time.Duration;

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

    /**
     * RedisTemplate 的大部分操作是同步阻塞的（除非使用 ReactiveRedisTemplate）
     * 而 RBucket 提供了原生的 setAsync。缓存操作不应该拖慢数据库事务的提交。使用 setAsync 可以让 Redisson 在 Netty 线程池里异步处理 IO，业务线程直接返回结果。
     */
    @Resource
    private RedissonClient redissonClient;

    /**
     * 使用 @Qualifier 强制指向 Redis 专用的序列化器
     * 这样就不会和 Spring MVC 默认的那个混淆
     */
    @Resource
    @Qualifier("redisObjectMapper")
    private ObjectMapper redisObjectMapper;

    @Around("@annotation(writingCache)")
    public Object syncCache(ProceedingJoinPoint joinPoint, RedisWritingCache writingCache) throws Throwable {
        // 1. 执行写 DB 逻辑
        Object result = joinPoint.proceed();

        String id = SpringExpressionUtils.parseSpel(writingCache.keyExpression(), joinPoint);
        String redisKey = writingCache.prefix() + id;
        RBucket<Object> bucket = redissonClient.getBucket(redisKey);
        // RJsonBucket<Object> jsonBucket = redissonClient.getJsonBucket(redisKey, new JacksonCodec<>(redisObjectMapper, Object.class));

        if (writingCache.evict()) {
            // 核心策略：删除缓存（保证最终一致性最稳妥的方法）
            bucket.deleteAsync();
            // jsonBucket.deleteAsync();
            log.info("RedisCache Evict | Key: {}", redisKey);
        } else if (result != null) {
            // 同步缓存
            // 这里是按照简单的以 Redis String 类型存储JSON串来缓存数据的，实际也可以使用 RedisJSON 数据类型
            if (writingCache.expireTime() > 0) {
                bucket.setAsync(result, Duration.ofSeconds(writingCache.expireTime())); // 底层是【set k v ex】
                // jsonBucket.setAsync(result, Duration.ofSeconds(writingCache.expireTime())); // 底层是【json.set k $ v & expire】LUA 封装的原子指令
            } else {
                bucket.setAsync(result);
                // jsonBucket.setAsync(result);
            }
        }
        return result;
    }
}
```

<br>



RedisCacheForReadingAspect：

```java
import com.demo.component.jsoncache.RedisReadingCache;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.redisson.api.RBucket;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * RedisJSON 读缓存切面
 * 处理数据的读取，先读缓存数据，缓存中不存在则查库，并且将查询结果缓存起来；
 *
 * 缓存穿透处理：如果数据库数据也不存在，则对该数据适当进行缓存穿透处理
 * 缓存击穿处理：【双重检查锁实现】，解决某个热点Key过期，瞬间大量相同Key请求过来的问题
 *
 * 关于双重检查锁逻辑：
 * 注意1：这里的 try 5 秒是【最多排队5秒】，注意与【真正持有锁的时间】相区分
 * 注意2：如果你希望所有线程都必须等到结果，不准失败进入 else 分支，你应该使用无参的 lock() 方法：lock.lock(); try {..} finally { lock.unlock(); }
 *       在高并发网关或核心业务中，我不建议“死等”。因为如果数据库真的挂了，所有请求都会堆积在 lock.lock() 处，最终导致 Tomcat 线程池耗尽，引发雪崩。
 * 注意3：如果你在 tryLock 中指定了第二个参数 leaseTime，看门狗就会彻底关掉，lock.tryLock(5, 10, TimeUnit.SECONDS)：此时所租期就是10秒，之后即便你业务没执行完锁必释放。
 * 建议是：保持 “tryLock + else” 结构，这是一种 “快速失败 (Fail-Fast)” 的保护机制。在分布式环境下，保护数据库不被瞬间压垮（DCL 的作用）和保护应用自身不被慢 SQL 拖死（wait-time 的作用）同等重要。
 *
 * @author KJ
 */
@Aspect
@Order(10)
@Component
@Slf4j
public class RedisCacheForReadingAspect {

    @Resource
    private RedissonClient redissonClient;

    private static final String PROTECTED_PLACEHOLDER = "{}";
    private static final String LOCK_PREFIX = "lock:cache:";

    @Around("@annotation(readingCache)")
    public Object readCacheHandler(ProceedingJoinPoint joinPoint, RedisReadingCache readingCache) throws Throwable {
        String id = SpringExpressionUtils.parseSpel(readingCache.keyExpression(), joinPoint);
        String redisKey = readingCache.prefix() + id;

        // 1. 获取 RBucket 对象
        RBucket<Object> bucket = redissonClient.getBucket(redisKey);

        // --- 第一重检查：尝试从缓存读取 ---
        Object cacheData = bucket.get();
        if (cacheData != null) {
            return isPlaceholder(cacheData) ? null : cacheData;
        }

        // --- 缓存未命中，进入【分布式】双重检查锁定区间 ---
        // 集群环境下（多节点部署）：这里的锁使用真正的分布式锁。如果有 10 个节点并行运行，当一个热点 Key 失效时，集群中保证只会有一个请求到达数据库。
        RLock lock = redissonClient.getLock(LOCK_PREFIX + redisKey);
        if (lock.tryLock(5, TimeUnit.SECONDS)) {
            try {
                // --- 第二重检查（DCL）：再次尝试从缓存读取 ---
                cacheData = bucket.get();
                if (cacheData != null) {
                    return isPlaceholder(cacheData) ? null : cacheData;
                }

                // 缓存未命中，查库
                Object dbResult = joinPoint.proceed();

                // 数据回填
                if (dbResult != null) {
                    // 写入缓存，支持配置过期时间
                    if (readingCache.expireTime() > 0) {
                        bucket.set(dbResult, Duration.ofSeconds(readingCache.expireTime()));
                    } else {
                        bucket.set(dbResult);
                    }
                } else if (readingCache.preventPenetration()) {
                    // 穿透处理：写入占位符
                    bucket.set(PROTECTED_PLACEHOLDER, Duration.ofSeconds(readingCache.preventTtl()));
                }
                return dbResult;
            } finally {
                lock.unlock();
            }
        } else {
            // 如果竞争锁失败，说明有其他线程在查库，这里可以选择重试或降级
            // else 的触发不是因为锁过期了，而是因为竞争太激烈，前面的线程占锁时间太长，导致后面的线程等得“不耐烦”了。
            log.warn("分布式锁竞争激烈，未能获取到锁: {}", redisKey);
            Thread.sleep(200); // 稍微等一下查库线程

            // 方案 1：直接去缓存再读一次。
            // 如果那个线程刚好在第 5.1 秒塞进去了，这里就能读到。
            Object finalCheck = bucket.get();
            if (finalCheck != null) return isPlaceholder(finalCheck) ? null : finalCheck;

            // 方案 2：如果还是没有，可以根据业务选择：
            // a. 抛异常（前端提示繁忙）
            // b. 再次尝试查库（不加锁了，稍微穿透一下也行，保可用性）
            // c. 返回默认空值
            throw new RuntimeException("系统繁忙，请稍后再试");
        }
    }

    private boolean isPlaceholder(Object data) {
        if (data instanceof String) return PROTECTED_PLACEHOLDER.equals(data);
        if (data instanceof Map) return ((Map<?, ?>) data).isEmpty();
        return false;
    }
}
```

<br>

SpringExpressionUtils：

Spring EL 表达式解析支持 

```java
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



### 应用组件

RedisWritingCache：

```java
/**
 * @author KJ
 * @description 写缓存注解
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RedisWritingCache {
    String prefix();               // Redis Key 前缀，如 "employee:"
    String keyExpression();        // SpEL 表达式，用于提取 ID，如 "#employee.id"
    long expireTime() default -1;  // 缓存过期时间（秒），默认 -1 表示不设置
    boolean evict() default true;  // 是否强制删除缓存，强烈建议数据更新、删除时为true
}
```

<br>

RedisReadingCache：

```java
/**
 * @author KJ
 * @description 缓存读取注解
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RedisReadingCache {
    String prefix();               // Redis Key 前缀，如 "employee:"
    String keyExpression();        // SpEL 表达式，用于提取 ID，如 "#employee.id"
    long expireTime() default -1;  // 缓存过期时间（秒），默认 -1 表示不设置

    // --- 防穿透配置 ---
    boolean preventPenetration() default true; // 默认开启
    long preventTtl() default 10;              // 空值缓存时间（秒），建议设短一点
}
```

<br>



### 业务演示类

EmployeeDoc：

```java
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class EmployeeDoc {
    private String id;
    private String name;
    private String department;
    private LocalDateTime createTime; // 验证 JavaTimeModule 是否生效
}

```

<br>

EmployeeService：

```java
/**
 * @author KJ
 * @description 业务演示类 EmployeeService
 */
@Slf4j
@Service
public class EmployeeService {

    // 模拟数据库
    private final Map<String, EmployeeDoc> mockDb = new ConcurrentHashMap<>();

    @RedisWritingCache(prefix = "emp:", keyExpression = "#emp.id", evict = false, expireTime = 3600)
    public EmployeeDoc saveEmployee(EmployeeDoc emp) {
        log.info("====> 写入数据库: {}", emp.getId());
        mockDb.put(emp.getId(), emp);
        return emp;
    }

    @RedisWritingCache(prefix = "emp:", keyExpression = "#id", evict = true)
    public void deleteEmployee(String id) {
        log.info("====> 删除数据库数据并失效缓存: {}", id);
        mockDb.remove(id);
    }

    @RedisWritingCache(prefix = "emp:", keyExpression = "#emp.id", evict = true, expireTime = 3600)
    public EmployeeDoc updateEmployee(EmployeeDoc emp) {
        log.info("====> 更新数据库: {}", emp.getId());
        mockDb.put(emp.getId(), emp);
        return emp;
    }

    @RedisReadingCache(prefix = "emp:", keyExpression = "#id", expireTime = 3600, preventPenetration = true, preventTtl = 10)
    public EmployeeDoc getEmployeeById(String id) {
        log.info("====> 缓存未命中，开始执行查库逻辑 (ID: {})", id);
        // 模拟数据库查询耗时，方便测试并发锁
        try { Thread.sleep(1000); } catch (InterruptedException e) { e.printStackTrace(); }
        return mockDb.get(id);
    }
}
```

<br>

EmployeeController：

```java
/**
 * @author KJ
 * @description 业务演示类 EmployeeController
 */
@RestController
@RequestMapping("/employee")
public class EmployeeController {

    @Resource
    private EmployeeService employeeService;

    @GetMapping("/{id}")
    public EmployeeDoc get(@PathVariable String id) {
        return employeeService.getEmployeeById(id);
    }

    @PostMapping
    public EmployeeDoc save(@RequestBody EmployeeDoc emp) {
        emp.setCreateTime(LocalDateTime.now());
        return employeeService.saveEmployee(emp);

    }
    @PutMapping
    public EmployeeDoc update(@RequestBody EmployeeDoc emp) {
        emp.setCreateTime(LocalDateTime.now());
        return employeeService.updateEmployee(emp);
    }

    @DeleteMapping("/{id}")
    public String delete(@PathVariable String id) {
        employeeService.deleteEmployee(id);
        return "OK";
    }
}
```

<br>



### 测试单元

```java
/**
 * @author KJ
 * @description 测试 Redis 缓存的并发问题
 */
@Slf4j
@SpringBootTest(classes = App.class)
public class RedisCacheConcurrencyTest {

    @Resource
    private EmployeeService employeeService;

    @Test
    public void testCacheBreakdown() throws InterruptedException {
        String empId = "999";
        // 1. 先确保缓存和数据库都是空的
        employeeService.deleteEmployee(empId);

        // 2. 准备 100 个并发线程
        int threadCount = 100;
        ExecutorService executorService = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startSignal = new CountDownLatch(1);
        CountDownLatch doneSignal = new CountDownLatch(threadCount);

        log.info("开始模拟 {} 个并发请求冲击同一个 Key...", threadCount);

        for (int i = 0; i < threadCount; i++) {
            executorService.submit(() -> {
                try {
                    startSignal.await(); // 阻塞，直到所有人准备就绪
                    employeeService.getEmployeeById(empId);
                } catch (Exception e) {
                    log.error("请求失败", e);
                } finally {
                    doneSignal.countDown();
                }
            });
        }

        // 3. 发令枪响：所有线程同时出发
        long startTime = System.currentTimeMillis();
        startSignal.countDown();
        doneSignal.await();
        long endTime = System.currentTimeMillis();

        log.info("所有请求处理完毕，总耗时: {} ms", (endTime - startTime));
    }
}
```

<br>

redisson 生成的锁数据：

```bash
# 这段数据展示了 Redisson 分布式锁（RLock） 在 Redis 底层存储的典型结构。
# 它使用 Redis 的 Hash 类型来支持可重入性（Reentrancy）。
192.168.1.224:7001> hgetall lock:cache:emp:999
1) "924e0d78-6d6f-4b40-a24c-0f18bfff5118:167"   # 持有锁的线程标识。由 Redisson实例ID (UUID) + 线程ID (Thread ID) 组成。
2) "1"                                          # 锁的计数器。表示当前线程重入该锁的次数。
```

<br>



## 限流器的实现

### 切面实现

```java
import com.demo.component.limiter.RateLimiter;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.redisson.api.RRateLimiter;
import org.redisson.api.RateType;
import org.redisson.api.RedissonClient;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import java.time.Duration;

/**
 * 使用 Redisson 实现限流有以下两个显著优势：
 * 1. 从“滑动窗口”升级为“令牌桶”：Redisson 默认使用基于令牌桶（Token Bucket）算法的 RRateLimiter，它比滑动窗口更平滑，且性能更高。
 * 2. 无需维护 Lua 脚本：不再需要加载外部 lua 文件，Redisson 内部已经高度封装并优化了限流逻辑。
 *
 * @author KJ
 * @description Redisson 限流切面
 */
@Aspect
@Component
@Order(0) // 优先级最高，先限流再做业务或读缓存
@Slf4j
public class RateLimiterAspect {

    @Resource
    private RedissonClient redissonClient;

    @Around("@annotation(rateLimiter)")
    public Object doAround(ProceedingJoinPoint joinPoint, RateLimiter rateLimiter) throws Throwable {
        // 1. 解析 Key
        String keySuffix = SpringExpressionUtils.parseSpel(rateLimiter.keyExpression(), joinPoint);
        String finalKey = rateLimiter.prefix() + keySuffix;

        try {
            // 2. 获取 Redisson 限流器对象
            RRateLimiter limiter = redissonClient.getRateLimiter(finalKey);

            /**
             * 3. 动态初始化限流配置
             * trySetRate 是原子操作，如果限流器已存在且配置相同，则返回 false 并不做修改。
             * mode: RateType.OVERALL 表示全局限流（跨所有节点）、RateType.PER_CLIENT 表示单客户端限流（针对当前连接）
             */
            limiter.trySetRate(RateType.OVERALL, rateLimiter.max(), Duration.ofSeconds(rateLimiter.window()));

            // 如果返回 false，说明配置不一致，需要强制设置（慎用，通常只在管理端使用）
            // 如果你修改了代码中的 @RateLimiter 注解参数（比如把 max 从 10 改成了 20），而 Redis 里的配置还没过期，新的配置是不会生效的。我们还是使用上面的方法！
            /*if (!limiter.trySetRate(RateType.OVERALL, rateLimiter.max(), Duration.ofSeconds(rateLimiter.window()))) {
                limiter.setRate(RateType.OVERALL, rateLimiter.max(), Duration.ofSeconds(rateLimiter.window())); // 强制覆盖
            }*/

            // 4. 尝试获取 1 个令牌
            // tryAcquire() 立即返回，不阻塞
            if (!limiter.tryAcquire(1)) {
                log.warn("Rate limit exceeded for key: {}", finalKey);
                throw new RuntimeException(rateLimiter.message());
            }

        } catch (RuntimeException e) {
            // 如果是限流抛出的 RuntimeException，继续向上抛
            if (e.getMessage().equals(rateLimiter.message())) throw e;

            // --- 核心降级逻辑 ---
            // 当 Redis 宕机、网络抖动等非业务异常发生时，降级放行
            log.error("Redisson 限流组件异常，已自动降级放行。Key: {}, 异常原因: {}", finalKey, e.getMessage());
        }

        return joinPoint.proceed();
    }
}
```

<br>



### 应用组件

```java
/**
 * @author KJ
 * @description
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RateLimiter {
    /** 限流 Key 的前缀 */
    String prefix() default "rate_limit:";

    /** SpEL 表达式，用于动态提取用户 ID 或 IP */
    String keyExpression();

    /** 窗口时间长度 (单位：秒) */
    int window() default 60;

    /** 窗口内允许的最大请求次数 */
    int max() default 100;

    /** 错误提示信息 */
    String message() default "操作太频繁，请稍后再试";
}
```

<br>



### 新增业务代码

在原有的 EmployeeService 基础上增加注解 @RateLimiter 即可给实际相关接口加上限流功能：

```java
@RateLimiter(prefix = "limit:emp:save:", keyExpression = "'global'", max = 5, window = 1) // 限制分布式应用每秒只能新增 5 个员工 (令牌桶模式)，粒度是全局的【spel 解析成一个 "global" 字符串）】
@RedisWritingCache(prefix = "emp:", keyExpression = "#emp.id", evict = false, expireTime = 3600)
public EmployeeDoc saveEmployee(EmployeeDoc emp) {
    log.info("====> 写入数据库: {}", emp.getId());
    mockDb.put(emp.getId(), emp);
    return emp;
}

@RateLimiter(prefix = "limit:emp:delete:", keyExpression = "#id", max = 2, window = 1) // 删除：按员工 ID 限流，防止对单条数据的恶意频繁操作
@RedisWritingCache(prefix = "emp:", keyExpression = "#id", evict = true)
public void deleteEmployee(String id) {
    log.info("====> 删除数据库数据并失效缓存: {}", id);
    mockDb.remove(id);
}

@RateLimiter(prefix = "limit:emp:update:", keyExpression = "#emp.id", max = 3, window = 1) // 修改：按员工 ID 限流，1 秒内同一员工只允许更新 3 次
@RedisWritingCache(prefix = "emp:", keyExpression = "#emp.id", evict = true, expireTime = 3600)
public EmployeeDoc updateEmployee(EmployeeDoc emp) {
    log.info("====> 更新数据库: {}", emp.getId());
    mockDb.put(emp.getId(), emp);
    return emp;
}

/**
 * 查询：
 * 1. 针对 “单条数据” 设置 1 秒 10 次的保护（这里仅用于测试，实际热点数据限流如每秒100）
 * 2. 执行顺序：RateLimiter (Order 0) -> ReadingCache (Order 10)
 */
@RateLimiter(prefix = "limit:emp:read:", keyExpression = "#id", max = 10, window = 1)
@RedisReadingCache(prefix = "emp:", keyExpression = "#id", expireTime = 3600, preventPenetration = true, preventTtl = 10)
public EmployeeDoc getEmployeeById(String id) {
    log.info("====> 缓存未命中，开始执行查库逻辑 (ID: {})", id);
    // 模拟数据库查询耗时，方便测试并发锁
    try { Thread.sleep(1000); } catch (InterruptedException e) { e.printStackTrace(); }
    return mockDb.get(id);
}
```

<br>



### 测试单元

```java
import com.demo.App;
import com.demo.model.EmployeeDoc;
import com.demo.service.EmployeeService;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Test;
import org.redisson.api.RedissonClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.util.Assert;
import java.time.LocalDateTime;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * @author KJ
 * @description 测试 Redisson 限流
 */
@Slf4j
@SpringBootTest(classes = App.class)
public class RateLimiterTest {

    @Resource
    private RedissonClient redissonClient;

    @Resource
    private EmployeeService employeeService;

    @Test
    public void testRateLimiting() throws InterruptedException {
        String empId = "999";
        int threadCount = 30; // 模拟 20 个并发请求
        // 强制清理旧配置，确保 max=5 生效
        redissonClient.getRateLimiter("limit:emp:read:" + empId).delete();
        // 必须预存数据，否则永远在穿透/占位符逻辑里跑
        employeeService.saveEmployee(new EmployeeDoc("999", "张三", "dev", LocalDateTime.now()));

        // 对应我们在 Service 中设置的：max = 5, window = 1 (1秒内允许5个)
        // 预期结果：5个成功，15个被限流抛出异常

        ExecutorService executorService = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startSignal = new CountDownLatch(1);
        CountDownLatch doneSignal = new CountDownLatch(threadCount);

        // 计数器
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger limitCount = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            executorService.submit(() -> {
                try {
                    startSignal.await(); // 等待发令枪
                    employeeService.getEmployeeById(empId);
                    successCount.incrementAndGet();
                } catch (RuntimeException e) {
                    // 捕获限流抛出的异常
                    if (e.getMessage().contains("操作太频繁")) {
                        limitCount.incrementAndGet();
                    } else {
                        log.error("其他异常: ", e);
                    }
                } catch (Exception e) {
                    log.error("系统错误: ", e);
                } finally {
                    doneSignal.countDown();
                }
            });
        }

        long startTime = System.currentTimeMillis();
        startSignal.countDown(); // 发令枪响！
        doneSignal.await();
        long endTime = System.currentTimeMillis();

        log.info("======= 限流测试报告 =======");
        log.info("总请求数: {}", threadCount);
        log.info("成功次数 (预期接近 5): {}", successCount.get());
        log.info("被限流次数 (预期接近 15): {}", limitCount.get());
        log.info("总耗时: {} ms", (endTime - startTime));
        log.info("===========================");

        // 断言：成功数应该不大于我们的 max 设定
        log.info("成功次数: {}, 被限流次数: {}", successCount.get(), limitCount.get());
        Assert.isTrue(successCount.get() == 10, "应该只有10个请求成功");
        Assert.isTrue(limitCount.get() == 20, "应该有10个请求被限流");
    }
}
```

<br>

Redis服务器生成的限流器数据：

```bash
192.168.1.166:7001> hgetall limit:emp:read:999
1) "rate"      # 许可总数：对应注解里的 max = 10。即在一个周期内最多允许 10 个请求。
2) "10"
3) "interval"  # 时间窗口长度：单位毫秒。对应 window = 1，表示 1000ms（1秒）为一个计数周期。
4) "1000"
5) "keepAliveTime"  # 保活时间：Redisson 内部维护令牌桶状态的辅助参数，通常为 0。
6) "0"
7) "type"      # 限流类型：0 代表 RateType.OVERALL（全集群共享限流）；如果是 1 则代表单个客户端限流。
8) "0"


# 永不过期。Redisson 的限流器设计初衷是“分布式配置”。
# 一旦通过 trySetRate 初始化，这些参数（1秒10次）就会永久保存在 Redis 中。
# 代码中的 trySetRate 方法名带有 "try"，意味着“如果不存在则设置”。
# 如果 Redis 里已经有了这个 Key，即使你修改了代码中的注解参数，Redisson 也不会覆盖它。
# 之所以用 trySetRate 是因为限流一般是在管理端配置的，只有管理员有操作权限，应用程序严谨随意修改限流参数！
192.168.1.166:7001> ttl limit:emp:read:999
(integer) -1
```

<br>