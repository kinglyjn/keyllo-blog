title: mysql的安装
author: kinglyjn
tags:
  - mysql
categories:
  - database
  - mysql
date: 2019-01-03 19:54:00
---
## MySQL安装（以CentOS7为例）

### 准备工作

<!--more-->

``` bash
# CentOS7默认不启动网卡的（ONBOOT=no)，开启网卡
$ vi /etc/sysconfig/network-scripts/ifcfg-xxx
$ service network restart 
$ ip addr

# CentOS7查看和关闭防火墙
$ firewall-cmd --state
$ systemctl stop firewalld.service
$ systemctl disable firewalld.service  #禁止开机启动

# 关闭selinux
$ vi /etc/selinux/config
SELINUX=enforcing ==> SELINUX=disabled    

# CentOS7配置阿里云yum源 
$ mv /etc/yum.repos.d/CentOs-Base.repo /etc/yum.repos.d/CentOs-Base.repo.bak
$ curl -o http://mirrors.aliyun.com/repo/Centos-7.repo
$ mv /etc/yum.repos.d/Centos-7.repo /etc/yum.repos.d/CentOs-Base.repo
$ yum clean all
$ yum makecache
$ yum update

# Centos7和RHEL7最小安装中没有常用的ifconfig和netstat，安装
# 寻找程式所属套件
$ yum provides ifconfig
$ yum whatprovides ifconfig
# 安装ifconfig
$ yum install net-tools
# 安装traceroute
$ yum install traceroute
# 这样装完就有ifconfig、netstat和route以及traceroute和traceroute6了
# 其实ifconfig在7版中全部有新指令代替，所以可能要学习新的方法
ifconfig          ==>  ip addr, ip [-s] link
ifconfig eth1 up  ==>  ip l set eth1 up
netstat           ==>  ss [-ltu]
traceroute        ==>  tracepath 192.168.1.1

# 安装常用工具
$ yum install lrzsz
$ yum install wget
$ yum install tree 

# yum常用命令
yum install packagename    #安装指定包
yum update packagename     #更新指定包
yum check-update           #检查可更新的安装包
yum upgrade packagename    #升级指定包

yum search string            #根据关键词查找包
yum remove/erase packagename #卸载程序包
yum deplist package1         #查看程序package1依赖情况

yum clean packages       #清除缓存目录下的软件包
yum clean headers        #清除缓存目录下的 headers
yum clean oldheaders     #清除缓存目录下旧的 headers

### rpm常用命令
rpm -qa |grep -i xxx     #查看xxx是否被安装
rpm -qi                  #查看安装包的信息
rpm -ql                  #列出被安装包的信息 
rpm -ivh xxx             #安装一个包
rpm -Uvh                 #升级一个安装包
rpm -e xxx               #移除一个包
   
### 查看mysql用户及其用户组
id mysql 
cat /etc/passwd|grep mysql
cat /etc/group|grep mysql
```

### MySQL的安装

``` bash
# 下载安装包
wget MySQL-server-5.6.41-1.el7.x86_64.rpm
wget MySQL-client-5.6.41-1.el7.x86_64.rpm

# 安装MySQL包，此时centos自定为我们生成了mysql:mysql用户，使用cat /etc/pass 和 cat /etc/group 进行查看
rpm -ivh MySQL-server-5.6.41-1.el7.x86_64.rpm
rpm -ivh MySQL-client-5.6.41-1.el7.x86_64.rpm

# 服务的启动和停止
service mysql start|stop

# 修改mysql登录密码，mysql安装之后提示
# A RANDOM PASSWORD HAS BEEN SET FOR THE MySQL root USER !
# You will find that password in '/root/.mysql_secret'. 
# 查看/root/.mysql_secret可以看到初始登录密码，然后登录mysql
$ mysql -u root -p xxx
# 然后必须修改密码，否则无法继续操作
$ set password=password('xxx')

# 设置mysql开机自启动
$ chkconfig mysql on
$ chkconfig --list
  mysql           0:off   1:off   2:on    3:on    4:on    5:on    6:off
  netconsole      0:off   1:off   2:off   3:off   4:off   5:off   6:off
  network         0:off   1:off   2:on    3:on    4:on    5:on    6:off 
$ cat /etc/inittab
```

### MySQL客户端的登录

``` bash
mysql -u root -p
mysql  -h192.168.1.160 -u root -p
mysql  -h192.168.1.160 -P3306 -u root -p
```

### MySQL安装位置和数据文件

``` bash
# mysql中的四大目录
/var/lib/mysql/     数据库文件的存放位置     /var/lib/mysql/xxx.cloud.pid
/usr/share/mysql    配置文件目录            mysql.server命令及配置文件
/usr/bin            相关命令目录            mysqladmin mysqldump等命令
/etc/init.d/mysql   启停相关脚本

# 查看mysql进程
[root@host-rdbms mysql]# ps -ef |grep mysql
root      1787     1  0 Dec12 ?        00:00:00 /bin/sh /usr/bin/mysqld_safe --datadir=/var/lib/mysql --pid-file=/var/lib/mysql/host-rdbms.pid
mysql     1944  1787  0 Dec12 ?        00:00:04 /usr/sbin/mysqld --basedir=/usr --datadir=/var/lib/mysql --plugin-dir=/usr/lib64/mysql/plugin --user=mysql --log-error=host-rdbms.err --pid-file=/var/lib/mysql/host-rdbms.pid
root      2481  1477  0 01:06 pts/0    00:00:00 grep --color=auto mysql

# mysql的数据文件（默认路径为 /var/lib/mysql）
# 对于MyISAM引擎（ALTER TABLE xxx engine=MyISAM character set utf8）
tablexxx.frm    存放表结构
tablexxx.MYD    存放表数据
tablexxx.MYI    存放索引
# 对于InnoDB引擎（ALTER TABLE xxx engine=InnoDB）
tablexxx.frm    存放表结构
tablexxx.ibd    存放表数据
```

### 修改MySQL配置文件

``` bash
# mysql配置文件
# 将mysql默认配置文件cp到/etc/my.cnf
$ cp /usr/share/mysql/my-default.cnf /etc/my.cnf

# 修改mysql默认字符集编码[latin1] ==> [utf-8]
$ vim /etc/my.cnf
    [client]
    port = 3306
    socket = /var/lib/mysql/mysql.sock
    default-character-set = utf8
    
    [mysqld]
    port = 3306
    character_set_server = utf8
    character_set_client = utf8
    collation-server = utf8_general_ci
    #mysql安装后默认表名区分大小写，列名不区分大小写（0表示区分大小写，1表示不区分大小写）
    lower_case_table_name = 1
    #设置最大连接数（默认为151，mysql服务器允许的最大连接数为16384）
    max_connections = 1000
    ...
    socket = /var/lib/mysql/mysql.sock
    skip-external-locking
    key_buffer_size = 384M
    max_allowed_packet = 1M
    table_open_cache = 512
    #数据排序时缓冲区的大小
    sort_buffer_size = 2M
    read_buffer_size = 2M
    read_rnd_buffer_size = 8M
    myisam_sort_buffer_size = 8
    query_cache_size = 32M
    #建议设置为 vCPU*2
    thread_concurrency = 8
    #主要用于主从复制
    log-bin = /var/lib/mysql/xxx  
    #默认是关闭的，主要用于记录严重的警告和错误信息，每次启动和关闭的详细信息等
    log-error = /var/lib/mysql/xxx  
    #默认关闭，记录查询的sql语句（慢查询日志），如果开启会减低mysql的整体性能，因为记录日志也是需要消耗系统资源的
    log = /var/lib/mysql/xxx
    
    [mysql]
    default-character-set = utf-8
    
# 修改前查看：
mysql> show variables like '%character%';
+--------------------------+----------------------------+
| Variable_name            | Value                      |
+--------------------------+----------------------------+
| character_set_client     | utf8                       |
| character_set_connection | utf8                       |
| character_set_database   | latin1                     |
| character_set_filesystem | binary                     |
| character_set_results    | utf8                       |
| character_set_server     | latin1                     |
| character_set_system     | utf8                       |
| character_sets_dir       | /usr/share/mysql/charsets/ |
+--------------------------+----------------------------+ 

# 修改后查看： 
mysql> show variables like '%character%';
+--------------------------+----------------------------+
| Variable_name            | Value                      |
+--------------------------+----------------------------+
| character_set_client     | utf8                       |
| character_set_connection | utf8                       |
| character_set_database   | utf8                       |
| character_set_filesystem | binary                     |
| character_set_results    | utf8                       |
| character_set_server     | utf8                       |
| character_set_system     | utf8                       |
| character_sets_dir       | /usr/share/mysql/charsets/ |
+--------------------------+----------------------------+
```

### 常见错误解决方案

``` bash
# 常见错误1：Can’t connect to MySQL server on ‘10.211.55.5’ (61)
# 第一步：查看3306端口是否开启
# 使用ufw，sudo ufw status或者直接使用命令 netstat -an | grep 3306，如果结果显示类似：
# tcp   0   0 127.0.0.1:3306   0.0.0.0:*     LISTEN
# 从结果可以看出3306端口只是在IP 127.0.0.1上监听，所以拒绝了其他IP的访问。
# 第二步：修改配置文件 /etc/my.cnf
# bind-address = 127.0.0.1
# 把上面这一行注释掉或者把127.0.0.1换成合适的IP，建议注释掉


# 常见错误2：is not allowed to connect to this MySQL server
> GRANT ALL PRIVILEGES ON *.* TO 'myuser'@'%' IDENTIFIED BY 'mypassword' WITH GRANT OPTION;
> GRANT ALL PRIVILEGES ON *.* TO 'root'@'192.168.1.3' IDENTIFIED BY 'mypassword' WITH GRANT OPTION;
> use mysql
> update user set host = '%' where user = 'root';
> select host, user from user;


# 常见错误3：cant connect to mysql server 10060
# 出现这种现象的原因有两个，一个是当前用户被MySQL服务器拒绝，另外一个原因是3306端口被被防火墙禁掉，无法连接到该端口。解决方法如下：
# 1.设置远程用户访问权限：
# 任何远程主机都可以访问数据库  
> GRANT ALL PRIVILEGES ON *.* TO 'root'@'%'WITH GRANT OPTION;     
> FLUSH PRIVILEGES;      
> EXIT
# 2.在iptables中开放3306端口
$ /sbin/iptables -I INPUT -p tcp --dport 3306 -j ACCEPT
$ /etc/rc.d/init.d/iptables save
$ service iptables restart
# 当然除了开放3306端口外，还有一个方法就是关闭防火墙，命令为：
# service iptables stop  
# 不过，不推荐这种做法，因为这会引起安全性问题。
```

