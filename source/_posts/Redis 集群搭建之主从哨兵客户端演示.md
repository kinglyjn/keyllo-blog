title: Redis 集群搭建之主从哨兵客户端演示

author: kinglyjn

mathjax: true

tags:

  - springdata
  - redis
  - sentinel
  - lettuce

categories:

  - db_cache

  - redis

date: 2023-02-02 15:18:22

---



## Spring Data Redis 3.x 简介

Spring Data Redis 3.x 是 Spring 生态中处理 Redis 数据访问的核心。它不仅继承了经典的模板模式，还针对现代 Java 生态（Java 17+）和响应式架构进行了大幅增强。以下是其核心原理与主要功能的详细拆解。



<!--more-->



### 核心架构原理

Spring Data Redis 的设计遵循了 Spring Data 家族的 `抽象-实现` 的分层逻辑，旨在将 Redis 操作与底层驱动解耦。

* **双层驱动抽象**：它并不直接操作 Redis，而是通过 RedisConnectionFactory 桥接底层的驱动。在 3.x 版本中，默认驱动是 **Lettuce**（基于 Netty 的异步驱动），同时也支持 **Jedis**。
* **序列化透明化**：Redis 只能存储字节数组（byte\[\]）。Spring Data Redis 通过 RedisSerializer 接口实现 “对象 $\leftrightarrow$ 字节” 的透明转换。
* **统一异常体系**：它将 Redis 原生的各种驱动异常映射为 Spring 统一的 DataAccessException，让你的业务代码不再直接依赖底层 Redis 客户端异常。

<br>



### 主要功能特性

**高级操作模板 (Templates)**

这是开发者最常用的功能。它提供了两种抽象级别的 API：

* **RedisTemplate**：最强大的工具，支持复杂的 Java 对象序列化。通过 `opsFor...` 接口操作 Redis 的所有数据结构（String, List, Set, ZSet, Hash, Stream 等）。

* **StringRedisTemplate**：专门针对 Key-Value 都是字符串的场景进行了优化，避免了复杂的序列化开销，性能极佳。

<br>



**响应式编程支持 (Reactive)**

Spring Data Redis 3.x 对响应式栈提供了 “一等公民” 级别的支持：

* **ReactiveRedisTemplate**：支持非阻塞的 Redis 操作，完美集成 Project Reactor。
* **对象映射与存储库 (Repositories)**：借鉴了 JPA 的开发模式，允许你通过声明式接口来操作 Redis。
  * @RedisHash：将 Java 类直接映射为 Redis 的 Hash 结构。
  * @Indexed：提供对二级索引的支持。
  * @TimeToLive：自动 TTL 管理，通过注解直接在实体类中控制过期时间。
* **核心高级组件**
  * **Redis Streams**：提供了完善的 Stream 监听容器 StreamMessageListenerContainer，支持消费组、ACK 机制等，方便构建异步消息队列。
  * **分布式锁与事务**：支持基于 multi/exec 的事务管理，以及通过 SessionCallback 确保一系列操作在同一个连接中执行。
  * **Pub/Sub 消息订阅**：提供了消息监听适配器，可以像处理 MQ 消息一样处理 Redis 的发布订阅。

<br>



### 3.x 的关键变化

**基座升级**：不再支持 Java 8，全面拥抱 Java 17/21 和 Jakarta EE。

**性能优化**：Lettuce 驱动得到了深度优化，特别是在连接池管理和 SSL 连接稳定性方面。

**可观测性**：集成了 Micrometer，可以非常方便地监控 Redis 的操作耗时、连接池状态等指标。

<br>



## 构建主从哨兵客户端

我们搭建了主从哨兵模式的 redis 集群，下面构建对应客户端的具体步骤：



### 依赖包

```xml
<properties>
  <maven.compiler.source>17</maven.compiler.source>
  <maven.compiler.target>17</maven.compiler.target>
  <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
  <spring-boot.version>3.5.9</spring-boot.version>
  <logback.version>1.5.25</logback.version>
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

<dependencies>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
  </dependency>

  <dependency>
    <groupId>ch.qos.logback</groupId>
    <artifactId>logback-classic</artifactId>
    <version>${logback.version}</version>
  </dependency>
  <dependency>
    <groupId>ch.qos.logback</groupId>
    <artifactId>logback-core</artifactId>
    <version>${logback.version}</version>
  </dependency>

  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
  </dependency>

  <!-- 必须：引入了 commons-pool2，Spring Boot 会自动利用它创建对象池，
           无需你在 Java 代码里写复杂的 GenericObjectPoolConfig -->
  <dependency>
    <groupId>org.apache.commons</groupId>
    <artifactId>commons-pool2</artifactId>
  </dependency>

  <dependency>
    <groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-databind</artifactId>
  </dependency>
</dependencies>
```

<br>



### 配置文件

application.yml

```yaml
spring:
  data:
    # 对应的类 org.springframework.boot.autoconfigure.data.redis.RedisProperties
    redis:
      # 1. 哨兵集群配置
      sentinel:
        master: mymaster
        nodes:
          - 192.168.1.149:26379  # 或者英文逗号分隔也可以
          - 192.168.1.166:26379
          - 192.168.1.224:26379
      password: xxxxxx
      database: 0
      timeout: 5000ms            # 命令响应超时时间，生产环境建议 3-5s（本质是连接建立后，发出指令到收到 Redis回复的最大等待时间）
      connect-timeout: 5000ms    # 建立连接的超时时间（本质是TCP三次握手及SSL握手的最大等待时间）
      # 2. Lettuce 客户端高级配置
      lettuce:
        pool:
          enabled: true
          max-active: 64         # 最大连接数，根据 QPS 调整
          max-idle: 16           # 最大空闲连接
          min-idle: 8            # 最小空闲连接
          max-wait: 2000ms       # 连接耗尽时等待时长
        cluster:
          refresh:
            adaptive: true       # 开启自适应拓扑刷新
            period: 30s          # 定期刷新拓扑，确保主从切换后连接能及时更新

logging:
  level:
    # getConnectionAsync(WRITE) [channel=0xba41b9bd, /192.168.1.249:64778 -> /192.168.1.149:6379, epid=0x37] ... 方便观察写主节点
    # getConnectionAsync(READ)  [channel=0x9b3a9a8b, /192.168.1.249:64779 -> /192.168.1.166:6379, epid=0x38] ... 方便观察读从节点
    io.lettuce.core: DEBUG
    org.springframework.data.redis: DEBUG
```

logback-spring.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration scan="true" scanPeriod="60 seconds">
    <!--scan=true：改动 logback-spring.xml 无需重启项目，日志策略会立刻生效-->
    <!--./logs 是相对路径，也就是在哪里执行的启动命令，就会在哪里生成logs文件夹，生产环境建议设置成绝对路径-->
    <!--生产环境专业的启动命令：nohup java -jar xxx.jar > /dev/null 2>&1 & -->
    <property name="LOG_PATH" value="./logs"/>
    <property name="CONSOLE_LOG_PATTERN"
              value="%d{yyyy-MM-dd HH:mm:ss.SSS} %highlight(%-5level) %magenta(${PID:- }) --- [%15.15thread] %cyan(%-40.40logger{39}) : %m%n"/>
    <property name="FILE_LOG_PATTERN"
              value="%d{yyyy-MM-dd HH:mm:ss.SSS} %-5level ${PID:- } --- [%thread] %logger{50} - [%method,%line] - %m%n"/>

    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>${CONSOLE_LOG_PATTERN}</pattern>
            <charset>UTF-8</charset>
        </encoder>
    </appender>

    <appender name="INFO_FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>${LOG_PATH}/sys-info.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
            <fileNamePattern>${LOG_PATH}/archive/sys-info-%d{yyyy-MM-dd}.%i.log</fileNamePattern>
            <maxFileSize>100MB</maxFileSize>
            <maxHistory>30</maxHistory>
            <totalSizeCap>30GB</totalSizeCap>
        </rollingPolicy>
        <encoder>
            <pattern>${FILE_LOG_PATTERN}</pattern>
            <charset>UTF-8</charset>
        </encoder>
        <filter class="ch.qos.logback.classic.filter.LevelFilter">
            <level>ERROR</level>
            <onMatch>DENY</onMatch>
            <onMismatch>ACCEPT</onMismatch>
        </filter>
    </appender>

    <appender name="ERROR_FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>${LOG_PATH}/sys-error.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
            <fileNamePattern>${LOG_PATH}/archive/sys-error-%d{yyyy-MM-dd}.%i.log</fileNamePattern>
            <maxFileSize>100MB</maxFileSize>
            <maxHistory>60</maxHistory>
        </rollingPolicy>
        <encoder>
            <pattern>${FILE_LOG_PATTERN}</pattern>
            <charset>UTF-8</charset>
        </encoder>
        <filter class="ch.qos.logback.classic.filter.ThresholdFilter">
            <level>ERROR</level>
        </filter>
    </appender>

    <!--所有环境的公共配置-->
    <root level="INFO">
        <appender-ref ref="CONSOLE" />
        <appender-ref ref="INFO_FILE" />
        <appender-ref ref="ERROR_FILE" />
    </root>
</configuration>
```

<br>



### 配置类

RedisSentinelConfig

```java
import com.fasterxml.jackson.databind.ObjectMapper;
import io.lettuce.core.ReadFrom;
import org.springframework.boot.autoconfigure.data.redis.LettuceClientConfigurationBuilderCustomizer;
import org.springframework.boot.autoconfigure.data.redis.RedisProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
@EnableConfigurationProperties(RedisProperties.class) // 告诉 Spring 把 YAML 里的 spring.data.redis 映射到 RedisProperties 类中
public class RedisSentinelConfig {

    /**
     * 配置 Lettuce 读写分离策略
     * REPLICA_PREFERRED: 优先读从库，从库不可用时读主库
     * 这是官方推荐的“钩子”，Spring 在自动创建 ConnectionFactory 时会调用它。这样你在 YAML 里的 pool, timeout 等配置全都会生效。
     */
    @Bean
    public LettuceClientConfigurationBuilderCustomizer clientConfigurationBuilderCustomizer() {
        // 这一行代码就能开启 YAML 里配置不了的“从库优先读取”
        return builder -> builder.readFrom(ReadFrom.REPLICA_PREFERRED);
    }

    /**
     * 强烈建议不要手动注入RedisConnectionFactory，而是使用springboot自动装配的
     * Spring Boot 的自动配置原理是：只有当容器中没有 RedisConnectionFactory 这个 Bean 时，它才会根据 YAML 自动创建一个。
     * 一旦你手动定义了，自动配置就会失效，可能因为手动配置不全的问题，出现连接池失效、超时失效、拓扑刷新缺失等各种问题
     */
    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);

        // 使用 String 序列化 Key
        StringRedisSerializer stringSerializer = new StringRedisSerializer();
        template.setKeySerializer(stringSerializer);
        template.setHashKeySerializer(stringSerializer);

        // 使用 Jackson 序列化 Value
        ObjectMapper om = new ObjectMapper();
        // 允许忽略找不到类型 ID 的情况，或者不启用 DefaultTyping
        // om.activateDefaultTyping(LaissezFaireSubTypeValidator.instance, ObjectMapper.DefaultTyping.NON_FINAL);
        GenericJackson2JsonRedisSerializer jsonSerializer = new GenericJackson2JsonRedisSerializer(om);
        template.setValueSerializer(jsonSerializer);
        template.setHashValueSerializer(jsonSerializer);

        template.afterPropertiesSet();
        return template;
    }
}
```

<br>



### 核心组件

RedisUtils

```bash
import jakarta.annotation.Resource;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import java.util.concurrent.TimeUnit;

/**
 * @author KJ
 */
@Component
public class RedisUtils {

    @Resource
    private RedisTemplate<String, Object> redisTemplate;

    // --- String ---
    public void set(String key, Object value, long time) {
        redisTemplate.opsForValue().set(key, value, time, TimeUnit.SECONDS);
    }

    public Object getValue(String key) {
        return redisTemplate.opsForValue().get(key);
    }

    // --- Hash (对象存储) ---
    public void hSet(String key, String item, Object value) {
        redisTemplate.opsForHash().put(key, item, value);
    }

    // --- List (简单队列/时间线) ---
    public void lPush(String key, Object value) {
        redisTemplate.opsForList().leftPush(key, value);
    }

    // --- Set (去重/共同好友) ---
    public void sAdd(String key, Object... values) {
        redisTemplate.opsForSet().add(key, values);
    }

    // --- ZSet (排行榜/索引权重) ---
    public void zAdd(String key, Object value, double score) {
        redisTemplate.opsForZSet().add(key, value, score);
    }
}
```

<br>



### 测试相关的类

RedisTestController

```java
/**
 * @author KJ
 */
@RestController
@RequestMapping("/redis/test")
public class RedisTestController {

    @Resource
    private RedisTemplate<String, Object> redisTemplate;
    @Resource
    private RedisUtils redisUtils;

    @GetMapping("/replication_info")
    public Properties getInfo() {
        return redisTemplate.execute((RedisCallback<Properties>) connection -> connection.serverCommands().info("replication"));
    }

    @GetMapping("/failover_test")
    public void failoverTest() throws InterruptedException {
        for (int i = 0; i < 1000; i++) {
            redisUtils.set("name", "KJ_" + i, 60);
            System.out.println("set name: " + i);
            Thread.sleep(500);
            Object value = redisUtils.getValue("name");
            System.out.println("get name: " + value);
        }
    }

    @GetMapping("/read_test")
    public void readTest(@RequestParam("key") String key) {
        Object value = redisUtils.getValue(key);
        System.out.println("get name: " + value);
    }

    @GetMapping("/nodes_info")
    public Map<String, Object> getAllNodesInfo() {
        LettuceConnectionFactory factory = Objects.requireNonNull((LettuceConnectionFactory) redisTemplate.getConnectionFactory());
        try {
            factory.getConnection().getSentinelConnection(); // lettuceConnection.sentinelConfiguration == null 了
        } catch (InvalidDataAccessResourceUsageException e) {
            System.out.println("【可验证】Spring Boot 在自动配置时，并没有把 YAML 里的哨兵参数设置到 LettuceConnection 对象中，而是设置到了 LettuceConnectionFactory（连接工厂）中。");
            System.out.println("【可验证】对于 Lettuce 驱动来说，它在启动时已经根据配置决定了它是以“哨兵模式”运行的。它不需要在每个具体的 Connection 对象里再塞一个 sentinelConfiguration 引用。");
        }

        Map<String, Object> result = new HashMap<>();
        RedisSentinelConfiguration config = Objects.requireNonNull(factory.getSentinelConfiguration());
        // master name
        result.put("sentinelMasterName", config.getMaster());
        // 哨兵节点
        result.put("sentinelNodes", config.getSentinels());
        // 监听哨兵订阅（Pub/Sub）：当你配置了哨兵地址，Lettuce 会启动一个专门的后台线程连接到哨兵。它会订阅哨兵的 +switch-master 频道。
        // 哨兵发布一条消息：“嘿，新主节点现在是 149 了！”
        // Lettuce 收到消息，在不销毁连接对象的情况下，直接在底层把物理连接重定向到新 IP。
        // Lettuce 内部维护着一张“地图”。
        // 虽然你的 LettuceConnection 看起来还是那个对象，但它底层的“物理指针”已经自动漂移了。
        // 所以，即便 sentinelConfiguration 字段在连接实例里是空的，只要LettuceConnectionFactory 是带着哨兵配置启动的，你的集群就具备高可用能力。
        try (RedisSentinelConnection sentinelConn = factory.getSentinelConnection()) { // 不是null!
            Iterable<RedisServer> masters = sentinelConn.masters();
            List<Map<String, Object>> replicationInfos = new ArrayList<>();
            masters.forEach(m -> {
                Map<String, Object> info = new LinkedHashMap<>();
                // master name
                info.put("sentinelMasterName", m.getName());
                // 法定选举人数
                info.put("sentinelQuorum", m.getQuorum());
                // master address
                info.put("masterAddress", m.getHost() + ":" + m.getPort());
                replicationInfos.add(info);
                Iterable<RedisServer> replicas = sentinelConn.replicas(m);
                List<String> replicaList = new ArrayList<>();
                replicas.forEach(r -> replicaList.add(r.getHost() + ":" + r.getPort()));
                // replicas address
                info.put("replicasAddress", replicaList);
            });
            result.put("replicationInfo", replicationInfos);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
        return result;
    }
}
```

<br>

RedisTest

```java
@SpringBootTest(classes = App.class)
public class RedisTest {

    @Resource
    private RedisUtils redisUtils;

    @Test
    public void test01() throws InterruptedException {
        // 往主库写
        redisUtils.set("name", "KJ", 60);
        Thread.sleep(1000);
        // 从主库读（这里需要注意，集群节点的时间必须严格保持一致，否则可能出现主库写了带有过期时间戳的数据，从库还没来得及同步就已经过期了，这样从库永远也查不到数据，得到的总是null）
        Object value = redisUtils.getValue("name");
        System.out.println(value);
        redisUtils.hSet("user", "name", "KJ");
        redisUtils.lPush("list", "KJ");
        redisUtils.sAdd("set", "KJ");
        redisUtils.zAdd("zset", "KJ", 1);
    }
}
```

<br>

