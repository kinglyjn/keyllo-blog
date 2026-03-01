title: SSH隧道详解

author: kinglyjn

tags:
  - security
  - ssh

categories:
  - ops
  - linux

date: 2021-12-30 10:42:58

---



## 场景一：本地端口转发实现跳板机



### 场景描述



想象一个业务场景，我的电脑想访问host03的9000端口，但是网络不通，但是我有host02的ssh登录权限，并且host02能够访问host03的9000端口，那么能不能通过host02作为跳板机直接让我的电脑访问host03:9000呢？

![image-20211230150950790](/images/image-20211230150950790.png)

其实这个就是ssh本地端口转发的典型应用，可以实现跳板机的功能，如上图所示。

<br>



<!--more-->



### 实验验证

准备3台主机，host02作为跳板机，最终想要实现 host01:8000 代理 host03:9000，通过访问 host01:8000 即可访问 host03:9000。

![image-20211230152543350](/images/image-20211230152543350.png)

在host03监听9000端口：

```bash
nc -lk 9000
```

在host01执行命令：

```bash
ssh -g -L 8000:host03:9000 root@host02
```

在我的电脑访问host01:8000：

```bash
nc host01 8000
```

![image-20211230153440332](/images/image-20211230153440332.png)

实验成功！

<br>



## 场景二：远程端口转发实现内网穿透



### 场景描述



我在自己的电脑开发了一个应用，想通过把它暴露在公网请远端的朋友帮忙查看和调试，能不能实现呢？场景如下：

![image-20211230170615402](/images/image-20211230170615402.png)

答案是肯定的。我们不仅可以把本机的普通端口暴露到公网，而且可以把ssh登录端口暴露，以实现外网登录内网的目的。

<br>



### 实验验证



#### 内网穿透到普通端口



1）在我的电脑启动挂件绑定到我电脑的8081端口（这里以web应用为例）

2）在我的电脑执行如下命令实现远程转发

```bash
ssh -g -R 8000:localhost:8081 user@pub-ip-server
```

![image-20211230173345517](/images/image-20211230173345517.png)

3）远程主机的安全组和防火墙放开8000端口允许外部访问

4）通过任意主机浏览器访问 pub-ip-sever:8000 进行验证

```bash
curl http://pub-ip:8000
```

实验成功！

<br>



#### 内网穿透暴露内网登录权限

1）我的电脑执行将登录权限暴露到公网

```bash
ssh -g -R 10022:localhost:22 user@pub-ip-server
```

2）外部任意主机通过登录 pub-ip-server 登录到我的电脑

```bash
ssh myuser@pub-ip-server -p 10022
```

实验成功！

<br>



## 场景三：本地 socks5 实现访问代理



### 场景描述



在 HostA 的本地 10080 端口启动一个 socks5 服务，通过本地 socks5 代理的数据会通过 ssh 链接先发送给 HostB，再从 HostB 转发送给远程主机。

```bash
HostA$ ssh -D localhost:10080  userb@HostB
```

或者更优化地：

```bash
HostA$ ssh -fN -D 0.0.0.0:10080 userb@HostB
```

其中：

* 选项 -D 类似于选项为 -L 和 -R 的静态端口转发。像那些一样，我们可以让客户端只监听本地请求或从其他节点到达的请求，具体取决于我们将请求关联到哪个地址：`-D [bind_address:] port`。
* 在静态端口转发中可以看到，我们使用选项 -R 进行反向端口转发，而动态转发是不可能的。我们只能在 SSH 客户端创建 SOCKS 服务器，而不能在 SSH 服务器端创建。
* 注意 `1080` 是 SOCKS 服务器的典型端口，正如 8080 是 Web 代理服务器的典型端口一样，不过这里我们用的端口是10080。
* 选项 -N 防止实际启动远程 [shell](https://www.linuxcool.com/) 交互式会话。当我们只用 ssh 来建立隧道时很有用。
* 选项 -f 会使 ssh 停留在后台并将其与当前 shell 分离，以便使该进程成为守护进程。如果没有选项 -N（或不指定[命令](https://www.linuxcool.com/)），则不起作用，否则交互式 shell 将与后台进程不兼容。
* 对于通过 SOCKS 服务器访问另一个网络的应用程序，如果应用程序提供了对 SOCKS 服务器的特别支持，就会非常方便（虽然不是必需的），就像浏览器支持使用代理服务器一样。作为一个例子，如 Firefox 或 Internet Explorer 这样的浏览器使用 SOCKS 服务器访问另一个网络的应用程序。

<br>



### 实验验证



![image-20211230183408791](/images/image-20211230183408791.png)

那么在 HostA 上面，浏览器配置 socks5 代理为 127.0.0.1:10080，看网页时就能把数据通过 HostB 代理出去，类似 ss/ssr 版本，只不过用 ssh 来实现。

实验前（chrome浏览器）：

<img src="/images/image-20211230183837717.png" alt="image-20211230183837717" style="zoom:50%;" />

实验后（chrome浏览器）：

<img src="/images/image-20211230183339937.png" alt="image-20211230183339937" style="zoom:50%;" />

<br>



## 使用优化



为了更好用一点，ssh 后面还可以加上：`-CqTnN` 参数，比如：

```bash
root@host01$ ssh -CqTnN -L 0.0.0.0:8000:host03:9000 root@host02
```

其中 `-C` 为压缩数据，`-q` 安静模式，`-T` 禁止远程分配终端，`-n` 关闭标准输入，`-N` 不执行远程命令。此外视需要还可以增加 `-f` 参数，把 ssh 放到后台运行，即最佳实践：

```bash
root@host01$ ssh -f -N -g -L 8000:host03:9000 root@host02
```

注意，ssh 代理没有短线重连功能，链接断了命令就退出了，所以需要些脚本监控重启，或者使用 `autossh` 之类的工具保持链接。

正向代理（-L）的第一种用法可以用 iptable 的 port-forwarding 模拟，iptable 性能更好，但是需要 root 权限，ssh -L 性能不好，但是正向代理花样更多些。反向代理（-R）一般就作为没有安装 frp/ngrok/shootback 时候的一种代替，但是数据传输的性能和稳定性当然 frp 这些专用软件更好。

socks5 代理（-D）其实是可以代替 ss/ssr 的，区别和上面类似。所以要长久使用，推荐安装对应软件，临时用一下 ssh 挺顺手。

