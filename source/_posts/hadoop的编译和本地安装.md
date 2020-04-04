title: hadoop的编译和本地安装
author: kinglyjn
tags:
  - hadoop
categories:
  - dataops
  - ''
  - hadoop
date: 2018-11-07 23:57:00
---
## hadoop 源码的编译（v2.7.6）

Hadoop是使用Java语言开发的，但出于性能、安全等角度考虑，hadoop部分功能（如压缩）使用系统本地库(Native Libraries)实现。本地库是由C/C++编写的动态库xxx.so（windows下对应xxx.dll文件），并通过JNI(Java Native Interface)机制为java层提供接口。由于不同的处理器架构，需要编译出相应平台的动态库(xxx.so)文件，才能被正确的执行，所以最好重新编译一次hadoop源码，让xxx.so文件与自己处理器相对应。如下是编译hadoop应用的一般步骤：

<!--more-->

``` bash
# 查看hadoop源码中BUILDING.txt文件
hadoop编译依赖环境等

# 安装 gcc、gcc-c++
yum install gcc
yum install glibc-headers
yum install gcc-c++ 

# 安装 cmake
yum install cmake

# 安装 openssl-devel
yum install openssl-devel

# 安装 zlib-devel、ncurses-devel
# [ERROR] Failed to execute goal org.apache.maven.plugins:maven-antrun-plugin:1.7:run (make) on project hadoop-common: An 
# Ant BuildException has occured: exec returned: 1
# [ERROR] around Ant part ...<exec failonerror="true" dir="/home/maven/hadoop-2.7.6-src/hadoop-common-project/hadoop-common
# /target/native" executable="cmake">... @ 4:132 in /home/maven/hadoop-2.7.6-src/hadoop-common-project/hadoop-common/target
# /antrun/build-main.xml
yum -y install zlib-devel 
yum -y install ncurses-devel

# 卸载 google protobuf
rm `which protoc`
# 安装 google protobuf 2.5.0
# https://github.com/google/protobuf/releases?after=v3.0.0-alpha-4.1 找到相应的版本下载，这里我们需要2.5.0版本
tar -zxvf protobuf-2.5.0.tar.gz
cd protobuf-2.5.0
./configure
make
make install
protoc --version

# 编译安装snappy
tar -zxvf snappy-1.1.3.tar.gz -C /opt/module/
cd snappy-1.1.3/
./configure
make
make install
ls -lh /user/local/lib |grep snappy

# MAVEN install 时候 JVM 内存溢出
# 处理方式:在环境配置文件和 maven 的执行文件均可调整 MAVEN_OP 的heap大小
export MAVEN_OPTS="-Xms256m -Xmx1536m"

# 编译hadoop源码
# 编译完成的源码位于 xxx/hadoop-2.7.6-src/hadoop-dist/target/hadoop-2.7.6.tar.gz
# 编译时间视硬件和网络情况 0.5~2小时不等
tar -zxvf hadoop-2.7.6-src.tar.gz
cd hadoop-2.7.6-src
mvn package -Pdist,native -DskipTests -Dtar
或
mvn package -Pdist,native -DskipTests -Dtar -Dsnappy.lib=/usr/local/lib -Dbundle.snappy
```
![图1](/images/pasted-19.png)

## hadoop本地(local)安装和测试

``` bash
# 1. tar开、创建软连接、设置和导出HADOO_HOME环境变量、将$HADOOP_HOME/bin&sbin增加到PATH环境中
$ ...

# 2. 编辑配置文件hadoop-env.sh
$ vim $HADOOP_HOME/etc/hadoop/hadoop-env.sh
export JAVA_HOME=/opt/jdk1.8.0_181

# 3. 测试（注意output文件夹事先不存在）
$ hadoop jar $HADOOP_HOME/share/hadoop/mapreduce/hadoop-mapreduce-examples-2.7.6.jar wordcount ~/test/input/ ~/test/output/
$ cat output/part-r-00000 
hadoop  1
hello   3
keyllo  1
world   1
```
<br>