title: Redis的基本介绍和安装使用（基于Redis 8.2）

author: kinglyjn

tags:

  - linux
  - cache
  - redis

categories:

  - db_cache

  - redis

date: 2023-01-29 11:24:21

---



## 什么是Redis？

[Redis](https://redis.io/) 是一个用C语言开发的、基于内存结构进行键值对数据存储的、高性能的、非关系型数据库 [下载地址](https://download.redis.io/releases/)。Redis支持的数据结构主要包括：

* string（字符串）
* hash（映射）
* list（队列）
* set（无序集合）
* zset（有序集合）

<br>

<!--more-->



### Redis的特点

**主要优点：**

* **基于内存存储（单线程操作，多路复用），数据读写效率极高**：
  * 当前最新的数据：在普通的 Linux 单机环境下，Redis 7.x/8.x 的读写通常可以轻松突破 **15万 - 25万次/秒**；随着 Redis 8.0 对异步 I/O 和命令处理路径的优化，配合多线程 I/O（I/O Threads），在 10Gbps 网卡环境下，吞吐量甚至可以达到 **50万 - 100万级**；
  * 集群模式通过 Redis Cluster 横向扩展，读写能力是无上限的（几百万甚至上千万次/秒）；
  * Redis核心网络读写与命令执行是单线程的，这避免了上下文切换和多线程竞争锁的开销，也保证了原子性。从 4.0 版本开始引入了 UNLINK、FLUSHALL ASYNC 等异步线程；6.0 引入了多线程 I/O来处理网络读写的拆包和封包（单线程虽然极快，但网络带宽不给力）；8.0 进一步强化了后台任务的并行化。
* **Redis本身支持数据的持久化存储，当前Redis的四种持久化方案**：
  * `RDB (Redis Database)` —— 定时快照：相当于给内存数据“拍照片”。它在指定的时间间隔内，将内存中的全量数据生成一个压缩的二进制文件（dump.rdb）保存到磁盘。优点是文件紧凑，适合备份和灾难恢复；恢复大数据集的速度比 AOF 快；但数据丢失风险大。如果两次快照之间发生崩溃，这段时间的数据就会丢失。RDB 适用于对数据完整性要求不是极致严苛，追求快速恢复的场景。
  * `AOF (Append Only File)` —— 命令日志：AOF 记录的是 Redis 执行过的每一个“写操作”命令。当 Redis 重启时，会通过重新执行这些命令来重建数据。优点是数据更安全，通过 fsync 策略（如每秒刷盘），最多只丢失 1 秒的数据；缺点是生成的文件比 RDB 大得多；在高并发下，频繁的磁盘 IO 也会影响性能。为了防止文件无限膨胀，Redis 会定期重写 AOF，只保留恢复当前数据所需的最小命令集。
  * `混合持久化 (RDB + AOF)` —— 默认主流方案：这是从 Redis 4.0 开始引入并成为 **Redis 7.x/8.x 默认**的方案。它结合了二者的优点。在 AOF 重写时，先将当前的内存数据以 RDB 格式写入 AOF 文件的开头，后续的增量写命令再以 AOF 格式追加。重启恢复时，前半部分加载 RDB，速度极快；后半部分回放 AOF，确保数据不丢失。
  * `Multi-Part AOF (Redis 7.0+) `—— 现代增强版：在最新的 Redis 版本中，AOF 被拆分成了多个文件（基础文件、增量文件、清单文件），解决了以前单文件 AOF 重写时造成的磁盘 IO 剧烈抖动问题，使得持久化过程更加平滑，管理也更高效。
* **极强的高可用和横向扩展能力，典型的三种集群模式**：
  * `主从模式(Master-Slave)`：这是最基础的模式，也是其他模式的基石。一个 Master 节点负责写操作，多个 Slave 节点负责读操作，Master 接收写操作后，通过异步方式将数据同步给 Slave。实现了读写分离，极大提高了读并发；并且数据有了多个副本，更加安全。这种模式的主要缺点是没有自动故障转移，Master 挂了系统就无法写数据了，需要人工干预将 Slave 提升为 Master；单机的内存和磁盘容量有限，整个集群的数据容量受限。适合于小型应用（读多写少）。
  * `哨兵模式 (Sentinel)`：哨兵模式是为了解决主从模式无法自动恢复的痛点而生的。在主从模式的基础上，额外部署一组 Sentinel 进程（通常是奇数个）。这种模式会不断检查 Master 和 Slave 是否运行正常，如果 Master 挂了，哨兵会通过选举协议，从 Slave 中选出一个新的 Master，并通知客户端更新地址，实现了无人值守的自动恢复。缺点是客户端需要集成 Sentinel 的连接逻辑，并且依然无法解决水平扩容的问题。适合于中型应用（要求高可用）。
  * `切片集群模式 (Redis Cluster)`：这是真正的分布式方案，也是目前大型互联网公司（如你之前提到的淘宝、美团）主流使用的模式。由多个主从对组成，数据通过 **哈希槽（Hash Slot）** 分布在不同的 Master 上。Redis Cluster 预设了 **16384** 个槽位。根据 Key 的哈希值决定存储在哪个节点，实现了**数据分片**。如果你内存不够，再加几台机器就行，理论上可以管理上万个节点；这种集群是 **去中心化** 的：不需要哨兵，节点之间通过 Gossip 协议就可以互相监控。这种模式的主要缺点是 **批量操作和事务受限**，如果多个 Key 落在不同节点，无法执行 mget 等批量操作，也无法支持跨节点的事务（需要用 Hash Tag 解决，例如 user123:name 和 user123:age 会强制把它们都存到一个节点，这样既能批量读取，也能在同一个节点处理事务）。这种模式适合于真正的大型应用（海量数据、高并发写）。
* **虽然基于k-v存储，但是支持多种数据类型**；
* **所有操作都是原子性的，而且可以通过lua脚本将多个操作合并成一个原子操作**（注意：Redis集群规定一个`事务`里的所有命令，操作的 Key 必须都在`同一个节点上`）；

<br>

**主要缺点：**

* 缓存数据与数据库数据必须通过两次写操作才能保持数据的一致性（数据的强一致性和最终一致性）；
* 使用缓存，可能存在缓存穿透、缓存击穿、及缓存雪崩等问题需要处理；
* Redis可以作为持久化数据库使用，但是存在数据丢失的风险；

<br>



### 典型的应用场景

* 缓存：在绝大多数互联网项目中，为了提升数据的访问速度，降低数据库的压力，一般使用 redis 作为缓存中间层；
* 点赞、排行榜、计数器等功能：对数据库读写要求比较高，但是对数据的一致性要求并不是很高的场景；
* 分布式锁：基于 redis 的操作特性可以实现分布式锁功能；
* 分布式会话：在分布式系统中可以使用redis实现共享 session；
* 消息中间件：可以使用 redis 实现是应用之间的通信；

<br>



## Redis的安装和基本使用



### CentOS 7+ 环境下安装

```bash
# 1. 安装基础工具
sudo yum install -y gcc make wget
sudo yum install gcc-c++ -y

# 2. 下载 Redis 8 源码 (以 8.2.0 为例)
wget https://download.redis.io/releases/redis-8.2.0.tar.gz 
tar -zxzf redis-8.2.0.tar.gz 
cd redis-8.2.0

# 3. 编译并安装
make
sudo make install
redis-server -v

# 4.1. 创建配置目录
sudo mkdir -p /etc/redis

# 4.2. 拷贝配置文件
sudo cp ./redis.conf /etc/redis/redis.conf

# 4.3. 以后启动时指定这个配置文件
redis-server /etc/redis/redis.conf

# 5. 进入后输入 ping，如果返回 PONG，说明一切正常！
redis-cli
```

systemd 脚本管理redis服务，并实现开机自启：

```bash
# 第一步：创建 Service 文件
sudo vi /usr/lib/systemd/system/redis.service

[Unit]
Description=Redis In-Memory Data Store
After=network.target

[Service]
Type=forking
# 注意：路径必须与你的实际安装路径一致
ExecStart=/usr/local/bin/redis-server /etc/redis/redis.conf
#ExecStop=/usr/local/bin/redis-cli shutdown
#ExecStop=/usr/local/bin/redis-cli -a 你的密码 shutdown
#systemd 停止服务时默认会发送 SIGTERM 信号给 Redis。Redis 捕捉到这个信号后，会自动触发安全关闭流程
#所以ExecStop配置项可以直接去掉
Restart=always
# Redis 8 建议增加的文件描述符限制
# 在 Redis 8.x 中，由于其极高的并发处理能力，默认的系统文件打开数（通常是 1024）在高负载下可能不够用。
# 在 systemd 脚本中设置此项参数可以确保 Redis 不会因为“Too many open files”错误而拒绝连接。
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target


# 第二步：为了让 systemd 正确追踪 Redis 进程，你必须修改 redis.conf 中的一个参数。
# 找到 daemonize 这一项，确保它被设置为 yes
sudo vi /etc/redis/redis.conf
daemonize yes


# 第三步：重新加载并启动
# 重载系统服务配置
sudo systemctl daemon-reload
# 启动 Redis
sudo systemctl start redis
# 设置开机自启动
sudo systemctl enable redis
# 查看运行状态
sudo systemctl status redis
```

常用管理命令速查

```bash
#启动：
systemctl start redis
#停止：
systemctl stop redis
#重启：
systemctl restart redis
#查看状态：看到绿色 active (running) 即代表成功
systemctl status redis
```

<br>



### Ubuntu/Debian 环境下安装

```bash
sudo apt-get update
sudo apt-get install lsb-release curl gpg

# 导入 GPG 密钥
curl -fsSL https://packages.redis.io/gpg | sudo gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
sudo chmod 644 /usr/share/keyrings/redis-archive-keyring.gpg


# 添加仓库
echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/redis.list

sudo apt-get update

# 执行安装，默认安装最新稳定版 (Redis 8.x)
sudo apt-get install redis
redis-server -v
```

<br>

### 常用配置设置 (redis.conf)

Redis 8 的配置文件通常位于 /etc/redis/redis.conf。以下是生产环境建议修改的关键项：

* 网络与安全
  * `bind 0.0.0.0`：允许远程访问。这个配置的真实含义是Redis 应该监听自己身上的哪块网卡；设置成 0.0.0.0 或 `* -::*` 表示谁都能连这个redis，设置成形如 192.168.1.50 表示只监听内网 IP。这样同局域网的其他服务器可以连过来，但公网访问不到，这是最推荐的方式。
  *  `requirepass 你的强密码`：设置访问密码，Redis 8 的性能极高，暴力破解非常快，密码务必复杂。
  * `protected-mode yes`：开启保护模式。开启之后，如果检测到 **没有配置密码（requirepass）** 或者 **没有显式绑定 IP 地址（bind）**，那么redis就会自动进入“保护模式”，保护模式 下Redis 只接受来自本地回环地址的请求，如果此时有外部服务器尝试连接你的 6379 端口，Redis 会直接拒绝连接并返回一条长长的错误信息，告诉你：“为了安全，我已开启保护模式，除非你设置了密码或绑定了 IP”。在生产环境中也建议开启，它会随着你设定密码或绑定ip后自动失效。
* 性能与线程 (Redis 8 特色)
  
  * `io-threads 4`：根据 CPU 核心数设置（如 8 核设为 4 或 6），开启多线程 I/O 以突破网络瓶颈。
* 内存管理
  * `maxmemory 4gb`：限制最大内存，防止撑爆系统内存导致 OOM。
  * `maxmemory-policy allkeys-lru`：内存满后的淘汰策略（推荐 LRU 或 LFU）。
* 持久化 (默认已优化)

  * `appendonly yes`：开启 AOF。
  * `aof-use-rdb-preamble yes`：开启混合持久化（Redis 8 默认通常为开启状态）。
* 网络时间及个数相关
  * `tcp-backlog 511`:在高并发场景下，当 Redis 忙不过来时，还没被处理的 TCP 连接排队个数，默认是511，建议设置成 2048。这个值不能超过 Linux 内核的 `/proc/sys/net/core/somaxconn`（CentOS 7 的默认值通常只有 128），而Redis 默认配置的 tcp-backlog 是 511，这会导致 Redis 启动时会在日志里发出 WARNING，并被迫把自己的队列缩小到 128。建议把系统的这个值设置成 2048 或更高。

    ```bash
    # 永久生效（推荐），在文件末尾添加
    vim /etc/sysctl.conf
    net.core.somaxconn = 2048            #已完成握手的队列
    net.ipv4.tcp_max_syn_backlog = 2048  #相关的正在握手的半连接队列也一并调优
    
    # 立即生效
    sysctl -p
    ```

  * `maxclients 10000`: 最大连客户端连接数，默认1万个。即使配置了1万个，如果不处理系统文件描述符的限制，它也无法生效。系统文件描述符限制 (ulimit)，在 Linux 中每个连接都是一个文件。如果系统只允许打开 1024 个文件，Redis 就无法处理第 1025 个连接。使用 `ulimit -n` 查看当前ulimit个数，使用以下方式可以做出更改：

    ```bash
    #编辑下述文件并写入如下内容：
    #退出ssh重新连接，便可以看到生效
    vim /etc/security/limits.conf
    * soft nofile 65535
    * hard nofile 65535
    
    # 注意在CentOS7+中，/etc/security/limits.d/ 的配置文件优先级高于 
    # /etc/security/limits.conf。 很多系统默认带有一个 20-nproc.conf
    # 或类似命名的文件，它可能会覆盖你的全局设置。将你的配置也写进该目录下的配置文件
    echo "* soft nofile 65535" > /etc/security/limits.d/99-redis.conf
    echo "* hard nofile 65535" >> /etc/security/limits.d/99-redis.conf
    ```

  * `timeout 0`: 客户端闲置连接的超时时间，默认为0。设置为0表示客户端如果长时间没有任何操作（既不发送命令，也不读取数据），Redis 也永远不会主动断开这个连接。

  * `tcp-keepalive 300`: redis服务器与客户端ack心跳检测的时间间隔，默认300秒；

  * `repl-timeout 60`: 主从同步（Replication）时的超时时间，默认60。如果你每次需要操作的数据量巨大，同步时间长，可能需要把默认的 60 调大，否则同步会不断断开重连。

  * `cluster-node-timeout 15000`: 集群节点是否“失联”的判断时间，默认是15000毫秒。

* 其他常用配置

  * `databases 16`: 数据库个数

  * `dir /var/lib/redis`: 数据持久化存放目录 

  * `logfile /var/log/redis/redis.log`: 指定日志输出路径

  * `loglevel notice`: 指定日志的级别，debug(极详细)/verbose(较详细)/notice(只记录重要信息)/warning(只记录错误和警告)，生产环境推荐使用 notice

  * `pidfile /var/run/redis_6379.pid`: 记录进程 ID，方便 Systemd 管理。


<br>



### 配置定期处理日志文件

使用 Linux 自带的 `logrotate` (最推荐方案)。这是 Linux 处理日志的标准做法。它可以自动实现每天切割日志、保留最近几天的、压缩旧日志、删除太久的。你不需要手动去启动或运行任何程序，因为 Linux 系统（CentOS 7）默认已经开启了 `cron` 定期任务，它每天会自动扫描 `/etc/logrotate.d/` 目录并执行里面的规则。

```bash
# 创建一个 Redis 日志转储配置文件（保存以下内容）：
vim /etc/logrotate.d/redis
/var/log/redis/redis.log {
    # 对于redis的日志，如果使用了 loglevel notice，基本不用担心大小（一年也就几十 MB）
    weekly          # 每周切割一次（也可以改为 daily）
    rotate 4        # 保留 4 份旧日志
    copytruncate    # 这种方式对 Redis 最友好，不需要重启服务
    delaycompress   # 延迟压缩
    compress        # 压缩旧日志以节省空间
    missingok       # 如果日志文件丢了也不报错
    notifempty      # 如果日志是空的就不切割
}
```

定期手动清理（应急方案）：如果你发现日志已经很大了，想立刻清理，千万不要直接 `rm` 掉文件（因为 Redis 进程还拿着文件句柄，删了空间也不会释放）。

```bash
# 清空日志内容，但不删除文件
true > /var/log/redis/redis.log
```

<br>



### 最基本的使用

可以通过 `redis-cli` 与服务器交互。

基础键值对：

```bash
# 基础键值对 (Strings)
set user:1 "zhangsan"
get user:1
expire user:1 60  
ttl user:1
```

<br>

hash的新特性：

```bash
# 哈希字段级过期 (Redis 8 新特性)
# 这是 Redis 8/7.4 最实用的功能，以前只能给整个 Hash 设过期，现在可以精确到字段：
hset user:1 name zhangsan age 12

# 给特定字段设过期（单位：秒），再次设置后后值覆盖前值
hsetex user:1 ex 60 fields 1 age 22

# 查看某个字段还有多长时间过期
httl user:1 fields 1 age

# 查看多个字段还有多长时间过期
httl user:1 fields 2 name age
1) (integer) -1
2) (integer) 34

# 查看hset的所有字段数据 
hgetall
1) "age"
2) "12"
3) "name"
4) "zhangsan"
```

<br>

JSON 数据的操作支持

```bash
# 第一步：安装插件
# 官网下载地址，请下载和你系统和redis版本匹配的插件
https://redis.io/downloads/#Modules_Tools_and_Integration
sudo mkdir -p /etc/redis/modules
sudo cp rejson.so /etc/redis/modules/

# 第二步：配置加载插件
vim /etc/redis/redis.conf
loadmodule /etc/redis/modules/rejson.so

# 第三步：重启服务，并验证安装成功
sudo systemctl restart redis
redis-cli
127.0.0.1:6379> MODULE LIST
1) 1) "name"
   2) "ReJSON"
   3) "ver"
   4) (integer) 20607
   5) "path"
   6) "/etc/redis/modules/rejson.so"
   7) "args"
   8) (empty array)

# 第四步：初步使用
# 存储值
127.0.0.1:6379> json.set product:101 $ '{"name":"iphone", "price":999, "tags":["tech", "work"]}'
OK
# 获取值：以$开头是Redis 8 和最新版 RedisJSON 推荐的标准写法，返回的永远是数组，因为它支持更复杂的过滤
127.0.0.1:6379> json.get product:101 $.price
"[999]"
127.0.0.1:6379> json.get product:101 $.tags[0]
"[\"tech\"]"
# 获取值：不包含$而是直接查找，这是旧版路径的写法，它会直接找到的对应的元素原封不动地返回，适合简单的字段读取
127.0.0.1:6379> json.get product:101 price
"999"
127.0.0.1:6379> json.get product:101 tags[0]
"\"tech\""
```

<br>







