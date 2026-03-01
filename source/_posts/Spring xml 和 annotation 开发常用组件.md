title: Spring xml 和 annotation 开发常用组件

author: kinglyjn

tags:

  - spring

categories:

  - java
  - springx

date: 2018-12-16 10:23:41

---



## xml 开发



### 基本形式的注入

基本的注入包括常见的基本数据类型及其包装类型、数组、列表、键值对，引用数据类型。

<!--more-->

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans.xsd">
    
    <bean id="user" class="com.demo.entity.User">
        <property name="id" value="1"/>
        <property name="name" value="张三"/>
        <property name="tags">
            <array>
                <value>IT</value>
                <value>dev</value>
                <value>linux</value>
            </array>
        </property>
        <property name="dept" ref="dept"/>
        <property name="roles">
            <list>
                <ref bean="role1"/>
                <ref bean="role2"/>
            </list>
        </property>
        <property name="attrs">
            <map>
                <entry key="position" value="dev"/>
                <entry key="address">
                    <bean class="com.demo.entity.Address">
                        <property name="desc" value="BJ"/>
                        <property name="geo">
                            <array>
                                <value>117.4</value>
                                <value>39.4</value>
                            </array>
                        </property>
                    </bean>
                </entry>
            </map>
        </property>
    </bean>

    <bean id="dept" class="com.demo.entity.Dept">
        <property name="id" value="1"/>
        <property name="name" value="研发"/>
    </bean>

    <bean id="role1" class="com.demo.entity.Role">
        <property name="id" value="1"/>
        <property name="name" value="admin"/>
    </bean>
    <bean id="role2" class="com.demo.entity.Role">
        <property name="id" value="2"/>
        <property name="name" value="common"/>
    </bean>
</beans>
```

<br>

### 引入utils 命名空间简化配置

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:util="http://www.springframework.org/schema/util"
       xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans.xsd
       http://www.springframework.org/schema/util http://www.springframework.org/schema/util/spring-util.xsd">

    <bean id="user" class="com.demo.entity.User">
        <property name="id" value="1"/>
        <property name="name" value="张三"/>
        <property name="tags" ref="tags"/>
        <property name="dept" ref="dept"/>
        <property name="roles" ref="roles"/>
        <property name="attrs" ref="myAttrs"/>
    </bean>

    <util:list id="tags">
        <value>IT</value>
        <value>dev</value>
        <value>linux</value>
    </util:list>
    <util:list id="roles">
        <bean id="role1" class="com.demo.entity.Role">
            <property name="id" value="1"/>
            <property name="name" value="admin"/>
        </bean>
        <bean id="role2" class="com.demo.entity.Role">
            <property name="id" value="2"/>
            <property name="name" value="common"/>
        </bean>
        <!--<ref bean="xxx"/>-->
    </util:list>
    <util:map id="myAttrs">
        <entry key="position" value="dev"/>
        <entry key="address">
            <bean class="com.demo.entity.Address">
                <property name="desc" value="BJ"/>
                <property name="geo">
                    <array>
                        <value>117.4</value>
                        <value>39.4</value>
                    </array>
                </property>
            </bean>
        </entry>
    </util:map>

    <bean id="dept" class="com.demo.entity.Dept">
        <property name="id" value="1"/>
        <property name="name" value="研发"/>
    </bean>
</beans>
```

<br>



### 引入p命名空间

主要的作用是简化setter注入的配置：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:util="http://www.springframework.org/schema/util" xmlns:p="http://www.springframework.org/schema/p"
       xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans.xsd
       http://www.springframework.org/schema/util http://www.springframework.org/schema/util/spring-util.xsd">

    <bean id="user" class="com.demo.entity.User" p:id="1" p:name="张三" p:tags-ref="tags" p:roles-ref="roles" p:attrs-ref="myAttrs">
        <property name="dept">
            <bean class="com.demo.entity.Dept">
                <property name="id" value="1"/>
                <property name="name" value="研发"/>
            </bean>
        </property>
    </bean>

    <util:list id="tags">
        <value>IT</value>
        <value>dev</value>
        <value>linux</value>
    </util:list>
    <util:list id="roles">
        <bean id="role1" class="com.demo.entity.Role">
            <property name="id" value="1"/>
            <property name="name" value="admin"/>
        </bean>
        <bean id="role2" class="com.demo.entity.Role">
            <property name="id" value="2"/>
            <property name="name" value="common"/>
        </bean>
    </util:list>
    <util:map id="myAttrs">
        <entry key="position" value="dev"/>
        <entry key="address">
            <bean class="com.demo.entity.Address">
                <property name="desc" value="BJ"/>
                <property name="geo">
                    <array>
                        <value>117.4</value>
                        <value>39.4</value>
                    </array>
                </property>
            </bean>
        </entry>
    </util:map>
</beans>
```

<br>



### 引入c命名空间

主要的作用是简化构造方法的注入。

普通的构造方法注入：

```xml
<bean id="user" class="com.demo.entity.User">
    <constructor-arg name="id" value="1"/>
    <constructor-arg name="name" value="张三"/>
    <constructor-arg name="dept" ref="dept"/>
</bean>
```

引入c命名空间：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:util="http://www.springframework.org/schema/util" xmlns:p="http://www.springframework.org/schema/p"
       xmlns:c="http://www.springframework.org/schema/c"
       xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans.xsd
       http://www.springframework.org/schema/util http://www.springframework.org/schema/util/spring-util.xsd">

    <bean id="user" class="com.demo.entity.User" c:id="1" c:name="张三"/>
</beans>
```

<br>



### 多xml文件管理

bean.xml

```xml
<bean id="user" class="com.demo.entity.User">
    <constructor-arg name="name" value="张三"/>
    <constructor-arg name="dept" ref="dept"/>
</bean>
<import resource="bean-ref.xml"/>
```

bean-ref.xml

```xml
<bean id="dept" class="com.demo.entity.Dept">
    <property name="id" value="1"/>
    <property name="name" value="研发"/>
</bean>
```

<br>



### 设置 init 和 destroy 方法

```xml
<bean id="user" class="com.demo.entity.User" init-method="myInit" destroy-method="myDestroy" scope="singleton"
      p:tags-ref="tags" p:roles-ref="roles" p:attrs-ref="myAttrs">
    <constructor-arg name="id" value="1"/>
    <constructor-arg name="name" value="张三"/>
    <constructor-arg name="dept" ref="dept"/>
</bean>
```

执行顺序：

1. constructor 创建对象
2. setter 注入
3. bean 后置处理器（初始化之前）👈
4. bean 对象初始化（调用指定的初始化方法，即上面我们指定的 <u>myInit</u>）
5. bean 后置处理器（初始化之后）👈
6. 对象创建完成的，待使用
7. 对象销毁（调用指定的销毁方法，即上面我们配置的 <u>myDestroy</u>）
8. IoC容器关闭

<br>



### 设置全局后置处理器

典型的应用场景：

* 面向切面 AOP 动态代理与字节码增强
* 处理实现了特定标记接口的 Bean，例如为实现  ApplicationContextAware 的 bean 设置上下文
* 面向开发自定义扩展点

```java
/**
 * @author KJ
 * @description 全局后置处理器处理器
 */
public class MyPostProcessor implements BeanPostProcessor {

    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) throws BeansException {
        System.out.println("postProcessBeforeInitialization..." + beanName);
        return BeanPostProcessor.super.postProcessBeforeInitialization(bean, beanName);
    }

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
        System.out.println("postProcessAfterInitialization..." + beanName);
        return BeanPostProcessor.super.postProcessAfterInitialization(bean, beanName);
    }
}
```

```xml
<bean id="myPostProcessor" class="com.demo.entity.MyPostProcessor"/>
```

<br>



### FactoryBean形式的Bean

FactoryBean 是 spring 提供的一种整合第三方框架的常用机制。和普通的 bean 不同，配置一个 FactoryBean 形式的 bean，在获取 bean 的时候得到的并不是 class 属性中配置的这个类的对象 ，而是一个 getObject 方法的返回值。通过这种机制，spring 可以帮我们把复杂组件创建的详细过程和繁琐的细节都屏蔽起来，只把最简单的使用界面展示给我们。下面我以 mybatis 为例进行展示：

引入依赖：

```xml
<dependency>
  <groupId>org.springframework</groupId>
  <artifactId>spring-context</artifactId>
</dependency>
<dependency>
  <groupId>org.springframework</groupId>
  <artifactId>spring-jdbc</artifactId>
</dependency>

<dependency>
  <groupId>org.junit.jupiter</groupId>
  <artifactId>junit-jupiter</artifactId>
  <scope>test</scope>
</dependency>
<dependency>
  <groupId>org.springframework</groupId>
  <artifactId>spring-test</artifactId>
  <scope>test</scope>
</dependency>

<dependency>
  <groupId>org.mybatis</groupId>
  <artifactId>mybatis</artifactId>
  <version>3.5.19</version>
</dependency>
<dependency>
  <groupId>org.mybatis</groupId>
  <artifactId>mybatis-spring</artifactId>
  <version>4.0.0</version>
</dependency>
<dependency>
  <groupId>com.mysql</groupId>
  <artifactId>mysql-connector-j</artifactId>
  <version>9.5.0</version>
</dependency>
<dependency>
  <groupId>com.alibaba</groupId>
  <artifactId>druid</artifactId>
  <version>1.2.27</version>
</dependency>
```

applicationContext.xml

```xml
<!--SqlSessionFactory-->
<bean id="sqlSessionFactory" class="org.mybatis.spring.SqlSessionFactoryBean">
    <property name="dataSource" ref="dataSource" />
    <property name="configLocation" value="classpath:mybatis/mybatis-config.xml" />
    <property name="mapperLocations" value="classpath:mybatis/mapper/*.xml" />
    <property name="typeAliasesPackage" value="com.demo.factorybean.entity" />
</bean>

<bean class="org.mybatis.spring.mapper.MapperScannerConfigurer">
    <property name="basePackage" value="com.demo.factorybean.dao" />
    <property name="sqlSessionFactoryBeanName" value="sqlSessionFactory" />
</bean>

<!--数据源-->
<bean id="dataSource" class="com.alibaba.druid.pool.DruidDataSource" init-method="init" destroy-method="close">
    <property name="driverClassName" value="com.mysql.cj.jdbc.Driver" />
    <property name="url" value="jdbc:mysql://xxx:3306/zdemo" />
    <property name="username" value="xxx" />
    <property name="password" value="xxx" />
</bean>

<!--事务管理器-->
<bean id="transactionManager" class="org.springframework.jdbc.datasource.DataSourceTransactionManager">
    <property name="dataSource" ref="dataSource" />
</bean>
<tx:annotation-driven transaction-manager="transactionManager"/>
```

mybatis-config.xml

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE configuration
        PUBLIC "-//mybatis.org//DTD Config 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-config.dtd">
<configuration>
    <settings>
        <setting name="mapUnderscoreToCamelCase" value="true"/>
        <setting name="logImpl" value="STDOUT_LOGGING"/>
    </settings>
</configuration>
```

UserMapper.xml

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE mapper
        PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-mapper.dtd">

<mapper namespace="com.demo.factorybean.dao.UserMapper">
    <select id="findById" parameterType="long" resultType="com.demo.factorybean.entity.User">
        SELECT id, username FROM zdemo01_user WHERE id = #{id}
    </select>
</mapper>
```

UserMapper

```java
public interface UserMapper {
  
    @Select("select * from zdemo01_user order by id desc")
    List<User> findAll();

    User findById(@Param("id") Long id);
}
```

测试类：

```java
@SpringJUnitConfig(locations = "classpath:applicationContext.xml") // 整合了 ExtendWith 和 ContextConfiguration
@Transactional // 测试完成后自动回滚，数据库不会留下脏数据
public class BeanFactoryTest {

    @Autowired
    private UserMapper userMapper;

    @Test
    @Rollback(true) // 显式声明回滚
    public void test01() {
        List<User> users = userMapper.findAll();
        System.out.println(users);
        User user = userMapper.findById(1L);
        System.out.println(user);
    }
}


// 或者直接
@Test
public void test01() {
    ApplicationContext context = new ClassPathXmlApplicationContext("applicationContext.xml");
    UserMapper userMapper = context.getBean(UserMapper.class);
    List<User> users = userMapper.findAll();
    System.out.println(users);
    User user = userMapper.findById(1L);
    System.out.println(user);
}
```

<br>



### 自己实现一个 FactoryBean

MyUserFactoryBean：

```java
/**
 * @author KJ
 * @description 自定义一个 FactoryBean
 */
public class MyUserFactoryBean implements FactoryBean<User> {
    @Override
    public User getObject() throws Exception {
        return new User(1L, "张三");
    }

    @Override
    public Class<?> getObjectType() {
        return User.class;
    }

    @Override
    public boolean isSingleton() {
        return FactoryBean.super.isSingleton(); // 默认为 true
    }
}
```

```xml
<bean id="user" class="com.demo.factorybean.my.MyUserFactoryBean"/>
```

测试类：

```java
@Test
public void test01() {
    ApplicationContext context = new ClassPathXmlApplicationContext("my-factory-bean.xml");
    Object user = context.getBean("user");
    System.out.println(user.getClass());
    System.out.println(user);
}
```

测试结果：

```
class com.demo.entity.User
User(id=1, name=张三, tags=null, dept=null, roles=null, attrs=null)
```

<br>

### 引入外部属性文件

jdbc.properties

```properties
jdbc.driverClassName=com.mysql.cj.jdbc.Driver
jdbc.url=jdbc:mysql://xxx:3306/zdemo
jdbc.username=xxx
jdbc.password=xxx
```

applicationContext.xml

```xml
<!--引入外部属性文件-->
<context:property-placeholder location="jdbc.properties"/>

<!--数据源-->
<bean id="dataSource" class="com.alibaba.druid.pool.DruidDataSource" init-method="init" destroy-method="close">
  <property name="driverClassName" value="${jdbc.driverClassName}" />
  <property name="url" value="${jdbc.url}" />
  <property name="username" value="${jdbc.username}" />
  <property name="password" value="${jdbc.password}" />
</bean>
```

或者使用 yml格式。在原生 Spring 框架中，默认主要支持 properties 格式的文件。如果你想直接引入 yml  文件，Spring 并没有内置直接支持 YAML 的 XML 标签，需要依赖额外的库 如 SnakeYAML。加入依赖：

```xml
<dependency>
  <groupId>org.yaml</groupId>
  <artifactId>snakeyaml</artifactId>
  <version>2.0</version>
</dependency>
```

jdbc.yml

```yaml
jdbc:
  driverClassName: com.mysql.cj.jdbc.Driver
  url: jdbc:mysql://xxx:3306/zdemo
  username: xxx
  password: xxx
```

applicationContext.xml

```xml
<!--引入外部属性文件-->
<bean id="yamlProperties" class="org.springframework.beans.factory.config.YamlPropertiesFactoryBean">
    <property name="resources">
        <list>
            <value>classpath:jdbc.yml</value>
        </list>
    </property>
</bean>
<bean class="org.springframework.context.support.PropertySourcesPlaceholderConfigurer">
    <property name="properties" ref="yamlProperties"/>
</bean>

<!--使用外部属性（这种yml形式的外部属性，IDE高亮支持可能不是很友好）-->
<bean id="dataSource" class="com.alibaba.druid.pool.DruidDataSource" init-method="init" destroy-method="close">
  <property name="driverClassName" value="${jdbc.driverClassName}" />
  <property name="url" value="${jdbc.url}" />
  <property name="username" value="${jdbc.username}" />
  <property name="password" value="${jdbc.password}" />
</bean>
```

<br>



## 注解开发

### 原来不彻底的注解开发

在早期的 structs 或 springmvc 时代，开发中可能还需要以下几行xml配置：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:context="http://www.springframework.org/schema/context"
       xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans.xsd http://www.springframework.org/schema/context https://www.springframework.org/schema/context/spring-context.xsd">
    
    <!--配置扫描组件包-->
    <context:component-scan base-package="com.demo"/>
</beans>
```

或者，以前在 Spring MVC 项目中，通常会配置两个容器：父容器（applicationContext.xml）和子容器（spring-mvc.xml）。父容器负责扫描 Service、Repository 等组件，而子容器只扫描 Controller。通过 `` 和 `` 可以避免组件被重复扫描和覆盖。

父容器 applicationContext.xml 配置：

```xml
<!-- 扫描除了 @Controller 以外的所有组件 -->
<context:component-scan base-package="com.demo">
    <!-- 排除 Controller 组件，避免在父容器中创建 Controller 实例 -->
    <context:exclude-filter type="annotation" expression="org.springframework.stereotype.Controller"/>
</context:component-scan>
```

子容器 spring-mvc.xml 配置：

```xml
<!-- 只扫描Controller组件 -->
<context:component-scan base-package="com.example" use-default-filters="false">
  <!-- 只包含Controller组件 -->
  <context:include-filter type="annotation" expression="org.springframework.stereotype.Controller"/>
</context:component-scan>
    
<!-- 启用Spring MVC注解驱动 -->
<mvc:annotation-driven />
    
<!-- 视图解析器配置 -->
<bean class="org.springframework.web.servlet.view.InternalResourceViewResolver">
  <property name="prefix" value="/WEB-INF/views/" />
  <property name="suffix" value=".jsp" />
</bean>
```

‌web.xml 配置：将父子容器整合在一起的配置文件。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<web-app xmlns="http://xmlns.jcp.org/xml/ns/javaee"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://xmlns.jcp.org/xml/ns/javaee 
                             http://xmlns.jcp.org/xml/ns/javaee/web-app_3_1.xsd"
         version="3.1">

    <!-- 配置父容器监听器 -->
    <listener>
        <listener-class>org.springframework.web.context.ContextLoaderListener</listener-class>
    </listener>
    
    <!-- 指定父容器配置文件位置 -->
    <context-param>
        <param-name>contextConfigLocation</param-name>
        <param-value>classpath:applicationContext.xml</param-value>
    </context-param>
    
    <!-- 配置DispatcherServlet作为子容器 -->
    <servlet>
        <servlet-name>dispatcher</servlet-name>
        <servlet-class>org.springframework.web.servlet.DispatcherServlet</servlet-class>
        <init-param>
            <param-name>contextConfigLocation</param-name>
            <param-value>classpath:spring-mvc.xml</param-value>
        </init-param>
        <load-on-startup>1</load-on-startup>
    </servlet>
    
    <servlet-mapping>
        <servlet-name>dispatcher</servlet-name>
        <url-pattern>/</url-pattern>
    </servlet-mapping>  
</web-app>
```

演示Demo和测试方法：

```java
@Repository
public class UserDao {}

@Test
public void test01() {
    ApplicationContext context = new ClassPathXmlApplicationContext("applicationContext.xml");
    UserDao userDao = context.getBean("userDao", UserDao.class);
    System.out.println(userDao);
}
```

<br>



### 彻底的注解式开发

引入配置类：

```java
/**
 * @author KJ
 * @description
 */
@Configuration
@ComponentScan({"com.demo"})
public class MyConfig {
}
```

演示Demo和测试方法：

```java
@Test
public void test01() {
    AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext(MyConfig.class);
    UserDao userDao = context.getBean(UserDao.class);
    System.out.println(userDao);
}
```

<br>



### 常用的注解有哪些

**组件注解**

这些注解用于标记类为 Spring 管理的组件，根据不同的层次进行分类：

- ‌**@Component**‌：通用组件注解，用于标记一个类为 Spring 组件，是最基础的注解。
- ‌**@Service**‌：用于标记业务逻辑层组件，是 @Component 的特化注解，语义更明确。
- ‌**@Repository**‌：用于标记数据访问层组件（DAO 层），也是 @Component 的特化注解，通常用于处理数据库异常转换。
- ‌**@Controller**‌：用于标记控制层组件（Web 层），是 @Component 的特化注解，用于处理 Web 请求。
- ‌**@RestController**‌：是 @Controller 和 @ResponseBody 的组合注解，用于构建 RESTful Web 服务，返回的数据会自动序列化为 JSON 或 XML。‌



**配置类注解**‌

用于定义配置类和管理 Bean：

- ‌**@Configuration**‌：用于标记一个类为配置类，替代 XML 配置文件，可以使用 @Bean 注解定义 Bean。
- ‌**@Bean**‌：用于方法上，表示该方法的返回值将被注册为一个 Bean，由 Spring 容器管理。
- ‌**@ComponentScan**‌：用于指定 Spring 容器扫描组件的包路径，启用组件扫描功能。



**依赖注入注解**

用于实现自动装配和依赖注入：

- ‌**@Autowired**‌：用于自动装配 Bean，可以标注在字段、构造函数或方法上，Spring 会自动注入匹配类型的 Bean。
- ‌**@Qualifier**‌：与 @Autowired 配合使用，用于指定注入 Bean 的名称，解决多个相同类型 Bean 时的歧义问题。
- ‌**@Resource**‌：由 JSR-250 提供，按名称匹配注入 Bean，与 @Autowired 功能类似。
- ‌**@Inject**‌：由 JSR-330 提供，与 @Autowired 功能相同。



**其他常用注解**

- ‌**@Value**‌：用于注入配置文件中的属性值。
- ‌**@Scope**‌：用于指定 Bean 的作用域，如 singleton（单例）、prototype（原型）等。
- ‌**@PostConstruct**‌：用于标记初始化方法，在 Bean 创建完成后执行。
- ‌**@PreDestroy**‌：用于标记销毁方法，在 Bean 销毁前执行。

这些注解构成了 Spring 框架中组件管理和依赖注入的核心机制，极大地简化了 Spring 应用的开发和配置过程。

<br>



