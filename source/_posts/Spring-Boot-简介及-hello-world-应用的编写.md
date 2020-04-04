title: Spring Boot 简介及 hello world 应用的编写
author: kinglyjn
tags:
  - springboot
categories:
  - framework
  - springboot
date: 2019-02-22 11:45:00
---
## spring boot 简介

* 简化spring应用开发的一个框架
* 整个spring技术栈的一个大整合
* J2EE开发的一站式解决方案

<!--more-->


## 微服务简介

2014, martin fowler

微服务：架构风格

* 一个应用是一组小型服务；
* 通过HTTP的方式进行沟通；
* 每一个功能元素都是一个可独立替换和升级的软件单元；

详细参照 [微服务详细介绍（中文）](http://blog.cuicc.com/blog/2015/07/22/microservices/)，[微服务详细介绍（英文）](https://martinfowler.com/articles/microservices.html)



## spring boot hello world 应用

浏览器发送hello请求，服务器接收并处理请求，响应hello world字符串。参考 [文档](https://spring.io/guides/gs/rest-service/)

1) 创建maven工程

``` xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>2.0.5.RELEASE</version>
    </parent>
    <groupId>com.keyllo.demo</groupId>
    <artifactId>zdemo-springboot01-helloworld</artifactId>
    <version>1.0-SNAPSHOT</version>

    <properties>
        <java.version>1.8</java.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <!--spring boot进行单元测试的模块-->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
```

2) 编写启动类

``` java
package com.keyllo.helloworld;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
* 1. 标注SpringBootApplication的类是应用的主配置类
* 2. 实质上是代表了一组注解：
*     @SpringBootConfiguration 标识这是一个spring boot的配置类，它的再底层是@Configuration注解
*     @EnableAutoConfiguration 开启自动配置功能，以前我们需要配置的东西，springboot自动帮我们配置。
*               它也是代表了一组注解：
*               1. @AutoConfigurationPackage标识自动配置包，底层为@Import({Registrar.class})，
*                  通过在Registrar类相关方法打断点可以发现，这个注解本身的含义是将主配置类所在包下的
*                  所有组件都扫描进去。
*               2. @Import({AutoConfigurationImportSelector.class})，标识自动导入那些组件的
*                  选择器，它会将需要导入的组件以全类名的方式返回；这些组件就会被添加到容器中。最终的
*                  效果是这个注解会给容器中导入非常多的(目前96个)自动配置类(XxxAutoConfiguration)，
*                  即给容器中导入这个场景所需要的所有组件，并配置好这些组件。有了自动配置类，就免去了
*                  我们手动编写配置注入功能组件等的工作。实质上是在启动的时候从类路径 
*                  spring-boot-autoconfigure的META-INF/spring.factories文件中获取
*                  EnableAutoConfiguration指定的值，将这些值作为自动配置类导入到容器中，自动配置类
*                  就生效，帮我们进行自动配置工作。在application.properties/yml 中我们能配置的
*                  springboot的参数都来源于spring-boot-autoconfigure-xxx.jar的XxxProperties
*                 （例如 HttpEncodingProperties）
*     @ComponentScan 
*/ 
@SpringBootApplication //标注一个主程序
public class HelloWorldApplication {
    public static void main(String[] args) {
        SpringApplication.run(HelloWorldApplication.class, args);
    }
}
```

3) 编写相关的Controller、Service

``` java
package com.keyllo.helloworld.controller;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

@Controller
public class HelloController {
    @ResponseBody
    @RequestMapping("/hello")
    public String hello() {
        return "hello world";
    }
}
```

4) 开发环境启动应用

``` bash
# 直接使用 eclipse 或 idea 工具启动主程序类 HelloWorldApplication
$ curl http://localhost:8080/hello
```

5) 部署应用

这个maven插件可以将应用打包成一个可执行的jar包，参考 [文档](https://docs.spring.io/spring-boot/docs/2.1.2.RELEASE/reference/htmlsingle/#howto-create-an-executable-jar-with-maven)

``` xml
<build>
  <plugins>
    <plugin>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-maven-plugin</artifactId>
    </plugin>
  </plugins>
</build>
```

打包部署和运行项目

``` bash
$ mvn clean package -Dmaven.test.skip=true 
$ java -jar zdemo-springboot01-helloworld-1.0-SNAPSHOT.jar 
$ curl http://localhost:8080/hello
```



## hello world 应用探究

1) 父项目

``` xml
<!--
helloworld的父项目
-->
<parent>
   <groupId>org.springframework.boot</groupId>
   <artifactId>spring-boot-starter-parent</artifactId>
   <version>2.0.5.RELEASE</version>
</parent>

<!--
更高的父项目：
spring boot应用 版本仲裁中心
-->
<parent>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-dependencies</artifactId>
  <version>2.0.5.RELEASE</version>
  <relativePath>../../spring-boot-dependencies</relativePath>
</parent>
```

2) 导入的依赖

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-web</artifactId>
</dependency>
```

**spring-boot-starter**-web (spring-boot-starter 称为spring-boot的场景启动器)，这个web启动器帮我们导入了web模块正常运行所依赖的组件。相关启动器参考 [文档](https://docs.spring.io/spring-boot/docs/2.1.2.RELEASE/reference/htmlsingle/#using-boot-starter)。

spring boot将所有的功能场景都抽取了出来，做成了一个个的starter启动器，只需要在项目中引入这些starter相关场景的所有依赖都会导入进来。



## 使用spring initializer快速创建spring boot项目

eclipse和IDEA都支持使用spring的项目创建向导快速创建一个spring boot项目。

选择我们需要的模块；向导会联网创建我们需要的项目；

* 主程序已经编写好了，我们只需要写我们自己的逻辑
* resources文件夹中目录结构是：
  * static：保存所有的静态资源-js、css、img；
  * templates：保存所有的模板页面（spring boot默认jar包使用嵌入式的tomcat，默认不支持jsp页面，但是可以使用模板引擎-freemarker、thymeleaf）；
  * application.properties：springboot应用的配置文件；可以修改很多默认设置；