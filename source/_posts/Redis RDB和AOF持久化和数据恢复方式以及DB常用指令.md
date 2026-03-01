title: Redis RDB和AOF持久化和数据恢复方式以及DB常用指令

author: kinglyjn

mathjax: true

tags:

  - redis

categories:

  - db_cache

  - redis

date: 2023-02-01 09:02:41

---



###  RDB 快照持久化方式

RDB（Redis Database）在指定的时间间隔内，将内存中的全量数据生成一个二进制快照文件（`dump.rdb`）。类似于“拍照片”。核心配置参数：

<!--more-->



```bash
# 触发机制：save <秒> <修改次数>
# 触发频率：不要设置得太频繁，防止 fork 消耗 CPU。
# 建议只保留这三行，甚至可以根据业务减少。
save 3600 1      # 1小时改1个key
save 300 100     # 5分钟改100个key
save 60 10000    # 1分钟改1万个key

dbfilename dump.rdb              # 文件名
dir /var/lib/redis               # 存储目录
rdbcompression yes               # 开启 LZO 压缩，虽然耗点 CPU，但能显著减小 RDB 体积
rdbchecksum yes                  # 开启 RDB 校验，确保文件没损坏，增加恢复可靠性
stop-writes-on-bgsave-error yes  # 备份失败时，禁止写入（预警机制，建议开启）

# 内存级保护
maxmemory 3gb    # 务必设置。建议设为物理内存的 60%-70%。剩下的 30% 留给 BGSAVE 时的 fork 操作和操作系统的页缓存。
maxmemory-policy # 建议设置为 volatile-lru 或 allkeys-lru


# 内核级保护
# 允许内核在 fork 时不进行保守估计。
vi /etc/sysctl.conf
vm.overcommit_memory = 1
sysctl -p
```

**优点**：恢复大数据集速度极快；文件紧凑，适合异地备份。

**缺点**：数据丢失风险大（上次备份到宕机之间的数据会丢失）；fork 子进程时在大内存环境下可能导致瞬时卡顿。

<br>



### AOF 追加日志持久化方式

AOF (Append Only File)：记录每一个写操作指令，以追加的方式写入文件（appendonly.aof）。类似于“记账本”。核心配置参数：

```bash
appendonly yes                   # 开启 AOF
appendfilename "appendonly.aof"

# 同步策略（核心）
appendfsync everysec             # 每秒同步一次（性能与安全的最优折中）
# appendfsync always             # 每次写入都同步（安全但慢）
# appendfsync no                 # 交给操作系统决定（最快但不安全）

# AOF 重写配置（防止文件无限变大）
# 重写（Rewrite）触发机制：
# 当 AOF 文件大小比上次重写后增长了 100% 且 达到 1GB 时触发。
# 调大 min-size 可以减少频繁重写带来的 IO 抖动。
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 1gb

# 【关键】在重写执行期间，是否禁止 fsync 刷盘？
# 设置为 no 最安全，但在磁盘 IO 极高时可能会导致主线程阻塞。
# 如果你使用 SSD，建议设为 no。如果是普通磁盘，建议为yes。
## 默认情况（no）：Redis 非常严谨。即使后台在重写几GB的数据，主线程每秒一次的 fsync（刷盘）依然照常进行。
## 如果磁盘 IO 忙不过来，主线程就会被阻塞，表现就是：你的 Owlias 搜索接口突然响应超时了。
## 开启后（yes）：如果后台正在重写，主线程不再强制要求磁盘立刻给出“写入成功”的确认，而是把数据留在内核的
## Page Cache 里。这样主线程就“解脱”了，响应速度依然飞快。本质上这个参数也是一个 “性能”换“安全” 的选择。
no-appendfsync-on-rewrite no

# 开启混合持久化（Redis 7 默认开启，头部为 RDB 格式）
aof-use-rdb-preamble yes
```

**优点**：数据最安全（最多丢失1秒数据）；日志可读，可以手动修复（如误删后删掉 AOF 末尾的 FLUSHALL 指令）。

**缺点**：文件体积比 RDB 大；数据恢复速度慢（需要逐条回放指令）。

<br>



### 生产环境最佳实践

建议采用 **“混合持久化”** 策略：

* 策略：RDB + AOF 同时开启

  * **混合模式**：在 redis.conf 中设置 `aof-use-rdb-preamble yes`。AOF 重写时，文件前半部分是 RDB 格式（加载快），后半部分是增量指令（数据全）。

  * **异地备份**：每天定时通过 `cron` 脚本将 dump.rdb 拷贝到另一台服务器或云存储，防止物理机房故障。

  * **针对向量搜索（Valkey-Search）的优化**：降低 AOF 重写频率：向量索引数据很大，频繁重写会造成磁盘 IO 飙升。建议将 `auto-aof-rewrite-min-size` （默认64mb）调大（如 512mb 或 1gb）。

  * **硬件级保障**：

    * 使用 SSD：Redis 持久化非常依赖磁盘的随机写入性能，SSD 是必须的。
    * 预留内存：Linux 在 fork 时需要一定的内存余量。建议系统内存占用不要超过 70%，并设置 `vm.overcommit_memory = 1`。

    ```bash
    # 在配置 Redis 持久化（尤其是 BGSAVE）时，vm.overcommit_memory = 1 是 Linux 内核参数中
    # 最核心的一个。如果不设置它，在高负载下你的 Redis 经常会因为“内存不足”而备份失败，甚至崩溃。
    # 简单来说，它是 Linux 处理内存分配的一种策略。
    ## 默认状态 (0)：当 Redis 请求内存（比如 fork 子进程做快照）时，内核会进行启发式估算。如果它认为内存可能不够，就会拒绝该请求。
    ## 激进状态 (1)：内核总是允许内存分配请求，直到物理内存真的用完。
    ## 设置成 1 后，内核会相信 Redis，直接允许 fork，从而保证持久化任务顺利开启。
    
    # 临时生效（立即生效，重启失效）
    echo 1 > /proc/sys/vm/overcommit_memory
    # 或者
    sysctl -w vm.overcommit_memory=1
    
    # 永久生效（推荐）
    vi /etc/sysctl.conf
    # 在文件末尾添加一行
    vm.overcommit_memory = 1
    # 加载配置使其生效
    sysctl -p
    
    
    ## 关闭linux内存大页
    echo never > /sys/kernel/mm/transparent_hugepage/enabled
    echo never > /sys/kernel/mm/transparent_hugepage/defrag
    
    
    # 确保 net.core.somaxconn 至少设为 2048，匹配 Redis 的高并发需求。
    net.core.somaxconn = 2048        
    ```

<br>



### 误操作后怎么快速恢复！

比如执行了 FLUSHALL 后能否恢复数据，取决于你的 持久化配置（AOF 或 RDB）以及你反应的速度。请立即按照以下步骤进行“抢救”：

* 第一步：保持冷静，立即阻止任何新的写入：一旦发现误操作，不要重启 Redis（除非你没开 AOF），因为重启可能会触发新的持久化操作，覆盖掉现有的备份文件。

* 第二步：根据持久化方式选择恢复方案

  * **场景 A：你开启了 AOF（最稳妥的恢复方式）**：

    * 由于 AOF 记录的是每一条写命令，FLUSHALL 也会作为一个命令记在日志文件的末尾。你只需要把这一条删掉即可。

    * 立即备份 AOF 文件：防止后续操作失误。

      ```bash
      # 如果是单纯的aof方式：
      cp appendonly.aof appendonly.aof.bak
      
      # 如果是混合rdb+aof方式：你会看到类似的至少三个文件：
      # appendonly.aof.2.base.rdb：基础文件，这是混合持久化的核心，是上一次AOF重写时的内存全量快照（RDB格式）。
      # appendonly.aof.2.incr.aof：增量文件，它记录了从上一次生成 .base.rdb 之后的所有写命令。你的 FLUSHALL 命令就写在这个文件的末尾。
      # appendonly.aof.manifest：清单文件，告诉 Redis：当前的 AOF 由哪个 Base 文件和哪些 Incr 文件组成，以及它们的序列号（这里是 2），Redis 启动时会先读它。
      mkdir /root/redis_backup
      cp appendonly.aof.* /root/redis_backup/
      ```

    * 打开 AOF 文件进行编辑：

      ```bash
      vim appendonly.aof   或者   vim appendonly.aof.2.incr.aof
      # 删除末尾的 FLUSHALL 命令：
      # 滚动到文件最底部，你会看到类似 *1\r\n$8\r\nFLUSHALL 这样的记录。将其彻底删除。
      ```

    * 重启 Redis 实例： Redis 会重新读取修改后的 AOF 文件，数据就会像 “录像回放”一样全部回来（除了那条被你删掉的清空命令）。

  * **场景 B：你只开启了 RDB**：这种情况比较看运气，取决于 FLUSHALL 之后是否触发了新的 RDB 备份。

    * 检查 dump.rdb 文件的时间戳： 如果 dump.rdb 的最后修改时间是在你执行 FLUSHALL 之前，那么你非常幸运。立即备份 dump.rdb 文件。

    * 立即强制关闭 Redis 进程（不要执行正常的 `shutdown`，因为正常关机会尝试保存当前内存状态，即清空后的状态）：

      ```bash
      # 千万不要执行 redis-cli shutdown，因为正常退出可能再次触发持久化。
      ps -ef | grep redis
      kill -9 [Redis的PID]
      ```

    * 把备份的 dump.rdb 拷贝回数据目录。

    * 重启 Redis，数据会恢复到上一次快照时的状态。

  * **场景 C：你开启了混合持久化（AOF 头部是 RDB）**

    * 操作逻辑同 **场景 A**。依然是编辑 appendonly.aof，找到末尾的文本部分（AOF 混合模式下，文件末尾通常是正常的 AOF 文本指令），删掉 FLUSHALL 即可。

* 第三步：最后的 “核武器”——冷备份：如果你之前按照我建议的生产环境最佳实践，做了**异地备份**（比如每天凌晨拷贝一次 `dump.rdb` 到另一台机器），那么你可以拿昨天的备份文件进行恢复。虽然会丢失今天的数据，但总好过全量丢失。

* 最后：为了防止你的redis数据再次遭遇这种 “灭顶之灾”，请务必执行以下操作：

  ```bash
  # 重命名命令（最有效）： 在 redis.conf 中加入：
  rename-command FLUSHALL "OWLIAS_DANGEROUS_CLEAN_ALL"
  rename-command FLUSHDB  ""  # 彻底禁用
  rename-command CONFIG   "OWLIAS_ADMIN_CONFIG"
  
  # 权限控制： 确保生产环境的 Redis 开启了 requirepass 密码认证，避免脚本或外部工具误触。
  
  # 开启 AOF
  # 正如你看到的，AOF 是唯一能让你“反悔” 的后悔药。
  ```

<br>



### 异地定时备份脚本

第一步：

$ vim /root/scripts/redis_backup.sh

$ chmod +x /root/scripts/redis_backup.sh

```bash
#!/bin/bash

# --- 配置信息 ---
REDIS_CLI="/usr/local/bin/redis-cli"
export REDISCLI_AUTH="你的密码"            # 如果没有密码留空，Redis 客户端支持读取 REDISCLI_AUTH 环境变量，这样你就不用在命令行参数里传密码了。
DATA_DIR="/var/lib/redis"                 # Redis数据目录
BACKUP_DIR="/data/redis_backups"          # 本地备份存放临时目录
REMOTE_SERVER="user@remote_ip"            # 远程服务器账号及IP
REMOTE_DIR="/backup/owlias_redis/"        # 远程服务器存放路径
DATE=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/var/log/redis_backup.log"

# --- 创建备份目录 ---
mkdir -p $BACKUP_DIR

echo "[$DATE] 开始执行备份..." >> $LOG_FILE

# 1. 触发 BGSAVE 生成最新的快照
# 
echo "触发 BGSAVE..." >> $LOG_FILE
$REDIS_CLI BGSAVE

# 2. 等待备份完成（根据数据量调整等待时间，或循环检查 INFO Persistence）
sleep 10 

# 3. 打包当前所有的持久化文件 (Base RDB, Incr AOF, Manifest)
# Redis 7 的 Multi-Part AOF 建议全部打包
tar -czf $BACKUP_DIR/redis_data_$DATE.tar.gz -C $DATA_DIR .

# 4. 将备份文件传输到异地服务器 (建议配置 SSH 免密登录)
ssh $REMOTE_SERVER "mkdir -p $REMOTE_DIR"
if [ $? -eq 0 ]; then
  echo "远程目录就绪，开始传输..." >> $LOG_FILE
  scp $BACKUP_DIR/redis_data_$DATE.tar.gz $REMOTE_SERVER:$REMOTE_DIR
  if [ $? -eq 0 ]; then
    echo "传输成功。" >> $LOG_FILE
  else
    echo "错误：文件传输失败！" >> $LOG_FILE
  fi
else
  echo "错误：无法在远程服务器创建目录！" >> $LOG_FILE
fi

# 5. 清理本地过旧的备份（保留最近 7 天）
find $BACKUP_DIR -mtime +7 -name "*.tar.gz" -exec rm -rf {} \;

echo "[$DATE] 备份任务完成。" >> $LOG_FILE
```

<br>

第二步：配置 SSH 免密登录（核心）

* 在 Redis 服务器运行：`ssh-keygen -t rsa`（一路回车）。

* 拷贝公钥到备份服务器：`ssh-copy-id user@remote_ip`。

<br>

第三步：设置定时任务 (Crontab)

执行 crontab -e，添加以下行，设置为每天凌晨 3:00 运行：

```bash
00 03 * * * /bin/bash /root/scripts/redis_backup.sh >> /var/log/redis_backup_cron.log 2>&1
```

<br>



### DB相关的常用指令

```bash
## 数据库切换与基础管理
# 查看当前有多少库
> config get databases
# 切换到指定的数据库
> select 2
# 返回当前数据库中 Key 的总数
> dbsize 
# 从当前数据库中随机返回一个 Key
> randomkey
# 清空当前节点上的选择的数据库（在master节点执行，慎用！）
> flushdb
# 清空当前节点上的所有的库（在master节点执行，极度危险！）
> flushall
# 查看哪些库里已经存了东西，以及每个库有多少 Key
> info keyspace
# Keyspace
db0:keys=2,expires=0,avg_ttl=0,subexpiry=0
db2:keys=1,expires=1,avg_ttl=299721,subexpiry=0


## DB 内的操作
# 判断键是否存在
> exists user:1
# 查看当前库中匹配的key有哪些
> keys user*
# 键改名
>  rename u user:1
# 将当前库的k-v移到另一个库
> move user:1 2
# 查看 Key 的数据类型
> type user:1


## DB信息监控
> info
# 查看持久化详情（最后一次落盘是否成功）
> info persistence
# 查看内存占用（是否达到了你设定的 maxmemory）
> info memory
# 查看当前有多少客户端连接
> info clients
# 实时打印出 Redis 服务器接收到的所有命令（生产环境慎用，高并发下会严重影响性能）
> monitor
$ redis-cli -h 192.168.1.224 -a 123456 monitor


## 数据持久化
# 同步保存当前节点的所有库的数据到磁盘（dump.rdb），阻塞式：会卡住当前集群节点的所有请求，直到保存完成
> save
# 在后台异步保存当前节点的所有库的数据（dump.rdb），非阻塞：Redis 会 fork 一个子进程进行保存。
> bgsave
# 返回最近一次成功保存的时间戳
> lastsave
# 手动触发 AOF 日志重写，减小 appendonly.aof 文件体积（对性能影响中等）
bgrewriteaof
```

[注意]：

* **Redis 集群模式下不支持多数据库，只能使用 DB 0**，因此在集群环境下执行 save/bgsave/bgrewriteaof 等指令，本质上就是针对该节点唯一的 DB 0 进行持久化。
* 自动化胜过手动：在你的 redis.conf 中配置 save 规则（如 save 900 1）或开启 appendonly yes。Redis 会自动在后台调用 BGSAVE 或重写 AOF，不需要你手动执行。
* 如果你以后将应用部署到集群环境，备份时需要编写脚本，循环登录到每一个 Master 节点去执行 BGSAVE，并把每个节点的 dump.rdb 都拷贝出来。
* 除非是在停机维护或极端紧急情况下，否则永远不要在生产环境执行 SAVE。

<br>



### 关于 redis 的逻辑分库

在 Redis 的演进过程中，16 个逻辑数据库（DB 0-15）的设计其实是一个“历史遗留”且“备受争议”的功能。简单来说：**分库设计是为了给单机模式下的用户提供一种简单的逻辑隔离手段，但在现代分布式架构（Cluster）中，这种设计被证明弊大于利。**以下是分 16 个库的主要原因及其背后的逻辑：

为什么当初要分库？（设计初衷）

* 简单的环境隔离： 在早期开发中，大家习惯在同一个 Redis 实例上跑多个小项目。比如 DB 0 给 应用存用户 Session，DB 1 存临时缓存。这样可以避免 Key 名冲突，而不需要启动多个 Redis 进程。
* 快速清空逻辑块： 你可以执行 FLUSHDB 只清空当前数据库，而不影响其他数据库。这比用 "KEYS *" 匹配前缀再删除要快得多。

* 管理便利性： 对于运维来说，管理一个端口（6379）下的多个 DB，比维护 16 个不同端口的 Redis 实例要省事（省内存、省进程管理）。

<br>

为什么集群模式（Cluster）却抛弃了它？

当你从单机升级到集群时，Redis 强制只能使用 DB 0。这是因为：

* 代理与路由的复杂性： Redis 集群的核心是 **Hash Slot（哈希槽）**。数据分片是根据 Key 计算的。如果允许 16 个库，那么路由指令时不仅要看 Key 在哪个节点，还要看它在哪个库，这会极大增加集群代理和客户端的实现难度。
* 资源竞争无法隔离： 虽然库号不同，但它们共享同一个 CPU 核心和 IO 线程。如果 DB 0 在做极其复杂的向量搜索（Valkey-Search），DB 1 一样会卡住。这种 “伪隔离” 在追求高并发的集群环境下意义不大。
* 官方的态度： Redis 之父 antirez 曾公开表示，Redis 的多数据库设计是他最大的设计失误之一。他更倾向于推荐用户 **“一个实例只跑一个业务”**。

<br>

生产环境实践：

* **强烈建议你养成 “只用 DB 0” 的习惯！**
* **使用命名空间**：在代码里给 Key 加前缀，如 "Search:Index:..."、 "Cache:Temp:..."。
  * 在 Redis 中使用冒号（`:`）作为分隔符来构建 Key 的前缀，是社区公认的最佳实践。这种做法本质上是在逻辑上模拟关系型数据库中的 “表” 或 “模式” 概念。
  * 数据的逻辑隔离与分类：注意是逻辑隔离而非物理隔离。如果是集群模式，Redis 使用 `CRC16 算法` 对 Key 进行哈希，然后将其分配到 `16384 个“哈希槽”（Hash Slots）`中。Search:Index:1 和 Cache:Temp:1 的哈希结果几乎肯定不同，因此它们很可能会被分配到不同的物理主机上。但是同一种前缀的数据（如 Search:1 和 Search:2）也会因为哈希值不同而散落在不同的主机上。如果你希望特定前缀的数据必须堆放在同一个主机上（为了执行多 Key 事务），你可以使用花括号：`{Search}:Index:1`、`{Search}:Index:2` 这种形式。Redis 只会对 `{}` 里的内容进行哈希。这样，所有以 {Search} 开头的 Key 都会进入同一个哈希槽，存储在同一台主机上。
  * 防止 Key 冲突：在大型项目或微服务架构中，不同的开发者或模块可能会起相同的名字。而使用命名空间能够有效解决这一问题。
  * 便于批量管理与分析：Redis 的一些命令和工具深度依赖前缀匹配。比如，使用 SCAN 命令配合 "MATCH Search:*" 可以快速找到特定模块的所有Key，而不影响生产环境性能。使用分析工具（如 redis-rdb-tools）时，可以按前缀统计各业务模块的内存占用情况。使用 redis-cli 或图形化管理工具（如 Redis Insight）时，前缀会让 Key 自动呈现为树状结构。
  * 权限控制（ACL）：Redis 7.0 可以通过 ACL 设置某个账号只能访问带有特定前缀的 Key，这比分库更安全、更强大。