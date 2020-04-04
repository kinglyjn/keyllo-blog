title: linux 常用命令（一）
author: kinglyjn
tags:
  - linux
categories:
  - os
  - linux
date: 2018-09-26 21:12:00
---
### 开启网卡
   
CentOS7默认不启动网卡的（ONBOOT=no)，需要编辑ifcfg-xxx去开启。

``` bash
$ vi /etc/sysconfig/network-scripts/ifcfg-xxx
$ service network restart
$ ip addr
```

<!--more-->

注：用VMware安装完linux之后在本机网路连接中会出现两块虚拟出来的网卡 VMnet1 和 VMnet8；
虚拟机网络主要有三种不同的连接方式，分别是桥接、NAT、HostOnly；

* 桥接：利用本机真实的网卡进行通信，占用局域网的一个ip，相当于一台真实的机器与外界连接
* NAT：利用虚拟网卡VMnet8与真实机通信，不占用真实网段的ip地址，能与本机通信，也能连接互联网
* HostOnly：利用虚拟网卡VMnet1与真实机通信，不占用真实网段的ip地址，只能与本机进行通信

### 关闭和禁用防火墙（可选）

``` bash
### CentOS7查看和关闭防火墙
$ firewall-cmd --state
$ systemctl stop firewalld.service
$ systemctl disable firewalld.service 
```

### 更改hosts和hostname

``` bash
# 更改主机名
sudo vi /etc/hostname

# 更改hosts
sudo vi /etc/hosts   
```

### 增加开机启动执行的命令

``` bash
$ ll /etc/rc.local  
lrwxrwxrwx. 1 root root 13 Aug 20 10:23 /etc/rc.local -> rc.d/rc.local

$ sudo vi /etc/rc.local
编写开机执行脚本
```

### 软件升级和安装

``` bash
# rpm常用命令
rpm -qa |grep -i xxx     #查询已安装的所有包
rpm -qi
rpm -ql
rpm -ivh xxx             #安装软件包
rpm -e xxx               #卸载软件包

# yum常用命令
yum install packagename  #安装指定包
yum update packagename   #更新指定包
yum check-update         #检查可更新的安装包
yum upgrade packagename  #升级指定包

yum search string        #根据关键词查找包
yum remove/erase packagename #卸载程序包
yum deplist package1     #查看程序package1依赖情况
yum provides xxxxxx
yum whatprovides xxxxxx

yum clean packages       #清除缓存目录下的软件包
yum clean headers        #清除缓存目录下的 headers
yum clean oldheaders     #清除缓存目录下旧的 headers

# centOS7配置阿里云yum源 
# 备份系统原来的repo文件
$ mv /etc/yum.repos.d/CentOs-Base.repo /etc/yum.repos.d/CentOs-Base.repo.bak
# 下载阿里的yum源
$ curl -o http://mirrors.aliyun.com/repo/Centos-7.repo
# 替换系统原理的repo文件
$ mv /etc/yum.repos.d/Centos-7.repo /etc/yum.repos.d/CentOs-Base.repo
# 执行yum源更新命令
$ yum clean all
$ yum makecache
$ yum update
```

### 安装常见的软件

``` bash
yum install net-tools
yum install traceroute
yum install lrzsz
yum install wget
yum install tree 
yum install vim
yum install gcc make
```

### 关闭selinux

```
$ vi /etc/selinux/config
SELINUX=enforcing ==> SELINUX=disabled 

$ sudo reboot   
```

### 增加和删除用户

``` bash
#查看当前系统中有哪些人登录
who
#查看当前用户的用户
who am i
#查看当前用户的用户名称
whoami
#增加用户
adduser xxx
#给用户设置密码
passwd xxx
#删除用户
userdel xxx
#删除用户及其相关目录
userdel -r xxx
```

### 修改用户

``` bash
# 将名称为dan的用户重命名为susan
# 这只会更改用户名，而其他的东西，比如用户组，家目录，UID 等都保持不变
sudo usermod -l susan dan
# 注意你需要从要改名的帐号中登出并杀掉该用户的所有进程，要杀掉该用户的所有进程可以执行下面命令
sudo pkill -u dan
sudo pkill -9 -u dan
# 要更改家目录，我们需要在执行 usermod 命令的同时加上 -d 选项
sudo usermod -d /home/susan -m susan
# 更改用户UID
sudo usermod -u 2000 susan
# 更改用户的用户组
sudo usermod -g xxxgroup xxxuser
# 做完修改后，可以使用 id 命令来检查
id susan

# 增删改查用户组
groupadd xxx
groupdel xxx
groupmod -n newgroup oldgroup
cat /etc/passwd
```

### 修改文件或目录所有者、访问权限

``` bash
# 将目录 dirname 这个目录的所有者和组改为user1:group1
chown -R user1:group1 dirname

# 把目录 dirname 修改为可写可读可执行
chmod 777 dirname
```

### 给新加的用户root权限

给新加的用户root权限,并且使该用户（centos用户）sudo的时候不用输入密码：

``` bash
sudo visudo 或 sudo u+w /etc/sudoers & sudo vim /etc/sudoers
# 添加配置
centos  ALL=(ALL)       ALL
centos  ALL=(ALL)       NOPASSWD: ALL
```

### 给操作命令加入时间

``` bash
sudo vim /etc/profile
或者
sudo vim /etc/bash.bashrc
	HISTFILESIZE=2000
	HISTSIZE=2000
	HISTTIMEFORMAT="%Y%m%d-%H%M%S: "
	export HISTTIMEFORMAT
last -x
history
```

### 文件处理系常用命令

``` bash
# 查看：
ls [-ald] [文件或目录] 
    -a #显示所有文件，包括隐藏文件
	-l #详细信息显示
	-d #查看目录属性 只看目录而不看目录下的文件
	-h #通用选项，人性化显示
	-i #显示文件的index（i节点），文件的唯一标识
--------------------------------------------------------
查看结果：
类型权限  文件计数 |所有者u 所属组g 其他人o| 大小 修改时间 文件名
-rw-r--r--  1     root  root      17  Sep 18 09:18  abc
--------------------------------------------------------
-：普通文件  
d：目录
l：软链接文件

# 查找文件：
find / -name filename
find /etc -name '*filena*' 
find / -amin -10   #查找在系统中最后10分钟访问的文件 
find / -atime -2   #查找在系统中最后48小时访问的文件 
find / -empty      #查找在系统中为空的文件或者文件夹 
find / -group cat  #查找在系统中属于groupcat的文件 
find / -mmin -5    #查找在系统中最后5分钟里修改过的文件 
find / -mtime -1   #查找在系统中最后24小时里修改过的文件 
find / -nouser     #查找在系统中属于作废用户的文件 
find / -user fred  #查找在系统中属于fred这个用户的文件
find / -size [+10|-10|10] #查找系统中[大于|小于|等于]10个字节的文件

# 查找文件中的某个字符串：
grep "regex_str" filename

# 查找文件中的某个字符串（vim命令模式下）：
/str

# 替换文件中的某个字符串（vim命令模式下）：
:%s/src_str/target_str/gi  #全局查找替换，忽略大小写
:%s/src_str/target_str/g  #全局查找替换，大小写敏感

# 查看某个文本文件：
cat -n log.txt   #一次查看，显示行号
tail -f log.txt  #实时查看日志
head -3 log.txt  #查看文件前3行
more log.txt     #分页查看
less -MN log.txt #分页查看，显示行号

# 查看文件或文件夹大小
du -sh *
du -sh filename/dirname

# 查看磁盘挂载
df -h

# 创建目录：
mkdir [-p] [目录名]
       -p  #递归创建 

# 创建链接：
软链接：ln -s a.txt ln_a.txt
硬链接：ln a.txt ln_a.txt
1. ln命令会保持每一处链接文件的同步性，也就是说，不论你改动了哪一处，其它的文件都会发生相同的变化；
2. ln的链接又分软链接和硬链接两种，软链接就是ln -s ** **，它只会在你选定的位置上生成一个文件的镜像，不会占用磁盘空间，硬链接ln ** **，没有参数-s， 它会在你选定的位置上生成一个和源文件大小相同的文件，无论是软链接还是硬链接，文件都保持同步变化;
3. 如果你用ls察看一个目录时，发现有的文件右上角有一个箭头，那就是一个用ln命令生成的文件，用ls -l命令
去察看，就可以看到显示的link的路径了

# 复制文件或目录：
# 本机复制
cp [-rp] [原文件或者目录] [目标目录]
	-r  #复制目录
	-p  #保留文件属性
	-i  #提示有覆盖文件
	-b  #有覆盖文件同时保留原文件~和新文件
    
# 将本机文件或文件夹复制到远程主机
scp local_file remote_username@remote_ip:remote_folder
scp -r local_folder remote_username@remote_ip:remote_folder
# 将远程主机的文件或文件夹复制到本机
scp root@www.cumt.edu.cn:/home/root/others/music /home/space/music/1.mp3 
scp -r www.cumt.edu.cn:/home/root/others/ /home/space/music/
# 在本机将远程主机host02的文件或文件夹复制到host03上
scp -r hadoop@host02:~/hadoop-2.7.6 hadoop@host03:~/
	-v 用来显示进度.可以用来查看连接,认证,或是配置错误. 
	-C 使能压缩选项
	-P 选择端口.注意 -p 已经被 rcp 使用. 
	-4 强行使用IPV4地址. 
	-6 强行使用IPV6地址.

# 移动文件或目录（或重命名）：
mv [原文件目录] [目标文件目录] #注意文件的覆盖
mv -i [原文件目录] [目标文件目录] #提示有覆盖文件
mv -b [原文件目录] [目标文件目录] #有覆盖文件同时保留原文件~和新文件

# 删除文件或目录：
rm [-rf] [文件或者目录]
	-r  #删除文件目录
	-f  #强制执行 

# tar命令:
   解包：tar zxvf filename.tar
   打包：tar zcvf filename.tar dirname
 
# gz命令:
   解压1：gunzip FileName.gz
   解压2：gzip -d FileName.gz
   压缩：gzip FileName
　　
　　.tar.gz 和 .tgz
　　解压：tar zxvf FileName.tar.gz
　　压缩：tar zcvf FileName.tar.gz DirName
　
# bz2命令:
   解压1：bzip2 -d FileName.bz2
   解压2：bunzip2 FileName.bz2
   压缩： bzip2 -z FileName
   
   .tar.bz2
　　解压：tar jxvf FileName.tar.bz2
　　
# zip命令:
   解压：tar jxvf FileName.tar.bz
   压缩：zip FileName.zip DirName
```

### 配置linux以文本而非桌面的方式启动

``` bash
# 1. 修改 /etc/default/grub
     ...
     GRUB_CMDLINE_LINUX_DEFAULT="quiet" >>>>>  GRUB_CMDLINE_LINUX_DEFAULT="text"
     ...
    
# 2. 运行update-grub
$ sudo update-grub

# 3. 重启
$ sudo reboot

# 4. 如果在命令行文本模式下，可以直接启动桌面程序
$ startx
```

### 前后台程序的切换

``` bash
# 后台启动程序
$ java jar xxx.jar XxxClass &

# 将前台运行的程序放在后台执行
# 1.先暂停当前前台运行的程序
ctrl+z
# 2.使用bg命令将刚刚暂停的程序放在后台执行，bg后面加 进程作业号码，可以根据 jobs 命令查询
$ bg &1

# 将后台的程序切换到前台
$ fg &1
```

### crontable定时任务

在linux中自带的调度功能crontab，针对每个用户都可以调度自己的任务。

``` bash
# 开启定时任务进程
$ systemctl restart crond

# 示例：在centos这个用户下创建定时任务，这个定时任务的功能是，每隔一分钟将系统时间写入到指定的文件中
$ crontab -e
*/1 * * * * /bin/date >> /home/centos/bf-log.txt

# 列出所有的定时任务
$ crontab -l

# 删除所有的定时任务
$ crontab -r

# crontab时间表达式的一些实例
## 每天的21:30分执行
30 21 * * * cmd

## 每个月1，11，21号的2:30执行
30 2 1,11,21 * * cmd

## 每周六周日的1:45执行
45 1 * * 6,0 cmd

## 每天的20:00至23:00,每半个小时执行一次
0,30 20-23 * * * cmd

## 每隔一小时执行一次
* */1 * * * cmd
```

### 关机和重启

不管是关闭还是重启，首先要运行sync命令，把内存中的数据写入磁盘。

``` bash
# 先把内存中的数据写入磁盘
$ sync

# 关机（等价于 shutdown -h now 和 poweroff）
$ halt

# 重启（等价于 shutdown -r now）
$ reboot
```

### 日期显示和设置

``` bash
# 查看时间
$ date
  Tue Sep 25 14:40:12 EDT 2018
$ date +"%Y-%m-%d %H:%M:%S"  
  2018-09-26 08:05:19
$ hwclock  --show
  Fri 21 Sep 2018 11:54:18 AM EDT  -0.353888 seconds

# 设置时间
$ date -s "2017-06-30 11:11:11"

# 将当前时间和日期写入BIOS，避免重启后失效
$ hwclock -w

# 同步网络时间
$ yum -y install ntp ntpdate
$ ntpdate cn.pool.ntp.org
$ hwclock –systohc

# 日历
$ cal 2018
$ cal -3
$ cal -y
$ cal
```

### 磁盘分区、磁盘的查看、挂载、卸载

``` bash
# 查看分区
fdisk -l

# 查看硬盘及其挂载点
df -h

# 挂载磁盘到指定挂载点
# -t 指定挂载的磁盘类型，通常不必指定，mount会自动选择正确的类型
# 常用磁盘类型 iso9600、msdos、vfat、ntfs、smbfs、nfs
# -o 描述挂载方式
# 常用挂载方式 rw（读写）、ro（只读）、loop（把一个文件当成硬盘分区挂接上系统）、iocharset（指定访问文件系统所用的字符集）
$ mount [-t 磁盘类型] [-o 挂载方式] 要挂载的设备 挂载点
$ mount -t iso9600 -o rw /dev/cdrom /mnt/cdrom/

# 卸载某个挂载点上的磁盘
$ umount /mnt/cdrom/
```
