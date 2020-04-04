title: 制作本地yum源
author: kinglyjn
tags:
  - linux
categories:
  - os
  - linux
  - ''
date: 2018-09-27 15:13:00
---
## 为什么要制作本地YUM源

YUM 源虽然可以简化我们在 Linux 上安装软件的过程，但是生成环境通常无法上网，不能连接外网的 YUM 源，说以接就无法使用 yum 命令安装软件了。为了在内网中也可以 使用 yum 安装相关的软件，就要配置 yum 源。
YUM源其实就是一个保存了多个 RPM 包的服务器，可以通过 http 的方式来检索、下载并安装相关的 RPM 包。

<!--more-->

## 制作yum源步骤

a) 准备一台 Linux 服务器，版本如 CentOS-6.8-x86_64-bin-DVD1.iso
b) 将 CentOS-6.8-x86_64-bin-DVD1.iso 镜像挂载到/mnt/cdrom 目录

``` bash
$ mkdir /mnt/cdrom
$ mount -t iso9660 /dev/cdrom /mnt/cdrom
```
c) 修改本机上的 YUM 源配置文件，将源指向自己

``` bash
# 备份原有的 YUM 源的配置文件
$ cd /etc/yum.repos.d/
$ cp CentOS-Base.repo CentOS-Base.repo.bak

# 编辑 CentOS-Base.repo 文件
$ vi CentOS-Base.repo
[base]
name=CentOS-Local
baseurl=file:///var/iso
gpgcheck=1
enabled=1 #增加改行，使能 
gpgkey=file:///etc/pki/rpm-gpg/RPM-GPG-KEY-CentOS-6
```

d) 清除yum缓冲，列出可用的yum源

``` bash
$ yum clean all
$ yum repolist
```

e) 安装httpd
``` bash
$ yum install -y httpd
$ service httpd start 或者
$ systemctl start httpd

# 如果访问不通，检查防火墙 是否开启了 80 端口或关闭防火墙
$ curl http://192.168.11.101:80
```

f) 将 YUM 源配置到 httpd(Apache Server)中，其他的服务器即可通过网络访问这个内网中的 YUM 源了

``` bash
$ cp -r /mnt/cdrom/ /var/www/html/CentOS
$ umount /mnt/cdrom

# 检查
$ curl http://192.168.11.101/CentOS/
```

## 使用新制作的yum源

a) 让其他需要安装 RPM 包的服务器指向这个 YUM 源，准备一台新的服务器，备份或删除原有的 YUM 源配置文件。

``` bash
# 备份原有的 YUM 源的配置文件
$ cd /etc/yum.repos.d/
$ cp CentOS-Base.repo CentOS-Base.repo.bak

# 编辑 CentOS-Base.repo 文件
$ vi CentOS-Base.repo
[base]
name=CentOS-hadoop101 baseurl=http://192.168.11.101/CentOS
gpgcheck=1 
gpgkey=file:///etc/pki/rpm-gpg/RPM-GPG-KEY-CentOS-6
```

b) 在这台新的服务器上执行 YUM 的命令

``` bash
$ yum clean all
$ yum repolist
```

## 国内常用yum源

网易：http://mirrors.163.com/.help/CentOS7-Base-163.repo
阿里：http://mirrors.aliyun.com/repo/Centos-7.repo

## 注：ubuntu源的更新

``` bash
# 首先备份源列表
$ sudo cp /etc/apt/sources.list /etc/apt/sources.list_backup

# 然后编辑sources.list文件
$ sudo vi /etc/apt/sources.list

# 选择合适的源，替换掉文件中所有的内容，保存编辑好的文件: 然后刷新列表，注意一定要执行刷新
$ sudo apt-get update
```

ubuntu14.04国内常用源列表：
``` bash
# 网易
deb http://mirrors.163.com/ubuntu/ trusty main restricted universe multiverse 
deb http://mirrors.163.com/ubuntu/ trusty-security main restricted universe multiverse 
deb http://mirrors.163.com/ubuntu/ trusty-updates main restricted universe multiverse 
deb http://mirrors.163.com/ubuntu/ trusty-proposed main restricted universe multiverse 
deb http://mirrors.163.com/ubuntu/ trusty-backports main restricted universe multiverse 
deb-src http://mirrors.163.com/ubuntu/ trusty main restricted universe multiverse 
deb-src http://mirrors.163.com/ubuntu/ trusty-security main restricted universe multiverse 
deb-src http://mirrors.163.com/ubuntu/ trusty-updates main restricted universe multiverse 
deb-src http://mirrors.163.com/ubuntu/ trusty-proposed main restricted universe multiverse 
deb-src http://mirrors.163.com/ubuntu/ trusty-backports main restricted universe multiverse

# 阿里
deb http://mirrors.aliyun.com/ubuntu/ trusty main restricted universe multiverse 
deb http://mirrors.aliyun.com/ubuntu/ trusty-security main restricted universe multiverse 
deb http://mirrors.aliyun.com/ubuntu/ trusty-updates main restricted universe multiverse 
deb http://mirrors.aliyun.com/ubuntu/ trusty-proposed main restricted universe multiverse 
deb http://mirrors.aliyun.com/ubuntu/ trusty-backports main restricted universe multiverse 
deb-src http://mirrors.aliyun.com/ubuntu/ trusty main restricted universe multiverse 
deb-src http://mirrors.aliyun.com/ubuntu/ trusty-security main restricted universe multiverse 
deb-src http://mirrors.aliyun.com/ubuntu/ trusty-updates main restricted universe multiverse 
deb-src http://mirrors.aliyun.com/ubuntu/ trusty-proposed main restricted universe multiverse 
deb-src http://mirrors.aliyun.com/ubuntu/ trusty-backports main restricted universe multiverse
```