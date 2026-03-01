title: Redis 集群搭建之主从哨兵模式

author: kinglyjn

mathjax: true

tags:

  - sentinel

  - redis

categories:

  - db_cache

  - redis

date: 2023-02-02 10:12:23

---



## 主从哨兵集群的能力范围



这种模式的主要作用是：

* `容灾（高可用）`：主节点（Master）的数据会异步同步到两个从节点（Slave）。即使主节点磁盘损坏或数据丢失，从节点上依然保留着数据副本。不过，为了让这个架构真正发挥作用，通常还需要一个“灵魂组件”——Redis Sentinel（哨兵）。 <!--more-->
* `读写分离`：这是为了应对高并发流量的常用手段。主节点负责所有的写操作（SET, DEL, LPUSH 等），从节点 负责所有的读操作（GET, LRANGE, HGETALL 等）。由于 Redis 是单线程模型，单机的读写性能有上限。通过增加从节点，你可以线性横向扩展系统的读吞吐量。
* `分担备份压力`：这个作用非常有限 ，在生产环境最佳的建议是 ：
  * Master 节点：开启轻量级持久化，开启 **RDB**，且开启 **AOF** 但设置 `appendfsync everysec`。目的是万一 Master 意外重启，它能从本地加载绝大部分数据，不至于以 “空库” 身份危险地同步掉 Slave的数据。
  * 其中一个 Slave 节点：开启最严格的持久化 + 异地备份。开启 AOF 和 RDB，甚至可以设置 appendfsync always。你的 redis_backup.sh 脚本应该只在这个 Slave 上运行。Master 全力处理写数据操作；Slave 承担磁盘 IO 压力，去做压缩、打包和上传远端的操作。

<br>



虽然主从+哨兵模式能够容灾和提速，但它解决不了以下两个问题：

* **写负载均衡：** 所有的写请求依然只能去那一个主节点。如果你的写操作极其频繁（比如高频日志采集），一主两从帮不了你，你需要 **Redis Cluster（分片集群）**。
* **内存容量瓶颈：** 每个节点存的都是**全量数据**。如果你的数据量达到了 64GB，那么三个节点每个都需要 64GB 内存。

<br>



## 集群的搭建过程

### 搭建基础的一主两从

**主机准备：**

```
Master (主)：192.168.1.149  host01  +【💂哨兵】
Slave1 (从)：192.168.1.166  host02  +【💂哨兵】
Slave2 (从)：192.168.1.224  host03  +【💂哨兵】
```

<br>

**环境准备（所有机器执）**

```bash
# 【极其重要】集群节点时间同步！

# 关闭防火墙（或者开放 6379 端口）
systemctl stop firewalld
systemctl disable firewalld

# 系统内核参数设置
vim /etc/sysctl.conf
net.core.somaxconn = 2048            #已完成握手的队列限制（应该适当调大）
net.ipv4.tcp_max_syn_backlog = 2048  #正在握手的半连接队列限制（应该适当调大）
vm.overcommit_memory = 1             #允许内核在 fork 时不进行保守估计。
sysctl -p

# 调大系统文件描述符
vim /etc/security/limits.conf
* soft nofile 65535
* hard nofile 65535
echo "* soft nofile 65535" > /etc/security/limits.d/99-redis.conf
echo "* hard nofile 65535" >> /etc/security/limits.d/99-redis.conf

# 关闭内核的透明大页
echo never > /sys/kernel/mm/transparent_hugepage/enabled
echo never > /sys/kernel/mm/transparent_hugepage/defrag
```

<br>

**配置 Master 节点（host01）**

```bash
# 允许远程连接
bind 0.0.0.0
port 6379

# 后台运行
daemonize yes

# 设置密码（生产环境必选）
requirepass xxxxxx

# 主库建议也设置 masterauth，防止主从切换后原主库连不上新主库
masterauth xxxxxx

# 持久化建议开启混合模式
appendonly yes
aof-use-rdb-preamble yes

# 保护模式关闭（确保集群互通）
protected-mode no
```

<br>

**配置 Slave 节点 (host02 & host03)**

两个从库的配置完全一致，只需在 redis.conf 中显式指定主库。

```bash
bind 0.0.0.0
port 6379
daemonize yes
requirepass xxxxxx
masterauth xxxxxx

# 指定主库的 IP 和 端口
replicaof host01 6379

# 从库通常设为只读
replica-read-only yes

appendonly yes
```

<br>

**启动与验证**

按 **Master -> Slave1 -> Slave2** 的顺序启动服务：

```bash
redis-server /etc/redis.conf
```

验证主从状态，在 Master 上通过 redis-cli 查看：

```bash
redis-cli -a xxxxxx
> info replication
role:master         ###
connected_slaves:2  ###
slave0:ip=192.168.1.224,port=6379,state=online,offset=135036,lag=0  ###
slave1:ip=192.168.1.166,port=6379,state=online,offset=135036,lag=0  ###
master_failover_state:no-failover
master_replid:aec27a75b2fa3f36f320c253873f5a6237605ee0
master_replid2:0000000000000000000000000000000000000000
master_repl_offset:135036
second_repl_offset:-1
repl_backlog_active:1
repl_backlog_size:1048576
repl_backlog_first_byte_offset:8231
repl_backlog_histlen:126806
```

<br>



### 生产环境进阶：哨兵模式

单纯的主从架构在主库宕机时需要手动重启。为了实现全自动化运维，建议在三台机器上各启动一个 **Sentinel** 进程。



**配置 Sentinel**

三台机器的哨兵配置基本相同：

```bash
$ vim /etc/redis/sentinel.conf 

# 哨兵进程运行的端口，默认为 26379
port 26379

# 是否以守护进程（后台）方式运行。生产环境务必设为 yes
daemonize yes

# 核心监控配置：
# sentinel monitor <主库别名> <主库IP> <端口> <票数(Quorum)>
# 1. "mymaster"：给这组主从关系起的名字，客户端和后续配置都通过这个名字识别。
# 2. "192.168.1.149 6379"：当前主库的物理地址。
# 3. "2"：法定人数（票数）。表示至少需要 2 个哨兵节点判定主库下线，才会真正触发故障切换（Failover）。
sentinel monitor mymaster 192.168.1.149 6379 2

# 主库的连接密码：
# 如果 Master 设置了 requirepass，哨兵必须配置此项才能连接并监控主库。
sentinel auth-pass mymaster 123456

# 判定“主观下线”的时长（毫秒）：
# 如果哨兵在30秒内没收到主库的有效心跳回复，就会认为该主库“主观下线(SDOWN)”。
# 生产建议：如果业务对延迟敏感，可以调低至 5000-10000（5-10秒）。
sentinel down-after-milliseconds mymaster 30000

# 故障切换超时时间（毫秒）：
# 在执行故障转移时，如果在 180000ms（3分钟）内没有完成切换（如选举新主、同步数据等），
# 则认为本次 Failover 失败。它还决定了同一哨兵对同一主库进行两次切换之间的间隔。
sentinel failover-timeout mymaster 180000

# 建议将工作目录改到 redis 专用数据目录下
dir "/var/lib/redis/sentinel"

# 建议将 PID 文件路径与其他服务区分开，增加 -sentinel 后缀
pidfile "/var/run/redis-sentinel.pid"

# 哨兵日志文件位置，确保文件夹 /var/log/redis/ 存在
logfile "/var/log/redis/sentinel.log"
```

<br>

**启动哨兵**

也是三台机器逐个启动

```bash
$ redis-sentinel /etc/redis/sentinel.conf
```

查看Redis 哨兵（Sentinel）集群的信息的相关指令：

```bash
# 使用 redis-cli 查询（最常用），你可以连接到任意一台机器的 26379 端口。

## 查看整体状态摘要
$ redis-cli -p 26379 sentinel masters

## 查看当前 Master 的确切地址
$ redis-cli -p 26379 sentinel get-master-addr-by-name mymaster
1) "192.168.1.149"
2) "6379"

## 查看其他哨兵节点的信息
$ redis-cli -p 26379 sentinel sentinels mymaster

## 查看从库（Slaves）状态
$ redis-cli -p 26379 sentinel slaves mymaster

## 进入交互模式查看详细信息
$ redis-cli -p 26379
> info sentinel
sentinel_masters:1
sentinel_tilt:0
sentinel_tilt_since_seconds:-1
sentinel_total_tilt:0
sentinel_running_scripts:0
sentinel_scripts_queue_length:0
sentinel_simulate_failure_flags:0
master0:name=mymaster,status=ok,address=192.168.1.149:6379,slaves=2,sentinels=3

## 查看物理日志（查看切换细节）
# +sdown：主观认为下线。
# +odown：客观认为下线（大家投票通过）。
# +switch-master：这就是最关键的动作，表示主库已经切换成功。
tail -f /var/log/redis/sentinel.log
2733:X 03 Feb 2026 19:52:40.446 # +sdown master mymaster 192.168.1.149 6379
2733:X 03 Feb 2026 19:52:40.509 # +odown master mymaster 192.168.1.149 6379 #quorum 2/2
2733:X 03 Feb 2026 19:52:42.581 # +switch-master mymaster 192.168.1.149 6379 192.168.1.166 6379

## 如果发现哨兵列表里有已经不存在的旧哨兵信息（比如你更换了服务器 IP）
## 可以执行如下命令，这会重置状态并重新扫描当前的节点
redis-cli -p 26379 sentinel reset mymaster
```

如何优雅地管理或关闭哨兵：

```bash
# 如果是在本地
redis-cli -p 26379 shutdown

# 如果有密码
redis-cli -p 26379 -a 123456 shutdown

# 如果你是通过 systemctl（CentOS 7 的标准做法）管理的，直接使用系统指令
systemctl stop redis-sentinel

# 最粗暴的方式
ps -ef | grep redis-sentinel
kill -9 <PID>
pkill redis-sentinel # 或者直接按名称杀死
```

<br>

**需要注意的问题：**

* 复制风暴：如果数据量巨大，两个 Slave 同时同步 Master 会导致主库带宽瞬间拉满。在 Redis 7 中性能有所优化，但仍需注意带宽。
* 脑裂问题：如果网络分区导致两个 Master 出现，Sentinel 的 quorum 参数（即上面配置的 2）能有效防止大部分脑裂。关于票数的设定，比你的主从节点数是2n+1，那么一般哨兵票数设置为n+1，它能防止因为单个哨兵网络抖动而导致的 “误判” 或者 “脑裂”。
* 持久化一致性：Master 必须开启持久化。如果 Master 没开持久化且崩溃自动重启（数据为空），它会把空数据同步给所有 Slave，导致全量丢失。

<br>



## 两个问题

### 如果主节点真的挂了呢？

你可能已经注意到，上述哨兵模式配置文件中我们配置了诸如 “sentinel monitor mymaster 192.168.1.149 6379 2” 的信息，那么如果主节点挂了，哨兵重新选举了新的master，哨兵的配置文件需要手动做修改吗？答案是：**你完全不需要手动去修改配置文件。**这正是 Redis Sentinel（哨兵）最核心的“黑科技”之一。

* 哨兵会自动重写（Rewrite）配置文件：当 Master 发生故障，哨兵集群选举出新的 Master 后，哨兵会执行以下操作：
  * 修改内存状态：哨兵内部会立即更新 mymaster 的指向。
  * 重写配置文件：哨兵会自动修改自己以及其他哨兵机器上的 sentinel.conf 文件。
    * 你会发现原先写死的 192.168.1.149 会被自动替换为新主库的 IP。
    * 文件末尾通常会多出一行 "# Generated by CONFIG REWRITE"，记录下最新的主从拓扑结构。
    * 强制修改从库：哨兵会向其他所有的从库发送 `SLAVEOF` 指令，让它们去连接新的 Master。
* 那么，客户端（你的应用程序）该怎么办？
  * 既然主库 IP 变了，你的应用程序如果还连死在旧的 192.168.1.149 上，依然会报错。
  * **正确的生产实践是：客户端不连 Redis，而是连哨兵。**在你的代码（比如使用 Java 的 Jedis/Lettuce 或 Python 的 redis-py）中，你应该这样配置：
    * 不要提供 Redis IP，而是提供 3 个哨兵的 IP 和端口（26379）。
    * 程序启动，先问哨兵：“现在谁是 mymaster？”
    * 哨兵告诉程序：“现在的 Master 是 192.168.1.166”
    * 程序拿到 IP 后再去连接 Redis。
    * 发生切换时：哨兵会发布订阅消息通知程序，程序会自动断开旧连接，重新向哨兵要新地址。
* 一个极端的坑：老 Master 复活了怎么办？
  * 如果原先的挂掉的 192.168.1.149 机器修好了，重新启动了，它会发生什么？
  * 它启动时虽然配置文件（redis.conf）里可能写着 role: master，但哨兵会立即发现它。
  * 哨兵会冲过去告诉它：“时代变了，你现在只是个 Slave。”
  * 哨兵会自动修改 192.168.1.149 的 redis.conf，在里面加上 replicaof 192.168.1.166 6379。所以你唯一需要确保的是 ：确保 Redis 的用户对 redis.conf 和 sentinel.conf 有写权限，否则哨兵无法重写文件，重启后就会丢失状态。

<br>



### 能不能手动指定一个master？

答案是可以。在 Redis Sentinel 架构中，手动干预 Master 的归属通常有两种场景：临时切换（运维需要）和强制指定（架构重构）。你可以通过以下几种方式来实现：

**第一，优雅的手动切换：sentinel failover**

如果你只是想让当前的 Master 休息一下（比如你要重启 host01 进行系统维护），你不必关掉进程，也不用改配置，直接对任意一个哨兵发令：

```bash
redis-cli -p 26379 sentinel failover mymaster
```

原理：这会强制触发一次故障转移。哨兵会像处理真实宕机一样，投票选出一个最优的 Slave 提升为新 Master。

优点：过程平滑，数据丢失风险极小，且所有 Slave 和哨兵会自动同步新主库信息。

缺点：你不能“指名道姓”让谁当选，哨兵会根据从库的优先级、偏移量（数据同步程度）自动选一个最好的。

<br>

**第二，精准的 “点名” 切换：slaveof no one**

如果你非要让某一台指定的机器（比如 host03）立刻当上 Master，你需要两步走：

* 第一步：在目标从库上执行下属指令，连接到你想提升为 Master 的那个 Redis 实例（6379 端口）：

  ```bash
  redis-cli -p 6379 -a 123456 slaveof no one
  ```

  此时，这台机器会立刻把自己提升为 Master。

* 第二步：让哨兵承认现实，哨兵会发现 “哎？怎么多出一个 Master？”。根据优先级和配置，哨兵可能会试图把这台机器再降级回去。为了稳固地位，你通常需要对哨兵执行一次：

  ```bash
  redis-cli -p 26379 sentinel reset mymaster
  ```

  这种方式比较“暴力”，在生产环境建议配合 zcall 停掉其他节点后再操作，防止脑裂。

<br>

**第三，通过 “权重” 干预选举（最推荐的运维方案）**

如果你希望 host02 永远比 host03 更有资格当 Master（比如 host02 硬件更好，或是专为你的应用配置了高性能 SSD），你可以调整 replica-priority（从库优先级）。

```bash
# 数字越小，优先级越高。 当发生 SENTINEL failover 时，哨兵会优先选择数字最小的那台机器。
# 如果你把某台机器设为 replica-priority 0，那么它永远不会被提升为 Master。
host01: replica-priority 10
host02: replica-priority 100
host03: replica-priority 100
```

<br>

**第四，强制重定向：修改配置文件**

这是最彻底的办法，通常用于集群彻底重组。

* 关闭所有 Redis 和 Sentinel 进程。
* 修改各台机器的 redis.conf，手动设置 replicaof <目标新主IP> 6379。
* 清理所有 sentinel.conf 中的 "known-" 开头的行。
* 按 “新主 -> 从” 的顺序重新启动。

<br>



## SpringBootDataRedis 客户端

### 依赖配置

```xml
<properties>
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
        <artifactId>spring-boot-starter-data-redis</artifactId>
    </dependency>
  
    <!-- 必须：引入了 commons-pool2，Spring Boot 会自动利用它创建对象池，
       无需你在 Java 代码里写复杂的 GenericObjectPoolConfig -->
    <dependency>
        <groupId>org.apache.commons</groupId>
        <artifactId>commons-pool2</artifactId>
    </dependency>
  
    <!--序列化k-v-->
    <dependency>
        <groupId>com.fasterxml.jackson.core</groupId>
        <artifactId>jackson-databind</artifactId>
    </dependency>
  
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
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
</dependencies>
```

<br>

### 配置文件

```yml
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
      password: 123456
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

<br>

### RedisSentinelConfig

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

[注]：

![image-20260204114546775](/images/image-20260204114546775.png)

<br>

### RedisUtils

```java
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

### App 启动类

```java
@SpringBootApplication
public class App { // 自动注入了 RedisConnectionFactory
    public static void main(String[] args) {
        SpringApplication.run(App.class, args);
    }
}
```

<br>

### 其他测试类

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
        // 从主库读
        // 这里需要注意，集群节点的时间必须严格保持一致，否则可能出现主库写了带有过期时间戳的数据，
        // 从库还没来得及同步就已经过期了，这样从库永远也查不到数据，得到的总是null）
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

RedisTestController

```java
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
}
```

<br>

测试结果：

```bash
curl -XGET http://localhost:8080/redis/test/replication_info
{
    "master_failover_state": "no-failover",
    "role": "slave",
    "repl_backlog_size": "1048576",
    "connected_slaves": "0",
    "slave_priority": "100",
    "slave_repl_offset": "6062495",
    "slave_read_only": "1",
    "master_replid2": "0000000000000000000000000000000000000000",
    "replica_full_sync_buffer_size": "0",
    "replica_announced": "1",
    "master_replid": "fd795d955c8b865b47cd486893c8e567072c66ea",
    "master_link_up_since_seconds": "7607",
    "master_repl_offset": "6062495",
    "master_last_io_seconds_ago": "0",
    "repl_backlog_first_byte_offset": "5012040",
    "master_sync_in_progress": "0",
    "master_host": "192.168.1.149",
    "repl_backlog_histlen": "1050456",
    "master_link_status": "up",
    "master_current_sync_attempts": "1",
    "master_total_sync_attempts": "1",
    "total_disconnect_time_sec": "4032",
    "replica_full_sync_buffer_peak": "1048560",
    "second_repl_offset": "-1",
    "repl_backlog_active": "1",
    "master_port": "6379",
    "slave_read_repl_offset": "6062495"
}

curl -XGET http://localhost:8080/redis/test/nodes_info
{
    "sentinelMasterName": {
        "name": "mymaster"
    },
    "replicationInfo": [
        {
            "sentinelMasterName": "mymaster",
            "sentinelQuorum": 2,
            "masterAddress": "192.168.1.149:6379",
            "replicasAddress": [
                "192.168.1.224:6379",
                "192.168.1.166:6379"
            ]
        }
    ],
    "sentinelNodes": [
        {
            "id": null,
            "name": null,
            "host": "192.168.1.149",
            "port": 26379,
            "type": null,
            "masterId": null,
            "master": false,
            "replica": false
        },
        ...
    ]
}
```

<br>