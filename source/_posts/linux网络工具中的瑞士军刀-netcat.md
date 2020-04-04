title: linux网络工具中的瑞士军刀-netcat
author: kinglyjn
tags:
  - linux
categories:
  - os
  - linux
date: 2018-12-17 15:34:00
---
## 概述

NetCat，在网络工具中有“瑞士军刀”美誉，其有Windows和Linux的版本。因为它短小精悍（1.84版本也不过25k，旧版本或缩减版甚至更小）、功能实用，被设计为一个简单、可靠的网络工具，可通过TCP或UDP协议传输读写数据。同时，它还是一个网络应用Debug分析器，因为它可以根据需要创建各种不同类型的网络连接。

<!--more-->

## 安装

``` bash
$ yum install -y nc
$ nc -version
$ nc -h
```

## 几种常见使用方法


### 远程拷贝文件(类似scp)

例如将server1的 test1.sh 文件 传入到server2的 test2.sh文件（将会覆盖写入）：

``` bash
#先在server2用nc激活监听：
$ nc -lp 1234 > test2.sh
#然后在server1上运行（这里的1表示超时时间）：
$ nc -w 1 supervisor01z 1234 < test1.sh

#而使用scp同样可以完成同样的功能：
$ scp test2.sh root@server2:/xxx/xxx
```

### 传输目录

例如将server1的shells目录传送到server02：

``` bash
#server2
$ nc -l 1234 |tar zxvf -
#server1
$ tar zcvf - shells |nc supervisor01z 1234

#而使用scp同样可以完成同样的功能：(将会覆盖写入)
$ scp -r shells/ root@supervisor01z:/home/ubuntu/test
```

### 简单的通信工具

``` bash
#server1和server2实现通信交流（k表示长连接）
#server1
$ nc -lp 1234  或者  nc -lk 1234
#server2
$ nc supervisor01z 1234
```

## Java API 示例

注意：NC是以换行符 '\n' 来区分一条消息的。

``` java
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.lang.management.ManagementFactory;
import java.lang.management.RuntimeMXBean;
import java.text.SimpleDateFormat;
import java.util.Date;

public class NCUtil {
	private static SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.S");
	/** 配置信息 */
	private static final String REMOTE_HOST = "host01";
	private static final int REMOTE_PORT = 8888;
	
	public static void write2NC(Object o, String msg) {
		BufferedWriter bw = null;
		try {
			// prefix
			String curtime = sdf.format(new Date());
			RuntimeMXBean runtimeMXBean = ManagementFactory.getRuntimeMXBean(); 
			String pidname = runtimeMXBean.getName(); //1234@xxx
			String tname = Thread.currentThread().getName() + "-" + Thread.currentThread().getId();
			String oname = o.getClass().getSimpleName() + "-" + o.hashCode();
			String prefix = "["+ curtime + "    " + pidname + "    " + tname + "    " + oname  +"] ";
			
			// core
			Process process = Runtime.getRuntime().exec("nc " + REMOTE_HOST + " " + REMOTE_PORT);
			OutputStream os = process.getOutputStream();
			bw = new BufferedWriter(new OutputStreamWriter(os));
			bw.write(prefix + msg + System.getProperty("line.separator"));
			bw.flush();
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try { bw.close(); } catch (IOException e) {}
		}
	}
	
	public static void main(String[] args) {
		write2NC(new NCUtil(), "hello keyllo, hello world.");
	}
}
```



