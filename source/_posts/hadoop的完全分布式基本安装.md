title: hadoop的完全分布式基本安装
author: kinglyjn
tags:
  - hadoop
categories:
  - dataops
  - ''
  - hadoop
date: 2018-11-08 03:43:00
---
## hadoop完全分布式(fully)安装

### 主机资源的整体规划

``` bash
host01        host02              host03            备注 (测试机器配置 32vCPU 128gMem 2tDisk)
#----------------------------------------------------------------------------------------#
namenode      secondarynamenode   redourcemanager   实际环境中nn、snn、rm重要节点必须单独部署
datanode      datanode            datanode          主要消耗硬盘
nodemanager   nodemanager         nodemanager       主要消耗CPU
                                  historyserver     MR任务历史记录服务
```
<!--more-->

### 基本hadoop完全分布式环境搭建的主要步骤

1) 准备工作

``` bash
# 1. 配置 hosts 和 hostname
略

# 2. 配置 limits.conf (退出当前用户，重新登录生效)
$ sudo vim /etc/security/limits.conf
* soft nofile 65536
* hard nofile 131072
* soft nproc 4096
* hard nproc 4096
* soft memlock unlimited
* hard memlock unlimited

# 3. 安装JDK及设置环境变量
略

# 4. 配置相关主机间的免密登录
略

# 5. 安装和配置集群节点间的时间同步服务(NTP)
## 5.1. 在所有节点安装ntp服务
$ sudo yum install ntp ntpdate
## 5.2. 在所有节点设置时区（这里设置为中国所用时间）
$ sudo timedatectl set-timezone Asia/Shanghai
## 5.3. 同步网络上的准确时间 或 自己设置准确时间
$ sudo ntpdate cn.pool.ntp.org 或 sudo date -s "2018-06-30 11:11:11"
$ sudo hwclock -w
## 5.4.1. 对于ntpd服务端的配置
### 在server节点上设置其ntp服务器为其自身，同时设置可以接受连接服务的客户端，
### 是通过更改/etc/ntp.conf文件来实现的，其中server设置127.127.1.0为其
### 自身，新增加一个restrict段为可以接受服务的网段（stratum=0为最高等级，10为最低等级）
$ sudo vim /etc/ntp.conf
restrict 192.168.56.0 mask 255.255.255.0 nomodify notrap
server 127.127.1.0
fudge 127.127.1.0 stratum 10
## 5.4.2. 对于ntpd客户端的配置
### 设置其客户端时间基准服务器为host01
$ sudo vim /etc/ntp.conf
restrict 192.168.56.0 mask 255.255.255.0
server host01
$ sudo ntpdate host01
## 5.5. 配置/etc/sysconfig/ntpd文件，增加如下内容，让硬件时间和系统时间一起同步
SYNC_HWCLOCK=yes	
## 5.6. 重启ntp服务，并设置其为开机启动
## 安装NTP之后，systemctl enable ntpd设置为开机自动启动，但是重启之后NTP并没有启动，
## 一般引起这个问题的最为常见的原因是系统上安装了一个与NTP相冲突的工具chrony，
## 所以，解决这一问题的方法就是 systemctl disable chronyd
$ sudo systemctl restart ntpd
$ sudo systemctl enable ntpd
$ sudo systemctl list-unit-files | grep enable
## 5.7. 在所有节点启动时间同步
$ sudo timedatectl set-ntp yes
$ sudo timedatectl
```
请注意：
使用ntpd服务，要好于ntpdate加cron的组合。因为，ntpdate同步时间，会造成时间的跳跃，对一些依赖时间的程序和服务会造成影响。比如sleep，timer等。而且ntpd服务可以在修正时间的同时，修正cpu tick。理想的做法为，在开机的时候，使用ntpdate强制同步时间，在其他时候使用ntpd服务来同步时间。
要注意的是，ntpd有一个自我保护设置: 如果本机与上源时间相差太大，ntpd不运行。所以新设置的时间服务器一定要先ntpdate从上源取得时间初值，然后启动ntpd服务。ntpd服务运行后，先是每64秒与上源服务器同步一次，根据每次同步时测得的误差值经复杂计算逐步调整自己的时间，随着误差减小，逐步增加同步的间隔。 每次跳动，都会重复这个调整的过程。

2)  配置基本的 xxx-env.sh 文件

主要包含 hadoop-env.sh、mapred-env.sh、yarn-env.sh 三个文件

``` bash
# hadoop-env.sh
export hJAVA_HOME=/opt/jdk1.8.0_181
export HADOOP_LOG_DIR=/var/log/hadoop/$USER

# mapred-env.sh
export HADOOP_MAPRED_LOG_DIR="/var/log/hadoop/mr/logs"

# yarn-env.sh
if [ "$YARN_LOG_DIR" = "" ]; then
  #YARN_LOG_DIR="$HADOOP_YARN_HOME/logs"
  YARN_LOG_DIR="/var/log/hadoop/yarn/logs"
fi
if [ "$YARN_LOGFILE" = "" ]; then
  YARN_LOGFILE='yarn.log'
fi

# 在相关的每个节点创建和设置数据或日志目录
sudo mkdir -p /var/lib/hadoop/data/tmp
sudo mkdir -p /var/log/hadoop
sudo mkdir -p /var/log/hadoop/mr/logs
sudo mkdir -p /var/log/hadoop/yarn/logs
sudo chown -R hadoop:hadoop /var/lib/hadoop
sudo chown -R hadoop:hadoop /var/log/hadoop
```

3) 配置 xxx-site.xml 文件和 slaves 文件

主要包含 core-site.xml、hdfs-site.xml、mapred-site.xml、yarn-site.xml、slaves 这 4+1个文件

``` xml
<!-- core-site.xml -->
<configuration>
    <!-- 指定namenode的地址和端口 -->
    <property>
        <name>fs.defaultFS</name>
        <value>hdfs://host01:8020</value>
    </property>
    <!--指定hadoop运行时产生文件的存储目录，注意创建对应的目录和设置目录的权限-->
    <property>
        <name>hadoop.tmp.dir</name>
        <value>/var/lib/hadoop/data/tmp</value>
    </property>
    <!--设置一个hadoop的web静态用户名(默认为dr.who)-->
    <property>
        <name>hadoop.http.staticuser.user</name>
        <value>hadoop</value>
    </property>
    <!--丢进回收站中的文件多少分钟后会被系统永久删除，这里10080是7天，默认0-->
    <property>
        <name>fs.trash.interval</name>
        <value>10080</value>
    </property>
    <!--前后两次检查点的创建时间分钟间隔；新的检查点被创建后，旧的检查点随之被系统永久删除，默认0-->
    <property>
        <name>fs.trash.checkpoint.interval</name>
        <value>0</value>
    </property>
</configuration>


<!-- hdfs-site.xml -->
<configuration>
    <!--数据副本数-->
    <property>
        <name>dfs.replication</name>
        <value>3</value>
    </property>
    <!--HDFS文件目录是否进行权限检查-->
    <property>
        <name>dfs.permissions.enabled</name>
        <value>false</value>
    </property>
    <!--指定secondarynamenode的地址和端口-->
    <property>
        <name>dfs.namenode.secondary.http-address</name>
        <value>host02:50090</value>
    </property>
</configuration>


<!-- 配置slaves -->
<!--
严格来讲，slaves文件存储的并不是真正的datanode节点，它唯一的作用是在集群操作的时候要针对这个文件
作ssh处理。我们在start-all.sh、start-dfs.sh、start-yarn.sh的时候，通过ssh向远程服务器发送指
令，将远程服务器启动。至于节点是不是datanode节点，取决于hdfs-site.xml文件中的 dfs.hosts 和dfs.hosts.exclude 两个参数，dfs.hosts配置可以接入到集群中的datanode列表文件的路径，另一个参数
用于配置需下线机器列表文件的路径
-->
host01
host02
host03


<!-- mapred-site.xml -->
<configuration>
    <!--指定MR任务运行在yarn上，默认值为local-->
    <property>
        <name>mapreduce.framework.name</name>
        <value>yarn</value>
    </property>
    <!--配置和开启MR历史记录服务-->
    <property>
        <name>mapreduce.jobhistory.address</name>
        <value>host03:10020</value>
    </property>
    <property>
        <name>mapreduce.jobhistory.webapp.address</name>
        <value>host03:19888</value>
    </property>
</configuration>


<!-- yarn-site.xml -->
<configuration>
    <!--指定Reducer获取数据的方式为mapreduce_shuffle -->
    <property>
        <name>yarn.nodemanager.aux-services</name>
        <value>mapreduce_shuffle</value>
    </property>
    <!--指定resourcemanager所在的机器-->
    <!--如果没有指定，则在集群的哪一台机器启动resourcemanager，则就认为哪一台机器就是RMr-->
    <property>
        <name>yarn.resourcemanager.hostname</name>
        <value>host03</value>
    </property>	
    <!--如果有多张网卡，需要配置此选项，才能打开web界面-->
    <property>
    	<name>yarn.resourcemanager.webapp.address</name>
    	<value>host03:8088</value>
    </property>
    <!--启用hadoop的日志聚集功能(默认false)-->
    <property> 
        <name>yarn.log-aggregation-enable</name>
        <value>true</value>
    </property>
    <!--日志保存在HDFS上的期限(默认为-1，这里配置的是一周)-->
    <property>
        <name>yarn.log-aggregation.retain-seconds</name>
        <value>604800</value>
    </property>
</configuration>
```

4) 往各个节点分发hadoop安装及配置文件

``` bash
$ zcopy /home/hadoop/hadoop-2.7.6/ /home/hadoop/
```

5) 在namenode节点（此处为host01）格式化文件系统

``` bash
# 格式化之前必须先删除之前各个节点datanode的旧数据
$ zcall rm -rf /var/lib/hadoop/data/tmp/*

# 在namenode节点格式化文件系统
$ hdfs namenode -format
```

6) 在对应的节点(不强制要求)启动服务

``` bash
# 启动HDFS服务
[hadoop@host01 ~]$ start-dfs.sh 
Starting namenodes on [host01]
host01: starting namenode, logging to xxx/userxxx/hadoop-hadoop-namenode-host01.out
host03: starting datanode, logging to xxx/userxxx/hadoop-hadoop-datanode-host03.out
host01: starting datanode, logging to xxx/userxxx/hadoop-hadoop-datanode-host01.out
host02: starting datanode, logging to xxx/userxxx/hadoop-hadoop-datanode-host02.out
Starting secondary namenodes [host02]
host02: starting secondarynamenode, logging to xxx/hadoop/hadoop-hadoop-secondarynamenode-host02.out

# 启动YARN服务
[hadoop@host03 ~]$ start-yarn.sh 
starting yarn daemons
starting resourcemanager, logging to xxx/yarn/logs/yarn-hadoop-resourcemanager-host03.out
host02: starting nodemanager, logging to xxx/yarn/logs/yarn-hadoop-nodemanager-host02.out
host01: starting nodemanager, logging to xxx/yarn/logs/yarn-hadoop-nodemanager-host01.out
host03: starting nodemanager, logging to xxx/yarn/logs/yarn-hadoop-nodemanager-host03.out

# 启动historyserver服务
[hadoop@host03 ~]$ mr-jobhistory-daemon.sh start historyserver
starting historyserver, logging to xxx/mr/logs/mapred-hadoop-historyserver-host03.out
```

7) 查看各个节点的服务启动情况

``` bash
[hadoop@host01 ~]$ zcall jps
-------------host01---------------
21430 Jps
20746 DataNode
21276 NodeManager
20591 NameNode
-------------host02---------------
8242 DataNode
8354 SecondaryNameNode
9078 Jps
8892 NodeManager
-------------host03---------------
6993 DataNode
7762 ResourceManager
8515 Jps
8440 JobHistoryServer
7881 NodeManager
```