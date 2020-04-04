title: storm分组策略
author: kinglyjn
tags:
  - storm
categories:
  - dataops
  - ''
  - storm
date: 2018-12-17 20:14:00
---
### 内置分组策略

storm 内置了 8 种流分组的方式，通过实现 CustomStreamGrouping 接口可以实现自定义的流分组。InputDeclarer 接口定义了不同的流分组方式，每当TopologyBuilder#setBolt 方法被调用就返回该对象，用于声明一个bolt的输入流以及这些流应当如何分组。该接口定义的所有分组方法如下：

<!--more-->

1. 随机分组（`shuffleGrouping`）：最常用的分组方式，它随机地分发元组到 bolt 上的任务，这样能保证每个任务得到基本相同数量的元组。例如如果希望 bolt2 读取 spout 和 bolt1 两个组件发送的tuple，则可以定义 bolt2 如下：
``` java
topologyBuilder.setBolt("bolt2", new Bolt2(), 5)
   			.shuffleGrouping("spout")
   			.shuffleGrouping("bolt1");
```
2. 无分组（`noneGrouping`）：假定你不关心流是如何被分组的，则可以使用这种方式，目前这种分组和随机分组是一样的效果，有一点不同的是 storm 会把这个bolt放到其订阅者的同一个线程中执行。
3. 本地或随机分组（`localOrShuffleGrouping`）：如果目标 Bolt 中的一个或者多个 Task 和当前产生数据的 Task 在同一个Worker 进程里面，那么就走内部的线程间通信，将Tuple直接发给在当前 Worker 进程的目的 Task。否则，同 shuffleGrouping。localOrShuffleGrouping 的数据传输性能优于shuffleGrouping，因为在 Worker 内部传输，只需要通过Disruptor队列就可以完成，没有网络开销和序列化开销。因此在数据处理的复杂度不高， 而网络开销和序列化开销占主要地位的情况下，可以优先使用 localOrShuffleGrouping来代替 shuffleGrouping。
4. 字段分组（`fieldsGrouping`）：根据指定字段对流进行分组。例如，如果是按 userid 字段进行分组，具有相同 userid 的元组被分发到相同的任务，具有不同userid的元组可能被分发到不同的任务。字段分组是实现流连接和关联、以及大量其他用例的基础，在实现上，字段分组使用取模散列来实现。
5. 部分关键字分组（`partialKeyGrouping`）：这种方式与字段分组很相似，根据定义的字段来对数据流进行分组，不同的是，这种方式会考虑下游 Bolt 数据处理的均衡性问题，在输入数据源关键字不平衡时会有更好的性能。
6. 广播分组（`allGrouping`）：流被发送到所有 bolt 的任务中，使用这个分组方式要特别小心。
7. 全局分组（`globalGrouping`）：全部流被发送到 bolt 的同一个任务中（id最小的任务）。
8. 直接分组（`directGrouping`）：由元组的生产者组件决定元组消费者的组件，直接分组只能在已经声明为直接流（direct stream）的流中使用，声明方法为在 declareOutFields 方法中使用OutputFieldsDeclarer#declareStream 方法，并且元组必须使用emitDirect 方法来发射。Bolt 通过 TopologyContext 对象或者 OutputCollector 类的 emit 方法的返回值，可以得到其消费者的任务 id 列表（List&lt;Integer&gt;）。


### 直接分组示例

App中的定义：

``` java
TopologyBuilder builder = new TopologyBuilder();
builder.setSpout("call_log_reader_spout", new CallLogReaderSpout(), 1);
builder.setBolt("call_log_creator_bolt", new CallLogCreatorBolt(), 3).directGrouping("call_log_reader_spout");
```

CallLogReaderSpout：

``` java
private SpoutOutputCollector collector;
private List<Integer> callLogCreatorBoltIds;

@Override
public void open(Map conf, TopologyContext context, SpoutOutputCollector collector) {
	this.collector = collector;
	this.callLogCreatorBoltIds = context.getComponentTasks("call_log_creator_bolt");
	NCUtil.write2NC(this, this.callLogCreatorBoltIds.toString());
}

@Override
public void nextTuple() { //core：输出一条通话记录
	List<String> mobiles = new ArrayList<String>();
	mobiles.add("num1");
	mobiles.add("num2");
	mobiles.add("num3");
	
	if (i<5) {
		// 主叫 被叫 通话时长
		String from = mobiles.get(rnadomGenerator.nextInt(mobiles.size()));
		String to = mobiles.get(rnadomGenerator.nextInt(mobiles.size()));
		while (from.equals(to)) {
			to = mobiles.get(rnadomGenerator.nextInt(mobiles.size()));
		}
		int duration = rnadomGenerator.nextInt(60);
		// 输出一条听话记录到下游处理组件
		while (true) {
			Integer taskId = callLogCreatorBoltIds.get(new Random().nextInt(callLogCreatorBoltIds.size()));
			if (taskId%2 == 0) { // 直接发送给下游的偶数taskId组件
				this.collector.emitDirect(taskId, new Values(from, to, duration), from+"_"+to+"_"+System.currentTimeMillis());
				break;
			}
		}
		i++;
	}
}
```

CallLogCreatorBolt

``` java
@Override
public void execute(Tuple input) {
	NCUtil.write2NC(this, "execute: " + this.context.getThisTaskId());
	String from = input.getString(0);
	String to = input.getString(1);
	Integer duration = input.getInteger(2);
	collector.emit(input, new Values(from+"-"+to, duration)); //锚定
	collector.ack(input); //消费成功确认
}

/*
本地运行结果：
[2018-12-17 20:10:30.906    19261@kinglyjn.local    Thread-24-call_log_reader_spout-executor[6 6]-126    CallLogReaderSpout-1494616937] [3, 4, 5]
[2018-12-17 20:10:30.944    19261@kinglyjn.local    Thread-30-call_log_creator_bolt-executor[4 4]-132    CallLogCreatorBolt-248213827] execute: 4
[2018-12-17 20:10:30.951    19261@kinglyjn.local    Thread-30-call_log_creator_bolt-executor[4 4]-132    CallLogCreatorBolt-248213827] execute: 4
[2018-12-17 20:10:30.958    19261@kinglyjn.local    Thread-30-call_log_creator_bolt-executor[4 4]-132    CallLogCreatorBolt-248213827] execute: 4
[2018-12-17 20:10:30.963    19261@kinglyjn.local    Thread-30-call_log_creator_bolt-executor[4 4]-132    CallLogCreatorBolt-248213827] execute: 4
[2018-12-17 20:10:30.969    19261@kinglyjn.local    Thread-30-call_log_creator_bolt-executor[4 4]-132    CallLogCreatorBolt-248213827] execute: 4
[2018-12-17 20:10:33.136    19261@kinglyjn.local    SLOT_1027-89    CallLogCounterBolt-532851382] num2-num1: 1
[2018-12-17 20:10:33.140    19261@kinglyjn.local    SLOT_1027-89    CallLogCounterBolt-532851382] num3-num1: 3
[2018-12-17 20:10:33.144    19261@kinglyjn.local    SLOT_1027-89    CallLogCounterBolt-532851382] num2-num3: 1
*/
```

### 自定义分组策略

可以通过实现 CustomStreamGrouping 接口来创建自定义的流分组（customGrouping）。
使用示例：

``` java
topologyBuilder.setBolt("bolt2", new Bolt2(), 5).customGrouping("componentIdxxx", new MyGroupring());
```

MyGroupring

``` java
public class MyGrouping implements CustomStreamGrouping {
	private static final long serialVersionUID = 1L;

	/**
    * 主要做分组前的准备工作
    * @param context 是当前topology 在相应worker进程中的运行上下文
    * @param stream  当前topology对应的stream数据ID
    * @param targetTasks  待分组的下游该类组件实例的taskid列表
    */ 
	@Override
	public void prepare(WorkerTopologyContext context, GlobalStreamId stream, List<Integer> targetTasks) {
		// TODO
	}
    
    /**
    * 返回下游被分到的taskIds
    * @param taskId    当前taskID
    * @param values    就是tuple
    * @return          在哪一个task运行该数据
    */
	@Override
	public List<Integer> chooseTasks(int taskId, List<Object> values) {
		return null;
	}
}
```