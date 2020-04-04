title: Alibaba DataX 源码编译和功能初探
author: kinglyjn
tags:
  - datax
categories:
  - dataops
  - ''
  - ETL
date: 2018-11-23 16:44:00
---
## DataX简介

### 设计理念

为了解决异构数据源同步问题，DataX将复杂的网状的同步链路变成了星型数据链路，DataX作为中间传输载体负责连接各种数据源。当需要接入一个新的数据源的时候，只需要将此数据源对接到DataX，便能跟已有的数据源做到无缝数据同步。

<!--more-->

![图1](/images/pasted-24.png)

### 当前使用现状

DataX在阿里巴巴集团内被广泛使用，承担了所有大数据的离线同步业务，并已持续稳定运行了6年之久。目前每天完成同步8w多道作业，每日传输数据量超过300TB。此前已经开源DataX1.0版本，此次介绍为阿里巴巴开源全新版本DataX3.0，有了更多更强大的功能和更好的使用体验。

源码及文档: [https://github.com/alibaba/DataX](https://github.com/alibaba/DataX)

### DataX3.0框架设计

![图2](/images/pasted-25.png)

DataX本身作为离线数据同步框架，采用Framework + plugin架构构建。将数据源读取和写入抽象成为Reader/Writer插件，纳入到整个同步框架中。

* Reader：Reader为数据采集模块，负责采集数据源的数据，将数据发送给Framework。
* Writer： Writer为数据写入模块，负责不断从Framework取数据，并将数据写入到目的端。
* Framework：Framework用于连接reader和writer，作为两者的数据传输通道，并处理缓冲，流控，并发，数据转换等核心技术问题。

### DataX3.0核心架构

DataX 3.0 开源版本支持单机多线程模式完成同步作业运行，本小节按一个DataX作业生命周期的时序图，从整体架构设计非常简要说明DataX各个模块相互关系。

![图3](/images/pasted-26.png)

核心模块介绍：

1. DataX完成单个数据同步的作业，我们称之为Job，DataX接受到一个Job之后，将启动一个进程来完成整个作业同步过程。DataX Job模块是单个作业的中枢管理节点，承担了数据清理、子任务切分(将单一作业计算转化为多个子Task)、TaskGroup管理等功能。
2. DataXJob启动后，会根据不同的源端切分策略，将Job切分成多个小的Task(子任务)，以便于并发执行。Task便是DataX作业的最小单元，每一个Task都会负责一部分数据的同步工作。
3. 切分多个Task之后，DataX Job会调用Scheduler模块，根据配置的并发数据量，将拆分成的Task重新组合，组装成TaskGroup(任务组)。每一个TaskGroup负责以一定的并发运行完毕分配好的所有Task，默认单个任务组的并发数量为5。
4. 每一个Task都由TaskGroup负责启动，Task启动后，会固定启动Reader—>Channel—>Writer的线程来完成任务同步工作。
5. DataX作业运行起来之后， Job监控并等待多个TaskGroup模块任务完成，等待所有TaskGroup任务完成后Job成功退出。否则，异常退出，进程退出值非0

DataX调度流程：

举例来说，用户提交了一个DataX作业，并且配置了20个并发，目的是将一个100张分表的mysql数据同步到odps里面。 DataX的调度决策思路是：

1. DataXJob根据分库分表切分成了100个Task。
2. 根据20个并发，DataX计算共需要分配4个TaskGroup（20/5）。
3. 4个TaskGroup平分切分好的100个Task，每一个TaskGroup负责以5个并发共计运行25个Task。


## 编译源码

1) 下载源码

``` bash
$ git clone git@github.com:alibaba/DataX.git
```

2) 配置 maven setting.xml

``` xml
<mirrors>
    <mirror>
        <id>custom-mirror</id>
        <mirrorOf>*</mirrorOf>
        <!--<url>http://maven.aliyun.com/nexus/content/groups/public/</url>-->
        <url>https://maven.aliyun.com/repository/central</url>
    </mirror>
</mirrors>
```

3） 打包

``` bash
$ cd  {DataX_source_code_home}
$ mvn -U clean package assembly:assembly -Dmaven.test.skip=true
```

注：异常处理

异常一：

``` bash
[ERROR] Failed to execute goal on project odpsreader: Could not resolve dependencies for project com.alibaba.datax:odpsreader:jar:0.0.1-SNAPSHOT: Could not find artifact com.alibaba.external:bouncycastle.provider:jar:1.38-jdk15 in custom-mirror (https://maven.aliyun.com/repository/central) -> [Help 1]

$ vim odpsreader/pom.xml
com.aliyun.odps
odps-sdk-core
换一下版本 ：0.20.7-public 
```

异常二：

``` bash
[ERROR] Failed to execute goal on project otsstreamreader: Could not resolve dependencies for project com.alibaba.datax:otsstreamreader:jar:0.0.1-SNAPSHOT: Could not find artifact com.aliyun.openservices:tablestore-streamclient:jar:1.0.0-SNAPSHOT -> [Help 1]

$ vim otsstreamreader/pom.xml 
把 tablestore-streamclient 的版本 1.0.0-SNAPSHOT 改成 1.0.0
```

其他异常：

``` bash
多数是由maven仓库缺少jar包所致，可将maven镜像改为私服重试，私服配置如下：

<mirrors>
    <mirror>
        <id>custom-mirror</id>
        <mirrorOf>*</mirrorOf>
        <url>http://xxx.xxx.xxx.xxx:9999/nexus/content/groups/public/</url>
    </mirror>
</mirrors>

public availibale repositories：
aliyun：https://maven.aliyun.com/repository/central/
Central：https://repo1.maven.org/maven2/
cloudra：https://repository.cloudera.com/content/repositories/releases
conjars：http://conjars.org/repo/
```

打包成功，日志显示如下：

``` bash
[INFO] BUILD SUCCESS
[INFO] -----------------------------------------------
[INFO] Total time: 10:34 min
[INFO] Finished at: 2018-11-22T13:59:50+08:00
[INFO] Final Memory: 463M/2037M
[INFO] -----------------------------------------------
```

打包成功后的DataX包位于 {DataX_source_code_home}/target/datax/datax/ ，结构如下：

``` bash
$ cd  {DataX_source_code_home}
$ ls ./target/datax/datax/
bin    conf   job    lib    plugin script tmp

$ du -sh *
947M	datax
865M	datax.tar.gz
```

## dataX调优

DataX调优要分成几个部分（注：此处任务机指运行Datax任务所在的机器）。

1. 网络本身的带宽等硬件因素造成的影响；
2. DataX本身的参数；
3. 从源端到任务机；
4. 从任务机到目的端；

即当觉得DataX传输速度慢时，需要从上述四个方面着手开始排查。

### 网络带宽等硬件因素调优

此部分主要需要了解网络本身的情况，即从源端到目的端的带宽是多少，平时使用量和繁忙程度的情况，从而分析是否是本部分造成的速度缓慢。以下提供几个思路。

* 可使用从源端到目的端scp的方式观察速度；
* 结合监控观察任务运行时间段时，网络整体的繁忙情况，来判断是否应将任务避开网络高峰运行；
* 观察任务机的负载情况，尤其是网络和磁盘IO，观察其是否成为瓶颈，影响了速度；

### DataX本身的参数调优

#### 全局调优

``` json
{
   "core":{
        "transport":{
            "channel":{
                "speed":{
                    "channel": 2, ## 此处为数据导入的并发度，建议根据服务器硬件进行调优
                    "record":-1, ##此处解除对读取行数的限制
                    "byte":-1, ##此处解除对字节的限制
                    "batchSize":2048 ##每次读取batch的大小
                }
            }
        }
    },
    "job":{
            ...
        }
    }
```

#### 局部调优

``` json
"setting": {
            "speed": {
                "channel": 2,
                "record":-1,
                "byte":-1,
                "batchSize":2048
            }
        }
    }
}

# channel增大，为防止OOM，需要修改datax工具的datax.py文件。
# 如下所示，可根据任务机的实际配置，提升-Xms与-Xmx，来防止OOM。
# tunnel并不是越大越好，过分大反而会影响宿主机的性能。
DEFAULT_JVM = "-Xms1g -Xmx1g -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=%s/log" % (DATAX_HOME)
```

#### jvm调优

``` json
python datax.py  --jvm="-Xms3G -Xmx3G" ../job/test.json 
```

此处根据服务器配置进行调优，切记不可太大！否则直接Exception
以上为调优，应该是可以针对每个json文件都可以进行调优。


## 功能测试和性能测试

quick start [https://github.com/alibaba/DataX/blob/master/userGuid.md](https://github.com/alibaba/DataX/blob/master/userGuid.md)

### 动态传参

如果需要导入数据的表太多而表的格式又相同，可以进行json文件的复用，举个简单的例子： python datax.py -p "-Dsdbname=test  -Dstable=test" ../job/test.json

``` json
"column": ["*"],
"connection": [
	{
		"jdbcUrl": "jdbc:mysql://xxx:xx/${sdbname}?characterEncoding=utf-8",
		"table": ["${stable}"]
	}
],
```

上述例子可以在linux下与shell进行嵌套使用。

### mysql -> hdfs

示例一：全量导

``` bash
# 1. 查看配置模板
python datax.py -r mysqlreader -w hdfswriter

# 2. 创建和编辑配置文件
vim custom/mysql2hdfs.json
{
    "job":{
        "setting":{
            "speed":{
                "channel":1
            }
        },
        "content":[
            {
                "reader":{
                    "name":"mysqlreader",
                    "parameter":{
                        "username":"xxx",
                        "password":"xxx",
                        "column":["id","name","age","birthday"],
                        "connection":[
                            {
                                "table":[
                                    "tt_user"
                                ],
                                "jdbcUrl":[
                                    "jdbc:mysql://192.168.1.96:3306/test"
                                ]
                            }
                        ]
                    }
                },
                "writer":{
                    "name":"hdfswriter",
                    "parameter":{
                        "defaultFS":"hdfs://192.168.1.81:8020",
                        "fileType":"text",
                        "path":"/tmp/test01",
                        "fileName":"tt_user",
                        "column":[
                            {"name":"id", "type":"INT"},
                            {"name":"name", "type":"VARCHAR"},
                            {"name":"age", "type":"INT"}
                            {"name":"birthday", "type":"date"}
                        ],
                        "writeMode":"append",
                        "fieldDelimiter":"\t",
                        "compress":"GZIP"
                    }
                }
            }
        ]
    }
}

# 3. 启动导数进程
python datax.py custom/mysql2hdfs.json

# 4. 日志结果
2018-11-23 14:37:58.056 [job-0] INFO  JobContainer - 
任务启动时刻                    : 2018-11-23 14:37:45
任务结束时刻                    : 2018-11-23 14:37:58
任务总计耗时                    :                 12s
任务平均流量                    :                9B/s
记录写入速度                    :              0rec/s
读出记录总数                    :                   7
读写失败总数                    :                   0
```

示例二：增量导（表切分）

``` json
{
    "job": {
        "setting": {
            "speed": {
                "channel": 2
            }
        },
        "content": [{
            "reader": {
                "name": "mysqlreader",
                "parameter": {
                    "username": "admin",
                    "password": "qweasd123",
                    "column": [
                        "id",
                        "name",
                        "age",
                        "birthday"
                    ],
                    "splitPk": "id",
                    "where": "id<10",
                    "connection": [{
                        "table": [
                            "tt_user",
                            "ttt_user"
                        ],
                        "jdbcUrl": [
                            "jdbc:mysql://hadoop01:3306/test"
                        ]
                    }]
                }
            },
            "writer": {
                "name": "hdfswriter",
                "parameter": {
                    "defaultFS": "hdfs://minq-cluster",
                    "hadoopConfig": {
                        "dfs.nameservices": "minq-cluster",
                        "dfs.ha.namenodes.minq-cluster": "namenode33,namenode51",
                        "dfs.namenode.rpc-address.minq-cluster.namenode33": "hadoop01:8020",
                        "dfs.namenode.rpc-address.minq-cluster.namenode51": "hadoop02:8020",
                        "dfs.client.failover.proxy.provider.minq-cluster": "org.apache.hadoop.hdfs.server.namenode.ha.ConfiguredFailoverProxyProvider"
                    },
                    "fileType": "text",
                    "path": "/tmp/test/user",
                    "fileName": "mysql_test_user",
                    "column": [{
                            "name": "id",
                            "type": "INT"
                        },
                        {
                            "name": "name",
                            "type": "VARCHAR"
                        },
                        {
                            "name": "age",
                            "type": "INT"
                        },
                        {
                            "name": "birthday",
                            "type": "date"
                        }
                    ],
                    "writeMode": "append",
                    "fieldDelimiter": "\t"
                }
            }
        }]
    }
}
```

`注意`：外域机器通信需要用外网ip，未配置hostname访问会访问异常。
可以通过配置 hdfs-site.xml 进行解决：

``` xml
<property>
    <name>dfs.client.use.datanode.hostname</name>
    <value>true</value>
    <description>only cofig in clients</description>
 </property>
```

或者通过配置java客户端：

``` java
Configuration conf=new Configuration();
conf.set("dfs.client.use.datanode.hostname", "true");
```

或者通过配置 datax 工作配置：

``` json
"hadoopConfig": {
        "dfs.client.use.datanode.hostname":"true",
        "dfs.nameservices": "minq-cluster",
        "dfs.ha.namenodes.minq-cluster": "namenode33,namenode51",
        "dfs.namenode.rpc-address.minq-cluster.namenode33": "hadoop01:8020",
        "dfs.namenode.rpc-address.minq-cluster.namenode51": "hadoop02:8020",
        "dfs.client.failover.proxy.provider.minq-cluster": "org.apache.hadoop.hdfs.server.namenode.ha.ConfiguredFailoverProxyProvider"
}
```


示例三：增量导（sql查询）


mysql2hdfs-condition.json

``` json
{
    "job": {
        "setting": {
            "speed": {
                 "channel":1
            }
        },
        "content": [
            {
                "reader": {
                    "name": "mysqlreader",
                    "parameter": {
                        "username": "xxx",
                        "password": "xxx",
                        "connection": [
                            {
                                "querySql": [
                                    "select id,name,age,birthday from tt_user where id <= 5"
                                ],
                                "jdbcUrl": [
                                    "jdbc:mysql://192.168.1.96:3306/test"
                                ]
                            }
                        ]
                    }
                },
                "writer": {
                    "name": "hdfswriter",
                    "parameter":{
                        "defaultFS":"hdfs://192.168.1.81:8020",
                        "fileType":"text",
                        "path":"/tmp/test01",
                        "fileName":"tt_user",
                        "column":[
                            {"name":"id", "type":"INT"},
                            {"name":"name", "type":"VARCHAR"},
                            {"name":"age", "type":"INT"}
                            {"name":"birthday", "type":"date"}
                        ],
                        "writeMode":"append",
                        "fieldDelimiter":"\t"
                    }
                }
            }
        ]
    }
}
```


### hdfs -> mysql 

``` bash
# 1. 查看配置模板
python datax.py -r hdfsreader -w mysqlwriter

# 2. 创建和编辑配置文件
vim custom/hdfs2mysql.json
{
    "job": {
        "setting": {
            "speed": {
                "channel": 1
            }
        },
        "content": [{
            "reader": {
                "name": "hdfsreader",
                "parameter": {
                    "column": [{
                            "index": "0",
                            "type": "long"
                        },
                        {
                            "index": "1",
                            "type": "string"
                        },
                        {
                            "index": "2",
                            "type": "long"
                        },
                        {
                            "index": "3",
                            "type": "date"
                        }
                    ],
                    "defaultFS": "hdfs://minq-cluster",
                    "hadoopConfig": {
                        "dfs.namenode.rpc-address.minq-cluster.namenode33": "hadoop01:8020",
                        "dfs.ha.namenodes.minq-cluster": "namenode33,namenode51",
                        "dfs.nameservices": "minq-cluster",
                        "dfs.namenode.rpc-address.minq-cluster.namenode51": "hadoop02:8020",
                        "dfs.client.failover.proxy.provider.minq-cluster": "org.apache.hadoop.hdfs.server.namenode.ha.ConfiguredFailoverProxyProvider"
                    },
                    "encoding": "UTF-8",
                    "fileType": "text",
                    "path": "/tmp/test/tt_user*",
                    "fieldDelimiter": "\t"
                }
            },
            "writer": {
                "name": "mysqlwriter",
                "parameter": {
                    "column": [
                        "id",
                        "name",
                        "age",
                        "birthday"
                    ],
                    "connection": [{
                        "jdbcUrl": "jdbc:mysql://192.168.1.96:3306/test",
                        "table": ["ttt_user"]
                    }],
                    "username": "zhangqingli",
                    "password": "xxx",
                    "preSql": [
                        "select * from ttt_user",
                        "select name from ttt_user"
                    ],
                    "session": [
                        "set session sql_mode='ANSI'"
                    ],
                    "writeMode": "insert"
                }
            }
        }]
    }
}

# 3. 启动导数进程
python datax.py custom/hdfs2mysql.json

# 4. 日志结果
任务启动时刻                    : 2018-11-23 14:44:54
任务结束时刻                    : 2018-11-23 14:45:06
任务总计耗时                    :                 12s
任务平均流量                    :                9B/s
记录写入速度                    :              0rec/s
读出记录总数                    :                   7
读写失败总数                    :                   0
```


### mongo -> hdfs

示例一：全量导

``` bash
{
    "job": {
        "setting": {
            "speed": {
                "channel": 1
            }
        },
        "content": [{
            "reader": {
                "name": "mongodbreader",
                "parameter": {
                    "address": ["192.168.1.96:27017"],
                    "userName": "xxxx",
                    "userPassword": "xxxx",
                    "dbName": "test",
                    "collectionName": "student",
                    "column": [
                        {"name": "_id", "type": "string"},
                        {"name": "name", "type": "string"},
                        {"name": "age", "type": "double"},
                        {"name": "clazz", "type": "double"},
                        {"name": "hobbies", "type": "Array"},
                        {"name": "ss", "type": "Array"}
                    ],
                    "splitter": ","
                }
            },
            "writer": {
                "name": "hdfswriter",
                "parameter":{
                    "defaultFS":"hdfs://192.168.1.81:8020",
                    "fileType":"text",
                    "path":"/tmp/test01",
                    "fileName":"mongo_student",
                    "column":[
                        {"name": "_id", "type": "string"},
                        {"name": "name", "type": "string"},
                        {"name": "age", "type": "double"},
                        {"name": "clazz", "type": "double"},
                        {"name": "hobbies", "type": "string"},
                        {"name": "ss", "type": "string"}
                    ],
                    "writeMode":"append",
                    "fieldDelimiter":"\u0001"
                }
            }
        }]
    }
}
```

示例二：mongo增量导 

``` json
{
    "job": {
        "setting": {
            "speed": {
                "channel": 2
            }
        },
        "content": [{
            "reader": {
                "name": "mongodbreader",
                "parameter": {
                    "address": ["地址"],
                    "userName": "用户名",
                    "userPassword": "密码",
                    "dbName": "库名",
                    "collectionName": "集合名",
                        "query":"{created:{ $gte: ISODate('1990-01-01T16:00:00.000Z'), $lte: ISODate('2010-01-01T16:00:00.000Z') }}",
                    "column": [
                        { "name": "_id", "type": "string" }, 
                        { "name": "owner", "type": "string" }, 
                        { "name": "contributor", "type": "string" }, 
                        { "name": "type", "type": "string" }, 
                        { "name": "amount", "type": "int" }, 
                        { "name": "divided", "type": "double" }, 
                        { "name": "orderId", "type": "string" }, 
                        { "name": "orderPrice", "type": "int" }, 
                        { "name": "created", "type": "date" }, 
                        { "name": "updated", "type": "date" },
                        { "name": "hobbies", "type": "Array"}
                    ]
                }
            },
            "writer": {
                "name": "hdfswriter",
                "parameter": {
                    "defaultFS": "hdfs://xxx.xxx.xxx.xxx:xxx",
                    "fileType": "text",
                    "path": "/user/hive/warehouse/aries.db/ods_goldsystem_mdaccountitems/accounting_day=$dt",
                    "fileName": "filenamexxx",
                    "column": [
                        { "name": "_id", "type": "string" }, 
                        { "name": "owner", "type": "string" }, 
                        { "name": "contributor", "type": "string" }, 
                        { "name": "type", "type": "string" }, 
                        { "name": "amount", "type": "int" }, 
                        { "name": "divided", "type": "double" }, 
                        { "name": "orderId", "type": "string" }, 
                        { "name": "orderPrice", "type": "int" }, 
                        { "name": "created", "type": "date" }, 
                        { "name": "updated", "type": "date" },
                        { "name": "hobbies", "type": "string"}
                    ],
                    "writeMode": "append",
                    "fieldDelimiter": "\t"
                }
            }
        }]
    }

}
```

### hdfs -> mongo

``` json
{
	"job": {
		"setting": {
			"speed": {
				"channel": 2
			}
		},
		"content": [{
			"reader": {
				"name": "hdfsreader",
				"parameter": {
					"column": [
						{ "index": 0, "type": "String" },
						{ "index": 1, "type": "String" },
						{ "index": 2, "type": "Long" },
						{ "index": 3, "type": "Date" }
					],
					"defaultFS": "hdfs://minq-cluster",
					"hadoopConfig": {
						"dfs.nameservices": "minq-cluster",
						"dfs.ha.namenodes.minq-cluster": "namenode33,namenode51",
						"dfs.namenode.rpc-address.minq-cluster.namenode33": "hadoop01:8020",
						"dfs.namenode.rpc-address.minq-cluster.namenode51": "hadoop02:8020",
						"dfs.client.failover.proxy.provider.minq-cluster": "org.apache.hadoop.hdfs.server.namenode.ha.ConfiguredFailoverProxyProvider"
					},
					"encoding": "UTF-8",
					"fieldDelimiter": "\t",
					"fileType": "text",
					"path": "/tmp/test/mongo_student*"
				}
			},
			"writer": {
				"name": "mongodbwriter",
				"parameter": {
					"address": [
						"192.168.1.96:27017"
					],
					"userName": "test",
					"userPassword": "xxx",
					"dbName": "test",
					"collectionName": "student_from_hdfs",
					"column": [
						{ "name": "_id", "type": "string" },
						{ "name": "name", "type": "string" },
						{ "name": "age", "type": "int" },
						{ "name": "birthday", "type": "date" }
					],
					"splitter": ",",
					"upsertInfo": {
						"isUpsert": "true",
						"upsertKey": "_id"
					}
				}
			}
		}]
	}
}
```


## datax 插件开发

略（待续）