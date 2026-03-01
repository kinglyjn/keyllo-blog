title: Redis hash 底层数据结构及常用API

author: kinglyjn

mathjax: true

tags:

  - structure

  - redis

categories:

  - db_cache

  - redis

date: 2023-01-31 14:11:22

---



## Hash 介绍

### 数据结构

hash的优点是比 string 更节省内存，原因是最新的hash底层结构是 `listpack`（压缩列表）或 `hashtable（dict）`（哈希表）。当字段较少且值较小时，使用内存极其紧凑的 listpack；当数据量增大时，自动转为 hashtable 以保证 $O(1)$ 的查询效率。当你创建一个小的 Hash 时，它在物理内存上是一块完全连续的字节数组，它不像传统的键值对那样通过指针连接，而是把 Field 和 Value 像排队一样交叉存储。

<!--more-->

```bash
[Header] [Field1] [Value1] [Field2] [Value2] [Field3] [Value3] [End-Flag]
```

**Header**: 记录了整个 listpack 的总字节数和元素个数。

**Entry (Field/Value)**: 每个 Entry 内部又分为：

* `Encoding`: 记录内容的类型（是整数还是字符串，占多少位）。
* `Content`: 实际的数据。
* `Backlen`: 记录当前这个 Entry 的长度。这是listpack设计的灵魂，有了它 Redis 才能实现从后往前遍历（因为知道了当前 Entry 占多少字节，往回跳一下就到了上一个 Entry 的末尾）。

就是因为 listpack 没有 redisObject 的 16 字节开销，没有 SDS Header 的 3 字节开销，也没有指针。它就是纯粹的、紧挨着的数据。它才能大大地节省内存空间。

<br>当 Hash 里的元素变多或者某个字符串太长，连续内存块太大了（查找和修改效率变低），Redis 就会把物理结构从 listpack 转换为 hashtable，这时的物理结构变成了典型的 数组 + 链表。这个转换过程在源码中被称为 `hashConvert`，它是一场不可逆的单向演变。此时的数据结构：

**Bucket**：内存中开辟一个连续数组，存的是指针。

**dictEntry**：每个指针指向一个物理上分散在各处的 `dictEntry` 链表结构体。

```c
struct dictEntry {
    void *key;     // 指向一个 SDS 对象 (Field)
    void *val;     // 指向一个 SDS 对象 (Value)
    struct dictEntry *next; // 指向下一个节点（处理哈希冲突）
};
```

内存开销也变成：每个 Field 和 Value 都是独立的 SDS 对象（带 Header）；每个 SDS 对象都有一个 redisObject  外壳；每个 链表节点 dictEntry 还有额外的指针开销。

在 Redis 的默认配置下，从 listpack 向 dict 的转换是由两个硬性阈值控制的（见 redis.conf），只要满足以下任意一个条件，就会发生 hashConvert：

* `hash-max-listpack-entries`：元素数量阈值，默认值512，当 Hash 中的键值对（field-value pair）数量达到 512 个时，查找某个 field 的平均时间复杂度虽然仍是 $O(N)$，但在 CPU 指令层面已经能明显感觉到延迟增加，不如哈希表的 $O(1)$ 快；
* `hash-max-listpack-value`：单个元素大小阈值，默认值64 字节，当 Hash 中任意一个 field 或 value 的长度超过 64 字节时，由于每次修改（增加或更新）大元素都需要调用 `realloc` 重新分配整块大内存，并进行大量的字节拷贝（memmove）。如果元素太大，这种“牵一发而动全身”的开销会拖累性能。

<br>

我们来看，当你执行 HSET myhash field1 "hello" 时，我们假设这是第一个 Key-Value 写入：

* 第一步：创建 “外壳” (redisObject)。Redis 首先在内存中申请一块 16 字节的空间，创建一个 redisObject，将 type 设置为 OBJ_HASH，将 encoding 设置为 OBJ_ENCODING_LISTPACK，此时，这个外壳的 ptr 指针还指着空。

* 第二步：初始化“容器” (listpack)。Redis 申请一块初始的连续内存（通常很小，几十字节），作为 listpack 的基石。

  * 写入 Header，前 4 字节记录总长度，接下来的 2 字节记录元素个数（此时为 0）；
  * 写入 End-Flag，末尾写入一个 `0xFF` 字节，标志结束。

* 第三步：字段 (field1) 的字节搬运，现在要将 "field1" 塞进去了：

  * 计算编码：Redis 发现 "field1" 是个字符串，且长度为 6；
  * 分配空间：在 listpack 的 End-Flag 之前腾出空间；
  * 搬运内容：将 "f", "i", "e", "l", "d", "1" 拷贝进去；
  * 计算并追加 Backlen：由于长度为 6，Backlen 只需要 1 个字节（最高位为 0，值为 6）。

  此时 Entry1 物理形态：

  ```bash
  [Encoding(1B)] [Content("field1")] [Backlen(1B)]
  ```

* 第四步：值 ("hello") 的字节搬运，紧跟在 field1 后面，重复上述动作：

  * 搬运内容：将 "h", "e", "l", "l", "o" 拷贝
  * 计算并追加 Backlen，长度为 5，追加 Backlen 字节

  此时 Entry2 物理形态：

  ```bash
  [Encoding(1B)] [Content("hello")] [Backlen(1B)]
  ```

* 第五步：收尾工作

  * 更新 Header：把 listpack 头部的总长度更新（现在包括了 Header + Entry1 + Entry2 + End-Flag 的总和），元素个数改为 2；
  * 挂载指针：将第一步中 redisObject 的 ptr 指针指向这块 listpack 内存的首地址。

<br>

如果是 “继续追加” 操作 HSET myhash field2 "world"：

* 重新分配 (realloc)：Redis 会申请一块更大的连续内存（通常比实际需要的大一点点，防止频繁重分配）；
* 移动 End-Flag：把 `0xFF` 往后挪；
* 填充新成员：在旧数据的末尾、新 `0xFF` 之前，把 field2 和 world 的字节流塞进去。
* 更新元数据：修改 Header 里的长度和计数。

总结：这场搬运的精髓

* 它没有为 "field1" 或 "hello" 创建独立的 SDS 对象，而是直接把它们的裸字节扔进了那块连续内存里。
* 在 listpack 状态下，field1 指向 hello 的关系不是靠指针维护的，而是靠物理相邻维护。

<br>



### 典型应用

`存储对象`（如用户信息）、`购物车`。

<br>



## hash API

```bash
# 基本用法
> hset user:1 name zhangsan age 25
(integer) 2
> hget user:1 name
"zhangsan"

> hmget user:1 name age
1) "zhangsan"
2) "25"
> hgetall user:1
1) "name"
2) "zhangsan"
3) "age"
4) "25"

> hlen user:1
(integer) 2

> hkeys user:1
1) "name"
2) "age"
> hvals user:1
1) "zhangsan"
2) "25"

> hdel user:1 age
(integer) 1
> hexists user:1 age
(integer) 0


# 只有当字段不存在时才设置（原子性）【注意并不存在hsetxx命令】
> hsetnx user:1 age 11
(integer) 1
> hsetnx user:1 age 11
(integer) 0


# 原子递增（例如购物车加1）
> hincrby cart:1 item:101 1
(integer) 1
> hincrby cart:1 item:101 1
(integer) 2
> hget cart:1 item:101
"2"


# 浮点数递增
> hincrbyfloat stats:1 score 0.5
"0.5"
> hget stats:1 score
"0.5"


# 增量式迭代（适合处理字段非常多的 Hash，比 HGETALL 安全）
# 注意如果存储了海量的用户信息（比如fields有几千项），请务必养成使用 HMGET 或 HSCAN 的习惯！
# 每次调用只会扫描一小部分数据，不会卡死服务器
# 在扫描过程中，如果有新的字段加入或被删除，SCAN 命令不保证你能 100% 看到所有的变化
# 但它能保证从开始到结束一直存在的元素一定会被扫到
hscan user:1 0 match age*
1) "0"       #下一个游标值。如果没有扫描完则返回的值为非零，游标重新变为0时，说明整张表已经扫描完毕了
2) 1) "age"  #本次扫描到的匹配结果列表
   2) "11" 
   

# 哈希字段级过期 (Redis7.4+ hash最实用的特性)，
# 以前只能给整个 Hash 设过期，现在可以精确到字段：
> hsetex user:1 ex 120 fields 2 name lisi age 22
(integer) 1
> httl user:1 fields 2 name age
1) (integer) 98
2) (integer) 98
> httl user:1 fields 2 name age
1) (integer) -2
2) (integer) -2
> hkeys user:1
(empty array)

> hsetex user:2 ex 60 fields 1 name zhangsan
(integer) 1
> httl user:2 fields 1 name
1) (integer) 23
> httl user:2 fields 1 name
1) (integer) -2
```

<br>



