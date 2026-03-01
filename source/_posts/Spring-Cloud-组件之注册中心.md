title: Spring Cloud 组件之注册中心

author: kinglyjn

tags:

  - springcloud
  - eureka
  - zookeeper
  - consul

categories:

  - micros

  - springcloudx

date: 2020-04-06 00:22:32

---



## Eureka（<a href='https://github.com/Netflix/eureka/wiki'><font color='red'>已停更说明</font></a>）



集群架构原理：

<img src="/images/1586169823433.jpg" style="zoom:50%; float:left" /><div style="clear:both"></div>

对于eureka自身来说，其集群构建的原理简单来说就是 `相互注册，相互守望，最后作为一个整体给外界提供注册服务`。

* Eureka Server（类比物业公司）提供服务注册的服务，Eureka Client 会在 Eureka Server 中进行注册，这样server端注册表中将会存储所有可用服务节点的信息，服务节点的信息可以在界面中直观的看到；
* Eureka Client （类比业主）具备一个内置的、使用轮询（round-robin）负载算法的负载均衡器。在应用启动之后，客户端将会向 Eureka Server 发送心跳（类比交物业费，默认周期为30s），如果 Eureka Server 在多个心跳周期内没有收到某个节点的心跳，Eureka Server 将会从服务注册表中把这个节点移除掉（默认90s）。

<br>



<!--more-->



### 单机版配置

服务端配置：

```yml
server:
  port: 7001
  
eureka:
  instance:
    hostname: localhost  #eureka服务端的实例名称
  client:
    registerWithEureka: false   #表示不向注册中心注册自己（注意使用的都是驼峰式命名！）
    fetchRegistry: false  #表示自己就是注册中心，我的职责就是维护服务实例，并不需要去检索服务
    serviceUrl:
      defaultZone: http://${eureka.instance.hostname}:${server.port}/eureka/
```

```java
@SpringBootApplication
@EnableEurekaServer  // eureka server 端
public class EurekaApplication7001 {
    public static void main(String[] args) {
        SpringApplication.run(EurekaApplication7001.class, args);
    }
}
```

<br>

客户端配置

```yml
eureka:
  client:
    registerWithEureka: true   #表示向注册中心注册自己
    fetchRegistry: true  #是否从eureka server 抓取已有的注册信息，默认为true，单节点无所谓，但是集群的话必须设置为true才能配合ribbon进行负载均衡
    serviceUrl:
      defaultZone: http://localhost:7001/eureka/  #注意这里 defaultZone 一定是驼峰命名的！
```

```java
@SpringBootApplication
@EnableEurekaClient  // eureka client 端
public class PaymentApplication8001 {
    public static void main(String[] args) {
        SpringApplication.run(PaymentApplication8001.class, args);
    }
}
```

<br>



### 集群版配置

编辑/etc/hosts

```yml
127.0.0.1  eureka7001.com
127.0.0.1  eureka7002.com
```

<br>

服务端配置：

```yml
# eureka server 1
server:
  port: 7001
eureka:
  instance:
    hostname: eureka7001.com
  client:
    registerWithEureka: false #注意使用驼峰式命名
    fetchRegistry: false
    serviceUrl:
      defaultZone: http://eureka7001.com:7001/eureka/,http://eureka7002.com:7002/eureka/


# eureka server 2
server:
  port: 7002
eureka:
  instance:
    hostname: eureka7002.com 
  client:
    registerWithEureka: false 
    fetchRegistry: false
    serviceUrl:
      defaultZone: http://eureka7001.com:7001/eureka/,http://eureka7002.com:7002/eureka/
```

<br>

客户端配置：

```yml
# eureka client: payment 1
server:
  port: 8001
spring:
  application:
    name: payment-service
eureka:
  client:
    registerWithEureka: true
    fetchRegistry: true 
    serviceUrl:
      defaultZone: http://eureka7001.com:7001/eureka,http://eureka7002.com:7002/eureka
     
     
# eureka client: payment 2
server:
  port: 8002
spring:
  application:
    name: payment-service
eureka:
  client:
    registerWithEureka: true
    fetchRegistry: true 
    serviceUrl:
      defaultZone: http://eureka7001.com:7001/eureka,http://eureka7002.com:7002/eureka
      

# eureka client: order 1
server:
  port: 80
spring:
  application:
    name: order-service
eureka:
  client:
    registerWithEureka: true 
    fetchRegistry: true 
    serviceUrl:
      defaultZone: http://eureka7001.com:7001/eureka,http://eureka7002.com:7002/eureka 
```

<br>

Order 应用访问 Payment 服务默认负载均衡的设置：

```java
// 向spring容器中注册 RestTemplate
@Bean
@LoadBalanced
public RestTemplate restTemplate() {
  return new RestTemplate();
}


// 使用RestTemplate完成跨服务调用
@Slf4j
@RestController
@RequestMapping("/order02")
public class OrderController02 {
    // 使用微服务名称作为访问地址，实现负载均衡访问（默认轮询）
    private static final String PAYMENT_URL = "http://PAYMENT-SERVICE";

    @Autowired
    private RestTemplate restTemplate;


    /**
     * @RequestBody的作用：
     * curl -XPOST -H 'Content-Type:application/json' -d '{"serial":"LR0001"}' http://localhost/order01/payment/save
     *
     */
    @RequestMapping("/payment/save")
    public Map<String, Object> save(@RequestBody Payment payment) {
        log.info("保存的支付对象：{}", payment);
        Map result = restTemplate.postForObject(PAYMENT_URL + "/payment/save", payment, Map.class);
        return result;
    }

    @GetMapping("/payment/get/{id}")
    public Map<String, Object> getById(@PathVariable("id") Long id) {
        log.info("查询id：{}", id);
        Map result = restTemplate.getForObject(PAYMENT_URL + "/payment/get/" + id, Map.class);
        return result;
    }
}
```

<br>

### 更改服务的显示名称以及设置使用IP访问

eureka服务端增加如下配置：

```yml
eureka:
  instance:
      instance-id: payment8001
      prefer-ip-address: true
```



更改前：

<img src="/images/image-20200406210806567.png" alt="" style="zoom:25%; float:left; display: block;" /><div style="clear:both;"></div>

更改后：
<img src="/images/image-20200406210917002.png" alt="" style="zoom:26%; float:left; display: block;" /><div style="clear:both;"></div>


### 服务的发现



```java
// 注册DiscoveryClient
@SpringBootApplication
@EnableEurekaClient 
@EnableDiscoveryClient // 
public class PaymentApplication8001 {
    public static void main(String[] args) {
        SpringApplication.run(PaymentApplication8001.class, args);
    }
}


// 使用DiscoveryClient
@Autowired
private DiscoveryClient discoveryClient;

@GetMapping(value = "/discovery")
public Object discovery() {
  return this.discoveryClient;
}

@GetMapping(value = "/discovery/{serviceId}")
public Object getServiceName(@PathVariable("serviceId") String serviceId) {
  return discoveryClient.getInstances(serviceId);
}
```



效果如下：

<img src="/images/image-20200406214255903.png" style="zoom:26%; float:left" /> 

<img src="/images/image-20200406214403181.png" style="zoom:25%;" /><div style="clear:both;"></div><br>



### Eureka的自我保护模式

保护模式主要用于一组客户端和eureka之间存在网络分区场景下的保护，一旦进入保护模式，eureka server将会尝试保护其服务注册表中的信息，即某个时刻某些微服务不可用了，eureka不会立刻清理，依旧会对该服务的信息进行保存（属于`CAP理论`的AP分支-即高可用分区容错）。如果你的 eureka server 首页存在如下提示，则说明eureka进入了保护模式。

<img src="/images/image-20200406215437438.png" style="zoom:50%;" />



为什么会产生自我保护机制？

为了防止在 eureka client 正常运行，但是与 eureka server 网络不通的情况下，错误地将服务踢出。默认情况下，如果 eureka server 在一定时间内没有接收到某个微服务的心跳（默认90s）， eureka server 将会注销该实例。但是当网络分区发生故障（延时、卡顿、拥挤），微服务与 eureka server 之间无法进行正常的通信，如果注销微服务就会变得危险了 --- 因为微服务本身其实是健康的，`此时不应该注销这个微服务`。eureka 通过自我保护模式来解决这个问题 --- 当 eureka server 节点在短时间内丢失过多的客户端时（可能发生了网络分区故障），那么这个节点就进入了自我保护模式。一句话讲，就是 `好死不如赖活着`。

<br>

禁用自我保护机制：

服务端配置：

```yml
eureka:
  server:
    enable-self-preservation: false  #关闭自我保护模式（默认是开启的）
    eviction-interval-timer-in-ms: 2000  #设置2s检测驱逐（杀的块），默认是60s
```

客户端设置：

```yml
eureka:
  instance:
    lease-renewal-interval-in-seconds: 1  #设置客户端向服务端发送心跳的时间间隔为1s，默认为30s
    lease-expiration-duration-in-seconds: 2  #设置服务端在收到最后一次心跳后等待的时间上限为2s，默认为90s
```

设置完效果：

<img src="/images/image-20200406224448115.png" style="zoom:50%;" /><br>

<br>



## Zookeeper



<img src="/images/image-20200406231650500.png" style="zoom:50%;" />

<br>



### 使用zookeeper替换eureka作为服务注册中心



第一步：改pom

```xml
<!--服务注册-->
        <!--<dependency>-->
            <!--<groupId>org.springframework.cloud</groupId>-->
            <!--<artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>-->
        <!--</dependency>-->
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-starter-zookeeper-discovery</artifactId>
        </dependency>
```

第二步：改yml

```yml
#使用如下配置替换原来的eureka配置
spring:
  application:
    name: payment-service
  cloud:
    zookeeper:
      connect-string: host-rdbms:2181  #使用zk作为服务注册中心
```

第三步：改代码

```java
// 主启动类
@SpringBootApplication
@EnableDiscoveryClient  // 该注解除了向spring容器中注册DiscoveryClient，还用于使用zk或consul作为注册中心
public class PaymentApplication8004 {
    public static void main(String[] args) {
        SpringApplication.run(PaymentApplication8004.class, args);
    }
}
```

一起OK之后，启动，不好意思，报错了，如下：



![](/images/image-20200406232206947.png)



原因就像报出来的那样：

<img src="/images/image-20200406232718116.png" style="zoom: 33%; float:left"/> <div style="clear:both;"></div><br>



解决zk版本冲突的问题：

```xml
<dependency>
  <groupId>org.springframework.cloud</groupId>
  <artifactId>spring-cloud-starter-zookeeper-discovery</artifactId>
  <exclusions>
    <exclusion>
      <groupId>org.apache.zookeeper</groupId>
      <artifactId>zookeeper</artifactId>
    </exclusion>
  </exclusions>
</dependency>
<dependency>
  <groupId>org.apache.zookeeper</groupId>
  <artifactId>zookeeper</artifactId>
  <version>3.4.12</version><!--换成你的zk版本-->
  <exclusions>
    <exclusion>
      <groupId>org.slf4j</groupId>
      <artifactId>slf4j-log4j12</artifactId><!--zk默认使用log4j，而springboot使用logback-->
    </exclusion>
  </exclusions>
</dependency>
```

<br>

一起OK之后，启动，大功告成，查看zk服务端服务的注册，发现增加了如下节点：

![](/images/image-20200406234908271.png)

<br>



### 临时性节点 or 持久节点？

![](/images/image-20200407000545359.png)

由测试我们可以知道，zk作为注册中心，其服务节点是临时性的，客户端服务宕机后，zk心跳检测超时，zk立刻会将服务从列表中踢出（`CAP理论`的CP分支-即数据一致性分区容错）。

<br>



## Consul



### 基本介绍



是什么？：[官网介绍](https://www.consul.io/intro/index.html)

能干啥？

* 服务发现：提供HTTP 和 DNS 两种发现方式
* 健康监测：支持HTTP、TCP、Docker、Shell 脚本定制化
* KV存储：kv的存储方式
* 多数据中心：支持多数据中心
* 可视化web界面



### 安装和使用

第一步：安装和启动服务端

```shell
$ wget https://releases.hashicorp.com/consul/1.7.2/consul_1.7.2_linux_amd64.zip
$ unzip consul_1.7.2_linux_amd64.zip
$ ./consul --version
$ ./consul agent -dev -client 192.168.56.103

# 前端界面
$ curl 192.168.56.103:8500
```

第二步：客户端 pom（替换之前的zk或eureka）

```xml
<dependency>
  <groupId>org.springframework.cloud</groupId>
  <artifactId>spring-cloud-starter-consul-discovery</artifactId>
</dependency>
```

第三步：客户端 yml

```yml
server:
  port: 8006

spring:
  application:
    name: payment-service
  cloud:
    consul:
      host: host-rdbms
      port: 8500
      discovery:
        service-name: ${spring.applicaton.name}
```

<br>



## Eureka、ZK、Consul 比较

| 组件名 | 语言 | CAP  | 服务健康检查 | 对外暴露接口 | spring cloud 集成 |
| ------ | ---- | ---- | ------------ | ------------ | ----------------- |
| Eureka | Java | AP   | 可配支持     | HTTP         | 已集成            |
| ZK     | Java | CP   | 支持         | 客户端       | 已集成            |
| Consul | Go   | CP   | 支持         | HTTP/DNS     | 已集成            |

附：CAP理论经典架构图

<img src="/images/image-20200407021035839.png" style="zoom:50%; float:left" /><div style="clear:both;"></div>

`C`:  consistency，强一致性

`A`: availability，可用性

`P`: partition tolerance，分区容错性 

关键词：`三进二原则`，CAP理论关注的角度是数据，而不是系统整体设计的策略。

一个分布式系统不可能同时很好地满足一致性、可用性和分区容错性这三个需求，因此根据CAP原理将NoSQL数据库分成了满足CA原则、满足CP原则和满足AP原则三大类。

`CA`: 单点集群、满足一致性、可用性的系统，通常在可扩展性上不太好

`CP`: 满足一致性、分区容忍的系统，通常性能不是很高

`AP`: 满足可用性、分区容忍的系统，通常对一致性要求低一些

<br>



## Nacos 

服务注册中心的终极款，由于比较重要，先按下不表，感兴趣先去 [官网](https://nacos.io/zh-cn/) 瞜一眼吧，晚安！

<br>






