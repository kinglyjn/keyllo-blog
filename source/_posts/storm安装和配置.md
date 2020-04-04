title: storm安装和配置
author: kinglyjn
tags:
  - storm
categories:
  - dataops
  - ''
  - storm
date: 2018-12-17 10:29:00
---
### 准备工作

1) 安装java和python（略）
2) 安装zookeeper

<!--more-->

``` bash
# 1. 下载、解压、配置环境变量
略


# 2. 编辑配置文件zoo.cfg
$ vi zookeeper-3.4.6/conf/zoo.cfg 
#########
# 最低配置
#########

#zk的运行端口，默认是2181
clientPort=2181
#用于配置存储快照文件的目录，如果没有配置dataLogDir，那么事务日志也会存储在此目录
dataDir=/xxx/zookeeper-3.4.6/zkdata
#日志的存放路径
dataLogDir=/xxx/zookeeper-3.4.6/logs
#表示zk的一个基本时间单元，可用它的倍数来表示系统内部的时间间隔设置
tickTime=2000

#########
# 高级配置
#########

#单个客户端与单台服务器之间的连接数的限制，是ip级别的，默认是60，如果设置为0，那么表明不作任何限制。
#请注意这个限制的使用范围，仅仅是单台客户端机器与单台ZK服务器之间的连接数限制，不是针对指定客户端IP，
#也不是ZK集群的连接数限制，也不是单台ZK对所有客户端的连接数限制。
maxClientCnxns=60

#Session超时时间限制，如果客户端设置的超时时间不在这个范围，那么会被强制设置为最大或最小时间。
#默认的Session超时时间是在 2*tickTime ~ 20*tickTime 这个范围
minSessionTimeout=2*2000
maxSessionTimeout=20*2000

#自动清理snapshot和事务日志(单位为小时,默认为0表示不开启)
autopurge.purgeInterval=1
#这个参数和上面的参数搭配使用，这个参数指定了需要保留的文件数目。默认是保留3个
autopurge.snapRetainCount=3

#########
# 集群配置
#########

#表示follower连接到leader，初始化连接时最长能忍受多少个心跳的的时间间隔，这里的10表示，当已经超过了10个
#tickTime心跳的时间，zk服务器还没有收到客户端的返回信息，表明这个客户端连接失败。默认值为10
initLimit=10
#标识Leader与Follower之间发送消息，请求和应答最长允许时间。如果Leader发出心跳包在syncLimit时间之后，
#还没有从Follower那里收到响应，那么就认为这个F已经不在线了。注意：不要把这个参数设置得过大，否则可能会
#掩盖一些问题。
syncLimit=5
#server.A=host:port1:port2 
#其中A是一个数字，表示这个是第几号服务器
#host表示这个服务器的地址
#port1是follower服务器和leader服务器的通信端口
#port2是leader服务器选举过程中的投票通信端口
server.1=nimbusz:2888:3888
server.2=supervisor01z:2888:3888
server.3=supervisor02z:2888:3888


# 3. Zookeeper启动时默认将Zookeeper.out输出到当前目录，不友好。改变位置有两种方法：
# 在当前用户下~/.bash_profile或在/etc/profile，添加ZOO_LOG_DIR变量
export ZOO_LOG_DIR=/home/Hadoop/local/logs/zookeeper
# 或修改zkServer.sh 脚本
# 3.1 修改zoo.cfg文件，增加dataLogDir参数，如：
dataDir=/data/zookeeper/data
dataLogDir=/data/zookeeper/logs
# 3.2 修改zkServer.sh脚本，增加ZOO_LOG_DIR变量赋值


# 4. 建立ZK节点标示文件myid
root@nimbusz:~$ echo “1” > ${dataDir}/myid
root@supervisor01z:~$ echo “2” > ${dataDir}/myid
root@supervisor02z:~$ echo “3” > ${dataDir}/myid

# 5. 启动/查看/停止zookeeper进程
$ zkServer.sh start 或者 zkServer.sh start-foreground
$ zkServer.sh status
$ zkServer.sh stop

# 6. 客户端连接zk服务器
bin/zkCli.sh
bin/zkCli.sh -server 172.16.127.129:2181
bin/zkCli.sh -timeout 5000 -r -server 172.16.127.129:2181 #单位ms，-r只读
```

### 安装和配置storm

``` bash
# 1. 下载、解压、配置环境变量
$ wget http://mirrors.tuna.tsinghua.edu.cn/apache/storm/apache-storm-1.2.2/apache-storm-1.2.2.tar.gz
$ tar -zxvf apache-storm-1.2.2.tar.gz -C xxx
$ vi /etc/profile
  ...
  JAVA_HOME=xxx
  ZOOKEEPER_HOME=xxx
  STORM_HOME=xxx
  PATH=$PATH:$JAVA_HOME/bin:$ZOOKEEPER_HOME/bin:$STORM_HOME/bin
  ...
$ source profile


# 2. 配置文件
# 配置zk节点
storm.zookeeper.servers:
     - "cdh03"
     - "cdh04"
     - "cdh05"
# 配置nimbus和supervisor本地状态数据目录
storm.local.dir: "/root/zql/storm/localdir"
# 配置nimbus节点
nimbus.seeds: ["cdh03", "cdh04", "cdh05"]
# 配置每个supervisor节点的worker进程数（和端口的数量相等）
supervisor.slots.ports:
    - 6700
    - 6701
    - 6702
    - 6703
# 配置drpc节点（可选）
drpc.servers:
    - "server1"
    - "server2"
    

# 3. 分发storm安装文件到各个节点
scp -r apache-storm-1.2.2/ root@cdh04:/root/zql/storm
scp -r apache-storm-1.2.2/ root@cdh05:/root/zql/storm

# 4. 启动storm相关守护进程
root@nimbusz: nohup storm nimbus > /dev/null 2>&1 &
root@nimbusz: nohup storm ui > /dev/null 2>&1 &
root@supervior01: nohup storm supervisor > /dev/null 2>&1 &
root@supervior02: nohup storm supervisor > /dev/null 2>&1 &

# 5. 在每个storm节点上运行logviwer
$ nohup storm logviewer >/dev/null 2>&1 &
```

