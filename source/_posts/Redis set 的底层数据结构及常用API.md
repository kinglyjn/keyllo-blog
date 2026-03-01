title: Redis set 的底层数据结构及常用API

author: kinglyjn

mathjax: true

tags:

  - structure

  - redis

categories:

  - db_cache

  - redis

date: 2023-01-31 16:11:42

---



## 数据结构

在最新的 Redis（特别是 Redis 7.2 及以后版本）中，Set 对象的物理存储结构经历了重要的升级。为了平衡 “内存效率” 和 “查询性能”，Redis 会根据数据内容自动在三种底层结构间切换。我们可以把 Redis Set 想象成一个智能收纳盒，它会根据你放进去的东西自动变换形态。

<br>

<!--more-->



### 最新的三种物理结构

① **intset (整数集合) **—— “极简工位”。当你的 Set 里全部是整数，且元素数量较少时，Redis 使用 intset。

* 物理形态：一块连续的内存，像一排紧密排列的抽屉。
* 特点：极其节省空间，它会根据数字的大小（16位、32位或64位）自动升级抽屉的大小。
* 示例：{1, 2, 3} 这种纯数字集合。

② **listpack (紧凑列表)** —— “紧凑行李箱” —— 这是 Redis 7.2 引入的重要更新。以前 Set 只有 intset 和 hashtable。现在，如果数据包含字符串但量不大，Redis 会使用 listpack。

* 物理形态：也是一块连续的内存，但它比 intset 灵活，能存字符串。
* 特点：取代了以前的 ziplist，解决了连锁更新问题，专门用于在数据量小时压榨内存空间。

③ **hashtable (哈希表/字典) **—— “大型图书馆”——当数据量变大，或者你不满足 intset 的条件时，Redis 会切换到 hashtable（即 dict）。

* 物理形态：类似 java.util.HashMap，通过哈希函数将元素分散存储。
* 特点：查询极其快速【O(1)​ 复杂度】，无论里面有 10 个还是 100 万个元素，找人的速度几乎一样，但比较费内存。

<br>



### 具体的数据内存是怎样的？ 

假设你创建了一个名为 my_tags 的 Set：

* 第一步：全是小整数。

  ```bash
  SADD my_tags 100 200
  ```

  底层结构：intset。

  形态：内存里只有两个整齐的数字。

* 第二步：加入一个字符串。

  ```bash
  SADD my_tags "coffee"
  ```

  底层结构变身：由于出现了字符串，intset 无法存储，Redis 将其转换为 listpack。

  形态：内存依然是连续的一块，但现在每个格子里可以存不同长度的 “数字” 或 “单词” 了。

* 第三步：数据量激增。

  ```bash
  # 假设循环添加了 10000 个元素
  ```

  底层结构再变身：为了保证搜索速度（不至于在长长的 listpack 里从头翻到尾），Redis 会自动将其转换为 hashtable（dict）。

  形态：变成了一个复杂的索引表，虽然占内存多了，但查找速度瞬间飞起。

<br>



### 为什么要这么设计？

* **内存至上**：在数据量小的时候，Redis 宁愿多花一点点 CPU 时间去遍历连续内存（intset / listpack），也要把内存占用降到最低。
* **性能保底**：一旦数据多到遍历会变慢时，立即切换到 hashtable，确保 Redis “贼快” 的招牌不被砸掉。

<br>



### 相关的配置参数

* `set-max-intset-entries`: 默认值 512，如果整数元素的个数超过这个值，就会把 intset 升级为 listpack（或直接 hashtable），取决于具体版本。如果你内存很紧，可以调大到 1024，但 set 集合的查找性能会略微下降。
* `set-max-listpack-entries`: 默认值 128，当 listpack 里的元素个数超过这个值，转为 hashtable。
* `set-max-listpack-value`: 默认值 64，当集合中任意一个字符串的长度超过这个字节数，转为 hashtable。

<br>



### 典型的应用

在 Redis 的实际应用中，Set 集合因为具备去重、无序、高效检测成员、集合间运算（交并差） 的特性，成为了处理社交关系和唯一性统计的神器。典型的使用场景如下：

* 场景一：社交平台的 “关注与粉丝” 系统
* 场景二：社交推荐——“共同好友”与“可能认识的人”，这是 Set 最强大的地方：**集合间运算**。
* 场景三：抽奖活动、内容展示与去重，在抽奖或海量数据去重时，Set 的随机性和唯一性非常有用。

<br>



## set API

```bash
# 关注列表（Set）和粉丝列表（Set）
> sadd user:A:following B       # 用户A关注用户B
> srem user:A:following B       # 用户A取消关注用户B
> sismember user:A:following B  # 判断用户A是否关注了用户B
> scard user:A:following        # 统计用户A关注了几个人
> smembers user:A:following     # 列出所有关注的人（慎用阻塞式API，如果A关注了几万人，会卡死 Redis）

# smembers 的最佳替代方案 sscan，非阻塞，对线上业务友好。
# SSCAN key cursor [MATCH pattern] [COUNT count] 
> sadd user:A:following B C D E F G
> sscan user:A:following 0 count 5
1) "0"     # 下次需要扫描的游标起始点，如果为0则表示全部遍历完成
2) 1) "B"  # 为什么我设置的每次拿5个数据，redis却把所有的6个数据全给了我？
   2) "C"  # 这通常是由于Redis内部对集合的编码方式优化导致的，COUNT 参数在此情况下被忽略了。
   3) "D"  # Redis并不保证每次返回的元素数量严格等于 COUNT 值。
   4) "E"  # 当集合的底层编码为特定的紧凑格式时，Redis会直接返回所有元素以提高效率。
   5) "F"
   6) "G"
   
# 可以使用这个命令检查集合的编码方式
> object encoding user:A:following  
"listpack"


# 集合间运算
> sadd user:A:following B C D E F G
> sadd user:B:following E F G H I
> sinter user:A:following user:B:following  #【交集】找到用户A和用户B都关注的人
1) "E"
2) "F"
3) "G"
> sunion user:A:following user:B:following  #【并集】把A和B的好友合在一块去重
1) "C"
2) "D"
3) "I"
4) "H"
5) "G"
6) "B"
7) "F"
8) "E"
> sdiff user:A:following user:B:following   #【差集】找到用户A关注但是用户B没有关注的人
1) "D"
2) "C"
3) "B"


# 将运算结果存入一个新集合
# sinterstore / sunionstore / sdiffstore
> sdiffstore onlyA user:A:following user:B:following
> sdiffstore onlyB user:B:following user:A:following
> sunion onlyA onlyB                        #【对称差集】计算只被A或B一个人关注的那些人
1) "H"
2) "B"
3) "C"
4) "D"
5) "I"
127.0.0.1:6379> smembers onlyA
1) "B"
2) "C"
3) "D"
127.0.0.1:6379> smembers onlyB
1) "H"
2) "I"



# 从奖池中随机抽三个中奖者（但不删除他们）
> sadd lottery:pool A B C D E F G
> srandmember lottery:pool 3  
1) "C"
2) "D"
3) "E"
> srandmember lottery:pool 3
1) "A"
2) "D"
3) "G"

# 从奖池中随机抽三个中奖者（抽完就删除他们，防止重复中奖）
> spop lottery:pool 3  
1) "B"
2) "E"
3) "G"
> smembers lottery:pool
1) "A"
2) "C"
3) "D"
4) "F"



# 把一个用户从普通会员移动到VIP会员
> sadd rank:normal A B C D
> sadd rank:vip X Y Z
> smove rank:normal rank:vip A
> smembers rank:normal
1) "B"
2) "C"
3) "D"
> smembers rank:vip
1) "X"
2) "Y"
3) "Z"
4) "A"
```

