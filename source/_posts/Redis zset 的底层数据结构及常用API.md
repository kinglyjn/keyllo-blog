title: Redis zset 的底层数据结构及常用API

author: kinglyjn

mathjax: true

tags:

  - structure

  - redis

categories:

  - db_cache

  - redis

date: 2023-01-31 18:32:51

---



## 底层数据结构

在最新的 Redis（特别是 7.0+ 版本）中，zset（有序集合）是一个非常有意思的设计，它为了平衡 “查询速度” 和“内存消耗”，采用了`双重`底层的物理结构。简单来说，ZSet 是由 `listpack` 进化为`跳表（skiplist）+ 字典（dict）` 的过程。

<br>

<!--more-->



### 具体的转化过程

**第一阶段：listpack（紧凑列表）—— 幼年形态**

当 ZSet 里的元素不多（默认 < 128 个）且每个元素都很短时，Redis 会使用 listpack。

* 物理形态：一块连续的内存。
* 存储方式：元素名（member）和分数（score）紧挨着存放。
* 示例：[ "apple", 10, "banana", 20, "cherry", 30 ]
* 为什么这么设计：在数据量极小时，遍历连续内存的速度非常快，而且省去了指针的内存开销。

<br>



**第二阶段：skiplist + dict —— 成年形态**

当数据量变大后，为了维持 $O(\log N)$ 的查询效率，ZSet 会变身为一个复合结构，并且这种变身是不可逆的：

* ① 跳表 (Skiplist) —— 负责“范围查找”：跳表是 ZSet 的核心。可以把它想象成一个 “带多级索引的快速电梯”。普通链表是找数字 100 得从 1 走到 100 步。而跳表则是：

  * 第 3 层（特快）：直接从 1 跳到 50，再跳到 100。（只需 2 步）
  * 第 2 层（快车）：跳得稍微近一点。
  * 第 1 层（普通）：最底层的原始链表。

  实现原理：每个节点随机生成一个“高度”，高度越高的节点，在索引层出现的次数越多，从而实现跨越式搜索。

* ② 字典 (Dict) —— 负责“精准定位”：跳表虽然找范围很快（比如“找分数在 60-100 之间的人”），但如果你想知道“小明的具体分数是多少”，跳表还是需要从上往下找。

  * Dict 的作用：记录 member -> score 的映射。
  * 效果：查询某个成员的分数，复杂度直接降为 $O(1)$。

<br>

注意，zset的变身是不可逆的！一旦 ZSet 变身为 skiplist，就算你把长字符串删掉，或者把成员删到只剩 1 个，它也不会自动变回 listpack。这样设计的原因是：

* **避免频繁抖动**：如果数据在临界点反复增删，自动来回转换会产生巨大的 CPU 消耗（因为要重新分配内存、重新构建跳表或压缩 listpack）。
* **简化逻辑**：保持结构稳定对 Redis 的整体稳定性更有利。

<br>



### 更通俗的一个类比示例

想象你要管理一个酒店的客人名单，要求按房号排序。

* 初期（listpack）客人很少。你就在一张小纸条上按顺序写 “101-张三, 102-李四”。找人一眼就看到了。
* 后期（Skiplist + Dict）：客满 2000 人。
  * 跳表 (Skiplist)：你做了几张索引卡。第一张卡记录每层的第 1 个人，第二张卡记录每 100 个人。你想找 1801 号房，先看大卡片跳到 1500，再看小卡片跳到 1800，最后走两步就到了。
  * 字典 (Dict)：你还准备了一个姓名索引表。如果有人问 “张三在几号房？”，你不用翻房号表，直接查姓名表，秒回：“101”。

<br>



### 为什么要这么设计？

这是典型的 **“空间换时间”** 和 **“多维索引” **的思想，那为什么要跳表而不用平衡树（如红黑树）呢？

* **范围查询更强**：跳表最底层是双向链表，做 ZRANGE（获取前 10 名）时，定位到第一个后往后拉就行，红黑树则需要中序遍历，更复杂。
* **并发友好**：修改跳表时，只需要局部锁住几个节点；平衡树可能需要大规模调整。

<br>



### 变身不可逆导致的内存碎片化问题

Redis 长期运行后，由于频繁的增删改以及底层 listpack 向 skiplist 的转化，难免会产生内存碎片（即：内存虽然空着，但物理地址不连续，导致无法分配给大对象）。除了暴力重启，Redis 官方提供了一套非常优雅的 “在线手术” 方案。

**核心大招：Active Defrag (自动清理)**

从 Redis 4.0 开始，官方引入了 Active Defrag 功能。它就像一个 “后台保洁员”，在不停止服务的情况下，通过将数据移动到连续的内存区域来压缩碎片。你只需要通过下面这个命令随时开启这个功能：

```bash
# 在进行清理前，你需要先看一眼数据，重点关注 mem_fragmentation_ratio（碎片率）
## < 1.0：说明内存由于开启了 SWAP 导致性能极差（不正常）。
## 1.0 ~ 1.5：正常范围。
## > 1.5：说明碎片已经超过 50%，此时必须启动 activedefrag。
> info memory

# 开启 Active Defrag
> config set activedefrag yes
```

<br>

它的工作流程如下：

* **扫描**：Redis 扫描内存中的所有数据。
* **拷贝**：如果发现某个数据块周围有空隙（碎片），它会把这个数据拷贝到一块全新的、连续的内存地址。
* **释放**：旧的、细碎的内存地址被释放，还给操作系统，从而形成大块连续空间。

<br>

但是，保洁员也怕 “帮倒忙”，如果清理动作太猛，会抢占处理请求的 CPU；如果太慢，又赶不上碎片产生的速度。因此，Redis 提供了一系列精细的控制参数：

* `active-defrag-ignore-bytes`: 默认100mb，碎片不到 100MB 时，先别管它。

* `active-defrag-threshold-lower`：默认10%，碎片率超过 10% 时，启动清理。

* `active-defrag-cycle-min`：默认1，最少分配 1% 的 CPU 时间给清理任务。

* `active-defrag-cycle-max`: 默认25，最多分配 25% 的 CPU 时间（保证不卡死业务）。

<br>

**Linux内核级别的控制——透明大页（Transparent Huge Pages, THP）问题**：

* Linux 默认开启了 THP，试图通过将 4KB 的小页合并成 2MB 的大页来提高性能。

* 这种合并动作会导致严重的写放大和延迟。更糟糕的是，Redis 的内存分配器 `jemalloc` 极其讨厌 THP，因为它会导致内存分配的颗粒度变粗，产生大量无法回收的“空隙”。

* 我们需要在redis服务主机执行以下命令彻底关闭它，这是redis运维的标准动作：

  ```bash
  echo never > /sys/kernel/mm/transparent_hugepage/enabled
  echo never > /sys/kernel/mm/transparent_hugepage/defrag
  ```

<br>

**其他辅助手段“重塑”数据**：

* AOF 重写：当你执行 AOF 重写时，Redis 会读取当前内存中的最简状态并重新写入一个新的 AOF 文件。虽然这主要是为了瘦身日志，但在某些情况下，重写过程中的内存分配会比长期乱序操作后的分布更合理。
* 手动主从切换（最推荐，业务零感知）：如果是集群环境，可以手动执行主从切换 (Failover)。让从节点变为主节点，然后重启旧的主节点，这样对业务的影响几乎为零。

<br>



### 其他核心的相关参数配置

你可以通过以下参数控制这个“变身”临界点，以下两个参数满足一个就会变身：

* `zset-max-listpack-entries`: 默认 128 个。如果你的成员个数达到了 129 个，即便每个成员都只是一个小数字（比如 1），Redis 也会认为：“成员太多了，线性遍历太慢，该用跳表了。”
* `zset-max-listpack-value`: 默认 64 字节。如果你只存了 1 个元素，但这个元素的字符串长度达到了 65 字节，Redis 也会认为：“这个元素太肥了，不适合呆在紧凑的连续内存块里，变身！”

<br>



### 典型的应用场景

* 不仅需要去重查询所有关注的人，还希望按关注时间排序或亲密度分页展示的场景（查询效率极高）
* 热门手游的 “战力排行榜” 这种功能

<br>



## zset API

```bash
# PlayerA 战力 5000，PlayerB 战力 6500
> zadd game:rank 5000 playerA 6500 playerB
(integer) 2


# PlayerA 战力增加 500，变为 5500
> zincrby game:rank 500 playerA
"5500"


# 玩家销号，移出榜单
> zrem game:rank playerA
(integer) 1


# 查看 PlayerB 的战力
> zscore game:rank playerB
"6500"


# 查看 playerB 的战力排名
> zadd game:rank 5000 playerA 4000 playerC
> zrevrank game:rank playerB  # 倒序，这里的0表示倒排的第一个
(integer) 0
> zrank game:rank playerB     # 正序，这里的3表示正排的第三个
(integer) 3


# 范围查询和分页
> zadd game:rank 7000 playerD 3000 playerE 2000 playerF 8000 playerG
> zrange game:rank 0 4 withscores  # 拉取战力最低的前5名（带着战力分数）
 1) "playerF"
 2) "2000"
 3) "playerE"
 4) "3000"
 5) "playerC"
 6) "4000"
 7) "playerA"
 8) "5000"
 9) "playerB"
10) "6500"
> zrange game:rank 0 4  # 拉取战力最低的前5名（不带战力分数）【0 -1 表示拉所有】
1) "playerF"
2) "playerE"
3) "playerC"
4) "playerA"
5) "playerB"
> zrevrange game:rank 0 4 withscores  # 拉取战力前5的大魔王（带着战力分数）【0 -1 表示拉所有】
 1) "playerG"
 2) "8000"
 3) "playerD"
 4) "7000"
 5) "playerB"
 6) "6500"
 7) "playerA"
 8) "5000"
 9) "playerC"
10) "4000"
> zrevrange game:rank 5 9 withscores   # 按照战力排行拉取第二页数据
1) "playerE"
2) "3000"
3) "playerF"
4) "2000"
> zrangebyscore game:rank 3000 5000    # 拉取战力在3000~5000的所有玩家（战力从小到大）
1) "playerE"
2) "playerC"
3) "playerA"
> zrevrangebyscore game:rank 5000 3000 # 拉取战力在3000~5000的所有玩家（战力从大到小）
1) "playerA"
2) "playerC"
3) "playerE"


# 统计榜单上一共有多少玩家
> zcard game:rank
(integer) 7
# 统计战力在7000~8000的玩家个数
> zcount game:rank 7000 8000
(integer) 2
# 统计战力在8000以上的玩家个数
> zcount game:rank 8000 +inf
(integer) 1
# 统计战力在2000以下的玩家个数
> zcount game:rank -inf 2000
(integer) 1


# 删除最菜的那些，保留战力前五名
> zremrangebyrank game:rank 0 -6  # 删除开头的 0~倒数第六名
(integer) 2
> zrange game:rank 0 -1 withscores
 1) "playerC"
 2) "4000"
 3) "playerA"
 4) "5000"
 5) "playerB"
 6) "6500"
 7) "playerD"
 8) "7000"
 9) "playerG"
10) "8000"


# 再删除战力最强的两个
> zremrangebyrank game:rank -2 -1
(integer) 2
> zrange game:rank 0 -1 withscores
1) "playerC"
2) "4000"
3) "playerA"
4) "5000"
5) "playerB"
6) "6500"


# 再删除分数在 4000~5000 的菜鸟
> zremrangebyscore game:rank 4000 5000
(integer) 2
> zrange game:rank 0 -1 withscores
1) "playerB"
2) "6500"


# 分数相同时，按名字的字母顺序（A-Z）排序
> zadd game:rank 8000 playerX 8000 playerY
(integer) 2
> zrange game:rank 0 -1 withscores
1) "playerB"
2) "6500"
3) "playerX"
4) "8000"
5) "playerY"
6) "8000"

# 查找名字在 playerX 和 playerZ 之间的玩家（Lexicographical 字典序）
> zrangebylex game:rank [playerX [playerZ
1) "playerX"
2) "playerY"
```



