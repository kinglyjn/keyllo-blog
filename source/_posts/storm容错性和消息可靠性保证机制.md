title: storm容错性和消息可靠性保证机制
author: kinglyjn
tags:
  - storm
categories:
  - dataops
  - ''
  - storm
date: 2018-12-19 17:25:00
---
## storm的容错性机制

### Worker进程死亡

当一个工作进程死亡，supervisor会尝试重启它，如果启动连续失败了一定的次数，无法发送心跳信息到 nimbus，则nimbus会在另一台主机上重新分配 Worker。<br><br>

<!--more-->

### Supervisor节点死亡

当一个Supervisor节点死亡，分配给该节点主机的任务会暂停，nimbus 会把这些任务重新分配给其他的节点主机。<br><br>

### Nimbus或Supervisor守护进程死亡

Nimbus 或 Supervisor 守护进程被设计成快速失败的（每当遇到任何意外的情况，进程自动毁灭）和 无状态的（所有状态信息都保存在zk或者磁盘上）。Nimbus 或 Supervisor 守护进程应该使用 daemontools 或 monit 工具监控运行。所以如果Nimbus 或 Supervisor 守护进程死亡，它们的重启就像什么事没有发生一样正常工作。Nimbus 或 Supervisor 守护进程死亡并不会影响 Worker 进程的工作。<br><br>

### Nimbus单点故障

如果失去了Nimbus节点，Worker也会继续执行，如果 Worker 死亡，supervisor也会重启他们。但是如果没有nimbus，Worker不会在必要时安排到其他主机。所以在“某种程度上”nimbus是单点故障，但在实践中这不是什么大问题，因为nimbus守护进程死亡，不会发生灾难性的问题，并且storm1.x版本以后，nimbus 实现了高可用（HA），可以通过 nimbus.seeds 设置多个 nimbus 节点。<br><br>

### Spout任务挂了

在这种情况下，Spout任务通信的来源负责重放消息。例如，当客户端断开连接时，Kestrel和RabbitMQ等消息队列会将所有等待的消息放回队列中。如你所见，Storm的可靠性机制是完全分布式、可伸缩的、容错的。<br><br>

### Bolt任务挂了导致元组没有被ack

在这种情况下，在树根的失败元组的spout元组id会超时并被重新发送。<br><br>

### Acker任务挂了

在这种情况下，所有的Spout元组跟踪的Acker会超时并被重发。<br><br>


## storm的消息可靠性保障机制

### 发射消息

spout 和 bolt 分别使用 SpoutOutputCollector 和 OutputCollector 发射消息（emit），并且 SpoutOutputCollector 和 OutputCollector 是线程安全的，可以作为组件的成员变量进行保存。anchering和发射一个新的元组在同一时间完成，一个输出元组可以被锚定到多个输入元组，称为复合锚定，一个复合锚定元组未能被处理将导致来自 spout 的多个元组重发。spout 发射消息到 bolt，同时 storm 负责跟踪创建的消息树，如果 storm 检测到一个元组是完全处理的，则 storm 将调用原 spout的 ack方法，把spout提供给storm的消息 id 作为输入参数传入，进行消息的成功处理。反之，调用 spout#fail。<br><br>

### 消息被完全处理的含义

如同“蝴蝶效应”一样，一个来自 spout 的元组可以引发基于它所创建的数以千计的元组。消息被完全处理的含义是tuple树创建完毕，并且树中的每一个消息都已被处理。当一个元组的消息树在指定的超时范围内不能被完全处理，则元组被认为是失败的。超时的时间默认是 30s，对于一个特定的拓扑，可以使用 Config.TOPOLOGY_MESSAGE_TIMEOUT_SECS 来修改。<br><br>

### Acker任务

一个 storm 拓扑有一组特殊的 acker 任务，对于每一个 spout 元组，跟踪元组的有向无环图。可以在拓扑配置中使用 Config.TOPOLOGY_ACKERS 为一个拓扑设置 acker的任务数量，storm 默认 TOPOLOGY_ACKERS 是1个，对于拓扑处理大量的信息，需要增加这个数字。<br><br>

### ACK机制的整个过程

当一个tuple在拓扑中被创建出来的时候，不管是在Spout中还是在Bolt中创建的，这个 tuple都会被配置一个随机的64位id。acker就是使用这些id来跟踪每个spout tuple的 tuple DAG。这里贴一下storm源码分析里一个ack机制的例子。

``` bash
     
               T2
               2
       |￣￣￣￣￣￣￣￣￣￣bolt2
       |                  |
       |                  | 5
       |                  |
       |        8         |/
     spout <------------>  acker bolt
       |        3          |\         |\
       |                   |            \
       |                   | 6           \ 7
       |                   |              \ 
       |                   |               \
       |__________________bolt1______________bolt3
               1                    4
               T1                T3 T4 T5 
```

理解下整个大体节奏分为几部分:

1. 步骤1和步骤2中spout把一条信息同时发送给了bolt1和bolt2。
2. 步骤3表示spout emit成功后去acker bolt里注册本次根消息，ack值设定为本次发送的消息对应的64位id的异或运算值，上图对应的是T1^T2。
3. 步骤4表示bolt1收到T1后，单条tuple被拆成了三条消息T3、T4、T5发送给bolt3。
4. 步骤6表示bolt1在ack()方法调用时会向acker bolt提交T1^T3^T4^T5的ack值。
5. 步骤5和7的bolt都没有产生新消息，所以ack()的时候分别向acker bolt提交了T2 和T3^T4^T5的ack值。
6. 综上所述，本次spout产生的tuple树对应的ack值经过的运算为 T1^T2^T1^T3^T4^T5^T2^T3^T4^T5按照异或运算的规则，ack值最终正好归零。
7. 步骤8为acker bolt发现根spout最终对应的的ack是0以后认为所有衍生出来的数据都已经处理成功，它会通知对应的spout，spout会调用相应的ack方法。
 
storm这个机制的实现方式保证了无论一个tuple树有多少个节点，一个根消息对应的追踪ack值所占用的空间大小是固定的，极大地节约了内存空间。<br><br>


### 不重要消息处理如何去除ACK机制以提升性能？

如果可靠性不是那么重要，那么不跟踪tuple树可以节省一半的消息，减少带宽占用。

有三种方法可以删除可靠性保证，如下：

* 第一种是设置 Config.TOPOLOGY_ACKERS 为 0，在这种情况下，storm 会在 spout 发射一个元组之后立即调用 spout#ack 方法，元组树不会被跟踪；
* 第二种是通过消息基础删除消息的可靠性，可以在  SpoutOutputCollector#emit 方法中忽略x消息的 id，关掉对于个别 spout 元组的跟踪；
* 第三种做法，如果你不关心拓扑的下游元组的特定子集是否无法处理，可以作为非固定元组（不锚定）发射它们，因为它们没有锚定到任何 spout 元组，所以如果它们没有 acked，不会造成任何 spout 元组失败。