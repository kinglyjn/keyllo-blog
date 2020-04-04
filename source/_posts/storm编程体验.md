title: storm编程体验
author: kinglyjn
tags:
  - storm
categories:
  - dataops
  - ''
  - storm
date: 2018-12-17 17:29:00
---
## 需求

模拟实时统计通话记录中 主叫-被叫 的通话次数。

<!--more-->

## storm编程体验

<div style="float:left">
<img src="/images/pasted-23.png" alt="图一" style="width:60%">
</div>
<div style="clear:both"></div>


### 创建spout

IRichSpout接口的主要方法：

* open(mapconf,context,collector)：初始化方法
* nextTuple()：通过收集器输出数据并处理数据给下游组件
* close()：spout停止的时候调用的方法
* declareOutputFields()：声明tuple输出的schema
* ack(msgId)：确认一个特定的元组已被处理
* fail(msgId)：指定一个特定的元组没有被处理，并且不会被重复处理
	

`CallLogReaderSpout` implements IRichSpout

``` java
@Override
public void open(Map conf, TopologyContext context, SpoutOutputCollector collector) {
	this.context = context;
	this.collector = collector;
}

@Override
public void nextTuple() { //core：输出一条通话记录
	List<String> mobiles = new ArrayList<String>();
	mobiles.add("num1");
	mobiles.add("num2");
	mobiles.add("num3");
	
	if (this.i<100) {
		// 主叫
		String from = mobiles.get(rnadomGenerator.nextInt(mobiles.size()));
		// 被叫
		String to = mobiles.get(rnadomGenerator.nextInt(mobiles.size()));
		while (from.equals(to)) {
			to = mobiles.get(rnadomGenerator.nextInt(mobiles.size()));
		}
		// 通话时长
		int duration = rnadomGenerator.nextInt(60);
		// 输出一条听话记录到下游处理组件
		this.collector.emit(new Values(from, to, duration), from+to+System.currentTimeMillis());
		this.i++;
	}
}

@Override
public void declareOutputFields(OutputFieldsDeclarer declarer) {
	declarer.declare(new Fields("from", "to", "duration"));
}

@Override
public void ack(Object msgId) {
	NCUtil.write2NC(this, "ack: " + msgId.toString());
}
@Override
public void fail(Object msgId) {
	NCUtil.write2NC(this, "fail: " + msgId.toString());
}
```

### 创建bolt

IRichBolt接口的主要方法：

* prepare(mapconf,context,collector)：初始化方法
* execute(tuple)：接收上游数据并处理数据给下游组件
* cleanup()：bolt停止的时候调用的方法
* declareOutputFields(declarer)：声明tuple输出的schema
* getComponentConfiguration()：组件有关参数的声明方法


`CallLogCreatorBolt` implements IRichBolt

``` java
@Override
public void prepare(Map stormConf, TopologyContext context, OutputCollector collector) {
	this.collector = collector;
}

@Override
public void execute(Tuple input) {
	String from = input.getString(0);
	String to = input.getString(1);
	Integer duration = input.getInteger(2);
	collector.emit(input, new Values(from+"-"+to, duration)); //锚定tuple到tuple树，以供ack和fail处理
	collector.ack(input); //消费成功确认
}

@Override
public void declareOutputFields(OutputFieldsDeclarer declarer) {
	declarer.declare(new Fields("call", "duration"));
}
```

`CallLogCounterBolt` implements IRichBolt

``` java
@Override
public void prepare(Map stormConf, TopologyContext context, OutputCollector collector) {
	this.collector = collector;
	this.counterMap = new HashMap<String,Integer>();
}

@Override
public void execute(Tuple input) {
	String call = input.getString(0);
	Integer count = 1;
	if (counterMap.containsKey(call)) {
		count = counterMap.get(call) + 1;
	}
	counterMap.put(call, count);
	collector.ack(input); //消费成功确认，每个bolt都需要确认
}

@Override
public void cleanup() {
	counterMap.forEach((k,v) -> {
		System.err.println(k + ": " + v);
		NCUtil.write2NC(this, k + ": " + v);
	});
}
```

### 编写App

`App`

``` java
public static void main(String[] args) throws Exception {
	Config config = new Config();
	config.setDebug(false);
	//config.setNumWorkers(1);
	//config.setNumAckers(1);
	//config.setMessageTimeoutSecs(30); //消息的默认超时时间为30s
	//Map<String, String> envMap = new HashMap<String,String>();
	//envMap.put("storm.zookeeper.servers", "host01");
	//config.setEnvironment(envMap);
	
	TopologyBuilder builder = new TopologyBuilder();
	builder.setSpout("call_log_reader_spout", new CallLogReaderSpout(), 1);
	builder.setBolt("call_log_creator_bolt", new CallLogCreatorBolt(), 1).shuffleGrouping("call_log_reader_spout");
	builder.setBolt("call_log_counter_bold", new CallLogCounterBolt(), 1).fieldsGrouping("call_log_creator_bolt", new Fields("call"));
	
	if (args.length > 0) {
		StormSubmitter.submitTopology(args[0], config, builder.createTopology());
	} else {
		LocalCluster localCluster = new LocalCluster();
		localCluster.submitTopology("call_log_analysis_topo", config, builder.createTopology());
		Thread.sleep(5*1000);
		localCluster.shutdown();
	}
}
```

### 本地运行的结果

``` java
/*
运行结果：
num3-num2: 12
num2-num1: 14
num2-num3: 19
num3-num1: 21
num1-num3: 17
num1-num2: 17

[2018-12-17 16:22:05.970    16177@kinglyjn.local    SLOT_1027-89    CallLogCounterBolt-1545398013] num3-num2: 17
[2018-12-17 16:22:05.979    16177@kinglyjn.local    SLOT_1027-89    CallLogCounterBolt-1545398013] num2-num1: 16
[2018-12-17 16:22:05.983    16177@kinglyjn.local    SLOT_1027-89    CallLogCounterBolt-1545398013] num2-num3: 23
[2018-12-17 16:22:05.987    16177@kinglyjn.local    SLOT_1027-89    CallLogCounterBolt-1545398013] num3-num1: 16
[2018-12-17 16:22:05.991    16177@kinglyjn.local    SLOT_1027-89    CallLogCounterBolt-1545398013] num1-num3: 16
[2018-12-17 16:22:05.994    16177@kinglyjn.local    SLOT_1027-89    CallLogCounterBolt-1545398013] num1-num2: 12
*/
```

### 打包到集群运行

``` bash
# 开发机
$ mvn clean package -Dmaven.test.skip=true

# storm集群节点
$ strom jar zdemo-storm-0.0.1-SNAPSHOT.jar test01.App call_log_analysis_topo
```

Storm应用拓扑结构图：

![图一](/images/pasted-22.png)