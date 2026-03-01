title: Redis 集群 cluster 模式下避坑之跨槽问题

author: kinglyjn

mathjax: true

tags:

  - cluster

  - redis

categories:

  - db_cache

  - redis

date: 2023-02-08 10:12:51

---



### 现象描述

在 redis 单机搭建和集群搭建测试的过程中，我发现一个非常诡异的问题，那就是相同的测试数据，单机和集群对 RedisJSON `JSON.MGET` 这条指令的执行结果不一致。准确的说是：



<!--more-->



在单机环境下：

```bash
> json.mget user:101 user:102 name
1) "\"Owlias\""
2) "\"zhangsan\""
```

而在集群环境下：

```bash
> type user:1
ReJSON-RL
> type user:2
ReJSON-RL

> json.get user:1 $.name
"[\"Owlias\"]"
> json.get user:2 $.name
"[\"zhangsan\"]"

> json.mget user:1 user:2 name
1) "\"Owlias\""
2) (nil)
```

集群模式下，json.mget 总是只返回第一条数据，而后面的数据总是空的！

<br>



### 问题排查

起初我以为是 RedisJSON 编译或版本的问题，但反复查证之后，也没有发现任何问题。后来反复又想，应该是集群自身的问题。因为集群模式下存在多个节点，redis数据是通过槽位分配与物理节点关联起来的。为了验证这一点，我做了如下查证和实验。

<br>

**第一：查证集群模式下数据的槽位和节点分布**

```bash
> cluster keyslot user:1
(integer) 10778

> cluster keyslot user:2
(integer) 6777

> cluster slots
1) 1) (integer) 0
   2) (integer) 5460
   3) 1) "192.168.1.149"
      2) (integer) 7001
      3) "674136805fcda75f54357b4edf714bf9ddd72e87"
      4) (empty array)
   4) 1) "192.168.1.166"
      2) (integer) 7002
      3) "4e2fc6df712ee6e5b5281a85e13405bd65bb5b61"
      4) (empty array)
2) 1) (integer) 5461
   2) (integer) 10922
   3) 1) "192.168.1.166"
      2) (integer) 7001
      3) "feb5f2fb59db726dd01b72e5ab11d2129c44f0d3"
      4) (empty array)
   4) 1) "192.168.1.224"
      2) (integer) 7002
      3) "789fe01ffc8d22b6c9d6b275a00bec6dd3185b1c"
      4) (empty array)
3) 1) (integer) 10923
   2) (integer) 16383
   3) 1) "192.168.1.224"
      2) (integer) 7001
      3) "941fdcb529ad5b7b5e73b9b53aeefed22065c924"
      4) (empty array)
   4) 1) "192.168.1.149"
      2) (integer) 7002
      3) "777db4f7a2c398f97bfdd6380d548602ba0167a4"
      4) (empty array)
```

我们看到，user:1 和 user:2 分别处在两个hash槽下，这两个hash槽挂在了同一个分片（或者物理节点）下面。也就是很有可能是因为是因为 “跨槽” （而不是跨节点）导致了数据没有查出来。于是我又做了如下实验。



**制造相同槽位数据，看看 json.mget 能否查到完整数据**

```bash
> json.set {user}:1 $ '{"name":"Owlias", "age":23}'
> json.set {user}:2 $ '{"name":"zhangsan", "age":25}'

> cluster keyslot {user}:1
(integer) 5474
> cluster keyslot {user}:2
(integer) 5474

> json.mget {user}:1 {user}:2 name
1) "\"Owlias\""
2) "\"zhangsan\""
```

果然查到了完整的数据！这也大致证实了我的猜想。

<br>



### 确认原因

我们知道，Redis Cluster 将数据划分为 **16384 个哈希槽（Hash Slots）**。每个 Key 根据其名称进行 CRC16 校验并取模，决定它落在哪个槽位。

* **单机模式**：所有 Key 都在同一个内存空间，JSON.MGET 可以横扫所有 Key。
* **集群模式**：
  * user:1 和 user:2 存储在集群中的不同槽位下，数据所在的物理分片可能相同也可能不同，不过都无所谓，这里的关键点是槽位是否相同。
  * Redis Cluster 的命令处理逻辑是 **基于 Slot（槽）** 而不是基于 **Node（节点）** 的。即使两个 Key 碰巧在同一个 Master 节点上，只要它们的 Slot 编号不同，Redis 内核在处理 MGET 或 JSON.MGET 这类多键命令时，依然会因为 **非原子性风险** 而拒绝跨槽执行。
  * 具体到这个例子上来说就是：当我在 192.168.1.166 执行 "json.mget user:1 user:2 name" 时：
    * Redis 检查第一个 Key user:1，发现它属于 Slot 10778，就在我本地，OK。
    * Redis 检查第二个 Key user:2，发现它属于 Slot 6777。关键点来了，虽然 6777 也在我本地，但由于它和第一个 Key 不在同一个 Slot，Redis 的原生逻辑会认为这是一个 “跨槽请求”。
    * 为了保持高性能和简单的锁逻辑，Redis 模块通常会直接对非首个 Slot 的 Key 返回 `nil`，或者报错 `CROSSSLOT Keys in request don't hash to the same slot`。

<br>

在 Redis 官方文档中，一个通用的准则是：**所有的多键操作在集群模式下都必须保证所有 Key 位于同一个 Slot。**RedisJSON 作为插件，必须遵循 Redis 内核的分布式协议。它不会为了 json.mget 专门去实现一套复杂的分布式协调逻辑，因为那会极大地拖慢响应速度。

<br>



### 跨槽相关的指令都有哪些？



其他可能存在挂跨槽问题的指令包括：

* 所有多键操作相关的指令：比如 mget, mset, bitop 等。

* json.mset：尝试一次性设置多个 json Key 的值。
* json.merge：将一个 Key 的内容合并到另一个 Key，必须保证源 Key 和目标 Key 在同一 Slot。
* json.arrcopy 或 json.move：如果涉及将数据从一个Key路径复制或移动到另一个Key，必须遵守槽一致性。
* 命令不跨槽，但 “数据引用” 跨槽的较隐性的场景。比如有些用户尝试在 JSON 内部存储其他 Redis Key 的名称（作为引用），然后通过 Lua 脚本或客户端逻辑进行二次查询。由于 `Lua` 脚本在集群中也受到 “所有 Key 必须在同一 Slot” 的限制，会导致脚本执行失败。

<br>



有一点你可以放心，那就是 JSONPath 本身不涉及跨槽，**JSONPath 是一种路径选择语法，它只作用于 “单个文档” 内部**。

* `JSON.GET user:1 "$.orders[*].id"`：这个路径只是在 user:1 这一个 Key 的内存块里跑的。
* 只要你是在单个 Key 上使用复杂的 JSONPath（哪怕包含深度通配符 `..` 和复杂的过滤器 `[?(@...)]`），它永远不会触发跨槽异常。

<br>



### 怎么去平衡数据跨槽问题？

请注意，我这里使用的是 ”平衡“，而不是 “解决”。因为在 redis cluster 模式下，数据跨槽本就不是一个问题，集群就是以多槽位为基础进行设计的，我们不能仅仅为了能使用 MGET 等某些指令，而让所有的数据都挤在同一个槽位（物理分片）下，这直接违背了 Redis Cluster 设计的初衷——`负载均衡`（Load Balancing），而造成了`数据倾斜`（Data Skew）。在实际的业务开发中，你需要在功能和架构之间做出合理的取舍。

<br>



#### 两个不是特别靠谱的方法

如果在 redis cluster 环境下，你还是想要 mget 或者 json.mget，是不是没有办法了呢？其实也不是，以下两个方法可以视情况使用。



**第一：Hash Tags **

如果实在是需要将某一类少量需要批量查询的数据整到同一个槽位，以方便频繁的 MGET 调用，我们也有办法，那就是 **使用 Hash Tags 强制将 Key 分配到同一槽位**。使用 `{}` 来强制它们落入同一个槽位。将 Key 改为：`{user}:1` 和 `{user}:2`。Redis 只会对 \{\} 里的内容进行哈希。因为 \{user\} 是一样的，这两个 Key绝对会落在同一个节点上。此时执行 "JSON.MGET {user}:1 {user}:2 name" 就能 100% 成功。

<br>



**第二：Pipeline**

或者我们也可以使用支持 pipeline 的客户端。但这时必须清醒地意识到，pipeline 并不是原子性的，它只是将多个命令打包，按照不同的分片，一次性发给了 redis cluster 各自对应的分片节点上而已。假如在获取数据的过程中，有其他人修改了数据 ，那么 mget 到的数据可能并不是你需要的！

```java
/**
 * 跨 Slot 的 MGET
 *
 * @param keys 需要查询的 Key 列表
 * @return 结果列表，顺序与输入 keys 一致。Key 不存在则对应位置为 null。
 */
public List<Object> mget(List<String> keys) {
    // 确保使用 StringRedisSerializer 处理 Key，保证与 Redis 里的 Key 格式一致
            RedisSerializer<String> stringSerializer = (RedisSerializer<String>) slaveRedisTemplate.getKeySerializer();
    return slaveRedisTemplate.executePipelined(new SessionCallback<>() {
        @Override
        public <K, V> Object execute(@NonNull RedisOperations<K, V> operations) {
            for (String key : keys) {
                // 使用 execute 里的底层连接获取原始 byte[]
                operations.execute((RedisCallback<Object>) connection -> {
                    connection.get(stringSerializer.serialize(key));
                    return null;
                });
            }
            return null;
        }
    }, stringSerializer); // <--- 关键点：指定这个 pipeline 的结果序列化器
}

/**
 * 跨 Slot 的 JSON.MGET
 *
 * @param keys      需要查询的 Key 列表
 * @param jsonPath  JSON 路径，例如 "$" 或 "$.name"
 * @return 结果列表，顺序与输入 keys 一致。Key 不存在或路径不存在则对应位置为 null。
 */
public List<Object> jsonMGet(List<String> keys, String jsonPath) {
    return slaveRedisTemplate.executePipelined(new SessionCallback<>() {
        @Override
        public <K, V> Object execute(@NonNull RedisOperations<K, V> operations) {
            for (String key : keys) {
                // 使用底层 connection 执行原生 RedisJSON 命令
                operations.execute((RedisCallback<Object>) connection -> {
                    // 参数：命令, Key, JSONPath
                    // 注意：RedisJSON 命令返回的是 byte[]，Pipeline 会自动收集
                    connection.execute("JSON.GET",
                            key.getBytes(StandardCharsets.UTF_8),
                            jsonPath.getBytes(StandardCharsets.UTF_8));
                    return null; // 回调必须返回 null
                });
            }
            return null; // SessionCallback 必须返回 null
        }
    });
}



@Test
public void testMGet() {
    List<Object> rawResults = pipelineExecutor.mget(Arrays.asList("pipe:test:key1", "pipe:test:key2", "pipe:test:key3"));
    System.out.println(rawResults);
}

@Test
public void testJsonMGet() {
    List<Object> rawResults = pipelineExecutor.jsonMGet(Arrays.asList("user:1", "user:2"), "$");
    System.out.println(rawResults);
}
```

<br>



#### 最推荐的方式：使用 RediSearch 索引查询

这是最推荐和专业的方法。对于 Redis Cluster 来说，RediSearch 就是专门来干查询检索这件事的，它几乎就是 redis 唯一能 “合法” 跨槽的特殊存在：

* 你可以创建一个索引，覆盖所有 user。
* 执行 `FT.SEARCH idx "@id:[1 2]"`。
* RediSearch 的搜索命令是分布式感知的。当你向集群中任何一个节点发送搜索请求，它会自动分发给集群中的所有主节点，汇总结果后返回给你。这才是处理集群模式下批量检索的 “降维打击” 方案。

<br>





