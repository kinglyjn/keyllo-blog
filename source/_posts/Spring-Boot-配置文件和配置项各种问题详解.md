title: Spring Boot 配置文件和配置项各种问题详解
author: kinglyjn
tags:
  - springboot
categories:
  - framework
  - springboot
date: 2019-03-01 16:23:00
---
## spring boot的配置文件

配置文件的作用：就是用来修改spring boot配置的默认值。
<br>


### 配置文件的形式和格式

springboot使用一个全局的配置文件（名字是固定的），有如下两种形式：

<!--more-->

* application.properties
* application.yml
  * 注意 "k: v" 之间必须要有空格，并且以空格的缩进控制层级关系，空格多少无所谓，只要左对齐的一列配置都属于同一层级
  * 值的写法：
    * 字面值：普通的值（数字，字符串，布尔值），注意字符串默认不加引号，如果加了引号，那么单引号和双引号的作用不同，双引号不会转义字符串里面的特殊字符，特殊字符会作为本身想表示的意思（例如 name: "zhangsan\nlisi" 输出 zhangsan换行lisi），单引号会转义特殊字符，特殊字符最终只是一个普通的字符串数据（例如 name: "zhangsan\nlisi"，输出 zhangsan\nlisi）;
    * 对象和map：有两种写法，第一种是使用多行缩进的方式，第二种是行内写法（例如 student: {name: zhangsan,age: 18}）;
    * 数组和set：也有两种写法，第一种是使用多行 "- 值" 表示数组中的一个个元素；第二种是行内写法（例如 pets: [cat, dog, pig]）

application.properties 文件格式

``` prope
server.port: 8080
server.path: /zdemo-springboot-hello
```

application.yml 文件格式

``` yml
server:
    port: 8080
    path: /zdemo-springboot-hello
```
<br>


### 配置文件自定义键值

``` xml
<!--导入配置文件处理器，配置文件进行绑定就会有提示-->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-configuration-processor</artifactId>
  <optional>true</optional>
</dependency>
```

``` yml
server:
  port: 8081

person:
  lastName: zhangsan #键也可以是last-name，但是只有使用ConfigurationProperties才能转换为驼峰命名
  age: 18
  boss: false
  birth: 2019/01/01
  map: {k1: v1, k2: v2}
  list:
    - lisi
    - wangwu
  dog:
    name: xiaohei
    age: 2
```

``` java
package com.keyllo.demo.bean;
/**
 * 将配置文件中配置的每一个属性的值，映射到这个组件中
 * @ConfigurationProperties 告诉spring boot将本类中所有的属性和配置文件中相关的配置进行绑定
 * 只有组件是容器中的组件，才能使用容器中的功能，使用 @Component注解 将其加入到容器中
 */
@Component
// 问题：实际上把所有的配置卸载全局配置中也不合适
@ConfigurationProperties(prefix = "person") 
// 这个注解可解决上面的问题，提取部分配置，注意不支持 yml文件，只支持properties文件
//@PropertySource(value = {"classpath:person.properties"}) 
public class Person {
    private String lastName;
    private Integer age;
    private Boolean boss;
    private Date birth;

    private Map<String,Object> map;
    private List<Object> list;
    private Dog dog;

    // getter & setter 必须要有
    // ... 
  
    @Override
    public String toString() {
        return "Person{" +
                "lastName='" + lastName + '\'' +
                ", age=" + age +
                ", boss=" + boss +
                ", birth=" + birth +
                ", map=" + map +
                ", list=" + list +
                ", dog=" + dog +
                '}';
    }
}

@Component
public class Person2 {
    @Value("${person.last-name}")
    private String lastName;
    @Value("#{11*2}") // 支持SpEL表达式
    private Integer age;
    @Value("true")
    private Boolean boss;

    @Override
    public String toString() {
        return "Person2{" +
                "lastName='" + lastName + '\'' +
                ", age=" + age +
                ", boss=" + boss +
                '}';
    }
}
```

测试单元

``` java
package com.keyllo.demo;
import com.keyllo.demo.bean.Person;
import com.keyllo.demo.bean.Person2;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.junit4.SpringRunner;
/**
 * spring boot的单元测试
 * 可以在测试期间很方便地类似编码一样进行自动注入等容器的功能
 */
@RunWith(SpringRunner.class)  //这个单元测试使用spring的驱动器来跑，而不是用原来的junit
@SpringBootTest               //注解说明这是一个spring boot的单元测试
public class ZdemoSpringboot01HelloworldQuickApplicationTests {
	@Autowired
	private Person person;
	@Autowired
	private Person2 person2;

	@Test
	public void testxx() {
		System.out.println(person);
		System.out.println(person2);
	}
}
```
<br>

### @Value和@ConfigurationProperties 注解的区别

|                      | @ConfigurationProperties | @Value        |
| -------------------- | ------------------------ | ------------- |
| 功能                   | 批量注入配置文件中的属性             | 一个个绑定配置文件中的属性 |
| 松散语法（键xx-yy等价于 xxYy） | 支持                       | 不支持           |
| SpEl                 | 不支持                      | 支持            |
| JSR303数据校验           | 支持                       | 不支持           |

* 配置文件是yml或properties他们都能够获取到值
* 如果说只是在某个业务逻辑中需要获取一下配置文件中的某项值，采用 @Value

<br>


### @PropertySource 和 @ImportResource注解的使用

#### 使用@PropertySource加载指定配置文件

注意目前 @PropertySource 目前不支持 yml文件，所以如果使用@PropertySource加载指定配置文件，那么只能使用 properties文件。

``` java
@Component
@ConfigurationProperties(prefix = "person")
@PropertySource(value = {"classpath:person.properties"})
public class Person {
    private String lastName;
    private Integer age;
    private Boolean boss;
    private Date birth;

    private Map<String,Object> map;
    private List<Object> list;
    private Dog dog;

    // getter & setter 必须要有
    // ... 
}
```

resources/person.properties

``` yml
person.last-name=zhang\nsan
person.department=yan\\nfa\\nbu
person.age=23
person.birhtday=2019/01/01 12:12:12
person.boss=true
person.map.k1=v1
person.map.k2=v2
person.list[0]=0
person.list[1]=1
person.list[2]=2
person.dog.name=xiaohei
person.dog.age=${random.int[10,20]}
```
<br>

#### 使用@ImportResource导入spring原始的xml配置文件

方式一（xml方式）：

``` java
// 在主类上加@ImportResource注解
@ImportResource(locations = {"classpath:beans.xml"})
@SpringBootApplication
public class ZdemoSpringboot01HelloworldQuickApplication {
	public static void main(String[] args) {
		SpringApplication.run(ZdemoSpringboot01HelloworldQuickApplication.class, args);
	}
}
```

``` xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans.xsd">
    <bean id="helloService" class="com.keyllo.demo.service.HelloService"></bean>
</beans>
```

``` java
// 测试单元
@RunWith(SpringRunner.class)  
@SpringBootTest
public class ZdemoSpringboot01HelloworldQuickApplicationTests {
	@Autowired
	private ApplicationContext ioc;

	@Test
	public void helloService() {
		boolean b = ioc.containsBean("helloService");
		System.out.println(b); // true
	}
}
```

方式二（使用spring boot推荐的全注解代替xml的方式）：

``` java
package com.keyllo.demo.config;
import com.keyllo.demo.service.HelloService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
/**
 * 指定当前类是一个配置类
 */
@Configuration
public class MyAppConfig {
    /**
     * 1.将方法的返回值返回到容器中
     * 2.容器中这个组件的默认id就是方法名
     */
    @Bean
    public HelloService helloService() {
        System.out.println("给容器中添加helloService组件！");
        return new HelloService();
    }
}

// 测试单元同上
// 略
```
<br>


### 配置文件中的占位符

1) 随机数

${random.value}、${random.int}、${random.long}、${ramdom.int(10)}、${random.int[1024,65536]}

2) 占位符获取之前配置的值，如果没有可以使用“:”指定默认值

``` properties
person.last-name=张三${random.uuid}
person.age=${random.int}
person.birth=2019/01/01
person.boss=false
person.map.k1=v1
person.map.k2=v2
person.list=a,b,c
person.dog.name=${person.hello:hello}_dog
person.dog.age=15
```
<br>


##  profile环境

### 可配置不同环境的多个profile文件

我们在主配置文件编写的时候，文件名可以是 application-{profile}.properties/yml，默认使用的是application.properties中的配置。

<br>

### 激活指定的profile

* 方式一：在不同文档中配置各自环境，在主配置文件中指定 spring.profiles.active=${profile}的方式。

* 方式二：在一个文档中配置多个环境（使用多文档块的方式）

* 方式三：命令行激活的方式

  ``` bash
  # 命令行 idea: program arguments
  $ java -jar xxx.jar --spring.profiles.active=dev
  # JVM参数 vm options
  $ java -Dspring.profiles.active=dev -jar xxx.jar 
  ```
<br>


### yml支持多文档块方式

application.yml

``` yml
spring:
  profiles:
    active: test
server:
  port: 8080

---
spring:
  profiles: dev
server:
  port: 8081

---
spring:
  profiles: test
server:
  port: 8082
```
<br>


## 配置文件的加载位置

### 核心配置文件的加载

spring boot启动会扫描如下位置的application.properties或者application.yml文件作为springboot的默认配置文件。

* -project-root-path: ./config/
* -project-root-path: ./
* -classpath: ./config/
* -classpath: ./

![图一](/images/pasted-28.png)

优先级从上到下依次降低，高优先级的配置会覆盖低优先级的配置；注意打包的时候只会打包类路径下的文件；

SpringBoot会从这四个位置全部加载主配置文件，形成 **互补配置**；

我们还可以通过 `spring.config.location` 来改变默认配置文件的位置。具体的做法是在项目打包好之后，我们可以使用命令行参数的形式，启动项目的时候来指定配置文件的新位置，指定的配置文件和默认加载的这些配置文件共同起作用形成互补配置。

``` bash
$ java -jar zdemo-springboot01.jar --spring.config.location=~/Desktop/application.properties
```
<br>


### 外部配置文件和参数的加载

spring boot以下位置加载配置；优先级从高到低；高优先级会覆盖低优先级的配置；所有配置会形成互补配置。

1. 命令行参数（多个配置用空格分开；--配置项=值）

   ``` bash
   $ java -jar xxx.jar --server.port=8087 --server.servlet.context-path=/abc
   ```

2. 来自java:comp/env的JNDI属性

3. java系统属性（System.getProperty("xxx")）

4. 操作系统环境变量

5. RandomValuePropertySource配置的random.*属性值

6. jar包`外`的application-{profile}.properties/yml（`带spring.profiles=xxx`）配置文件

7. jar包`内`的application-{profile}.properties/yml（`带spring.profiles=xxx`）配置文件

8. jar包`外`的application-{profile}.properties/yml（`不带spring.profiles=xxx`）配置文件

9. jar包`内`的application-{profile}.properties/yml（`不带spring.profiles=xxx`）配置文件

10. @Configuration注解类上的@PropertySource

11. 通过SpringApplication.setDefaultProperties指定的默认属性

<br>