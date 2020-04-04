title: linux shell 基础（上）
author: kinglyjn
tags:
  - linux
categories:
  - os
  - linux
  - ''
date: 2018-09-20 23:46:00
---
## shell是啥？

### shell的概念

* shell是一个命令行解释器，它接收应用程序或用户的指令，然后调用操作系统内核；
* shell还是一个功能强大的编程语言，易编写，灵活性强；
<img src="/images/pasted-10.png" alt="图1" style="width:70%"/>

<!--more-->

### shell解析器

shell指令是从上往下执行的，由shell解析完成shell的解析过程，然后交由操作系统完成相应的功能。
linux提供的shell解析器有：
``` bash
$ cat /etc/shells 
/bin/sh
/bin/bash
/sbin/nologin
/bin/dash
/bin/tcsh
/bin/csh
```
bash和sh的关系：
``` bash
$ ll /bin/sh
lrwxrwxrwx. 1 root root 4 Aug 20 10:22 /bin/sh -> bash
```
centos默认的解析器是bash:
``` bash
$ echo $SHELL
/bin/bash
```

## shell脚本的编写和执行

### 编写第一个脚本

``` bash
$ touch helloworld.sh
$ vim helloworld.sh

# 在helloworld.sh中输入如下内容
#!/bin/bash
echo "helloworld"
```

### 脚本常用的执行方式

``` bash
# 1.采用bash或sh+脚本的相对路径或绝对路径（不用赋予脚本+x权限）
$ sh helloworld.sh 
$ bash helloworld.sh

# 2.采用输入脚本的绝对路径或相对路径执行脚本（必须具有可执行权限+x）
$ chmod u+x helloworld.sh
$ ./helloworld.sh
```
注意：第一种执行方法，本质是bash解析器帮你执行脚本，所以脚本本身不需要执行权限。第二种执行方法，本质是脚本自己执行，所以需要执行权限。

### 第二个shell脚本-多命令处理

需求：在/home/keyllo/目录下创建一个hello.txt,在hello.txt文件中增加“hello keyllo, hello world”。
``` java
$ touch batch.sh
$ vi batch.sh

# 在batch.sh中输入如下内容
#!/bin/bash
cd /home/keyllo
touch hello.txt
echo "hello keyllo, hello world" >> hello.txt
```

## shell变量

### 系统变量

常用的系统变量有：`$HOME`、`$PWD`、`$SHELL`、`$USER`
``` bash
# 查看系统变量的值
echo $SHELL

# 显示当前Shell中所有变量
$ set
```

### 自定义变量

1. 基本语法
	* 定义变量：变量=值 
	* 撤销变量：unset 变量
	* 声明静态变量：readonly变量，注意：不能unset
	* 可以通过export把变量提升为全局环境变量，供其他Shell程序使用
2. 变量定义规则
	* 变量名称可以由字母、数字和下划线组成，但是不能以数字开头，环境变量名建议大写；
	* `定义变量时等号两侧不能有空格`，变量的值如果有空格，需要使用双引号或单引号括起来；
	* 在bash中变量`默认类型都是字符串类型`，无法直接进行数值运算；

案例：
``` bash
# 给变量赋值
$ A=5
$ echo $A
5

# 撤销变量
unset A
echo $A

# 声明静态变量
readonly B=2
echo $B
2

# 静态变量不能被重新赋值或撤销
B=9
echo $B
2
unset B
-bash: unset: B: cannot unset: readonly variable

# 变量默认类型都是字符串类型，无法直接进行数值运算
$ C=1+2
echo $C
1+2

# 变量的值如果有空格，需要使用双引号或单引号括起来
D="hello keyllo, hello world"
echo $D
hello keyllo, hello world

# 可把变量提升为全局环境变量，可供其他Shell程序使用
JAVA_HOME=xxx
export JAVA_HOME
```

### 特殊变量

* $n：n为数字，`$0`代表该脚本名称，`$1-$9`代表第一到第九个参数，十以上的参数，十以上的参数需要用大括号包含，如`${10}`
* $#：获取所有输入参数个数，常用于循环
* $\*：这个变量代表命令行中所有的参数，$\*把所有的参数看成一个整体
* $@：这个变量也代表命令行中所有的参数，不过$@把每个参数区分对待
* $?：最后一次执行的命令的返回状态。如果这个变量的值为0，证明上一个命令正确执行；如果这个变量的值为非0（具体是哪个数，由命令自己来决定），则证明上一个命令执行不正确

``` bash
$ ./helloworld.sh 
$ echo $?
0
```

### 定义一个很长的字符串

``` bash
#!/bin/bash

# 当前脚本路径
CUR_SHELL_DIR=$(cd `dirname $0`; pwd)

# 映射表核心sql语句，注意hive语句不要使用\t，而是用空格代替
core_select_sql=$(echo -e "
select
    case
        when os='iOS' then 'ios' 
        else 'Android' 
    end as os_type,
    case
        when..then..
        else 'other'
    end as event_identifier,
    case
        when..then..
        else 'other'
    end as event_meaning,
    event_id,
    create_time,
    ...
    version
from ods.r15012_xjm 
")

# 1.映射结果表 ods.tmp_01_r15012_xjm 不存在则创建
# 2.将源表ods.r15012_xjm的增量数据映射导入到ods.tmp_01_r15012_xjm表
# 【注意】echo "$core_sql" 格式可以正常显示换行
if [ -n "$1" ]; then
  dt=$1
fi

hive<<EOF
create table if not exists ods.tmp_01_r15012_xjm(
    os_type string,
    event_identifier string,
    event_meaning string,
    event_id string,
    create_time string,
    ...
    version string
) comment '埋点数据事件映射表'
partitioned by(dt string) 
row format delimited fields terminated by '\001';

insert overwrite table ods.tmp_01_r15012_xjm partition(dt='$dt') 
$core_select_sql where dt='$dt';
EOF
```

## shell运算符

基本语法：
1. `$((运算式))`或`$[运算式]`
2. expr `+,-,\*,/,%` 分别表示加，减，乘，除，取余，注意`expr运算符间要有空格`

示例：
``` bash
# 计算2*3
$ expr 2 \* 3
$ echo $[2*3]
$ echo $((2*3))

# 计算(2+3)*4
$ expr `expr 2 + 3` \* 4
$ echo $[(2+3)*4]
$ echo $(((2+3)*4))
```

## 条件判断

基本语法：
[ condition ]
`注意condition前后要有空格`；
条件非空即为true，[ keyllo ]返回true，[]返回false。

常用判断条件：

* 两个整数之间比较：-lt 小于，-le 小于等于，-eq 等于，-gt 大于，-ge 大于等于，-ne 不等于，`注意比较符两端有空格`；
* 字符串比较：== 字符串相等，!= 字符串不相等，`注意比较符两端有空格`；
* 对文件权限进行判断：-r 有读的权限、-w 有写的权限、-x 有执行的权限；
* 对文件类型进行判断：-f 文件存在并且是一个常规的文件、-e 文件存在、-d 文件存在并是一个目录；

示例：
``` bash
# 2是否大于等于1
$ [ 2 -ge 1 ]
$ echo $?
0

# 判断两个字符串是否相等
$ [ "aaa" == "aaa" ]
$ echo $?
0 

# helloworld.sh是否有写权限
$ [ -w helloworld.sh ]
$ echo $?
0

# 用户根目录下的hello.txt文件是否存在
$ [ -e ~/hello.txt ]
$ echo $?
1

# 多条件判断
# && 表示前一条命令执行成功时，才执行后一条命令
# || 表示上一条命令执行失败后，才执行下一条命令
$ [ condition ] && echo OK || echo notok
OK
$ [ condition ] && [ ] || echo notok
notok
```