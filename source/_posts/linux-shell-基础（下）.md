title: linux shell 基础（下）
author: kinglyjn
tags:
  - linux
categories:
  - os
  - linux
date: 2018-09-21 23:26:00
---
## shell工具-cut

cut的工作就是“剪”，具体的说就是在文件中负责剪切数据用的。cut命令从文件的每一行剪切字节、字符和字段并将这些字节、字符和字段输出。注意cut操作文件内容并没有改变原文件内容，除非你使用重定向存储输出。

<!--more-->

### 基本用法
cut [选项参数] filename

选项参数说明：
* -f 列号，提取第几列，`-f n-`表示第n列及以后的所有列，`-f -n`表示第n列及以前的所有列；
* -d 分隔符，按照指定分隔符分割列（默认分割符是制表符）

### 示例

``` bash 
# 数据准备
$ touch cut.txt
$ vim cut.txt
bei shen
jing zhen
wo  wo
lai  lai
le  le

# 切割cut.txt第1列
[root@host-test test]# cut -d " " -f 1 cut.txt 
bei
jing
wo
lai
le

# 切割cut.txt第2、3列
[root@host-test test]# cut -d " " -f 2,3 cut.txt 
shen
zhen
 wo
 lai
 le

# 在cut.txt文件中切割出 jing
[root@host-test test]# cat cut.txt | grep jing | cut -d " " -f 1
jing

# 选取系统PATH变量值，第1个“:”后的所有路径
[root@host-test test]# echo $PATH | cut -d ":" -f 2-
/usr/local/bin:/usr/sbin:/usr/bin:/opt/java/bin:/opt/nodejs/bin:/root/bin

# 切割ifconfig后打印的IP地址
[root@host-test test]# ifconfig enp0s8 | grep inet.*netmask | cut -d " " -f 10
192.168.56.101
```

## shell工具-sed

sed是一种流编辑器，它一次处理一行内容。处理时，把当前处理的行存储在临时缓冲区中，称为“模式空间”；接着用sed命令处理缓冲区中的内容，处理完成后，把缓冲区的内容送往屏幕；接着处理下一行，这样不断重复，直到文件末尾。文件内容并没有改变，除非你使用重定向存储输出。

### 基本用法

sed [选项参数] 'command' filename

选项参数说明：
* -e：直接在指令列模式上进行sed的动作编辑

命令功能描述：
* a：新增，a的后面可以接字串，在下一行出现
* d：删除
* s：查找并替换 

### 示例

``` bash
# 数据准备
$ touch sed.txt
$ vim sed.txt
bei shen
jing zhen
wo  wo
lai  lai
le  le

# 将“mei nv”这个单词插入到sed.txt第二行下，并打印（注意文件并没有改变）
[root@host-test test]# sed '2a mei nv' sed.txt 
bei shen
jing zhen
mei nv
wo  wo
lai  lai
le  le

# 删除sed.txt文件所有包含wo的行
[root@host-test test]# sed '/wo/d' sed.txt 
bei shen
jing zhen
lai  lai
le  le

# 将sed.txt文件中wo替换为ni（'g'表示global，全部替换）
[root@host-test test]# sed 's/wo/ni/g' sed.txt 
bei shen
jing zhen
ni  ni
lai  lai
le  le

# 将sed.txt文件中的第二行删除并将wo替换为ni
[root@host-test test]# sed -e '2d' -e 's/wo/ni/g' sed.txt 
bei shen
ni  ni
lai  lai
le  le
```

## shell工具-awk

* awk是行处理器: 相比较屏幕处理的优点，在处理庞大文件时不会出现内存溢出或是处理缓慢的问题，通常用来格式化文本信息
* awk处理过程: 依次对每一行进行处理，然后输出

### 基本用法

``` bash
awk [选项参数] 'BEGIN{} pattern1{action1}  pattern2{action2} ... END{}' filename
```
注意：
* pattern：表示AWK在数据中查找的内容，就是匹配模式
* action：在找到匹配内容时所执行的一系列命令

选项参数说明：
* -F：指定输入文件折分隔符
* -f：调用脚本
* -v：赋值一个用户定义变量

awk的内置变量：
`FILENAME`：文件名
`NR`：已读的记录数
`NF`：浏览记录的域的个数（切割后，列的个数）

### 示例

``` bash
# 数据准备
$ sudo cp /etc/passwd ./

# 搜索passwd文件以root关键字开头的所有行，并输出该行的第7列
$ awk -F : '/^root/{print $7}' passwd 
/bin/bash

# 搜索passwd文件以root关键字开头的所有行，并输出该行的第1列和第7列，中间以“,”号分割
# 注意：只有匹配了pattern的行才会执行action
$ awk -F : '/^root/{print $1","$7}' passwd
root,/bin/bash

# 只显示/etc/passwd的第一列和第七列，以逗号分割
# 且在所有行前面添加列名user，shell在最后一行添加"xiaojuan,/bin/zhenhaokan"
# 注意：BEGIN在所有数据读取行之前执行，END在所有数据执行之后执行
$ awk -F : 'BEGIN{print "user,shell"} {print $1","$7} END{print "xiaojuan,/bin/zhenhaokan"}' passwd
user,shell
root,/bin/bash
bin,/sbin/nologin
daemon,/sbin/nologin
...
tomcat,/bin/bash
hexo,/bin/bash
xiaojuan,/bin/zhenhaokan

# 将passwd文件中的用户id增加数值1并输出
$ awk -F : -v i=1 '{print $3+i}' passwd
1
2
3
...
1001
1002

# 统计passwd文件名，每行的行号，每行的列数
$ awk -F : '{print "filename:" FILENAME ",linenum:" NR ",columns:" NF}' passwd 
filename:passwd,linenum:1,columns:7
filename:passwd,linenum:2,columns:7
filename:passwd,linenum:3,columns:7
...
filename:passwd,linenum:20,columns:7
filename:passwd,linenum:21,columns:7

# 切割IP
$ ifconfig enp0s8
enp0s8: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 192.168.56.101  netmask 255.255.255.0  broadcast 192.168.56.255
        inet6 fe80::6163:e383:f5e:1c85  prefixlen 64  scopeid 0x20<link>
        ether ff:ff:27:8f:b1:a1  txqueuelen 1000  (Ethernet)
        RX packets 47657  bytes 26156068 (24.9 MiB)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 26602  bytes 9689205 (9.2 MiB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0
$ ifconfig enp0s8 | grep inet.*netmask | awk -F " " '{print $2}'
192.168.56.101

# 查询sed.txt中空行所在的行号
awk '/^$/{print NR}' sed.txt 
5
```

## shell工具-sort

sort命令是在Linux里非常有用，它将文件进行排序，并将排序结果标准输出。

### 基本语法

``` bash
sort 选项 待排序文件的列表
```

选项：
* -n：依照数值的大小排序
* -r：以相反的顺序来排序
* -t：设置排序时所用的分隔字符
* -k：指定需要排序的列

### 示例

``` bash
# 数据准备
$ touch sort.txt
$ vim sort.txt
bb:40:5.4
bd:20:4.2
xz:50:2.3
cls:10:3.5
ss:30:1.6

# 按照“:”分割后的第三列倒序排序
$ sort -t : -nrk 3 sort.txt
bb:40:5.4
bd:20:4.2
cls:10:3.5
xz:50:2.3
ss:30:1.6
```

## 测试示例

示例1：查询file1中空行所在的行号
``` bash
$ awk '/^$/{print NR}' sed.txt 
```

示例2：有文件chengji.txt内容如下
张三 40
李四 50
王五 60
使用Linux命令计算第二列的和并输出：
``` bash
$ cat chengji.txt | awk -F " " '{sum+=$2} END{print sum}'
```

示例3：对文本中无序的一列数字排序并求和
``` bash
sort -n test.txt | awk '{sum+=$0; print $0} END{print "sum="sum}'
1
2
5
8
sum=16
```

## 文件编码（iconv）

``` bash
# 将UTF-8编码的src-file.csv 转化为 GBK编码的target-file.csv
iconv -f UTF-8 -c  -t GBK src-file.csv > target-file.csv
```

## 文件解压和压缩

``` bash
# tar
# 只是打包动作，相当于归档处理，不做压缩；解压也一样，只是把归档文件释放出来
tar -cvf xxx.tar file1 file2
tar -xvf xxx.tar -C /xxx/path

# tar.gz tgz 
# tar.gz和tgz只是两种不同的书写方式，后者是一种简化书写，等同处理
# 兼顾了压缩时间（耗费CPU）和压缩空间（压缩比率），本质是对tar包进行gzip算法的压缩
tar -zcvf xxx.tar.gz file1 file2
tar -zxvf xxx.tar.gz -C /xxx/path

# tar.bz
# Linux下压缩比率较tgz大，即压缩后占用更小的空间，使得压缩包看起来更小。
# 但同时在压缩，解压的过程却是非常耗费CPU时间。
tar -jcvf xxx.tar.bz2 file1 file2
tar -jxvf xxx.tar.gz -C /xxx/path

# gz
gzip -d examples.gz examples
gunzip examples.gz

# zip 
# 格式是开放且免费的，所以广泛使用在 Windows、Linux、MacOS 平台
# 要说 zip 有什么缺点的话，就是它的压缩率并不是很高，不如 rar及 tar.gz 等格式
zip -r examples.zip examples   (examples可为目录)
unzip examples.zip

# rar
rar -a examples.rar examples
rar -x examples.rar
```

## 标准输出和错误输出

``` bash
$ nohup xxx/xxx.sh > mystd.out 2> myerr.ouct &
```

