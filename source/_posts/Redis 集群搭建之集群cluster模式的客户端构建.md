title: Redis 集群搭建之集群cluster模式的客户端构建

author: kinglyjn

mathjax: true

tags:

  - springdata
  - redis
  - cluster
  - lettuce

categories:

  - db_cache

  - redis

date: 2023-02-03 17:23:56

---



前面我们已经介绍了 redis 8.2.0 集群模式的搭建，这篇文章我们主要来介绍使用 Spring Data Redis 3.x 来构建集群模式对应的客户端。客户端支持企业中常用的核心功能，包括读写分离、容灾发现，lua支持、pipeline支持、RedisJSON module 支持、集群监控等。废话不多说，直接上代码！



<!--more-->



## 依赖项

```xml
<properties>
    <java.version>17</java.version>
    <maven.compiler.source>17</maven.compiler.source>
    <maven.compiler.target>17</maven.compiler.target>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    <spring-boot.version>3.5.9</spring-boot.version>
    <logback.version>1.5.25</logback.version>
</properties>

<!--依赖版本-->
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
    <!--spring boot-->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-aop</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>

    <!--log-->
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
        <scope>compile</scope>
        <optional>true</optional>
    </dependency>
</dependencies>

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
            </configuration>
        </plugin>
    </plugins>
</build>
```

<br>



## 配置项

application.yml

```yaml
spring:
  data:
    redis:
      password: xxxxxx
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



## 配置类

### RedisClusterConfig

这里需要对目前 redis cluster 客户端主流的构建方式，做一个概述说明：对于 redis cluster 客户端，企业级的实践通常根据业务规模和技术栈深度，分为三个流派：

* **流派一：自研 AOP 路由**：特点是 在 Spring Data Redis 基础上，通过 AOP 拦截动态切换 RedisTemplate。
  它在 “开发成本” 和 “可控性” 之间取得了完美平衡。代码清晰，不需要依赖第三方笨重的中间件，适合大多数日活百万级的业务。
* **流派二：增强型客户端（如 Redisson）**：完全放弃 RedisTemplate，改用 Redisson。电商、金融公司更倾向于用 Redisson，它的 ReadMode 配置是完全声明式的。Redisson 对集群的支持是“保姆级”的。你只需要在 YAML 里写 readMode: "SLAVE"，它会自动处理所有路由、拓扑刷新和异步重连，甚至连分布锁都自带了。但它对 Redis 的原生操作做了大量封装，学习成本高，且比 Lettuce 更重，有时会存在一些难以捉摸的内存泄露风险。
* **流派三：Sidecar/Proxy 代理（顶级大厂方案）**：字节、阿里、美团等公司。它们在物理机或 Pod 里跑一个 Envoy 或 自研代理（如 Predixy）。应用代码里只配置一个普通的连接，指向 localhost:6380。优点是业务代码简单，运维能力强，所有的超时、连接池都在代理层统一配置，代理层统一负责流量分片、读写分离、热点 Key 拦截、熔断降级。缺点是架构极其复杂，需要强大的中间件团队支撑。

我们此处基于 Spring Boot 3.6.x + Lettuce ，采用流派一的方式来构建客户端，它支持自适应拓扑刷新、无损参数映射、读写分离等功能，这是中大型企业中 “自研 Redis 客户端” 最常用的方案。

```java
import com.fasterxml.jackson.databind.ObjectMapper;
import io.lettuce.core.ClientOptions;
import io.lettuce.core.ReadFrom;
import io.lettuce.core.cluster.ClusterClientOptions;
import io.lettuce.core.cluster.ClusterTopologyRefreshOptions;
import org.apache.commons.pool2.impl.GenericObjectPoolConfig;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.data.redis.LettuceClientConfigurationBuilderCustomizer;
import org.springframework.boot.autoconfigure.data.redis.RedisProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.connection.RedisClusterConfiguration;
import org.springframework.data.redis.connection.RedisPassword;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettucePoolingClientConfiguration;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

/**
 * 企业级 Redis Cluster 配置 (Spring Boot 3.6.x + Lettuce)
 *
 * @author KJ
 */
@Configuration
public class RedisClusterConfig {

    private final RedisProperties redisProperties;
    private final ObjectProvider<LettuceClientConfigurationBuilderCustomizer> builderCustomizers;
    private final ObjectMapper objectMapper; // 注入 Spring 默认的 ObjectMapper

    public RedisClusterConfig(RedisProperties redisProperties,
                              ObjectProvider<LettuceClientConfigurationBuilderCustomizer> builderCustomizers,
                              ObjectMapper objectMapper) {
        this.redisProperties = redisProperties;
        this.builderCustomizers = builderCustomizers;
        this.objectMapper = objectMapper;
    }


    /**
     * 拓扑刷新配置：这是集群高可用的核心，必须开启，
     * 当集群发生节点主从切换时，它会确保 Lettuce 客户端能够秒级感知到拓扑变化。
     */
    @Bean
    public ClusterTopologyRefreshOptions clusterTopologyRefreshOptions() {
        ClusterTopologyRefreshOptions.Builder builder = ClusterTopologyRefreshOptions.builder();
        RedisProperties.Lettuce.Cluster.Refresh refresh = redisProperties.getLettuce().getCluster().getRefresh();
        // 1. 处理自适应刷新
        if (refresh.isAdaptive()) {
            // 收到 MOVED 信号时自动触发刷新
            builder.enableAllAdaptiveRefreshTriggers();
            // 建议显式增加一个超时保护，防止频繁触发导致的性能损耗
            builder.adaptiveRefreshTriggersTimeout(ClusterTopologyRefreshOptions.DEFAULT_ADAPTIVE_REFRESH_TIMEOUT_DURATION); // 30s
        }
        // 2. 处理周期性刷新
        if (refresh.getPeriod() != null) {
            builder.enablePeriodicRefresh(refresh.getPeriod());
        } else {
            // 如果YAML没配置，生产环境建议开启一个较长的周期作为保底（如 60s）
            builder.enablePeriodicRefresh(ClusterTopologyRefreshOptions.DEFAULT_REFRESH_PERIOD_DURATION); // 60s
        }
        return builder.build();
    }

    /**
     * 集群客户端选项，在此设置拓扑刷新及其他可选项配置
     */
    @Bean
    public ClusterClientOptions clusterClientOptions(
      ClusterTopologyRefreshOptions refreshOptions) {
        return ClusterClientOptions.builder()
                .topologyRefreshOptions(refreshOptions)
                // 每当有一个新节点想加入工作，客户端会先查一遍 “花名册”（执行 CLUSTER NODES），
                // 如果名单里没有，客户端直接拒绝跟它建立连接，建议开启。
                .validateClusterNodeMembership(true)
                // 定义了当客户端发现它通往 Redis 节点的“路”断了（网络抖动或节点崩溃）时，
                // 它该如何对待你代码里发出的 GET/SET 请求。DEFAULT 通常等同于 
                // REJECT_COMMANDS（快速失败，拒绝接单），
                // 如果设置为 SUCCEED_IF_POSSIBLE (死等)，一旦 Redis 挂了太久，
                // 你的 Java 内存会被大量堆积的请求撑爆（OOM），或者导致业务线程全部卡死。
                .disconnectedBehavior(ClientOptions.DisconnectedBehavior.DEFAULT)
                .build();
    }

    /**
     * 主库连接工厂：MASTER，设为 @Primary
     */
    @Bean
    @Primary ////
    public LettuceConnectionFactory masterConnectionFactory(ClusterClientOptions clientOptions) {
        return new LettuceConnectionFactory(getClusterConfiguration(), getClientConfig(ReadFrom.MASTER, clientOptions));
    }

    /**
     * 从库连接工厂：SLAVE，读数据时优先使用
     */
    @Bean
    public LettuceConnectionFactory slaveConnectionFactory(ClusterClientOptions clientOptions) {
        return new LettuceConnectionFactory(getClusterConfiguration(), getClientConfig(ReadFrom.REPLICA_PREFERRED, clientOptions));
    }

    /**
     * 读写分离 Template：主库
     */
    @Bean(name = "masterRedisTemplate")
    public RedisTemplate<String, Object> masterRedisTemplate(@Qualifier("masterConnectionFactory") LettuceConnectionFactory factory) {
        return buildTemplate(factory);
    }

    /**
     * 读写分离 Template：从库
     */
    @Bean(name = "slaveRedisTemplate")
    public RedisTemplate<String, Object> slaveRedisTemplate(@Qualifier("slaveConnectionFactory") LettuceConnectionFactory factory) {
        return buildTemplate(factory);
    }
  
    /**
     * 读写分离 StringRedisTemplate：主库 (使用原生的字符串序列化的模板 StringRedisTemplate)
     */
    @Bean(name = "masterStringRedisTemplate")
    public StringRedisTemplate masterStringRedisTemplate(@Qualifier("masterConnectionFactory") LettuceConnectionFactory factory) {
        return new StringRedisTemplate(factory);
    }

    /**
     * 读写分离 StringRedisTemplate：从库 (使用原生的字符串序列化的模板 StringRedisTemplate)
     */
    @Bean(name = "slaveStringRedisTemplate")
    public StringRedisTemplate slaveStringRedisTemplate(@Qualifier("slaveConnectionFactory") LettuceConnectionFactory factory) {
        return new StringRedisTemplate(factory);
    }
    

    /**
     * 模板键值序列化配置
     */
    private RedisTemplate<String, Object> buildTemplate(LettuceConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);

        StringRedisSerializer stringSerializer = new StringRedisSerializer();
        template.setKeySerializer(stringSerializer);
        template.setHashKeySerializer(stringSerializer);
        // 使用注入的 objectMapper 保证序列化行为与 Web 层一致
        GenericJackson2JsonRedisSerializer jsonSerializer = new GenericJackson2JsonRedisSerializer(objectMapper);
        template.setValueSerializer(jsonSerializer);
        template.setHashValueSerializer(jsonSerializer);
        template.afterPropertiesSet();
        return template;
    }

    /**
     * 构建集群拓扑配置（ip-port/password/maxRedirects）
     */
    private RedisClusterConfiguration getClusterConfiguration() {
        RedisClusterConfiguration clusterConfiguration = new RedisClusterConfiguration(redisProperties.getCluster().getNodes());
        if (redisProperties.getPassword() != null) {
            clusterConfiguration.setPassword(RedisPassword.of(redisProperties.getPassword()));
        }
        if (redisProperties.getCluster().getMaxRedirects() != null) {
            clusterConfiguration.setMaxRedirects(redisProperties.getCluster().getMaxRedirects());
        }
        return clusterConfiguration;
    }

    /**
     * 构建通用的 ClientConfiguration
     * 核心：通过 builderCustomizers 确保 YAML 中的所有原生配置（如client-name等）生效
     */
    private LettuceClientConfiguration getClientConfig(ReadFrom readFrom, ClusterClientOptions clientOptions) {
        LettuceClientConfiguration.LettuceClientConfigurationBuilder builder = createBuilder(redisProperties.getLettuce().getPool());
        if (redisProperties.getTimeout() != null) {
            builder.commandTimeout(redisProperties.getTimeout());
        }
        if (redisProperties.getConnectTimeout() != null) {
            builder.shutdownTimeout(redisProperties.getConnectTimeout());
        }
        if (redisProperties.getSsl() != null && redisProperties.getSsl().isEnabled()) {
            builder.useSsl();
        }
        // 无损应用 Spring 原生定制器，确保不丢失 client-name 等特殊配置
        builderCustomizers.orderedStream().forEach(customizer -> customizer.customize(builder));
        // 设置读写策略与集群客户端选项
        builder.readFrom(readFrom);
        builder.clientOptions(clientOptions);
        return builder.build();
    }

    /**
     * 根据是否配置连接池选择不同的 Builder
     */
    private LettuceClientConfiguration.LettuceClientConfigurationBuilder createBuilder(RedisProperties.Pool pool) {
        if (pool != null && pool.getEnabled() != null && pool.getEnabled()) {
            // 如果开启了连接池配置，则使用 Pooling 构建器
            return LettucePoolingClientConfiguration.builder().poolConfig(getPoolConfig(pool));
        }
        return LettuceClientConfiguration.builder();
    }

    /**
     * 将 RedisProperties.Pool 转换为 commons-pool2
     */
    private GenericObjectPoolConfig<io.lettuce.core.api.StatefulConnection<?, ?>> getPoolConfig(RedisProperties.Pool pool) {
        GenericObjectPoolConfig<io.lettuce.core.api.StatefulConnection<?, ?>> config = new GenericObjectPoolConfig<>();
        config.setMaxTotal(pool.getMaxActive());
        config.setMaxIdle(pool.getMaxIdle());
        config.setMinIdle(pool.getMinIdle());
        if (pool.getMaxWait() != null) {
            config.setMaxWait(pool.getMaxWait());
        }
        return config;
    }
}
```

<br>



### RedisClusterMonitor

如果需要客户端具有监控和展示集群状态的能力，可以假如这个配置：

```java
import io.lettuce.core.cluster.RedisClusterClient;
import io.lettuce.core.cluster.event.ClusterTopologyChangedEvent;
import io.lettuce.core.cluster.models.partitions.RedisClusterNode;
import io.lettuce.core.event.EventBus;
import io.lettuce.core.event.connection.ConnectionActivatedEvent;
import io.lettuce.core.event.connection.ConnectionDeactivatedEvent;
import io.lettuce.core.event.connection.DisconnectedEvent;
import io.lettuce.core.event.metrics.CommandLatencyEvent;
import io.lettuce.core.metrics.CommandLatencyId;
import io.lettuce.core.metrics.CommandMetrics;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.stereotype.Component;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * @author KJ
 * @description 集群监控组件，如果需要对接Prometheus，可以将报警数据再集成到 MeterRegistry
 */
@Component
public class RedisClusterMonitor {
    private static final Logger log = LoggerFactory.getLogger(RedisClusterMonitor.class);

    private final LettuceConnectionFactory connectionFactory;

    public RedisClusterMonitor(LettuceConnectionFactory connectionFactory) {
        this.connectionFactory = connectionFactory;
    }

    @PostConstruct
    public void init() {
        log.info(">>>>>> 正在启动 Redis 监控组件...");
        if (connectionFactory.getNativeClient() instanceof RedisClusterClient clusterClient) {
            EventBus eventBus = clusterClient.getResources().eventBus();

            // 订阅 Lettuce 事件总线
            eventBus.get().subscribe(event -> {
                try {
                    if (event instanceof CommandLatencyEvent latencyEvent) {
                        handleLatencyEvent(latencyEvent);
                    } else if (event instanceof ClusterTopologyChangedEvent topologyEvent) {
                        handleTopologyEvent(topologyEvent);
                    } else if (event instanceof DisconnectedEvent || 
                               event instanceof ConnectionDeactivatedEvent) {
                        // spring.data.redis.lettuce.cluster.refresh.period 
                        // 通常设置为 60s，每隔60秒，Lettuce就发起一次 CLUSTER NODES 全量拓扑刷新。
                        // 刷新时它会尝试为集群中的 每一个主从节点建立一个临时连接来获取信息。
                        // 一旦拓扑信息拿到了，这些临时连接就会被 主动关闭，以节省资源。
                        // Lettuce 的 EventBus 会诚实地记录下每一次建立（Activated）和每一次
                        // 关闭（Disconnected）。从集群角度看这完全正常。所以在这里
                        // DisconnectedEvent、ConnectionActivatedEvent、及下面的 
                        // ConnectionActivatedEvent 的日志只被 debug 即可，没必要大惊小怪。
                        handleConnectionFailure(event);
                    } else if (event instanceof ConnectionActivatedEvent) {
                        log.debug("【通知】Redis 节点连接已激活: {}", event);
                    }
                } catch (Exception e) {
                    log.error("监控事件处理时发生未知异常", e);
                }
            });
            log.info(">>>>>> RedisClusterMonitor 已成功挂载至 Lettuce EventBus");
        } else {
            log.error(">>>>>> Redis 监控组件挂载失败：当前不是集群客户端！");
        }
    }

    /**
     * 处理延迟指标：这是发现“慢查询”的核心
     */
    private void handleLatencyEvent(CommandLatencyEvent event) {
        Map<CommandLatencyId, CommandMetrics> latencies = event.getLatencies();
        latencies.forEach((id, metrics) -> {
            // 获取 P99 延迟 (单位通常为微秒)
            Map<Double, Long> percentiles = metrics.getCompletion().getPercentiles();
            if (percentiles != null && !percentiles.isEmpty()) {
                Long p99 = percentiles.get(99.0);

                // 报警阈值：如果 P99 超过 50,000 微秒 (50ms)
                if (p99 != null && p99 > 50000) {
                    log.warn("【性能报警】Redis 慢查询 -> 命令: {}, 节点: {}, P99: {} μs, P50: {} μs",
                            id.commandType(), id.remoteAddress(), p99, percentiles.get(50.0));
                }
            }
        });
    }

    /**
     * 集群拓扑变更监控，如感知主从切换（Failover）
     */
    private void handleTopologyEvent(ClusterTopologyChangedEvent event) {
        String beforeNodes = event.before().stream()
                .map(this::getNodeInfo)
                .map(Object::toString)
                .collect(Collectors.joining("\n"));

        String afterNodes = event.after().stream()
                .map(this::getNodeInfo)
                .map(Object::toString)
                .collect(Collectors.joining("\n"));

        // 这才是真正的“大事”，需要 ERROR
        log.error("【核心报警】Redis 集群拓扑发生变更！");
        log.error("变更前节点列表>>>>:\n{}", beforeNodes);
        log.error("变更后节点列表>>>>:\n{}", afterNodes);
    }

    private String getNodeInfo(RedisClusterNode node) {
        // 判断状态：如果包含 FAIL 或 EVENTUAL_FAIL 则视为故障
        String status = "UP";
        if (node.is(RedisClusterNode.NodeFlag.FAIL) || node.is(RedisClusterNode.NodeFlag.EVENTUAL_FAIL)) {
            status = "FAIL";
        } else if (node.is(RedisClusterNode.NodeFlag.HANDSHAKE)) {
            status = "HANDSHAKE";
        } else if (node.is(RedisClusterNode.NodeFlag.NOADDR)) {
            status = "NOADDR";
        }
        List<Integer> slots = node.getSlots();
        String slotInfo = formatSlots(slots);
        return String.format("%s | %s | %s | %s | %s | slots: %s",
                node.getUri(), node.getNodeId(), status, node.getRole(), node.getSlaveOf(), slotInfo);
    }

    private String formatSlots(List<Integer> slots) { // 更严谨：处理 “多段不连续” Slot
        if (slots == null || slots.isEmpty()) return "none";
        Collections.sort(slots);
        StringBuilder sb = new StringBuilder();
        int start = slots.get(0);
        int last = start;

        for (int i = 1; i < slots.size(); i++) {
            int current = slots.get(i);
            if (current != last + 1) {
                // 发现不连续，闭合当前区间
                appendRange(sb, start, last);
                start = current;
            }
            last = current;
        }
        appendRange(sb, start, last);
        return sb.toString();
    }

    private void appendRange(StringBuilder sb, int start, int last) {
        if (!sb.isEmpty()) sb.append(", ");
        if (start == last) sb.append(start);
        else sb.append(start).append("-").append(last);
    }

    /**
     * 处理连接异常
     */
    private void handleConnectionFailure(Object event) {
        log.debug("【通知】Redis 连接断开/失效事件: {}", event);
    }

    private void sendAlert(String message) {
        // 伪代码：集成告警 SDK
        log.info("发送告警消息: {}", message);
    }

    @PreDestroy
    public void shutdown() {
        log.info("正在关闭 RedisClusterMonitor...");
    }
}
```

<br>



##  关键切面

### 读写分离实现切面

**RedisReadOnlyAspect**

```java
package com.demo.aop;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Redis 读写分离实现切面
 * 
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
```

**支持类：RedisRouteContext**

```java
package com.demo.aop;

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
```

<br>



## 关键组件

### 读写分离基础组件

**RedisReadOnly**

```java
package com.demo.componet;

import com.demo.config.RedisClusterConfig;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

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

**DynamicRedisTemplate**

```java
package com.demo.componet;

import com.demo.aop.RedisRouteContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.core.*;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import java.util.Collection;
import java.util.List;

/**
 * 代理 RedisTemplate：
 * 把两个 Template 封装进一个 DynamicRedisTemplate 中
 * 在业务应用层访问 redis cluster，看起来就像访问单机 redis 一样无感
 * 
 * 优点：
 * 极简性：对于 90% 的开发者来说，他们只需要知道 redisTemplate 怎么用，不需要理解主从分离的细节。
 * 强制安全性：delete、set 等写操作，我们可以硬编码强制使用 masterTemplate。这样即便有粗心的开发
 *         在写操作方法上加了 @RedisReadOnly，系统也不会因为尝试在从库写入而报错。
 * 可维护性：所有的路由逻辑都集中在 DynamicRedisTemplate 一个类中。如果以后引入了热点 Key 探测，
 *         或者想接入多级缓存，只需要在这个类里改，业务代码完全不用动。
 * 
 * 避坑指南：
 * 事务问题：如果在同一个事务中先写后读，由于主从延迟，@RedisReadOnly 可能会读到旧数据。
 *         企业级经验是在同一个 Transactional 方法内，建议保持使用主库。
 * 序列化一致性：务必确保 masterRedisTemplate 和 slaveRedisTemplate 使用的是完全相同的序列化器，
 *        否则会出现“主库存、从库取不出来”的诡异 Bug。
 */
@Component
@Primary // 让 Spring 默认注入这个动态模版
public class DynamicRedisTemplate<K, V> extends RedisTemplate<K, V> {

    /**
     * 使用 final 修饰，确保不可变性与线程安全
     */
    private final RedisTemplate<K, V> masterTemplate;
    private final RedisTemplate<K, V> slaveTemplate;
    private final ObjectMapper objectMapper;

    public DynamicRedisTemplate(
            @Qualifier("masterRedisTemplate") RedisTemplate<K, V> masterTemplate,
            @Qualifier("slaveRedisTemplate") RedisTemplate<K, V> slaveTemplate,
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
    private RedisTemplate<K, V> getActualTemplate() {
        return RedisRouteContext.isReadOnly() ? slaveTemplate : masterTemplate;
    }


    // --- 包装常用操作，实现“无感”使用 ---

    @Override
    @NonNull
    public ValueOperations<K, V> opsForValue() {
        return getActualTemplate().opsForValue();
    }

    @Override
    @NonNull
    public <HK, HV> HashOperations<K, HK, HV> opsForHash() {
        return getActualTemplate().opsForHash();
    }

    @Override
    @NonNull
    public ListOperations<K, V> opsForList() {
        return getActualTemplate().opsForList();
    }

    @Override
    @NonNull
    public SetOperations<K, V> opsForSet() {
        return getActualTemplate().opsForSet();
    }

    @Override
    @NonNull
    public ZSetOperations<K, V> opsForZSet() {
        return getActualTemplate().opsForZSet();
    }

    @Override
    @NonNull
    public GeoOperations<K, V> opsForGeo() {
        return getActualTemplate().opsForGeo();
    }

    @Override
    @NonNull
    public HyperLogLogOperations<K, V> opsForHyperLogLog() {
        return getActualTemplate().opsForHyperLogLog();
    }

    @Override
    @NonNull
    public Boolean hasKey(@NonNull K key) {
        return getActualTemplate().hasKey(key);
    }


    // --- 核心写操作：强制路由至 Master ---

    @Override
    @NonNull
    public Boolean delete(@NonNull K key) {
        return masterTemplate.delete(key);
    }

    @Override
    @NonNull
    public Long delete(@NonNull Collection<K> keys) {
        return masterTemplate.delete(keys);
    }


    /**
     * 如果你需要执行更复杂的底层命令
     */
    @Override
    public <T> T execute(@NonNull RedisCallback<T> action) {
        return getActualTemplate().execute(action);
    }

    /**
     * executePipelined for RedisCallback：
     * RedisCallback 让你直接跟 Redis 驱动（Lettuce/Jedis）握手。它最快，但写起来最痛苦，因为你要处理各种 byte[]。
     * 注意：这个方法的 pipeline 并没有处理跨节点哈希槽的逻辑。它只适用于确定所有 Key 都在同一个 Slot/节点（例如使用了 Hash Tag {}）的场景！
     * 如果需要更安全的 pipeline，请使用 {@link RedisPipelineExecutor#execute(List)}
     */
    @Override
    @NonNull
    public List<Object> executePipelined(@NonNull RedisCallback<?> action) {
        // Pipeline 默认使用 MasterTemplate，因为通常包含写操作。
        return masterTemplate.executePipelined(action);
    }

    /**
     * executePipelined for SessionCallback：
     * SessionCallback 相当于给回调套了一个“业务壳子”，让你能继续使用 opsForValue() 这种方便的方法，同时保证这些操作都在同一个 Pipeline 会话中。
     * 注意：这个方法的 pipeline 并没有处理跨节点哈希槽的逻辑。同样它只适用于确定所有 Key 都在同一个 Slot/节点！
     * 如果需要更安全的 pipeline，请使用 {@link RedisPipelineExecutor#execute(List)}
     */
    @Override
    @NonNull
    public List<Object> executePipelined(@NonNull SessionCallback<?> session) {
        return masterTemplate.executePipelined(session);
    }
}
```

<br>



### RedisJSON 支持组件

**DynamicRedisJsonTemplate**

```java
package com.demo.componet;

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
 * 1. 支持读写分离
 * 2. 支持 JSON.SET NX XX
 * 3. JSONPath 支持：支持部分更新和复杂查询
 * 4. 原子操作：数字递增、数组追加等原子操作
 * 5. 过期时间请结合 {@link DynamicRedisTemplate#opsForValue()} 或 {@link DynamicRedisTemplate#opsForHash()}
 *
 * 为什么需要 RedisJSON？（对比传统做法）
 * 在没有 RedisJSON 之前，我们要存储一个 User 对象，通常有两种苦逼做法：
 * 方案 A（String 序列化）：把整个对象转成 JSON 字符串存入。痛点是如果你只想修改一个字段，你必须本地处理和网络传输整个字符串。在高并发下，这极其浪费带宽且存在并发覆盖风险。
 * 方案 B（Hash 散列）：用 Redis Hash 存。痛点是无法处理嵌套结构。如果用户的address是个复杂的嵌套对象，Hash就没辙了。
 *
 * RedisJSON 的出现： 让你能像操作 MongoDB 一样，直接在 Redis 内部解析、查询和部分修改 JSON 文档。
 * 并且 JSON.SET (NX/XX) 更新某个字段是原子的，这完美解决了 “读取-修改-写回” 产生的并发冲突。
 *
 * 避坑指南：
 * 索引警告：虽然RedisJSON很快，但如果你对几万个JSON文档进行全量扫描，依然会阻塞单线程。建议配合 RediSearch 模块建立二级索引。
 * 内存占用：RedisJSON 在内存中以树状结构（Binary 格式）存储，通常比存储压缩后的字符串要稍微多占用一点空间，但换来的是极高的处理效率。
 *
 * @author KJ
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



### Pipleline 支持组件

**RedisPipelineExecutor**

```java
package com.demo.componet;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.RedisOperations;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.SessionCallback;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import java.util.List;

/**
 * Redis Pipeline 是什么？
 * 它是一种旨在提高命令吞吐量的优化技术。在传统的 Redis 操作中，客户端每发送一条命令，
 * 都必须等待 Redis 服务器处理并返回结果后，才能发送下一条（即 Round Trip Time, RTT）。
 * 而 Pipeline 允许客户端一次性发送多条命令，而不必等待每一条命令的回复，最后再统一读取所有响应。
 * Pipeline 的本质是利用了 TCP 的 流式传输。它将多条命令打包在一次网络请求中发送，从而显著减少了 IO 阻塞的时间。
 * <p>
 * Pipeline 的局限性：
 * 非原子性：Pipeline 仅仅是把命令打包发送，Redis 依然会一条条执行。如果其中一条失败，其他命令仍会继续执行。这与 Multi/Exec 事务不同。
 * 内存限制：Pipeline 发送的命令响应会暂存在服务器内存中。如果一次性打包过大（如数万条大 Value 操作），可能会导致服务器内存激增或客户端缓冲区溢出。
 * 不支持依赖操作：你不能在一次 Pipeline 中根据第一条命令的结果来决定第二条命令（例如：get a 之后根据 a 的值来 set b）。
 * <p>
 * 避坑指南：
 * 这是最关键的一点：在 Redis Cluster 模式下，Pipeline 中的所有命令必须映射到同一个哈希槽才能在同一个节点执行。
 * 如果你的 Pipeline 里包含 key1（在节点 A）和 key2（在节点 B），普通的 Pipeline 会直接报错。
 * <p>
 * 本类说明：
 * 1. 解决了 {@link DynamicRedisTemplate#executePipelined(SessionCallback)} 无法处理跨节点哈希槽的问题。它会尝试将命令按节点进行“逻辑分组”。
 * 2. 它是串行分片执行的。这是 Spring Data Redis 的默认行为。当你发送包含跨节点 Key 的 Pipeline 时，Spring 会：
 * ① 分析哪些 Key 属于 Node A，哪些属于 Node B。
 * ② 开启到 Node A 的连接，发送 Pipeline，等待返回。
 * ③ 开启到 Node B 的连接，发送 Pipeline，等待返回。
 * 瓶颈在于：如果你有 10 个 Master 节点，总耗时 = RTT1 + RTT2 + ... + RTT10。
 */
@Component
public class RedisPipelineExecutor {

    // 明确指出这是一个用于写的 MasterTemplate
    private final RedisTemplate<String, Object> masterRedisTemplate;
    public RedisPipelineExecutor(@Qualifier("masterRedisTemplate") RedisTemplate<String, Object> masterRedisTemplate) {
        this.masterRedisTemplate = masterRedisTemplate;
    }

    /**
     * 企业级集群 Pipeline 执行器：支持集群自动分片
     * 自动处理：Key 分组 -> 节点路由 -> 结果聚合
     */
    public List<Object> execute(List<PipelineTask> tasks) {
        // 1. 获取连接工厂（默认走 Master，因为 Pipeline 通常涉及写或强一致读）
        LettuceConnectionFactory factory = (LettuceConnectionFactory) masterRedisTemplate.getConnectionFactory();
        assert factory != null;

        // 2. 使用 RedisTemplate 的 executePipelined
        // Spring Data Redis 的 Lettuce 驱动在高版本中已经内置了部分分片路由逻辑
        return masterRedisTemplate.executePipelined(new SessionCallback<>() {
            @Override
            public <K, V> Object execute(@NonNull RedisOperations<K, V> operations) {
                for (PipelineTask task : tasks) {
                    // 这里的 operations 会自动根据 Key 路由到对应的 Slot
                    task.run((RedisOperations<String, Object>) operations);
                }
                return null; // 必须返回 null
            }
        });
    }

    @FunctionalInterface
    public interface PipelineTask {
        void run(RedisOperations<String, Object> ops);
    }
}
```

<br>



**RedisParallelPipelineExecutor**

```java
package com.demo.componet;

import io.lettuce.core.cluster.SlotHash;
import io.lettuce.core.cluster.api.StatefulRedisClusterConnection;
import io.lettuce.core.cluster.models.partitions.Partitions;
import io.lettuce.core.cluster.models.partitions.RedisClusterNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.connection.RedisStringCommands;
import org.springframework.data.redis.connection.lettuce.LettuceConnection;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.types.Expiration;
import org.springframework.data.redis.serializer.RedisSerializer;
import org.springframework.scheduling.concurrent.CustomizableThreadFactory;
import org.springframework.stereotype.Component;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

/**
 * 企业级并行集群 Pipeline 执行器
 * 核心原理：按物理节点分片 -> 多线程异步执行 -> 结果顺序聚合
 *
 * 本类说明：
 * 这是我们为了压榨集群性能自研的方案。它会：
 * 1. 在内存中完成分组（Node A 有哪些，Node B 有哪些）。
 * 2. 使用线程池同时开启 10 个请求，向 10 个 Master 发送。
 * 3. 总耗时 = MAX(RTT1, RTT2, ..., RTT10)
 * 相比于 {@link RedisPipelineExecutor} 在节点众多的集群中，速度提升可达数倍。
 *
 * 潜在风险点提示：
 * 内存压力：如果 tasks 数量非常大（例如一次性传入 100 万个 Key），聚合会占用大量堆内存。
 * 在业务层控制单次 execute 的 Map 大小，建议每批次 5000 ~ 10000 条。
 */
@Component
public class RedisParallelPipelineExecutor {
    private static final Logger log = LoggerFactory.getLogger(RedisParallelPipelineExecutor.class);

    // 明确指出这是一个用于写的 MasterTemplate
    private final RedisTemplate<String, Object> masterRedisTemplate;
    public RedisParallelPipelineExecutor(@Qualifier("masterRedisTemplate") RedisTemplate<String, Object> masterRedisTemplate) {
        this.masterRedisTemplate = masterRedisTemplate;
    }

    // redis-pipeline 线程池
    private static final ExecutorService PIPELINE_THREAD_POOL = Executors.newFixedThreadPool(
            Runtime.getRuntime().availableProcessors() * 2,
            new CustomizableThreadFactory("redis-pipeline-"));

    /**
     * 执行并行 Pipeline
     *
     * @param tasks 键值对任务，例如 Map<Key, Value>
     * @return 聚合后的执行结果
     */
    public LinkedHashMap<String, Object> execute(Map<String, PipelineValue> tasks) {
        if (tasks == null || tasks.isEmpty()) return new LinkedHashMap<>();

        // 1. 获取 Lettuce 原生集群分区表 (Partitions)
        // 修正：通过 connectionFactory.getConnection() 获取连接，再提取 NativeConnection
        Partitions partitions = (Partitions) masterRedisTemplate.execute((RedisCallback<Object>) connection -> {
            if (connection instanceof LettuceConnection) {
                // 获取原生 Lettuce 连接并提取分区信息
                Object nativeConn = ((LettuceConnection) connection).getNativeConnection();
                if (nativeConn instanceof StatefulRedisClusterConnection) {
                    return ((StatefulRedisClusterConnection<?, ?>) nativeConn).getPartitions();
                }
            }
            return null;
        });

        if (partitions == null) {
            log.warn("未能获取集群分区表，退回到单机模式或原生 Pipeline");
            return fallbackExecute(tasks);
        }

        // 2. 将任务按物理节点进行分片
        // 修正：显式指定分组后的 Map 类型，解决泛型推导编译错误
        Map<RedisClusterNode, LinkedHashMap<String, PipelineValue>> nodeGroups = tasks.entrySet().stream()
                .collect(Collectors.groupingBy(
                        entry -> partitions.getPartitionBySlot(SlotHash.getSlot(entry.getKey())),
                        // 必须使用 LinkedHashMap 保证 Pipeline 发送顺序
                        Collectors.toMap(
                                Map.Entry::getKey,
                                Map.Entry::getValue,
                                (u, v) -> {
                                    throw new IllegalStateException(String.format("Duplicate key %s", u));
                                },
                                LinkedHashMap::new
                        )
                ));

        // 3. 并行异步执行
        List<CompletableFuture<Map<String, Object>>> futures = nodeGroups.entrySet().stream()
                .map(entry -> CompletableFuture.supplyAsync(
                        () -> executeOnNode(entry.getKey(), entry.getValue()),
                        PIPELINE_THREAD_POOL // 使用专用线程池
                ))
                .toList();

        // 4. 聚合结果
        return futures.stream()
                .map(CompletableFuture::join)
                .flatMap(map -> map.entrySet().stream())
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        Map.Entry::getValue,
                        (u, v) -> u,
                        LinkedHashMap::new // 最终返回结果也保持有序
                ));
    }

    /**
     * 保底逻辑：直接执行，不分片
     * 当集群拓扑获取失败时，环境可能已经不稳定，此时使用最简单的 opsForValue 进行逐条写入
     */
    private LinkedHashMap<String, Object> fallbackExecute(Map<String, PipelineValue> tasks) {
        LinkedHashMap<String, Object> results = new LinkedHashMap<>();
        tasks.forEach((key, pValue) -> {
            try {
                if (pValue.ttlSeconds != null && pValue.ttlSeconds > 0) {
                    masterRedisTemplate.opsForValue().set(key, pValue.value, Duration.ofSeconds(pValue.ttlSeconds));
                } else {
                    masterRedisTemplate.opsForValue().set(key, pValue.value);
                }
                results.put(key, "OK");
            } catch (Exception e) {
                log.error("Fallback 写入失败 Key: {}", key, e);
                results.put(key, e.getMessage());
            }
        });
        return results;
    }

    /**
     * 在特定节点上执行单次 Pipeline 会话
     */
    private Map<String, Object> executeOnNode(RedisClusterNode node, LinkedHashMap<String, PipelineValue> subTasks) {
        log.debug("开始在节点 {} 执行 Pipeline，任务数: {}", node.getNodeId(), subTasks.size());

        // 显式获取序列化器
        @SuppressWarnings("unchecked")
        RedisSerializer<String> keySerializer = (RedisSerializer<String>) masterRedisTemplate.getKeySerializer();
        @SuppressWarnings("unchecked")
        RedisSerializer<Object> valueSerializer = (RedisSerializer<Object>) masterRedisTemplate.getValueSerializer();

        // 注意：Spring 的 executePipelined 在底层会自动根据 Key 路由
        // 既然我们已经按节点分好了组，这里的执行效率会极高，且不会发生 MOVED 重定向
        List<Object> results = masterRedisTemplate.executePipelined((RedisCallback<Object>) connection -> {
            subTasks.forEach((key, pValue) -> {
                byte[] rawKey = keySerializer.serialize(key);
                byte[] rawValue = valueSerializer.serialize(pValue.value);
                if (rawKey != null && rawValue != null) {
                    if (pValue.ttlSeconds != null && pValue.ttlSeconds > 0) {
                        // 场景 A：带过期时间写入
                        connection.stringCommands().set(rawKey, rawValue, Expiration.seconds(pValue.ttlSeconds), RedisStringCommands.SetOption.upsert());
                    } else {
                        // 场景 B：永久写入
                        connection.stringCommands().set(rawKey, rawValue);
                    }
                }
            });
            return null;
        });

        // 将结果与 Key 重新对应映射
        // 注意如果某个 set 操作因为某些 Redis 内部原因报错，results 里的对应项可能是异常对象。
        Map<String, Object> resultMap = new LinkedHashMap<>();
        List<String> orderedKeys = new ArrayList<>(subTasks.keySet());
        for (int i = 0; i < orderedKeys.size(); i++) {
            // 注意：results 的长度应与 subTasks 一致
            Object res = (results != null && i < results.size()) ? results.get(i) : null;
            resultMap.put(orderedKeys.get(i), res);
        }
        return resultMap;
    }

    public static class PipelineValue {
        private final Object value;
        private final Long ttlSeconds; // 过期秒数，null 表示永久

        private PipelineValue(Object value, Long ttlSeconds) {
            this.value = value;
            this.ttlSeconds = ttlSeconds;
        }

        public static PipelineValue of(Object value) {
            return new PipelineValue(value, null);
        }

        public static PipelineValue of(Object value, long ttlSeconds) {
            return new PipelineValue(value, ttlSeconds);
        }
    }
}
```

<br>



### LUA 支持组件

**RedisLuaExecutor**

```java
package com.demo.componet;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;
import java.util.Collections;
import java.util.Map;

/**
 * Redis Lua 脚本执行器：
 * Lua 脚本是解决原子性问题的终极武器
 * 典型应用场景如：高并发扣减库存、分布式限流、原子化状态转换
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
     * 脚本：原子扣减库存
     * 参数: KEYS[1] 商品库存Key，ARGV[1] 扣减数量
     * 返回: 1表示成功; 0表示库存不足; -1表示Key不存在
     */
    public static final String DECREMENT_STOCK_LUA =
            "if redis.call('exists', KEYS[1]) == 1 then " +
                    "  local stock = tonumber(redis.call('get', KEYS[1])); " +
                    "  local num = tonumber(ARGV[1]); " +
                    "  if stock >= num then " +
                    "    return redis.call('decrby', KEYS[1], num); " +
                    "  else " +
                    "    return 0; " +
                    "  end; " +
                    "else " +
                    "  return -1; " +
                    "end;";
    private static final DefaultRedisScript<Long> DECREMENT_STOCK_SCRIPT;

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
        DECREMENT_STOCK_SCRIPT = new DefaultRedisScript<>();
        DECREMENT_STOCK_SCRIPT.setScriptText(DECREMENT_STOCK_LUA);
        DECREMENT_STOCK_SCRIPT.setResultType(Long.class);

        JSON_SET_AND_EXPIRE_SCRIPT = new DefaultRedisScript<>();
        JSON_SET_AND_EXPIRE_SCRIPT.setScriptText(JSON_SET_AND_EXPIRE_LUA);
        JSON_SET_AND_EXPIRE_SCRIPT.setResultType(Long.class);

        JSON_GET_AND_TOUCH_SCRIPT = new DefaultRedisScript<>(JSON_GET_AND_TOUCH_LUA, Map.class);
    }

    /**
     * 业务功能：原子扣减库存
     */
    public Long decrementStock(String key, Long num) {
        return masterTemplate.execute(DECREMENT_STOCK_SCRIPT, Collections.singletonList(key), num);
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



## 相关的测试类

### 测试单元

#### 普通 pipeline 测试

RedisPipelineExecutorTest

```java
/**
 * @author KJ
 */
@SpringBootTest(classes = App.class)
public class RedisPipelineExecutorTest {

    @Autowired
    private RedisPipelineExecutor pipelineExecutor;

    @Autowired
    @Qualifier("masterRedisTemplate")
    private RedisTemplate<String, Object> redisTemplate;


    @Test
    @DisplayName("普通Pipeline读写测试：验证多命令批量执行")
    public void testExecute() {
        // 1. 准备任务列表
        List<RedisPipelineExecutor.PipelineTask> tasks = new ArrayList<>();

        String key1 = "pipe:test:key1";
        String key2 = "pipe:test:key2";
        String key3 = "pipe:test:key3";

        // 清理旧数据
        redisTemplate.delete(List.of(key1, key2, key3));

        // 定义三个不同的任务：普通设置、带过期设置、自增
        tasks.add(ops -> ops.opsForValue().set(key1, "value1"));
        tasks.add(ops -> ops.opsForValue().set(key2, "value2", 60, TimeUnit.SECONDS));
        tasks.add(ops -> ops.opsForValue().increment(key3));

        // 2. 执行 Pipeline
        // 注意：executePipelined 返回的是每个命令的结果列表
        List<Object> results = pipelineExecutor.execute(tasks);

        // 3. 验证返回结果（通常是 OK, true, 1L 等）
        Assertions.assertNotNull(results);
        Assertions.assertEquals(3, results.size());

        // 4. 验证 Redis 实际存储状态
        Assertions.assertEquals("value1", redisTemplate.opsForValue().get(key1));
        Assertions.assertEquals("value2", redisTemplate.opsForValue().get(key2));
        Assertions.assertEquals(1, ((Number) redisTemplate.opsForValue().get(key3)).intValue());

        // 5. 验证 TTL
        Long expire = redisTemplate.getExpire(key2, TimeUnit.SECONDS);
        Assertions.assertTrue(expire > 0 && expire <= 60);
    }

    @Test
    @DisplayName("普通Pipeline读写测试：测试速度")
    public void testExecutePerformance() {
        List<RedisPipelineExecutor.PipelineTask> tasks = new ArrayList<>();
        int count = 1000;
        for (int i = 0; i < count; i++) {
            int index = i;
            tasks.add(ops -> ops.opsForValue().set("bulk:key:" + index, "value111" + index));
        }
        long start = System.currentTimeMillis();
        pipelineExecutor.execute(tasks);
        long end = System.currentTimeMillis();
        System.out.println("执行耗时: " + (end - start) + "ms"); // 1341ms（老机器开的进程多）
    }

    @Test
    @DisplayName("普通Pipeline读写测试：验证Pipeline中部分失败不影响整体连接")
    public void testPipelineWithInvalidCommand() {
        List<RedisPipelineExecutor.PipelineTask> tasks = new ArrayList<>();

        // 故意制造一个错误：对字符串执行 increment
        String stringKey = "pipe:error:string";
        redisTemplate.opsForValue().set(stringKey, "haha");

        tasks.add(ops -> ops.opsForValue().set("pipe:aaa", "111"));
        tasks.add(ops -> ops.opsForValue().increment(stringKey)); // 这里会在执行时报错
        for (int i = 0; i < 100; i++) {
            int index = i;
            tasks.add(ops -> ops.opsForValue().set("pipe:bbb:" + index, index));
        }

        try {
            List<Object> results = pipelineExecutor.execute(tasks);
            Assertions.assertNotNull(results);
            System.out.println("Pipeline 执行结果: " + results);
        } catch (Exception e) {
            // 虽然中间 increment 异常后会被捕获，走到这里，但是 set pipe:bbb:0-99 是成功的
            System.out.println("捕获到预期异常: " + e.getMessage());
        }
    }
}
```

<br>

#### 并行 pipeline 测试

RedisParallelPipelineExecutorTest

```java
@SpringBootTest(classes = App.class)
public class RedisParallelPipelineExecutorTest {

    @Autowired
    private RedisParallelPipelineExecutor pipelineExecutor;
    @Autowired
    private DynamicRedisTemplate<String, Object> redisTemplate;

    @Test
    @DisplayName("并行Pipeline读写测试：验证不同TTL的Key在的写入表现")
    public void testMixedWriteWithTtl() {
        // 1. 准备测试数据
        String permanentKey = "test:perm:001";
        String volatileKey = "test:ttl:002";
        Map<String, RedisParallelPipelineExecutor.PipelineValue> tasks = new LinkedHashMap<>();
        tasks.put(permanentKey, RedisParallelPipelineExecutor.PipelineValue.of("PermanentData"));
        tasks.put(volatileKey, RedisParallelPipelineExecutor.PipelineValue.of("TemporaryData", 60)); // 10秒过期

        // 2. 执行并行 Pipeline
        Map<String, Object> results = pipelineExecutor.execute(tasks);

        // 3. 验证结果
        Assertions.assertNotNull(results, "返回结果不应为空");
        Assertions.assertEquals(2, results.size(), "结果集大小应与输入一致");

        // 4. 验证 Redis 实际存储状态
        Assertions.assertEquals("PermanentData", redisTemplate.opsForValue().get(permanentKey));
        Assertions.assertEquals("TemporaryData", redisTemplate.opsForValue().get(volatileKey));

        // 5. 验证过期时间 (TTL)
        long expire = redisTemplate.getExpire(volatileKey, TimeUnit.SECONDS);
        Assertions.assertTrue(expire > 0 && expire <= 60, "TTL 设置应在有效范围内");

        Long permanentExpire = redisTemplate.getExpire(permanentKey, TimeUnit.SECONDS);
        Assertions.assertEquals(-1L, permanentExpire, "永久 Key 的 TTL 应为 -1");
    }

    @Test
    @DisplayName("并行Pipeline读写测试：大规模分片压测模拟")
    public void testBulkInsertOrder() {
        Map<String, RedisParallelPipelineExecutor.PipelineValue> tasks = new LinkedHashMap<>();
        int count = 1000;
        for (int i = 0; i < count; i++) {
            tasks.put("bulk:key:" + i, RedisParallelPipelineExecutor.PipelineValue.of("val-" + i));
        }

        long start = System.currentTimeMillis();
        LinkedHashMap<String, Object> results = pipelineExecutor.execute(tasks);
        long end = System.currentTimeMillis();
        System.out.println("Parallel Pipeline 执行耗时: " + (end - start) + "ms"); // 1655ms（老机器开的进程多）
        Assertions.assertEquals(count, results.size());

        // 随机抽样验证数据准确性
        Assertions.assertEquals("val-500", redisTemplate.opsForValue().get("bulk:key:500"));
    }

    @Test
    @DisplayName("并行Pipeline读写测试：处理空任务或异常")
    public void testEmptyTasks() {
        Map<String, Object> results = pipelineExecutor.execute(null);
        Assertions.assertTrue(results.isEmpty());

        results = pipelineExecutor.execute(new LinkedHashMap<>());
        Assertions.assertTrue(results.isEmpty());
    }
}
```

<br>



### 相关服务测试

#### 普通读写分离测试

ProductService

```java
@Service
public class ProductService {

    @Resource // @Resource 是按照名称匹配的，注意这里的变量名
    private DynamicRedisTemplate<String, Object> dynamicRedisTemplate;

    @Resource
    private RedisLuaExecutor redisLuaExecutor;

    /**
     * 场景 A：普通写操作（默认走 Master）
     */
    public void updateStock(String productId, Integer count) {
        dynamicRedisTemplate.opsForValue().set("stock:" + productId, count);
    }

    /**
     * 场景 B：大流量读操作（自动分流到 Slave）
     */
    @RedisReadOnly
    public Object getProductInfo(String productId) {
        // 虽然代码写的一样，但因为有注解，底层自动切到了从库
        return dynamicRedisTemplate.opsForValue().get("stock:" + productId);
    }

    /**
     * 使用Lua脚本执行原子扣减库存
     */
    public Long decrementStock(String productId, Long count) {
        return redisLuaExecutor.decrementStock("stock:" + productId, count);
    }
}
```

<br>

ProductController

```java
/**
 * @author KJ
 * @description 测试集群模式下 redis 的读写分离、宕机后故障转移、lua脚本支持
 */
@RestController
@RequestMapping("/products")
public class ProductController {

    @Resource
    private ProductService productService;

    /**
     * 更新库存 - 验证 Master 写入
     * POST http://localhost:8080/products/updateStock
     */
    @GetMapping("/updateStock")
    public Map<String, Object> updateStock(@RequestParam String productId, @RequestParam Integer count) {
        productService.updateStock(productId, count);
        return Map.of("code", 200, "message", "库存更新成功");
    }

    /**
     * 获取产品信息 - 验证 Slave 读取
     * GET http://localhost:8080/products/info/{productId}
     */
    @GetMapping("/info/{productId}")
    public Map<String, Object> getProductInfo(@PathVariable String productId) {
        Object info = productService.getProductInfo(productId);
        return Map.of("code", 200, "data", info != null ? info : "未找到该产品信息");
    }

    /**
     * 扣减库存 - 验证 Lua 脚本
     * POST http://localhost:8080/products/decrementStock
     */
    @GetMapping("/decrementStock")
    public Map<String, Object> decrementStock(@RequestParam String productId, @RequestParam Long count) {
        Long result = productService.decrementStock(productId, count);
        return Map.of("code", 200, "data", result);
    }
}
```

<br>



#### RedisJSON相关测试

UserService

```java
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

    @Data
    public static class User {
        private Long id;
        private String name;
        private Integer points;
        private List<Role> roles;
    }

    @Data
    public static class Role {
        private Long id;
        private String name;
        private Integer orderNum;
        private List<String> permissions;
    }
}
```

<br>

UserController

```java
@RestController
@RequestMapping("/user")
public class UserController {

    @Resource
    private UserService userService;

    @PostMapping("/save")
    public Boolean saveUser(@RequestBody User user) {
        return userService.saveUser(user);
    }

    @PostMapping("/saveNX")
    public Boolean saveUserNX(@RequestBody User user) {
        return userService.saveUserNX(user);
    }

    @PostMapping("/saveXX")
    public Boolean saveUserXX(@RequestBody User user) {
        return userService.saveUserXX(user);
    }

    @DeleteMapping("/{id}")
    public Long deleteUser(@PathVariable Long id) {
        return userService.deleteById(id);
    }

    @GetMapping("/{id}")
    public User getUser(@PathVariable Long id) {
        return userService.getUser(id);
    }

    @GetMapping("/fields/{id}")
    public String getUserNameRoleNamePermissionList(@PathVariable Long id) {
        return userService.getUserNameRoleNamePermissionList(id);
    }

    @PatchMapping("/{id}/name")
    public Boolean updateName(@PathVariable Long id, @RequestParam String newName) {
        return userService.updateUserName(id, newName);
    }

    @PatchMapping("/{id}/role/newFirstRoleName")
    public Boolean updateFirstRoleName(@PathVariable Long id, @RequestParam String newFirstRoleName) {
        return userService.updateFirstRoleName(id, newFirstRoleName);
    }

    @PostMapping("/{id}/points/increment")
    public Double incrementPoints(@PathVariable Long id, @RequestParam Double points) {
        return userService.incrementUserPoints(id, points);
    }

    @PostMapping("/{id}/appendPermission")
    public Long appendPermission(@PathVariable Long id, @RequestParam List<String> permissions) {
        return userService.appendPermission(id, permissions);
    }

    @PostMapping("/{id}/countPermission")
    public Long countPermission(@PathVariable Long id) {
        return userService.countPermission(id);
    }

    @PostMapping("/{id}/roles")
    public String addRoles(@PathVariable Long id, @RequestBody List<String> roles) {
        userService.addUserRoles(id, roles.toArray(new String[0]));
        return "Roles added";
    }

    @GetMapping("/batch")
    public List<User> batchGetUsers(@RequestParam List<Long> ids) {
        return userService.batchGetUsers(ids);
    }

    @GetMapping("/user/{id}/firstRoleType")
    public String getFirstRoleType(@PathVariable Long id) {
        return userService.getFirstRoleType(id);
    }

    @GetMapping("/user/{id}/userFieldsLength")
    public Long userFieldsLength(@PathVariable Long id) {
        return userService.userFieldsLength(id);
    }

    @GetMapping("/user/{id}/roleNameStrLength")
    public Long roleNameStrLength(@PathVariable Long id) {
        return userService.firstRoleNameStrLength(id);
    }
}
```

<br>





