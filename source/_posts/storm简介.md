title: storm简介
author: kinglyjn
tags:
  - storm
categories:
  - dataops
  - ''
  - storm
date: 2018-12-14 15:44:00
---
### storm是什么？

* 免费、开源、分布式、高容错的实时计算系统；
* 支持每秒每个节点百万tuple的实时处理；
* supervisor `无状态`(状态都保存在ZK或者磁盘上)和`快速失败`(每当遇到任何意外情况进程自动毁灭)的，因此supervisor的失败不会影响当前正在运行的任务，只要及时将他们重新启动即可；

<!--more-->

### storm集群架构

![图1](/images/pasted-20.png)

* `nimbus`: storm集群的master节点（storm1.0之后支持HA），负责分发用户代码，指派给具体的supervisor#worker进程去运行具体对应的task，并收集task的执行情况；
* `supervisor`: storm集群的从节点，负责运行和监督其上的worker进程。通过storm.yaml的supervisor.slots.ports配置项可以指定在一个supervisor上最大允许多少个slot，每个slot通过端口号来唯一标识，一个端口号对应一个worker进程（如果该worker进程被启动）；
* `zookeeper`: 用来维护storm集群的状态。supervisor是无状态(所有的状态都保存在zk或者磁盘上)和快速失败(每当遇到任何意外情况进程自动毁灭)的，每当supervisor因故障出现问题而无法运行topology，nimbus会第一时间感知到，并重新分配topology到其它可用的supervisor上运行。zk集群节点的配置可以通过 storm.yaml的storm.zookeeper.servers参数进行配置。

下图表示的是storm的内部通信机制：

![图2](/images/pasted-21.png)

### storm核心概念

* tuple: 元组，有序的元素列表，通常是任意类型的数据，使用英文逗号分隔，代表storm处理的记录；
* stream: 代表tuple的无序序列；
* spout: 数据喷头（对接kafka等数据源）；
* bolt: 数据转接头（数据逻辑处理单元，统计、聚合、过滤、分组等操作后产生和发射新的数据给下游bolts）；
* topology: spouts和bolts为完成某项工作而组成的`有向无环图(DAG)`，顶点是计算单元，边是数据流。topology是不会停止的，除非手动杀死；
* streamGrouping: 数据流分组策略，控制tuple在topo中如何进行路由，storm 内置了 8 种流分组的方式，通过实现 CustomStreamGrouping 接口可以实现自定义的流分组。8种分组策略分别是 随机分组（shuffleGrouping）、无分组（noneGrouping）、本地或随机分组（localOrShuffleGrouping）、字段分组（fieldsGrouping）、部分关键字分组（partialKeyGrouping）、广播分组（allGrouping）、全局分组（globalGrouping）、直接分组（directGrouping），具体可参考 [https://github.com/kinglyjn/zdemo-storm](https://github.com/kinglyjn/zdemo-storm)；
* `task`: 一个组件(spout或bolt)实例就叫做一个task，由执行线程孵化产生。每个组件的任务数量可以通过Config.TOPOLOGY_TASKS设置，某个组件的任务数量可以通过topologyBuilder.setBolt("xxxBolt", new XxxBolt(), 3).setNumTasks(6).shuffleGrouping("xxxSpout")设置；
* `executor`: 执行器或执行线程，执行线程为相同的组件（spout、bolt）运行一个或多个任务（task），由worker进程孵化产生。可以通过Config.TOPOLOGY_MAX_TASK_PARALLELISM或config.setMaxTaskParallelism(3)设置，每个组件的执行器的初始数量可以通过 TopologyBuilder#setSpout 或 TopologyBuilder#setBolt 的 parallelism_hint 参数设置。一个组件的任务数量始终贯穿拓扑的整个生命周期，但一个组件的执行器（线程）数量可以随时间而改变，这意味着 #threads <= #tasks。默认情况下任务的数量被设定为相同的执行器数量，即 storm 会用一个线程 executor 执行一个 task 任务；
* `worker`: 工作进程，storm集群的一个节点上可能有一个或多个拓扑上，一个工作进程执行拓扑的一个子集。工作进程属于一个特定的拓扑，并可能为这个拓扑的一个或多个组件（spout、bolt）运行一个或多个执行器。一个运行中的拓扑包括多个运行在 storm 集群内多个节点的进程。拓扑的工作进程数可以通过 Config.TOPOLOGY_WORKERS 或  Config.setNumWorkers(3) 设置；
* `rebalancing`: storm的一个很好的特性是，可以增加或者减少工作进程数（worker）或 执行器（executor）的数量而不需要重新启动集群或拓扑，这个过程被称为 storm的再平衡。注意，如果storm进行了扩容而没有再平衡，则新的节点是idle的。在rebalance时，首先将会deacticate拓扑任务，然后重新分发work的任务使每个work中的任务尽量均衡，几秒或几分钟之后，topology将重新回到以前的激活状态。有两种方式实现拓扑再平衡，使用 storm ui 或者 使用 cli shell:
``` bash
# -n: 表示进程数（worker数）
# -e: 表示执行线程数（executor数）
$ storm rebanlance xxxTopology -n 5 -e xxxSpout=3 -e xxxBolt=10
```