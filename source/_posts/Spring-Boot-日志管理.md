title: Spring Boot 日志管理
author: kinglyjn
tags:
  - springboot
categories:
  - framework
  - springboot
date: 2019-03-06 12:45:00
---
## 说说日志框架的起源及现状

比如说，公司中张三要开发一个大型系统，需要打印日志的功能，他的日志完善的过程如下：

1. System.out.println("xxx"), 将关键数据打印在控制台；新增和去除一行日志的打印很麻烦；
2. 使用自己写的日志框架来记录系统的一些关键信息，zhangsan-logging.jar；
3. 接着他又把之前写的日志jar包加了几个高大上的功能，如异步模式、自动归档等，zhangsan-logging-good.jar；
4. 公司又需要搭建新的系统，跟之前用的API不一样，张三需要给新的系统重新换上新的日志功能的实现包，zhangsan-logging-better.jar；
5. 张三突然想到了jdbc与数据库驱动的设计方式，他写了一个统一的接口层（日志功能的一个抽象层logging-abstract.jar），然后他要做的就是给项目中导入具体的日志实现就可以了，张三之前写的日志框架都是实现的日志抽象接口；

<!--more-->

其实目前市面上的日志框架也非常丰富，包括：

常见的`日志抽象层`：

* ~~JCL（Jakarta Commons Logging） 不建议使用~~
* ~~jboss-logging 不建议使用~~
* SLF4J（Simple Logging Facade for Java），推荐使用

常见的`日志实现层`：

* Log4j
* Log4j2（Log4j的升级版）
* Logback（Log4j的重置版），推荐使用
* JUL（java.util.logging）

<br>


## Spring Boot使用的日志

spring boot 的底层是spring框架，而spring框架默认是用JCL（Jakarta Commons Logging）做日志输出的。spring boot在日志功能上做了一层包装，选用的是`SLF4J和Logback`。



### 如何在系统中使用SLF4J

SLF4J的用户手册，参考 [SLF4J用户手册](https://www.slf4j.org/manual.html)

SLF4J及常用实现包的使用如下图：

<img src="/images/pasted-29.png" alt="图一" style="width:90%"/>

在应用开发的时候，做日志输出的时候，不应该直接调用日志输出的实现类，而是调用日志抽象层的方法。在此之前，需要给系统导入slf4j和logback的jar包。

``` java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class HelloWorld {
  public static void main(String[] args) {
    Logger logger = LoggerFactory.getLogger(HelloWorld.class);
    logger.info("Hello World");
  }
}
```

注意：每一个日志的实现框架都有自己的配置文件，使用slf4j作为日志抽象层之后，配置文件还是需要做成日志实现框架 的配置文件。
<br>


### 使用SLF4J统一不同框架的日志输出

开发一个系统难免会用到很多框架，例如开发A系统，用到了 spring（日志使用commons-logging）、hibernate（日志使用jboss-logging）、mybatis等框架 。那么问题来了，怎样统一日志记录？并且即使是使用别的框架，那么如何统一使用SLF4J和Logback进行日志的输出？

SLF4J的办法请参考[使用SLF4J统一日志输出](https://www.slf4j.org/legacy.html)，用一个成语概括就是 `偷天换日`，具体做法就是：

1. 排除 spring的commons-logging 默认日志包（必须排除掉，否则与替换包中的类发生冲突）；
2. 使用 jcl-over-slf4j 替换原来的 commons-logging 包；

更多示例如下图所示：

<img src="/images/pasted-30.png" alt="图二" style="width:90%"/>


### Springboot底层的日志包依赖关系

<img src="/images/pasted-31.png" alt="图三" style="width:60%"/>


springboot底层spring排除commons-logging依赖：

``` xml
<dependency>
	<groupId>org.springframework</groupId>
  	<artifactId>spring-core</artifactId>
  	<exclusions>
  		<groupId>commons-logging</groupId>
      	<artifactId>commons-logging</artifactId>
  	</exclusions>
</dependency>
```

总结：

* springboot底层也是使用slf4j+logback的方式进行日志记录的；
* springboot也把其他形式的日志实现替换成了slf4j的形式（还记得偷天换日吗？）；

所以springboot能自动适配所有的日志，而且底层使用slf4j+logback的方式记录日志，引入其他框架的时候只需要把这个框架依赖的日志jar包排除掉即可。
<br>


## Spring Boot 日志设置

### 日志功能默认配置

关于spring boot官方网站的日志介绍，请参考 [spring boot官网日志章节介绍](https://docs.spring.io/spring-boot/docs/2.1.3.RELEASE/reference/htmlsingle/#boot-features-logging)。

测试spring boot的默认设置：

``` java
@SpringBootTest
@RunWith(SpringRunner.class)
public class Test01 {
    @Test
    public void test01() {
        // 日志的级别：
        // 由低到高 trace<debug<info<warn<error
        // 可以调整输出的日志级别，日志就会在这个级别以后的高级别生效
        // springboot默认给我们调整使用的是info级别的日志，所以默认只会输出info级别及更高级别的日志
        Logger logger = LoggerFactory.getLogger(getClass());
        logger.trace("这是 trace ...");
        logger.debug("这是 debug ...");
        logger.info("这是 info ...");
        logger.warn("这是 warn ...");
        logger.error("这是 error ...");
    }
}

/*
SpringBoot默认配置下的日志输出：
2019-03-05 19:03:12.608  INFO 34052 --- [           main] com.keyllo.demo.Test01                   : 这是 info ...
2019-03-05 19:03:12.608  WARN 34052 --- [           main] com.keyllo.demo.Test01                   : 这是 warn ...
2019-03-05 19:03:12.609 ERROR 34052 --- [           main] com.keyllo.demo.Test01                   : 这是 error ...
*/
```

spring boot底层日志默认的设置参考 spring-boot-2.1.3.RELEASE.jar：

``` java
package org.springframework.boot.logging.java;
package org.springframework.boot.logging.log4j2;
package org.springframework.boot.logging.logback;
```
<br>


### 日志功能的手动配置

在配置文件中手动设置日志的输出级别：

``` properties
#设置日志的输出级别
logging.level={com.keyllo.demo.controller: trace, com.keyllo.service: debug}

#设置日志输出的文件
#如果不设置目录则默认输出到当前项目的根目录下，如 logging.file=spring.log
#下面设置先检查/Users/xxx/Desktop文件夹存不存在，不存在的话就创建，然后将日志写到其中的spring.log文件
#logging.file=/Users/xxx/Desktop/spring.log

#设置日志输出的路径
#logging.path 和 logging.file 使用其中的一个设置即可
#下面设置先检查/Users/xxx/Desktop文件夹存不存在，不存在的话就创建，然后将日志写到默认的spring.log文件
#logging.path=/Users/xxx/Desktop

#设置控制台日志输出的格式
#logging.file 和 logging.path 都不设置的话，日志只输出到控制台
logging.partern.console="%d{yyyy/MM/dd-HH:mm:ss} [%thread] %-5level %logger- %msg%n"

#设置文件中日志输出的格式
logging.partern.file="%d{yyyy/MM/dd-HH:mm:ss} [%thread] %-5level %logger- %msg%n"
```
<br>


### 切换底层日志的实现框架

我们前面说过，spring boot默认的日志实现是logback，如果我们想用log4j作为spring boot的底层日志实现（虽然这样做没有意义，因为正是因为log4j写的不好，log4j的作者才又开发了logback，但是我们还是想更深入地测试一下），该怎么做呢？

其实我们前面已经说过，我们只需要按照 slf4j的日志适配图进行相应包的`排除和替换`即可。

借用 idea工具的 diagrams->show dependencies 功能，我们可以很方便地做到以下事情：

1. 把logback的依赖全部干掉，加入logback转换层的依赖（可省略）
2. 把log4j转换层log4j-to-slf4j依赖干掉
3. 把log4j适配层slf4j-log4j12（依赖与log4j实现包）、实现层log4j包依赖加入

``` xml
<!--排除-->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-web</artifactId>
  <exclusions>
    <exclusion>
      <artifactId>logback-classic</artifactId>
      <groupId>ch.qos.logback</groupId>
    </exclusion>
    <exclusion>
      <artifactId>log4j-to-slf4j</artifactId>
      <groupId>org.apache.logging.log4j</groupId>
    </exclusion>
  </exclusions>
</dependency>
<!--替换-->
<dependency>
  <groupId>org.slf4j</groupId>
  <artifactId>slf4j-log4j12</artifactId>
</dependency>
```

【注】log4j.properties 示例：

``` properties
# properties
project=zdemo-springboot04
logpath=/Users/xxx/Documents/mytmp/logs

# root logger
#log4j.rootLogger=INFO, Console,File,RollingFile,DailyRollingFile
log4j.rootLogger=INFO, Console

## console log
log4j.appender.Console=org.apache.log4j.ConsoleAppender
log4j.appender.Console.Threshold=INFO
log4j.appender.Console.layout=org.apache.log4j.PatternLayout
log4j.appender.Console.layout.ConversionPattern=[%d] [%-3r] [%t,%x] [%-5p] %l - %m%n


## file log
log4j.appender.File=org.apache.log4j.FileAppender
log4j.appender.File.Threshold=ERROR
log4j.appender.File.layout=org.apache.log4j.PatternLayout
log4j.appender.File.layout.ConversionPattern=[%d] [%-3r] [%t,%x] [%-5p] %l - %m%n
log4j.appender.File.file=${logpath}/${project}.log
log4j.appender.File.encoding=UTF-8

## rolling file log / large log
log4j.appender.RollingFile=org.apache.log4j.RollingFileAppender
log4j.appender.RollingFile.Threshold=INFO
log4j.appender.RollingFile.layout=org.apache.log4j.PatternLayout
log4j.appender.RollingFile.layout.ConversionPattern=[%d] [%-3r] [%t,%x] [%-5p] %l - %m%n
log4j.appender.RollingFile.file=${logpath}/${project}.log
log4j.appender.RollingFile.encoding=UTF-8
log4j.appender.RollingFile.MaxFileSize=500MB
log4j.appender.RollingFile.MaxBackupIndex=10

## daily rolling file log / small log
log4j.appender.DailyRollingFile=org.apache.log4j.RollingFileAppender
log4j.appender.DailyRollingFile.Threshold=INFO
log4j.appender.DailyRollingFile.layout=org.apache.log4j.PatternLayout
log4j.appender.DailyRollingFile.layout.ConversionPattern=[%d] [%-3r] [%t,%x] [%-5p] %l - %m%n
log4j.appender.DailyRollingFile.file=${logpath}/${project}.log
log4j.appender.DailyRollingFile.encoding=UTF-8

## jdbc log
log4j.appender.JDBC01=org.apache.log4j.jdbc.JDBCAppender
log4j.appender.JDBC01.Threshold=INFO
log4j.appender.JDBC01.layout=org.apache.log4j.PatternLayout
log4j.appender.JDBC01.driver=com.mysql.jdbc.Driver
log4j.appender.JDBC01.url=jdbc:mysql://192.168.1.96:3306/test?useUnicode=true&characterEncoding=UTF-8
log4j.appender.JDBC01.user=zhangqingli
log4j.appender.JDBC01.password=qweasd
log4j.appender.JDBC01.sql=INSERT INTO T_LOG VALUES('%x','%d','%C','%p','%m')


# %m  the logger.info msg
# %p  DEBUG INFO WARN ERROR FATAL
# %r  time from app starting milliseconds 
# %c  log's location class
# %t  log's thread name
# %n  enter char
# %d  log's date and time
# %l  log's location class, thread name and the line number in code
# CREATE TABLE IF NOT EXISTS T_LOG(
#	USER_ID VARCHAR(20) NOT NULL,
#	DATED   DATE NOT NULL,
#	LOGGER  VARCHAR(50) NOT NULL,
#	LEVEL   VARCHAR(10) NOT NULL,
#	MESSAGE VARCHAR(1000) NOT NULL
# );
```
<br>


### 日志功能的自定义配置文件

如果不使用spring boot默认的日志设置，也可以定义自己的日志配置文件（日志配置文件放在类路径下）：

* Logback:  `logback-spring.xml`，logback-spring.groovy，logback.xml，logback.groovy
* Log4j2:  `log4j2-spring.xml`，log4j2.xml
* JUL:  logging.properties

推荐使用带spring扩展名的日志配置文件，例如对于 logback：

* logback.xml 直接就被日志实现框架识别了，绕过了spring boot；

* logback-spring.xml 日志框架不能直接加载该日志配置文件，需要由spring boot加载，这样可以用到高级特性 `springProfile`标签，只激活某个环境下的输出日志设置：

  ``` xml
  <springProfile name="staging">
  	<!-- configuration to be enabled when the "staging" profile is active -->
  </springProfile>

  <springProfile name="dev | staging">
  	<!-- configuration to be enabled when the "dev" or "staging" profiles are active -->
  </springProfile>

  <springProfile name="!production">
  	<!-- configuration to be enabled when the "production" profile is not active -->
  </springProfile>
  ```

【注】：logback-spring.xml 日志设置参考：

``` xml
<?xml version="1.0" encoding="UTF-8"?>
<!--
scan：当此属性设置为true时，配置文件如果发生改变，将会被重新加载，默认值为true。
scanPeriod：设置监测配置文件是否有修改的时间间隔，如果没有给出时间单位，默认单位是毫秒。当scan为true时，此属性生效。默认的时间间隔为1分钟。
debug：当此属性设置为true时，将打印出logback内部日志信息，实时查看logback运行状态。默认值为false。
-->
<configuration scan="false" scanPeriod="60 seconds" debug="false">
    <!-- 定义日志的根目录 -->
    <property name="LOG_HOME" value="/Users/zhangqingli/Documents/mytmp/logs" />
    <!-- 定义日志文件名称 -->
    <property name="appName" value="zdemo-springboot04"></property>
    <!-- ch.qos.logback.core.ConsoleAppender 表示控制台输出 -->
    <appender name="stdout" class="ch.qos.logback.core.ConsoleAppender">
        <!--
        日志输出格式：
			%d表示日期时间，
			%thread表示线程名，
			%-5level：级别从左显示5个字符宽度
			%logger{50} 表示logger名字最长50个字符，否则按照句点分割。
			%msg：日志消息，
			%n是换行符
        -->
        <layout class="ch.qos.logback.classic.PatternLayout">
            <pattern>%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{50} - %msg%n</pattern>
        </layout>
    </appender>

    <!-- 滚动记录文件，先将日志记录到指定文件，当符合某个条件时，将日志记录到其他文件 -->
    <appender name="appLogAppender" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <!-- 指定日志文件的名称 -->
        <file>${LOG_HOME}/${appName}.log</file>
        <!--
        当发生滚动时，决定 RollingFileAppender 的行为，涉及文件移动和重命名
        TimeBasedRollingPolicy： 最常用的滚动策略，它根据时间来制定滚动策略，既负责滚动也负责触发滚动。
        -->
        <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
            <!--
            滚动时产生的文件的存放位置及文件名称 %d{yyyy-MM-dd}：按天进行日志滚动
            %i：当文件大小超过maxFileSize时，按照i进行文件滚动
            -->
            <fileNamePattern>${LOG_HOME}/${appName}-%d{yyyy-MM-dd}-%i.log</fileNamePattern>
            <!--
            可选节点，控制保留的归档文件的最大数量，超出数量就删除旧文件。
            假设设置每天滚动，且maxHistory是365，则只保存最近365天的文件，删除之前的旧文件。注意，删除旧文件时，那些为了归档而创建的目录也会被删除。
            -->
            <MaxHistory>365</MaxHistory>
            <!--
            当日志文件超过maxFileSize指定的大小时，根据上面提到的%i进行日志文件滚动。
            注意此处配置SizeBasedTriggeringPolicy是无法实现按文件大小进行滚动的，必须配置timeBasedFileNamingAndTriggeringPolicy
            -->
            <timeBasedFileNamingAndTriggeringPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedFNATP">
                <maxFileSize>100MB</maxFileSize>
            </timeBasedFileNamingAndTriggeringPolicy>
        </rollingPolicy>
        <!-- 日志输出格式： -->
        <layout class="ch.qos.logback.classic.PatternLayout">
            <pattern>%d{yyyy-MM-dd HH:mm:ss.SSS} [ %thread ] - [ %-5level ] [ %logger{50} : %line ] - %msg%n</pattern>
        </layout>
    </appender>

    <!--
		logger主要用于存放日志对象，也可以定义日志类型、级别
		    name：表示匹配的logger类型前缀，也就是包的前半部分
		    level：要记录的日志级别，包括 TRACE < DEBUG < INFO < WARN < ERROR
		    additivity：作用在于children-logger是否使用 rootLogger配置的appender进行输出，
		                false表示只用当前logger的appender-ref，true表示当前logger的appender-ref和rootLogger的appender-ref都有效
    -->
    <!-- hibernate logger -->
    <!-- <logger name="com.keyllo.demo" level="debug" /> -->
    <!-- Spring framework logger -->
    <logger name="org.springframework" level="debug" additivity="false"></logger>

    <!--
    root与logger是父子关系，没有特别定义则默认为root。任何一个类只会和一个logger对应，要么是定义的logger，要么是root，
    判断的关键在于找到这个logger，然后判断这个logger的appender和level。
    -->
    <root level="info">
        <springProfile name="dev">
            <appender-ref ref="stdout" />
        </springProfile>
        <appender-ref ref="appLogAppender" />
    </root>
</configuration>
```