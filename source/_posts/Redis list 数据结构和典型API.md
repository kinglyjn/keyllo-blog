title: Redis list 数据结构和典型API

author: kinglyjn

mathjax: true

tags:

  - structure

  - redis

categories:

  - db_cache

  - redis

date: 2023-01-31 15:10:12

---



## 数据结构

### list 的底层实现——quicklist

底层结构**：**`quicklist（快速列表）`。

- 当前结构：在最新的 Redis（Redis 7.0 及以后版本）中，对象的底层物理存储结构已经全面进化为 quicklist。quicklist 是一个双向链表，每个节点都是一个 listpack（在旧版本中是 ziplist）。它结合了链表修改快的优点和数组内存紧凑、利用率高的优点。

  ```bash
  Redis List = 外层双向链表（保证扩展性） + 内层 listpack（保证内存紧凑和避免连锁更新）。
  ```

- 数据特点：

  - 如果你想用 List 实现堆栈 (Stack)，只需遵循 "同进同出"（例如 `lpush` + `lpop`）； 
  - 如果你想实现队列 (Queue)，只需遵循 "异进异出"（例如 `lpush` + `rpop`）。

<br>

<!--more-->



### 为什么不直接用普通链表？

普通链表每个节点都要存 prev 和 next 指针，如果你的 List 里存的是很小的数字（比如 1），指针占用的空间可能比数据本身还大，这太浪费内存了。而且链表节点在内存里是散乱的，对 CPU 缓存极不友好。

<br>



### listpack 具体是怎么保证内存紧凑和解决连锁更新的？

在 Redis 7.0 之前，节点里用的是 ziplist。它有个有个臭名昭著的致命缺点叫 “`连锁更新`”（某个元素变长导致后面所有元素的长度字段都要重写）。listpack 的出现彻底解决了这个问题。它是一块连续的内存，结构如下：

```bash
[总字节数] [元素个数] [元素1][元素2]...[结束标志 (End)]
```

每个 元素 (Entry)  内部长这样：

* Encoding: 数据的编码类型（是整数还是字符串）。
* Data: 实际的数据内容。
* Length: 该条目的长度（关键：它只记录当前条目的长度，不记录前一个的，因此规避了连锁更新）。

举个通俗点的例子，假设你要存储 1000 个单词：

* 传统链表方式：给每个单词准备一个独立的精美礼盒，每个盒子上系两根绳子连着前后的盒子。这导致盒子和绳子比单词还重，且仓库里摆得乱七八糟。
* 最新 Redis 方式 (quicklist + listpack)：
  * Redis 准备了几个大快递（这就是 quicklist 的节点）。
  * 每个箱子紧凑地塞进 100 个单词，单词之间挨在一起，不留空隙（这就是 listpack）。
  * 箱子与箱子之间用绳子连起来（双向链表）。

<br>



### 相关参数配置

你可以通过 Redis 配置来控制这个“箱子”（listpack）的大小：

* `list-max-listpack-size`: 设置每个 listpack 节点的最大字节数或元素个数，负数表示按内存大小限制，正数表示按元素个数限制。默认值为 -2，表示 8KB，这是最常用的黄金比例。
* `list-compress-depth`: 表示是否决定是否压缩中间节点，0表示不压缩，1表示除了头尾各 1 个节点外，中间所有的 `listpack` 都会被 LZF 算法压缩。这在 List 特别长且你只关注头尾操作时（如消息队列）非常省内存。默认值为0。

<br>



### 典型的用途

* 场景一：`消息队列 (Message Queue)`
  * 非阻塞队列：lpush + rpop（或者 rpush + lpop）；
  * 阻塞队列：lpush + brpop（或者rpush + blpop），如果队列为空，客户端会阻塞一定时间，直到有新消息进入，而不是盲目地轮询；
  * rpoplpush（或者 brpoplpush）：从一个列表弹出并压入另一个列表。常用于“可靠队列”模式，防止消息弹出后处理失败导致丢失。
* 场景二：`最新动态 / 时间轴 (Timeline)` ——例如微博的关注人动态、朋友圈信息流。由于最新的动态总是显示在最前面，List 的头插法非常契合。
  * lpush：将最新动态插入头部；
  * lrange：获取指定范围内的动态（实现分页），例如  lrange user:timeline 0 9 获取前10条；
  * ltrim：它是关键API，仅保留指定区间的元素，删除其余部分。用于维持一个“定长列表”，比如只保留最新的 1000 条，防止内存无限增长。ltrim user:timeline 0 999
* 场景三：`排行榜（按进入顺序）`——虽然通常用  ZSET，但如果只是简单的 “前 50 名入场观众”，List 就足够了。
  * lindex: 获取指定索引位置的元素。
  * llen：获取列表长度。
  * linsert：在某个特定元素前或后插入新元素。

<br>



## list API



```bash
# 队列
> lpush q1 1
> lpush q1 2
> lpush q1 3
(integer) 3
> lrange q1 0 -1
1) "3"
2) "2"
3) "1"

> rpop q1
"1"
> lrange q1 0 -1
1) "3"
2) "2"

> brpop q1 30
1) "q1"
2) "2"
> lrange q1 0 -1
1) "3"


# 可靠队列
> lpush list1 a b c
> lpush list2 1 2 3
> rpoplpush list1 list2
"a"
> lrange list1 0 -1
1) "c"
2) "b"
> lrange list2 0 -1
1) "a"
2) "3"
3) "2"
4) "1"

> brpoplpush list1 list2 30
"b"
> lrange list1 0 -1
1) "c"
> lrange list2 0 -1
1) "b"
2) "a"
3) "3"
4) "2"
5) "1"


# 栈
> lpush s1 1 2 3
(integer) 3
> lrange s1 0 -1
1) "3"
2) "2"
3) "1"
> lpop s1
"3"
> lpop s1
"2"
> lpop s1
"1"
> lpop s1
(nil)


# 最新动态
> lpush tline:user:1 aaa bbb ccc ddd eee ffff
> lrange tline:user:1 0 -1
1) "fff"
2) "eee"
3) "ddd"
4) "ccc"
5) "bbb"
6) "aaa"
> ltrim tline:user:1 0 4  #只留最近5条
OK
> lrange tline:user:1 0 -1
1) "fff"
2) "eee"
3) "ddd"
4) "ccc"
5) "bbb"


# 只有当列表存在的时候才添加（rpushx同理）
> lpushx list3 aaa  #不存在时
(integer) 0
> lpush list3 aaa
(integer) 1
> lpushx list3 bbb  #存在时
(integer) 2


# 在指定的元素之前插入
> rpush list6 a b c
> linsert list6 before b 111
(integer) 4
> lrange list6 0 -1
1) "a"
2) "111"
3) "b"
4) "c"
> linsert list6 before a 000
(integer) 5
> lrange list6 0 -1
1) "000"
2) "a"
3) "111"
4) "b"
5) "c"
> linsert list6 after b 222
(integer) 6
127.0.0.1:6379> lrange list6 0 -1
1) "000"
2) "a"
3) "111"
4) "b"
5) "222"
6) "c"


# 删除元素
# lrem keyxx countxx valuexx
# count > 0 : 从表头开始向表尾搜索，移除与 VALUE 相等的元素，数量为 COUNT 。
# count < 0 : 从表尾开始向表头搜索，移除与 VALUE 相等的元素，数量为 COUNT 的绝对值。
# count = 0 : 移除表中所有与 VALUE 相等的值。
> rpush list7 a a b a a
(integer) 5
> lrem list7 -2 a
(integer) 2
> lrange list7 0 -1
1) "a"
2) "a"
3) "b"
> lrem list7 0 a
(integer) 2
> lrange list7 0 -1
1) "b"


# 更改元素
> rpush list8 a b c
> lset list8 1 bb
OK
> lrange list8 0 -1
1) "a"
2) "bb"
3) "c"
> lset list8 -1 cc
OK
> lrange list8 0 -1
1) "a"
2) "bb"
3) "cc"


# 查询元素
> rpush list9 a b c
> lindex list9 1
"b"
> lindex list9 -1
"c"


# 列表长度
> llen list9
(integer) 3
```

