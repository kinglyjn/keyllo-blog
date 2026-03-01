title: Redis 发布订阅功能

author: kinglyjn

mathjax: true

tags:

  - pubsub
  - redis
  - lettuce

categories:

  - db_cache

  - redis

date: 2023-02-04 10:10:12

---



## Redis 发布订阅功能介绍

Redis 的 Pub/Sub 是一种典型的 **观察者模式** 实现，它是 Redis 中最轻量的通信方式。对于诸如目标是实现秒级刷新全集群应用节点的本地缓存，那么 Pub/Sub 是完美的选择。<!--more-->

* **解耦机制**：发布者 (Publisher) 往频道 (Channel) 发送消息，订阅者 (Subscriber) 监听频道。发布者不需要知道谁在听，订阅者也不需要知道消息谁发的。
* **实时性**：Redis 内部通过一个字典（Dict）维护频道与订阅者列表的映射。当消息到达时，Redis 会立即遍历该列表，将消息推送到 `所有活动的连接`。
* **内存级转发**：消息不落盘、不存储。它只是简单的 “转发”，如果没有订阅者在线，消息直接丢弃。
  * 你可能有疑问，发布者发布的消息存放在 redis 哪里？答案是 “无处安放”，它不存储在任何 Key 中，你无法像查询字符串或列表那样通过命令 “看到” 历史消息。
  * Redis 的发布订阅采用的是 **“推后即焚” (Fire and Forget)** 的模式。当发布者执行 publish 时，Redis 只是遍历内存中维护的 “订阅者名单”，将消息通过网络缓冲区（Output Buffer）推送到这些客户端的 Socket 中。
  * 一旦消息发送给了当前在线的订阅者，Redis 就会立即从内存中回收这条消息占用的空间。
  * 结果是消息不落盘，也不进入内存数据库。如果你在消息发布后 0.1 秒才上线订阅，你将永远错过这条消息。

<br>



**难道一点痕迹都找不到吗？**

虽然你看不到“消息内容”，但你可以通过以下手段观察  “发布订阅的状态”：

```bash
# 查询所有频道或相关频道
> pubsub channels
> pubsub channels *cache*

# 查看 owlias:cache:clear 频道有多少人在线
> pubsub numsub owlias:cache:clear

# 返回全集群范围内通过 PSUBSCRIBE 订阅的模式数量总和
> pubsub numpat

# 订阅某频道消息，开始阻塞接收消息
> subscribe channel1
# 退订，如果不带参数，则退订该连接下的所有频道。
> unsubscribe channel1

# 模式订阅。支持通配符（如 ?、*），监听匹配的所有频道。
> psubscribe user:*
# 模式退订。停止监听匹配的模式。
punsubscribe user:*

# 发布某频道消息
> publish channel1 xxx

# 监控实时流量 (monitor)，假如你想看到消息时如何从主节点一掠而过的，可以使用 monitor 指令（注意性能）：
> monitor
```

<br>



**内存buffer区的参数调优**

Redis Pub/Sub 的未消费存放在内存的输出缓冲区（Output Buffer）中。如果订阅者消费太慢，缓冲区积压到上限，Redis 为了保护自己不被撑爆，会强制断开这个订阅者的连接。这就是为什么你有时会发现 Java 客户端莫名其妙断开订阅的原因。并且更严重的是Redis 是单线程处理命令的，如果内存被占满，会导致 Redis 触发操作系统 OOM Killer，甚至导致整个集群雪崩。  pubsub内存上限可以通过下述参数进行调节：

```bash
# 格式：client-output-buffer-limit <class> <hard limit> <soft limit> <soft seconds>
# 对于发布订阅，对应的 <class> 是 pubsub
# hard limit (硬限制)：如果缓冲区大小超过这个值，Redis 立即关闭该客户端连接。
# soft limit (软限制)：如果缓冲区大小超过这个值，但还没到硬限制。
# soft seconds (持续时间)：如果缓冲区超过 “软限制” 并持续了这么秒，Redis 就会关闭该连接。0表示立即关闭。
# pubsub 内存默认配置通常比较保守（比如 32mb 8mb 60）
# 如果是并发较高，建议根据业务量适当调大到 128mb 32mb 60
client-output-buffer-limit pubsub 32mb 8mb 60

# 这里对于这个 buffer 相关的配置还有几个，顺便介绍：
# 针对普通客户端请求的buffer内存大小，0 0 0 表示不限制。
# 普通请求通常是“一问一答”模式，客户端不读取返回结果，后续请求就发不进来，所以通常不会导致缓冲区无限堆积。
client-output-buffer-limit normal 0 0 0

# 针对主从同步（Replication）的缓冲区。
# 注意它指的不是Redis存储数据的内存空间，而是Master为了把数据同步给从节点而开辟的待发送数据缓冲区的大小。
# 实际的数据存储的内存参数是 maxmemory，比如你限制 Redis 只用 8GB 存数据。
# 这里的参数指的是缓冲区积压达到 256MB，或者超过 64MB 并持续了 60秒，主机会断开与该从机的同步。
# 一旦断开，Replica 会尝试重连，通常会触发一次全量同步 (Full Resync)
# 全量同步会 fork 子进程、生成 RDB 文件，这对生产环境的性能影响极大，甚至导致 Master 瞬间卡死。
# 如果存在大批量写入，建议调大到 512mb 128mb 60，防止写入时从机因为瞬时积压导致频繁断开重连。
client-output-buffer-limit replica 256mb 64mb 60
```

<br>



**Redis PubSub 典型的应用场景**

在企业级架构中，Pub/Sub 通常用于以下非持久化、对实时性要求极高的场景：

* **全局配置同步（本地缓存刷新）**：当数据库数据更新时，通过 Redis 频道广播一个 “清除缓存” 的消息，所有 应用节点的 Caffeine 本地缓存收到后自动失效。
* **简单的即时聊天 (IM)**： 由于不需要存储历史记录，仅用于在线用户间的消息即时推送。
* **异构系统解耦**： 不同语言编写的服务（Java, Python, Go）通过共同监听一个 Channel 来同步简单状态。

使用 Redis Pub/Sub 处理消息的逻辑是，比如使用这种机制刷新多个节点的本地缓存，这种消息 “丢了就丢了”，最坏的结果不过是读取到旧缓存，下次自然会更新，没必要为了它增加 Redis 存储压力。如果你的业务场景要求：“即使订阅者掉线，回来后也要能看到刚才错过的消息”，比如订单支付通知、关键日志审计等消息，那么 redis 的 Pub/Sub 就不适合你了。这时候你应该考虑：

* 方案一：Redis List (简单队列)。
  * 使用 lpush 存入，lrange 查看，rpop / brpop / brpoplpush 出队消费。
  * 缺点是：不支持广播，一条消息只能被一个消费者拿走。
* 方案二：Redis Stream（优点就是快、但缺点是内存限制，一般实际中平衡起来还是方案三）。
  * 这是 Redis 5.0+ 引入的强力功能。
  * 消息会持久化存储在 Redis 里，你可以通过 xrevrange 查看历史记录。
  * 支持消费组，支持 ACK 确认。
* 方案三：使用其他产品的消息队列模型，如 RabbitMQ、RocketMQ、Kafka、Pulsar 等。

<br>



## 实践中的避坑指南

虽然 Pub/Sub 很好用，但在高并发、高可用的生产环境下，如果不注意以下几点，可能会引发灾难：

* 坑一：消息丢失（无堆积能力），如果订阅者网络闪断，哪怕只有 1 秒，在这 1 秒内发出的所有消息，该订阅者永远无法收到。所以正如我上述所说，Pub/Sub 并不适合处理对可靠性要求极高的业务（如订单支付成功通知）。如果不能丢消息，请改用 Redis Stream 或 RocketMQ 等其他消息订阅服务。
* 坑二：订阅者连接“爆炸”（Buffer 溢出），如果订阅者消费速度跟不上生产速度，Redis 会为每个订阅者维护一个输出缓冲区（Output Buffer）。缓冲区打满后，Redis 会为了保护自己而强制断开该客户端连接。在应用端`订阅者的回调方法必须极快`，严禁在里面写耗时 IO 或死循环。建议在回调里只做 “任务分发”，将消息丢入线程池异步处理。
* 坑三：集群模式下的 “带宽风暴”。在 Redis Cluster 中，Pub/Sub 是全集群广播的。你在节点 A 发布一条消息，节点 B、C、D 全都会在内部转发一遍。如果 Channel 极多且消息量极大，会严重消耗集群内部带宽。在 Redis 7.0+ 建议使用 Sharded Pub/Sub（分片发布订阅）。
* 坑四：阻塞与连接重用。一个连接一旦执行了 subscribe 命令，它就进入了订阅模式，无法再执行 GET/SET，在应用端，比如 Spring Data Redis 中，必须使用独立的 RedisMessageListenerContainer，它会管理专用的连接。

<br>



## 应用端代码

### RedisPubSubConfig

```java
import com.demo.componet.pubsub.RedisCacheSubscriber;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.listener.adapter.MessageListenerAdapter;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import java.util.concurrent.Executor;

/**
 * @author KJ
 * @description Redis 发布订阅配置
 */
@Configuration
public class RedisPubSubConfig {
    private static final Logger log = LoggerFactory.getLogger(RedisPubSubConfig.class);

    @Bean(name = "redisSubExecutor")
    public Executor redisSubExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(1000);
        executor.setThreadNamePrefix("RedisSub-");
        executor.initialize();
        return executor;
    }

    @Bean
    public RedisMessageListenerContainer container(LettuceConnectionFactory connectionFactory,
                                                   @Qualifier("redisSubExecutor") Executor executor,
                                                   MessageListenerAdapter cacheInvalidateAdapter) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.setTaskExecutor(executor); // 关键：异步化，避开“缓冲区溢出” 的坑

        // 订阅一个或多个频道
        // 固定频道订阅：用于特定业务
        container.addMessageListener(cacheInvalidateAdapter, new ChannelTopic("owlias:cache:clear"));
        // 模式匹配订阅：用于一类业务 (如：owlias:events:*)
        // container.addMessageListener(adapter, new PatternTopic("owlias:events:*"));
        log.info("Redis 消息监听容器已启动，使用异步线程池处理回调");
        return container;
    }

    /**
     * 消息监听适配器：指向具体的消息处理方法
     */
    @Bean
    public MessageListenerAdapter cacheInvalidateAdapter(RedisCacheSubscriber subscriber) {
        // 使用序列化器解析消息体，这里默认使用 String
        return new MessageListenerAdapter(subscriber, "onMessage");
    }
}
```

<br>

### RedisCacheSubscriber

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * @author KJ
 */
@Component
public class RedisCacheSubscriber {
    private static final Logger log = LoggerFactory.getLogger(RedisCacheSubscriber.class);

    public void onMessage(String message, String channel) {
        log.info("收到 Redis 广播消息 | 频道: {} | 内容: {}", channel, message);
        try {
            handleMessage(message, channel);
        } catch (Exception e) {
            log.error("处理 Redis 订阅消息异常", e);
        }
    }

    private void handleMessage(String message, String channel) {
        if ("owlias:cache:clear".equals(channel)) {
            log.info("正在执行本地缓存失效逻辑: channel={}, message={}", channel, message);
            // todo 生产避坑：逻辑必须简单（复杂逻辑建议丢入业务线程池）
        }
    }
}

```

<br>

### RedisCachePublisher

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

/**
 * @author KJ
 */
@Component
public class RedisCachePublisher {
    private static final Logger log = LoggerFactory.getLogger(RedisCachePublisher.class);

    private final RedisTemplate<String, Object> redisTemplate;
    public RedisCachePublisher(@Qualifier("masterRedisTemplate") RedisTemplate<String, Object> redisTemplate) {
        // 发布操作本质上是“写”操作，必须注入 masterRedisTemplate
        this.redisTemplate = redisTemplate;
    }

    public void publish(String channel, Object message) {
        try {
            log.debug("正在发布 Redis 消息至频道 {}: {}", channel, message);
            redisTemplate.convertAndSend(channel, message);
        } catch (Exception e) {
            log.error("发布 Redis 消息失败 | 频道: {}", channel, e);
            // 生产避坑：根据业务重要性决定是否需要补偿，或者记录审计日志
        }
    }
}
```

<br>

