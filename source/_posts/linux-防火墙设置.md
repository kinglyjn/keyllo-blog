title: linux 防火墙设置
author: kinglyjn
tags:
  - linux
categories:
  - os
  - linux
date: 2018-09-25 17:37:00
---
## 概述

防火墙是整个数据包进入主机前的第一道关卡。防火墙主要通过Netfilter与TCPwrappers两个机制来管理的。

* Netfilter：数据包过滤机制 
* TCP Wrappers：程序管理机制 

<!--more-->

关于数据包过滤机制有两个软件，即`firewalld`与`iptables`。关于两者的不同介绍如下：

1. 动态防火墙后台程序firewalld提供了一个动态管理的防火墙，用以支持网络“zones”,区分配对一个网络及其相关链接和界面一定程度的信任。它具备对ipv4和ipv6防火墙设置的支持。它支持以太桥接，并有分离运行时间和永久性配置选择，具备一个通向服务或者应用程序以直接增加防火墙规则的接口；
2. 系统提供了图像化的配置工具firewall-config(rhel7), 提供命令行客户端firewall-cmd, 用于配置 firewalld永久性或非永久性运行时间的改变:
它依次用iptables工具与执行数据包筛选的内核中的Netfilter通信；
3.firewalld和iptables service之间`最本质`的不同是:iptables service在 /etc/sysconfig/iptables 中储存配置，而firewalld将配置储存在
/usr/lib/firewalld/ 和 /etc/firewalld/ 中的各种XML文件里；
4. 使用 iptables service每一个单独更改意味着清除所有旧有的规则和从 /etc/sysconfig/iptables 里读取所有新的规则，然而使用firewalld却不会再创建任何新的规则，仅仅运行规则中的不同之处。因此,firewalld可以在运行时间内,改变设置而不丢失现行连接。 
5. iptables通过控制端口来控制服务，而firewalld则是通过控制协议来控制端口；


## firewalld

### 安装和启动firewalld

``` bash
# 安装、启动、设置开机启动
$ yum -y install firewalld
$ systemctl start firewalld
$ systemctl enable firewalld

# 安装firewalld图形化管理工具
yum -y install firewalld-config

# 查看火墙状态
$ systemctl status firewalld
$ firewall-cmd --state 
```

注意： 
systemctl是CentOS7的服务管理工具中主要的工具，它融合之前service和chkconfig的功能于一体，下面是一些常用命令：

* 启动一个服务：systemctl start firewalld.service
* 关闭一个服务：systemctl stop firewalld.service
* 重启一个服务：systemctl restart firewalld.service
* 显示一个服务的状态：systemctl status firewalld.service
* 在开机时启用一个服务：systemctl enable firewalld.service
* 在开机时禁用一个服务：systemctl disable firewalld.service
* 查看服务是否开机启动：systemctl is-enabled firewalld.service
* 查看已启动的服务列表：systemctl list-unit-files|grep enabled
* 查看启动失败的服务列表：systemctl --failed

### 查看开机启动

其实启用和禁用服务就是在当前“runlevel”的配置文件目录（/etc/systemd/system/multi-user.target.wants/）里，开启服务就是建立/usr/lib/systemd/system里面对应服务配置文件的软链接；禁用服务就是删除此软链接。有兴趣就自己看看 /usr/lib/systemd/system 里的文件，语法跟旧版/etc/init.d/ 里的服务脚本完全不同，也不能再用 /etc/init.d/sshd restart 之类的指令启动服务器了。先试试旧方法启某个服务：
``` bash
$ service sshd start
Redirecting to /bin/systemctl start  sshd.service
```
使用新的方法开启和查看firewalld服务：
``` bash
# 允许开机启动
# chkconfig iptables [on|off]
$ systemctl enable firewalld
Created symlink from /etc/systemd/system/dbus-org.fedoraproject.FirewallD1.service to /usr/lib/systemd/system/firewalld.service.
Created symlink from /etc/systemd/system/multi-user.target.wants/firewalld.service to /usr/lib/systemd/system/firewalld.service.

# 查看开机启动
# 注意这里不使用传统的 chkconfig iptables --list 命令
$ systemctl list-unit-files |grep firewalld
firewalld.service   enabled 
```

### 关闭和禁用firewalld

``` bash
$ systemctl stop firewalld
$ systemctl disable firewalld
$ firewall-cmd --state 
```

### firewalld网络区域(zone)

基于用户对网络中设备和交通所给与的信任程度,防火墙可以用来将网络分割成不同的区域，public为firewalld的默认区域。

* trusted(信任) 可接受所有的网络连接
* home(家庭) 用于家庭网络，仅接受ssh,mdns,ipp-client,samba-client,或dhcpv6-client服务连接
* internal（内部） 用于内部网络，仅接受ssh,mdns,ipp-client,ipp-client,samba-client,dhcpv6-client服务连接
* work（工作） 用于工作区，仅接受ssh或dhcpb6-client服务连接
* public（工作） 在公共区域内使用，仅接受ssh或dhcpv6-client服务连接，为firewalld的默认区域
* external(外部) 出去的ipv4网络连接通过此区域伪装和转发，仅接受ssh服务连接
* dmz(非军事区) 仅接受ssh服务连接
* block(限制) 拒绝所有网络连接
* drop(丢弃) 任何接受的网络数据包都被丢弃，没有任何回复

### firewall使用命令行接口配置防火墙

查看：

``` bash
# 查看活跃区域
$ firewall-cmd --get-active-zones
public
  interfaces: enp0s3 enp0s8

# 查看默认区域
$ firewall-cmd --get-default-zone
public

# 查看所有区域
$ firewall-cmd --get-zones      
block dmz drop external home internal public trusted work

# 查看默认区域的接口（interfaces），源（sources），服务（services）端口（ports）伪装开关（masquerade）（转发接口）forward-ports
$ firewall-cmd --list-all   
public (active)
  target: default
  icmp-block-inversion: no
  interfaces: enp0s3 enp0s8
  sources: 
  services: ssh dhcpv6-client
  ports: 
  protocols: 
  masquerade: no
  forward-ports: 
  source-ports: 
  icmp-blocks: 
  rich rules: 

# 查看防火墙所有服务
$ firewall-cmd --get-services
RH-Satellite-6 amanda-client amanda-k5-client bacula bacula-client bitcoin bitcoin-rpc bitcoin-testnet bitcoin-testnet-rpc ceph ceph-mon cfengine condor-collector ctdb dhcp dhcpv6 dhcpv6-client dns docker-registry dropbox-lansync elasticsearch freeipa-ldap freeipa-ldaps freeipa-replication freeipa-trust ftp ganglia-client ganglia-master high-availability http https imap imaps ipp ipp-client ipsec iscsi-target kadmin kerberos kibana klogin kpasswd kshell ldap ldaps libvirt libvirt-tls managesieve mdns mosh mountd ms-wbt mssql mysql nfs nfs3 nrpe ntp openvpn ovirt-imageio ovirt-storageconsole ovirt-vmconsole pmcd pmproxy pmwebapi pmwebapis pop3 pop3s postgresql privoxy proxy-dhcp ptp pulseaudio puppetmaster quassel radius rpc-bind rsh rsyncd samba samba-client sane sip sips smtp smtp-submission smtps snmp snmptrap spideroak-lansync squid ssh synergy syslog syslog-tls telnet tftp tftp-client tinc tor-socks transmission-client vdsm vnc-server wbem-https xmpp-bosh xmpp-client xmpp-local xmpp-server
```

设置：
``` bash
# 更改默认区域
$ firewall-cmd --set-default-zone=trusted
success


# 更改服务相关配置，服务的配置文件都是.xml结尾
$ cd /usr/lib/firewalld/services
$ ls 
amanda-client.xml dropbox-lansync.xml kadmin.xml nfs.xml puppetmaster.xml squid.xml
...
# 可以看出，服务的配置文件都是以服务本身命名的


# 将来源IP172.25.254.250设置为trusted
$ firewall-cmd --add-source=172.25.254.250 --zone=trusted
$ firewall-cmd --list-all --zone=trusted
trusted (active)
  target: ACCEPT
  icmp-block-inversion: no
  interfaces: 
  sources: 172.25.254.250
  services: 
  ports: 
  protocols: 
  masquerade: no
  forward-ports: 
  source-ports: 
  icmp-blocks: 
  rich rules: 

# 删除trusted区域中IP为172.25.254.250的来源
$ firewall-cmd --remove-source=172.25.254.250 --zone=trusted
success

# 将eth0添加到trusted中，注意得先将eth0从public中删除
$ firewall-cmd --remove-interface=eth0 --zone=public
$ firewall-cmd --add-interface=eth0 --zone=trusted
$ firewall-cmd --get-active-zones
ROL
  sources: 172.25.0.252/32
trusted
  interfaces: eth0
```

实验:
``` bash
# 0. 现在初始情况是：eth0与eth1处在public域中，现在假设eth0为外网开放接口，eth1为内网开放接口。

# 1. 现在将eth1加入trusted中，内部网络可以访问
$ firewall-cmd --add-interface=eth1 --zone=trusted
success
$ firewall-cmd --get-active-zones
ROL
  sources: 172.25.0.252/32
public
  interfaces: eth0
trusted
  interfaces: eth1
$ firewall-cmd --list-all --zone=trusted
trusted (active)
  interfaces: eth1
  sources: 
  services: http
  ports:
  masquerade: no
  forward-ports: 
  icmp-blocks:
  rich rules:

# 2. 然后在trusted中加入http服务
$ firewall-cmd --add-service=http --zone=trusted
success

# 3. publlic域默认为ssh连接与dhcpv6-client所以eth0并不具有连网功能 (演示，略)
# 4. 将来源ip为172.25.254.79的所有包拒绝，注意设置需要加载才能生效 (演示：略)
# 注意reload和complete-reload的区别是若此时179主机通过ssh连接上了服务端，若用complete reload则会中断现有连接，若使用reload则不会中断现有连接。
$ firewall-cmd --add-source=172.25.254.79 --zone=block
$ firewall-cmd --reload 或 firewall-cmd --complete-reload 
```

### firewalld 的 direct-rules

``` bash
# 列出规则
$ firewall-cmd –-direct –get-all-rules

# 添加规则：不让79主机访问80端口的请求响应
$ firewall-cmd –-direct –add-rule ipv4 filter INPUT 0 ! -s 172.25.254.79 -p tcp –dport 80 -j ACCEPT

# 删除规则
$ firewall-cmd –-direct –remove-rule ipv4 filter INPUT 0 ! -s 172.25.254.79 -p tcp –dport 80 -j ACCEPT
```

### firewalld 常用命令

``` bash
# 查看所有打开的端口： firewall-cmd --zone=public --list-ports
# 更新防火墙规则： firewall-cmd --reload
# 查看区域信息:  firewall-cmd --get-active-zones
# 查看指定接口所属区域： firewall-cmd --get-zone-of-interface=eth0
# 拒绝所有包：firewall-cmd --panic-on
# 取消拒绝状态： firewall-cmd --panic-off
# 查看是否拒绝： firewall-cmd --query-panic
 
# 添加 --permanent永久生效，没有此参数重启后失效
$ firewall-cmd --zone=public --add-port=80/tcp --permanent & firewall-cmd --reload
# 查看
$ firewall-cmd --zone=public --query-port=80/tcp
# 删除
$ firewall-cmd --zone=public --remove-port=80/tcp --permanent
```

## iptables

### iptables是什么？

iptables是隔离主机以及网络的工具，通过自己设定的规则以及处理动作对数据报文进行检测以及处理。 
防火墙的发展史就是从墙到链再到表的过程，也即是从简单到复杂的过程。为什么规则越来越多，因为互联网越来越不安全了，所有防火墙的的规则也越来越复杂。防火的工具变化为：ipfirewall(墙) --> ipchains（链条）--> iptables（表）。



### iptables的安装

首先得保持一个纯净的环境，将firewalld关闭，安装iptables。

``` bash
$ ststemctl stop firewalld.service
$ ststemctl disable irewalld.service

$ yum search iptables
$ yum install iptables-services.x86_64
$ ststemctl restart iptables.service
```

### iptables实现防火墙功能的原理

当主机收到一个数据包后，数据包先在内核空间中处理，若发现目的地址是自身，则传到用户空间中交给对应的应用程序处理，若发现目的不是自身，则会将包丢弃或进行转发。在数据包经过内核的过程中有五处关键地方，分别是`PREROUTING、INPUT、OUTPUT、FORWARD、POSTROUTING，称为钩子函数`，iptables这款用户空间的软件可以在这5处地方写规则，对经过的数据包进行处理，规则一般的定义为“`如果数据包头符合这样的条件，就这样处理数据包`”。

iptables有`四表五链`。`表决定了数据报文处理的方式，而链则决定了数据报文的流经哪些位置`。

四表为：

1. filter表（实现包过滤）
2. nat表（实现网络地址转换，修改数据包的源|目标IP地址或端口）
3. mangle表（为数据包设置标记）
4. raw表（实现数据包跟踪）

这些表具有一定的优先级：`filter>nat>mangle>raw`。

五链为：

* PREROUTING
* INPUT
* OUTPUT
* FORWARD
* POSTROUTING

下面是数据包的流向图：
![图1](/images/pasted-11.png)

1. 若目的地址是本地，则发送到INPUT，让INPUT决定是否接收下来送到用户空间，流程为：①--->②;
2. 若满足PREROUTING的nat表上的转发规则，则发送给FORWARD，然后再经过POSTROUTING发送出去，流程为：①--->③--->④--->⑥；
3. 主机发送数据包时，流程则是 ⑤--->⑥；

### iptables的书写规则

制作防火墙规则通常有两种基本策略。一是黑名单策略；二是白名单策略。`黑名单`策略指没有被拒绝的流量都可以通过，这种策略下管理员必须针对每一种新出现的攻击，制定新的规则，因此不推荐。`白名单`策略指没有被允许的流量都要拒绝，这种策略比较保守，根据需要，逐渐开放，目前一般都采用白名单策略，推荐。

制定iptables表规则思路：

1. 选择一张表(此表决定了数据报文处理的方式）
2. 选择一条链(此链决定了数据报文的流经哪些位置)
3. 选择合适的条件(此条件决定了对数据报文做何种条件匹配)
4. 选择处理数据报文的动作，制定相应的防火墙规则。

基本语法结构：
``` bash
$ iptables [-t 表名] 管理选项 [链名] [条件匹配] [-j 目标动作或跳转]

# 管理选项-链管理：
-N, --new-chain chain：新建一个自定义的规则链；
-X, --delete-chain [chain]：删除用户自定义的引用计数为0的空链；
-F, --flush [chain]：清空指定的规则链上的规则；
-E, --rename-chain old-chain new-chain：重命名链；
-Z, --zero [chain [rulenum]]：置零计数器；
  注意：每个规则都有两个计数器
  packets：被本规则所匹配到的所有报文的个数；
  bytes：被本规则所匹配到的所有报文的大小之和；
-P, --policy chain target 制定链表的策略(ACCEPT|DROP|REJECT)

# 管理选项-规则管理
-A, --append chain rule-specification：追加新规则于指定链的尾部； 
-I, --insert chain [rulenum] rule-specification：插入新规则于指定链的指定位置，默认为首部；
-R, --replace chain rulenum rule-specification：替换指定的规则为新的规则；
-D, --delete chain rulenum：根据规则编号删除规则；
-D, --delete chain rule-specification：根据规则本身删除规则；

# 管理选项-规则显示
-L, --list [chain]：列出规则；
-v, --verbose：详细信息； 
-vv 更详细的信息
-n, --numeric：数字格式显示主机地址和端口号；
-x, --exact：显示计数器的精确值，而非圆整后的数据；
--line-numbers：列出规则时，显示其在链上的相应的编号；
-S, --list-rules [chain]：显示指定链的所有规则；
```
![图2](/images/pasted-12.png)

### iptables书写规则中条件匹配

条件匹配分为基本匹配和扩展匹配，扩展匹配又分为显示匹配和隐式匹配。
基本匹配的特点是：无需加载扩展模块，匹配规则生效；
扩展匹配的特点是：需要加载扩展模块，匹配规则方可生效。
隐式匹配的特点：使用-p选项指明协议时，无需再同时使用-m选项指明扩展模块以及不需要手动加载扩展模块；  
显示匹配的特点：必须使用-m选项指明要调用的扩展模块的扩展机制以及需要手动加载扩展模块。

基本匹配的使用选项及功能：
* -p 指定规则协议，tcp udp icmp all
* -s 指定数据包的源地址，ip hostname
* -d 指定目的地址
* -i 输入接口
* -o 输出接口                                              
* ! 取反

隐式匹配的使用选项及功能：
``` bash
-p tcp
  --sport 匹配报文源端口；可以给出多个端口，但只能是连续的端口范围 
  --dport 匹配报文目标端口；可以给出多个端口，但只能是连续的端口范围
  --tcp-flags mask comp 匹配报文中的tcp协议的标志位
-p udp
  --sport 匹配报文源端口；可以给出多个端口，但只能是连续的端口范围
  --dport 匹配报文目标端口；可以给出多个端口，但只能是连续的端口范围
--icmp-type
  0/0： echo reply 允许其他主机ping
  8/0：echo request 允许ping其他主机
```

显式匹配的使用选项及功能：
``` bash
# 1.multiport(多个端口)
# 例如开放多个端口
$ iptables -I INPUT -d 172.16.100.7 -p tcp -m multiport --dports 22,80 -j ACCEPT
$ iptables -I OUTPUT -s 172.16.100.7 -p tcp -m multiport --sports 22,80 -j ACCEPT

# 2.iprange（ip范围）
# 例如以连续地址块的方式来指明多IP地址匹配条件
$ iptables -A INPUT -d 172.16.100.7 -p tcp --dport 23 -m iprange --src-range 172.16.100.1-172.16.100.100 -j ACCEPT
$ iptables -A OUTPUT -s 172.16.100.7 -p tcp --sport 23 -m iprange --dst-range 172.16.100.1-172.16.100.100 -j ACCEPT

# 3.time（时间范围）
# 指定时间范围
$ iptables -A INPUT -d 172.16.100.7 -p tcp --dport 901 -m time --weekdays Mon,Tus,Wed,Thu,Fri --timestart 08:00:00 --time-stop 18:00:00 -j ACCEPT
$ iptables -A OUTPUT -s 172.16.100.7 -p tcp --sport 901 -j ACCEPT

# 4.string(字符串)
# 对报文中的应用层数据做字符串模式匹配检测(通过算法实现)
--algo {bm|kmp}：字符匹配查找时使用算法
--string "STRING":　要查找的字符串
--hex-string “HEX-STRING”: 要查找的字符，先编码成16进制格式

# 5.connlimit(连接限制)
# 根据每个客户端IP作并发连接数量限制
--connlimit-upto n  连接数小于等于n时匹配
--connlimit-above n 连接数大于n时匹配

# 6.limit(速率限制)
# 报文速率控制

# 7.state（状态）
# 追踪本机上的请求和响应之间的数据报文的状态。状态有五种，分别是：
# INVALID 无法识别的连接
# ESTABLISHED 已经建立的连接
# NEW 新连接请求
# RELATED 相关联的连接，当前连接是一个新请求，但附属于一个已经存在的连接
# UNTRACKED 未追踪的连接
1、对于进入的状态为ESTABLISHED都应该放行；
2、对于出去的状态为ESTABLISHED都应该放行；
3、严格检查进入的状态为NEW的连接；
4、所有状态为INVALIED都应该拒绝； 
```

### iptables书写规则中的处理动作

处理动作有内置的处理动作和自定义的处理动作。自定义的处理动作用的比较少，因此只介绍内置的处理动作。
* ACCEPT:允许数据包通过
* DROP:直接丢弃数据包，不给出任何回应信息
* REJECT:拒绝数据包通过，必要时会给数据发送端一个响应信息
* LOG:在日志文件中记录日志信息，然后将数据包传递给下一条规则
* QUEUE: 防火墙将数据包移交到用户空间
* RETURN:防火墙停止执行当前链中的后续Rules，并返回到调用链 
* REDIRECT:端口重定向  
* MARK：做防火墙标记
* DNAT：目标地址转换
* SNAT：源地址转换                                           
* MASQUERADE:地址伪装

### iptables保存和载入规则

CentOS6和CentOS7保存和载入的规则稍有差异。

CentOS 7：
``` bash
# 保存
$ iptables-save > /PATH/TO/SOME_RULE_FILE   
# 重载
# -n, --noflush：不清除原有规则    
# -t, --test：仅分析生成规则集，但不提交
$ iptabls-restore < /PATH/FROM/SOME_RULE_FILE    
```

CentOS 6：
``` bash
# 保存规则于/etc/sysconfig/iptables文件，覆盖保存
$ service iptables save   
# 默认重载/etc/sysconfig/iptables文件中的规则 
# 配置文件：/etc/sysconfig/iptables-config 
$ service iptables restart
```

### 如何配置iptables

``` bash
# 1. 删除现有规则
iptables -F
# 2. 配置默认链策略
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP
# 3. 允许远程主机进行SSH连接
iptables -A INPUT -i eth0 -p tcp –dport 22 -m state –state NEW,ESTABLISHED -j ACCEPT
iptables -A OUTPUT -o eth0 -p tcp –sport 22 -m state –state ESTABLISHED -j ACCEPT
# 4. 允许本地主机进行SSH连接
iptables -A OUTPUT -o eth0 -p tcp –dport 22 -m state –state NEW,ESTABLISHED -j ACCEPT
iptables -A INPUT -i eth0 -p tcp –sport 22 -m state –state ESTABLISHED -j ACCEPT
# 5. 允许HTTP请求
iptables -A INPUT -i eth0 -p tcp –dport 80 -m state –state NEW,ESTABLISHED -j ACCEPT
iptables -A OUTPUT -o eth0 -p tcp –sport 80 -m state –state ESTABLISHED -j ACCEPT
```

### iptables的实践应用

#### iptables常用规则

1) 放行sshd服务
``` bash
$ iptables -t filter -A INPUT -s 192.168.0.0/24 -d 192.168.0.1 -p tcp --dport 22 -j ACCEPT
$ iptables -t filter -A OUTPUT -s 192.168.0.1  -p tcp --sport 22 -j ACCEPT
```

2) 放行httpd/nginx服务
``` bash
$ iptables -I OUTPUT -s 192.168.0.1 -p tcp --sport 80 -j ACCEPT
$ iptables -I INPUT -d 192.168.0.1 -p tcp --dport 80 -j ACCEPT
```

3) 放行本机端的流入流出
``` bash
$ iptables -A  INPUT  -s 127.0.0.1 -d 127.0.0.1 -i lo -j ACCEPT
$ iptables -A  OUTPUT  -s 127.0.0.1 -d 127.0.0.1 -o lo -j ACCEPT
#不放行本机的流入与流出，访问本机的httpd服务，网页会出现Error establishing a database connection。
```

4) 限制ping 192.168.0.1主机的数据包数，平均2/s个，最多不能超过3个
``` bash
$ iptables -A INPUT -i ens33 -d 192.168.0.1 -p icmp --icmp-type 8 -m limit --limit 2/second --limit-burst 3 -j ACCEPT
```

#### iptables初始化脚本

``` bash
#!/bin/bash
  
echo &quot;Setting firewall . . . . start&quot;
  
#--------RULESET INIT----------#
iptables -F
iptables -X
iptables -P INPUT DROP
iptables -P OUTPUT ACCEPT
iptables -P FORWARD ACCEPT
iptables -A INPUT -s 127.0.0.1 -d 127.0.0.1 -j ACCEPT
#------------------------------#
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT -i eth0 -p tcp ! --syn -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A FORWARD -m state --state ESTABLISHED,RELATED -j ACCEPT
#------------------------------#
#zabbix
iptables -A INPUT -p tcp --destination-port 10050 -j ACCEPT
iptables -A INPUT -p udp --destination-port 10051 -j ACCEPT
iptables -A OUTPUT -p tcp --destination-port 10050 -j ACCEPT
iptables -A OUTPUT -p udp --destination-port 10051 -j ACCEPT
#for web
iptables -A INPUT -p tcp --destination-port 21 -j ACCEPT
iptables -A INPUT -p tcp --destination-port 80 -j ACCEPT
iptables -A OUTPUT -p tcp --destination-port 80 -j ACCEPT
iptables -A OUTPUT -p tcp --destination-port 21 -j ACCEPT
#for mysql
iptables -A INPUT -p tcp --destination-port 3306 -j ACCEPT
iptables -A OUTPUT -p tcp --destination-port 3306 -j ACCEPT
#for mail
iptables -A INPUT -p tcp --destination-port 25 -j ACCEPT
iptables -A OUTPUT -p tcp --destination-port 25 -j ACCEPT
iptables -A OUTPUT -p tcp --destination-port 110 -j ACCEPT
#for ssh
iptables -A INPUT -p tcp -s any/0 --destination-port 22 -j ACCEPT
iptables -N icmp_allowed
iptables -A icmp_allowed -p ICMP --icmp-type 11 -j ACCEPT
iptables -A icmp_allowed -p ICMP --icmp-type 8 -j ACCEPT
iptables -A icmp_allowed -p ICMP -j DROP
iptables -A OUTPUT -p icmp -j ACCEPT
iptables -A INPUT -p icmp -j ACCEPT
iptables -A FORWARD -p tcp --tcp-flags SYN,ACK,FIN,RST RST -m limit --limit 1/s -j ACCEPT
iptables -A FORWARD -p icmp --icmp-type echo-request -m limit --limit 1/s -j ACCEPT
iptables -A FORWARD -p tcp --syn -m limit --limit 1/s -j ACCEPT
/etc/init.d/iptables save
```

## ubuntu防火墙ufw

一般来说， 我们会使用名气比较的大iptables等程序对这个防火墙的规则进行管理。iptables可以灵活的定义防火墙规则， 功能非常强大。但是由此产生的副作用便是配置过于复杂。一向以简单易用著称Ubuntu在它的发行版中，附带了一个相对iptables简单很多的防火墙配置工具：`ufw`。

### 安装

``` bash
# 安装
sudo apt-get install ufw 

# 一般用户，只需如下设置，已经足够安全了
# 如果你需要开放某些服务，再使用sudo ufw allow开启
# 关闭所有外部对本机的访问，但本机访问外部正常
sudo ufw enable 
sudo ufw default deny 
```

### 配置ufw防火墙

``` bash
# 开启/禁用服务
sudo ufw allow|deny [service] 

# 打开或关闭某个端口
sudo ufw allow smtp　      #允许所有的外部IP访问本机的25/tcp (smtp)端口 
sudo ufw allow 22/tcp      #允许所有的外部IP访问本机的22/tcp (ssh)端口 
sudo ufw allow 53          #允许外部访问53端口(tcp/udp) 
sudo ufw allow from 192.168.1.100 #允许此IP访问所有的本机端口 
sudo ufw allow proto udp 192.168.0.1 port 53 to 192.168.0.2 port 53 
sudo ufw deny smtp         #禁止外部访问smtp服务 
sudo ufw delete allow smtp #删除上面建立的某条规则 

# 查看防火墙状态
sudo ufw status 
```

### ufw使用示例

``` bash
#允许 53 端口
$ sudo ufw allow 53

#禁用 53 端口
$ sudo ufw delete allow 53

#允许 80 端口
$ sudo ufw allow 80/tcp

#禁用 80 端口
$ sudo ufw delete allow 80/tcp

#允许 smtp 端口
$ sudo ufw allow smtp

#删除 smtp 端口的许可
$ sudo ufw delete allow smtp

#允许某特定 IP
$ sudo ufw allow from 192.168.254.254

#删除上面的规则
$ sudo ufw delete allow from 192.168.254.254 
```