title: 使用iptables实现端口转发

author: kinglyjn

tags:
  - iptables

categories:
  - ops
  - linux

date: 2021-12-30 19:44:37

---



SSH 也能实现本机的端口转发，只不过原来的 1 条连接会变成 3 条。而  iptables 的端口转发则是在内核进行（netstat是看不到的），效率相对更高。下面介绍其典型的几种端口转发形式。



## 将本地的端口转发到本机端口



### 设置端口转发



将本机的 7777 端口转发到 6666 端口（该设置方式在机器重启之后失效）：

```bash
root@host01$ iptables -t nat -A PREROUTING -p tcp --dport 7777 -j REDIRECT --to-port 6666
```

<br>



<!--more-->



在本机侦听 6666 端口：

```bash
root@host01$ nc -lk 6666
```

在 host02 上连接 host01 的 7777 端口，虽然host01的 7777 端口并未被侦听，但是被转发给了处于侦听状态的 6666 端口：

```bash
root@host02$ nc host01 7777
```

![image-20211230195521705](/images/image-20211230195521705.png)

在 host02 上查看连接信息（ping host01 得到其IP 192.168.56.104）：

![image-20211230200050977](/images/image-20211230200050977.png)

在  host01 上查看连接信息（ping host02 得到其IP 192.168.56.105）

![image-20211230200545749](/images/image-20211230200545749.png)

注意：在host02上看到的连接端口是7777，而在host01上看到的连接端口是6666。

<br>



### 查看端口转发

查看当前iptables 的 nat 表的所有规则：（不用 -t 指定表名默认的是指 filter 表）

```bash
iptables -t nat -nL --line
```

![image-20211230201950963](/images/image-20211230201950963.png)

<br>



### 删除指定表指定链上的规则

删除指定表的指定链上的规则， -D 并指定序号即可。

```bash
iptables -t nat -D PREROUTING 1
```

注：PREROUTING链修改的是从外部连接过来时的转发，如果本机连接到本机的转发【只能是在本机内部转发】，需要对 OUTPUT 链做操作。

```bash
iptables -t nat -A OUTPUT -p tcp --dport 7777 -j REDIRECT --to-port 6666
iptables -t nat -D OUTPUT 1
```

![image-20211230202119216](/images/image-20211230202119216.png)

<br>



## 将本机的端口转发到其他机器

### 设置端口转发

通过 host01【104】 的 6666 端口访问 host02【105】 的 7777 端口，在 host01 上设置：

```bash
# 这里只能通过 IP 进行设置，并且 net.ipv4.ip_forward=1 必须设置后才能生效
root@host01$ sysctl -w net.ipv4.ip_forward=1
root@host01$ iptables -t nat -A PREROUTING -p tcp --dport 6666 -j DNAT --to-destination 192.168.56.105:7777
root@host01$ iptables -t nat -A POSTROUTING -p tcp -d 192.168.56.105 --dport 7777 -j SNAT --to-source 192.168.56.104
```

![image-20211230205140224](/images/image-20211230205140224.png)

<br>

### 实验验证

![image-20211230204543294](/images/image-20211230204543294.png)

可以看到 host01【104】 收到的包被转发。因为转发发生在内核，在转发机上，使用 ss 看不到任何与 host02【105】 和 host03【106】 的连接。

![image-20211230204838955](/images/image-20211230204838955.png)

<br>

### 延伸实现SSH跳板机

从上面可以看出，我们只要把  host02【105】 的 7777端口改成22端口，就可以实现用 host01【104】做跳板机登录的目的。

![image-20211230210027478](/images/image-20211230210027478.png)

<br>



## 将一台公网 ip 主机的端口转发到另一台公网 ip 主机

我有两台AWS主机，一台位于伦敦，一台位于纽约。红色为对应主机的公网 ip，黑色为私网ip。 将伦敦主机的 8000 端口转发到纽约的 9000 端口。

![image-20211230211908055](/images/image-20211230211908055.png)

在伦敦主机上操作：

```bash
iptables -t nat -A PREROUTING -p tcp --dport 8000 -j DNAT --to-destination 128.113.255.255:9000
iptables -t nat -A POSTROUTING -p tcp -d 128.113.255.255 --dport 9000 -j SNAT --to-source 10.53.1.49
```

注意：这里关键的地方在于 **`SNAT 之后的 source 地址只能是内网地址，不能 London 主机的公网地址`**。

如果配成了伦敦主机的公网地址，则转发不会成功。

虽然通过公网 ip 连接主机，但实际上在主机上抓包显示，数据包的目的地址都是主机的私网地址。DNAT 修改了数据包的目的地址，SNAT修改了数据包的源地址，一旦源地址被修改为本机的公网地址，该数据包将会被丢弃。

<br>



