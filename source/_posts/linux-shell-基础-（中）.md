title: linux shell 基础 （中）
author: kinglyjn
tags:
  - linux
categories:
  - os
  - linux
date: 2018-09-21 10:03:00
---
## 分支流程

### if语句

基本语法
``` bash
if [ 条件判断式 ];then
    程序指令
fi

或者

if [ 条件判断式 ]
then
    程序指令
fi
```

<!--more-->

注意：
1. [ 条件判断式 ]，中括号和条件判断式之间必须要有空格
2. if 后必须要有空格

示例1：
``` bash
#!/bin/bash
if [ $1 -eq 1 ];then
    echo "hehe"
elif [ $1 -eq 2 ];then
    echo "haha"
fi
```

示例2：
``` bash
#/bin/bash

# 判断某个查找的进程是否存在
count=`ps -ef | grep bigdata_admin.jar  | grep -v grep|wc -l`
if [ ${count} -lt 1 ]; then
  nohup java -jar  bigdata_admin.jar &
  echo "start success"
else
  echo "process is running"
fi
```

示例3：
``` bash
#!/bin/bash
startTime=$1
endTime=$2
hql="load data inpath '${inpath}' into table ${table_name}"

# 判断字符串是否为空或空串
if [ -n "$startTime" ]; then
    # 按规定格式格式化某个时间
    dt=$(date -d "$startTime" "+%Y%m%d")
else
    # 取前一天的时间
    dt=`date -d "1 days ago" +"%Y%m%d"`
else	
fi
hql="$hql partition(dt='$dt')"

hive<<EOF
$hql;
EOF
```

示例4：
```bash
#!/bin/bash

dt=$1
CUR_SHELL_DIR=$(cd `dirname $0`; pwd)
LOCAL_DATA_OPT_DIR=$(dirname $CUR_SHELL_DIR)/tmp;
SRC_DATA_FILE_NAME_PREFIX=xjm-behavior-$dt

files=$(ls $LOCAL_DATA_OPT_DIR)
for filename in $files
do
    if [[ $filename =~ xjm-behavior-$dt.*\.log ]];then
        SRC_DATA_FILE_NAME=$filename
        break
    fi
done

# 判断字符串是否相等
if [[ $SRC_DATA_FILE_NAME == "" ]];then
    echo "源数据文件名为空，异常退出！" 
    exit 1
fi
```

### case语句

基本语法
``` bash
case $变量名 in
值1)
    如果变量的值等于值1，则执行程序1
;;
值2)
    如果变量的值等于值2，则执行程序2
;;
*)
    如果变量的值都不是以上的值，则执行此程序
;;
esac
```
注意：
1. 双分号“;;”表示命令序列结束，相当于java中的break
2. 最后的“\*）”表示默认模式，相当于java中的default

示例：
``` bash
#!/bin/bash

case $1 in
1)
    echo "11111"
;;
2)
    echo "2222"
;;
*)
    echo "其他"
;;
esac

[root@host-test test]# bash hello.sh 1
11111
[root@host-test test]# bash hello.sh 2
2222
[root@host-test test]# bash hello.sh 3
其他
[root@host-test test]# bash hello.sh
其他
```

## 循环流程

### for循环

基本语法
``` bash
for((初始值;循环控制条件;变量变化))
do
    程序指令
done

或

for 变量 in 值1 值2 值3 ...
do
    程序指令
done
```

示例1：
``` bash
#!/bin/bash
sum=0
for(( i=0; i<=100; i++))
do
    sum=$[$sum+$i]
done
echo sum=$sum

[root@host-test test]# bash hello.sh
sum=5050
```

示例2：
``` bash
#!/bin/bash
for v in "$*"
do
    echo $v
done
echo "----------"
for v in "$@"
do
    echo $v
done

[root@host-test test]# bash hello.sh 1 2 3
1 2 3
----------
1
2
3
```
注意：
1. $\*和$@都表示传递给函数或脚本的所有参数，不被双引号“”包含时，都以$1 $2 …$n的形式输出所有参数；
2. 当它们被双引号“”包含时，“$\*”会将所有的参数作为一个整体（循环次数为1），以“$1 $2 …$n”的形式输出所有参数；“$@”会将各个参数分开，以“$1” “$2”…”$n”的形式输出所有参数；

示例3：
``` bash
#!/bin/bash

# 开始日期和结束日期，示例 20181120 20181122
startDate=$1
endDate=$2
# 当前脚本路径
CUR_SHELL_DIR=$(cd `dirname $0`; pwd)

startSec=`date -d "$startDate" "+%s"`
endSec=`date -d "$endDate" "+%s"`
for((i=$startSec;i<=$endSec;i+=86400))
do
    current_day=`date -d "@$i" "+%Y%m%d"`
    one_day_ago=`date -d "$current_day yesterday" +%Y%m%d`
    echo "current_day:${current_day}, yesterday:${one_day_ago}"
done
```

### while循环

基本语法
``` bash
while [ 条件判断式 ]
do
    程序指令
done

或

while read linexx
do
    echo $linexx
done < data.txt
```

示例1：
``` bash
#!/bin/bash
sum=0
i=0
while [ $i -le 100 ]
do
    sum=$[$sum+$i]
    i=$[$i+1]
done
echo sum=$sum

[root@host-test test]# bash hello.sh 
sum=5050
```

示例2：
``` bash
# 数据准备
$ echo -e "aaaa\nbbbb\ncccc\ndddd" > data.txt

# 循环遍历
while read line
do
    echo 打印1:$line
done < data.txt
cat data.txt | while read line
do
    echo 打印2:$line
done

[root@host-test test]# bash hello.sh 
打印1:aaaa
打印1:bbbb
打印1:cccc
打印1:dddd
打印2:aaaa
打印2:bbbb
打印2:cccc
打印2:dddd
```

示例3：
``` bash
#!/bin/bash
IPS="192.168.1.101
192.168.1.102
192.168.1.103"

echo "----while test----"
echo $IPS | while read line
do
    echo $line
done

echo "----for test----"
for v in $IPS
do
    echo $v
done

[root@host-test test]# bash hello.sh 
----while test----
192.168.1.101 192.168.1.102 192.168.1.103
----for test----
192.168.1.101
192.168.1.102
192.168.1.103
```
注意：
1. while read line 是一次性将文件信息读入并赋值给变量line，while中使用重定向机制,文件中的所有信息都被读入并重定向给了整个while语句中的line变量；
2. for是每次读取文件中一个以空格为分割符的字符串；

示例4：

``` bash
# 这里的例子以周为循环
!/bin/bash

begin_date="20160907"
end_date="20170226"

while [ "$begin_date" -le "$end_date" ];
do
    year=${begin_date:0:4}
    week_of_year=$(date -d "$begin_date" +%W)
    echo $year, $week_of_year
    begin_date=$(date -d "${begin_date}+7days" +%Y%m%d)
done
```


## read读取控制台输入

基本语法
``` bash
read 选项 参数名
```
选项：
* -p：prompt，表示读取值时的提示符
* -t：ttl，表示读取值时等待的时间（秒）

示例：提示10s内，读取控制台输入
``` bash
#!/bin/bash
read -t 7 -p "Enter youe name in 10s: " NAME
echo $NAME

[root@host-test test]# bash hello.sh 
Enter youe name in 10s: keyllo
keyllo
```

## 函数

### 系统函数示例

* basename [str/path] [suffix]：删掉所有的前缀包括最后一个（‘/’）字符，然后将字符串显示出来。如果suffix被指定了，basename会将str或path中的suffix去掉；
* dirname [absolute_path]：从给定的包含绝对路径的文件名中去除文件名（非目录的部分），然后返回剩下的路径（目录的部分）；

示例：
``` bash
[root@host-test test]# basename /root/test/data.txt 
data.txt
[root@host-test test]# basename ~/test/data.txt           
data.txt
[root@host-test test]# basename xx1/xx2/haha.txt
haha.txt

[root@host-test test]# dirname /root/test/data.txt 
/root/test
[root@host-test test]# dirname ~/test/data.txt
/root/test
[root@host-test test]# dirname xx1/xx2/haha.txt
xx1/xx2
```

### 自定义函数

基本语法
``` bash
[ function ] funcname[()]
{
    ACTIONS
    [return int;]
}
```
注意：
1. 必须在调用函数地方之前，先声明函数，shell脚本是逐行运行。不会像其它语言一样先编译；
2. 函数返回值，只能通过$?系统变量获得，可以显示加return返回，如果不加，将以最后一条命令运行结果，作为返回值。return后跟数值n(0-255)；

示例：
``` bash
#!/bin/bash
function sum()
{
    sum=$[$1+$2]
    echo $sum
}
sum 1 2

[root@host-test test]# bash hello.sh 
3
```