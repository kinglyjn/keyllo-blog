title: hadoop的伪分布式安装
author: kinglyjn
tags:
  - hadoop
categories:
  - dataops
  - ''
  - hadoop
date: 2018-11-08 03:38:00
---
## hadoop伪分布式(pseudo)安装

### 伪分布式的基本安装

1) 配置hadoop-env.sh

``` bash
vim $HADOOP_HOME/etc/hadoop/hadoop-env.sh
# 配置 JAVA_HOME
export JAVA_HOME=/opt/jdk1.8.0_181
# 日志存放目录，默认为 $HADOOP_HOME/logs by default.
# export HADOOP_LOG_DIR=${HADOOP_LOG_DIR}/$USER
# *.log：通过log4j记录的大部分应用程序的日志信息
# *.out：记录标准输出和标准错误日志，少量记录
export HADOOP_LOG_DIR=/var/log/hadoop/$USER

sudo mkdir -p /var/log/hadoop
sudo mkdir -p /var/lib/hadoop/data/tmp
sudo chown -R hadoop:hadoop /var/lib/hadoop
sudo chown -R hadoop:hadoop /var/log/hadoop
```

<!--more-->

2) 配置 core-site.xml （[默认值参考](http://hadoop.apache.org/docs/r2.6.0/hadoop-project-dist/hadoop-common/core-default.xml)）

``` xml
<!--指定hdfs中namenode的地址和端口-->
<property>
  <name>fs.defaultFS</name>
  <value>hdfs://host01:8020</value>
</property>
<!--指定hadoop运行时产生文件的存储目录，注意创建对应的目录和设置目录的权限-->
<property>
  <name>hadoop.tmp.dir</name>
  <value>/var/lib/hadoop/data/tmp</value>
</property>
```

3) 配置 hdfs-site.xml（[默认值参考](http://hadoop.apache.org/docs/r2.6.0/hadoop-project-dist/hadoop-hdfs/hdfs-default.xml)）

``` xml
<!--默认数据副本数为3，此处设置为1-->
<property>
  <name>dfs.replication</name>
  <value>1</value>
</property>
```

4) 格式化namenode（只有在第一次启动之前才格式化）

``` bash
bin/hdfs namenode -format
ls ${hadoop.tmp.dir}/dfs/name/current
fsimage_0000000000000000000  fsimage_0000000000000000000.md5  seen_txid  VERSION
```

5) 启动 hdfs 的 namenode和datanode 服务
```bash
sbin/hadoop-daemon.sh start namenode  (关闭为 stop)
sbin/hadoop-daemon.sh start datanode  (关闭为 stop)
jps
10920 NameNode
11003 DataNode
11071 Jps
```

6) WEB端查看HDFS文件系统及测试

``` bash
# WEB端查看HDFS文件系统
curl http://host01:50070

# HDFS测试命令
bin/hdfs dfs -mkdir -p /user/hadoop/input  (或 hadoop fs -mkdir ...)
bin/hdfs dfs -ls -R /
bin/hdfs dfs -put xxx/xxx.txt /user/hadoop/input
bin/hdfs dfs -get /user/hadoop/input/xxx.txt /opt/datas
bin/hdfs dfs -getmerge xxx/file01 xxx/file02 /opt/datas/mergedfile1_2.txt
bin/hdfs dfs -cat /user/hadoop/input/xxx.txt
bin/hdfs dfs -rm -r /user/hadoop/output

#查看当前hdfs是不是处于安全状态(安全状态是只读的)
bin/hdfs dfsadmin -safemode get
#进入|离开安全模式
bin/hdfs dfsadmin -safemode [enter|leave]

# MR测试命令(注意默认的 mapred-site.xml::mapreduce.framework.name 为 local)
bin/hadoop jar share/hadoop/mapreduce/hadoop-mapreduce-examples-2.7.6.jar wordcount /user/hadoop/input /user/hadoop/output
```

注意：

``` bash
# 消除ulimit警告
$ sudo vim /etc/security/limits.conf (退出当前用户，重新登录生效)
* soft nofile 65536
* hard nofile 131072
* soft nproc 4096
* hard nproc 4096
* soft memlock unlimited
* hard memlock unlimited

# namenode和datanode同时只能有一个工作的原因分析
# java.io.IOException: Incompatible clusterIDs in /var/lib/hadoop/data/tmp/dfs/data: namenode clusterID = CID-90c9142e-7220-4cf8-ba4e-20e4248a5692; datanode clusterID = CID-924dac24-3358-4cee-8c70-b35f4d721562
1) 首先第一次启动没有问题
2) 下一次启动时，可能由于namenode重新格式化，导致namenode和datanode数据版本不一致而不能正常启动
3) 解决方法是，在namenode格式化之前，删除datanode里面的信息(配置在core-site.xml ${hadoop.tmp.dir})
```

### 将伪分布式运行在yarn的管理之下

除了上述的配置之外，还需要进行如下配置或操作。

1) 配置 yarn-env.sh

``` bash
# default log directory & file
if [ "$YARN_LOG_DIR" = "" ]; then
  #YARN_LOG_DIR="$HADOOP_YARN_HOME/logs"
  YARN_LOG_DIR="/var/log/hadoop/yarn/logs"
fi
if [ "$YARN_LOGFILE" = "" ]; then
  YARN_LOGFILE='yarn.log'
fi

sudo mkdir -p /var/log/hadoop/yarn/logs
sudo chown -R hadoop:hadoop /var/log/hadoop
```

2) 配置 yarn-site.xml（[默认值参考](http://hadoop.apache.org/docs/r2.6.0/hadoop-yarn/hadoop-yarn-common/yarn-default.xml)）

``` xml
<!--指定 YRAN ResourceManager 的地址-->
<property>
  <name>yarn.resourcemanager.hostname</name>
  <value>host01</value>
</property>
<!--指定 Reducer 获取数据的方式为 mapreduce_shuffle -->
<property>
  <name>yarn.nodemanager.aux-services</name>
  <value>mapreduce_shuffle</value>
</property>
```

3) 配置 mapred-site.xml（[默认值参考](http://hadoop.apache.org/docs/r2.6.0/hadoop-mapreduce-client/hadoop-mapreduce-client-core/mapred-default.xml)）

``` xml
<!--指定MR运行在yarn上，默认值为local-->
<property>
  <name>mapreduce.framework.name</name>
  <value>yarn</value>
</property>
```

4) 启动 yarn 的 resourcemanager和nodemanager 服务

``` bash
sbin/yarn-daemon.sh start resource manager
sbin/yarn-daemon.sh start nodemanager
jps
10465 Jps
9782 NameNode
10329 NodeManager
10077 ResourceManager
9886 DataNode
```

5) WEB端查看YARN服务以及测试命令

``` bash
# WEB端查看YARN服务
# 浏览器访问yarn客户端管理界面 可以在yarn-site.xml的 yarn.resourcemanager.webapp.address 配置
# 默认的客户端管理界面http地址 ${yarn.resourcemanager.hostname}:8088
curl http://host01:8088

# MR测试命令(设置 mapred-site.xml::mapreduce.framework.name 为 yarn)
bin/hadoop jar share/hadoop/mapreduce/hadoop-mapreduce-examples-2.7.6.jar wordcount /user/hadoop/input /user/hadoop/output
```

### 配置和开启hadoop自带的MR历史记录服务

作业历史记录服务会在应用完成运行之后，会将日志的信息上传到HDFS文件系统上（一般保存在HDFS的 /tmp 目录下）。如果没有配置和开启历史服务器的服务，在yarn的web管理页是看不到mapreduce任务的history项的。

配置和开启MR历史记录服务的过程如下：

1) 配置 mapred-env.sh

``` bash
# Where log files are stored.  $HADOOP_MAPRED_HOME/logs by default.
# export HADOOP_MAPRED_LOG_DIR="" 
export HADOOP_MAPRED_LOG_DIR="/var/log/hadoop/mr/logs"

sudo mkdir -p /var/log/hadoop/mr/logs
sudo chown -R hadoop:hadoop /var/log/hadoop
```

2) 配置 mapred-site.xml，增加如下两个参数

``` xml
<property>
  <name>mapreduce.jobhistory.address</name>
  <value>host01:10020</value>
</property>
<property>
  <name>mapreduce.jobhistory.webapp.address</name>
  <value>host01:19888</value>
</property>
```

3) 启动MR历史记录服务

``` bash
$ sbin/mr-jobhistory-daemon.sh start historyserver
jps
13443 JobHistoryServer #
12004 ResourceManager
12248 NodeManager
10920 NameNode
13528 Jps
11003 DataNodes
```

### 配置和开启MR日志聚集功能

如果没有配置hadoop的日志聚集功能，则在yarn点击某个mr任务 map或reduce 的 logs 选项是看不到日志信息的。

``` bash
$ curl http://host01:8088
$ curl http://host01:19888/jobhistory/logs/host01:45881/container_xxx/job_xxx/hadoop
Aggregation is not enabled. Try the nodemanager at host01:45881
```

1) 配置 yarn-site.xml 

``` xml
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
```

2) 重启resourcemanager、nodemanager、historyserver服务

``` bash
sbin/yarn-daemon.sh stop resourcemanager 
sbin/yarn-daemon.sh stop nodemanager
sbin/mr-jobhistory-daemon.sh stop historyserver
#
sbin/yarn-daemon.sh start resourcemanager 
sbin/yarn-daemon.sh start nodemanager
sbin/mr-jobhistory-daemon.sh start historyserver
```

3) 重新在yarn上运行mr wordcount程序，查看MR历史记录服务和日志聚集功能是否生效

``` bash
bin/hadoop jar share/hadoop/mapreduce/hadoop-mapreduce-examples-2.7.6.jar wordcount /user/hadoop/input /user/hadoop/output3
```

### HDFS目录权限检查

比方说刚才我们配置了hadoop的作业历史记录服务，一般会将日志信息保存在HDFS的 /tmp 目录下，但是在[web页](http://host01:50070/explorer.html#/)没有配置权限情况下我们是看不到 tmp里面的内容的。

``` html
Permission denied: user=dr.who, access=READ_EXECUTE, inode="/tmp":ubuntu:supergroup:drwx------
```

原因是因为在 hdfs-site.xml 配置中 `dfs.permissions.enabled` 参数默认是true的，在开发环境，为了方便查看日志，通常先设置为false：

``` xml
<property>
  <name>dfs.permissions.enabled</name>
  <value>false</value>
</property>
```

另外，编辑core-site.xml，设置一个hadoop的web静态用户名(默认为dr.who)

``` xml
<property>
  <name>hadoop.http.staticuser.user</name>
  <value>hadoop</value>
</property>
```

重启hadoop相关进程

``` bash
sbin/yarn-daemon.sh stop resourcemanager
sbin/yarn-daemon.sh stop nodemanager
sbin/mr-jobhistory-daemon.sh stop historyserver
sbin/hadoop-daemon.sh stop namenode
sbin/hadoop-daemon.sh stop datanode

sbin/yarn-daemon.sh start resourcemanager
sbin/yarn-daemon.sh start nodemanager
sbin/mr-jobhistory-daemon.sh start historyserver
sbin/hadoop-daemon.sh start namenode
sbin/hadoop-daemon.sh start datanode
```

### 启用HDFS secondary namenode服务

namenode元数据（文件名、文件目录结构、文件生成时间、副本数、文件权限等信息）初始的时候是通过 bin/hdfs namenode -format 生成的，通过格式化这条命令，会在${HADOOP_TMP_DIR}/dfs/name/current 的 目录中生成一个`fsimage_*`的镜像文件（存放元数据），在namenode节点启动以后，元数据就被加载到内存当中。当在HDFS系统中做了增删改的操作之后，同样会在${HADOOP_TMP_DIR}/dfs/name/current 目录中产生`edits_*` 操作日志文件。namenode节点在重启的时候，会先读取 fsimage 和 edits文件，以将文件系统的元数据加载到namenode节点的内存当中。

``` bash
hadoop@host01:/var/lib/hadoop/data/tmp/dfs/name/current$ du -sh *
1.0M    edits_0000000000000000001-0000000000000000130
1.0M    edits_inprogress_0000000000000000131
4.0K    fsimage_0000000000000000000
4.0K    fsimage_0000000000000000000.md5
4.0K    seen_txid
4.0K    VERSION
```

通常如果hadoop如果运行了很长时间之后，edits操作日志文件就会变得很大。当这时候因为修改了hadoop的某个配置项或服务器修复需要重启 namenode节点的时候，这个重启的过程就会变得很慢（因为读edits操作日志文件通常要比读fsimage镜像文件慢很多）。所以为了减少namenode重启的时间，这时候就需要HDFS 的secondarynamenode。secondarynamenode的作用具体如下：

1. secondarynamenode在启动以后也会每隔一段时间读取 fsimage镜像文件 和 操作日志文件，读取完成之后，这些元数据信息会被加载到 secondarynamenode 节点自己的内存当中，然后将自己内存当中的元数据信息写到新的 fsimage镜像文件当中。
2. 当有新的HDFS的增删改操作之后，secondarynamenode会产生新的edits操作日志。然后下一次重启的时候，又会读取新的 fsimage镜像文件 和 操作日志文件，类似于上述1的步骤。

通过以上两步，secondarynamenode会不断合并edits操作日志文件到新的fsimage镜像文件，这样就有效地减少了namenode重启所花费的时间。

用一句话归结secondarynamenode的作用就是：`每隔一段时间合并生成HDFS元数据的新的快照，以减少namenode重启所花费的时间`。

以下是配置和启动secondarynamenode服务的过程：

1) 编辑 hdfs-site.xml，增加如下参数配置

``` xml
<property>
  <name>dfs.namenode.secondary.http-address</name>
  <value>host01:50090</value>
</property>
```

2) 开启secondarynamenode服务

``` bash
sbin/hadoop-daemon.sh start secondarynamenode

jps
19685 NodeManager
19862 NameNode
20583 Jps
19784 JobHistoryServer
19437 ResourceManager
20542 SecondaryNameNode #
19967 DataNode
```

3) 访问secondarynamenode服务web端

``` bash
curl http://host01:50090
```

4) 查看secondarynamenode生成的文件(除了namenode文件夹，又多出了一个namesecondary文件夹)

``` bash
hadoop@host01:/var/lib/hadoop/data/tmp/dfs$ ls
data  name  namesecondary

hadoop@host01:/var/lib/hadoop/data/tmp/dfs/namesecondary/current$ du -sh *
1.0M    edits_0000000000000000001-0000000000000000130
4.0K    edits_0000000000000000131-0000000000000000132
4.0K    fsimage_0000000000000000000
4.0K    fsimage_0000000000000000000.md5
4.0K    fsimage_0000000000000000132
4.0K    fsimage_0000000000000000132.md5
4.0K    VERSION
```

### hadoop快捷启动和关闭脚本

``` bash
# 首先可以设置不同主机之间通过ssh免密码登录
# 所谓的ssh公钥登录，就是用户将自己的公钥存储在远程主机上，登录的时候远程主机会向用户发送一段随机的字符串，
# 用户用自己的私钥加密后再发回到远程主机，远程主机主机用事先存储的公钥进行解密，如果成功就证明用户是可信的，
# 直接允许登录shell，不再要求输入密码。
# 1. 在用户机器上生成秘钥-公钥对 ssh-keygen -t [rsa|dsa] -C "xxx@xxx"
# 2. 拷贝用户机器上的公钥 id_rsa.pub 到需要登录远程主机上的 ~/.ssh/authorized_keys 文件中
# 或者第二步中，直接在本机上执行 ssh-copy-id hadoop@host01 将公钥拷贝到远程主机的authorized_keys中
# 配置无秘钥登录之后，快捷启动脚本就不会每次都需要输密码那么麻烦了

# 启动和关闭HDFS
# 启动顺序 namenode、datanode、secondarynamenode
# 关闭顺序 namenode、datanode、secondarynamenode
$ sbin/start-dfs.sh
$ sbin/stop-dfs.sh 

# 启动和关闭YARN
# 启动顺序 resourcemanager、nodemanager
# 关闭顺序 resourcemanager、nodemanager
$ sbin/start-yarn.sh 
$ sbin/stop-yarn.sh 

# 剩下的MR历史记录服务需要单独开启和关闭
$ sbin/mr-jobhistory-daemon.sh start historyserver
$ sbin/mr-jobhistory-daemon.sh stop historyserver
```
<br>