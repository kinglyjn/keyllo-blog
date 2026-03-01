title: Maven资源文件的打包与过滤
author: kinglyjn
tags:

  - maven
  - devtools
  - ci_di

categories:
  - java
  - devtools

date: 2020-09-22 13:53:19

---



### 默认打包测试

根据 Maven 的默认项目结构，资源文件放置在 src/main/resources 中，测试的资源文件在 src/test/resources 中。放置在 src/main/resources 中的资源文件默认会被打包进 jar 中。

> 注：如果配置文件放置在src/main/resources 下，则默认打包后该配置文件位于jar包的根目录下；
>
> 如果配置文件放置在src/main/resources/aaa 下，则默认打包后该配置文件位于jar包的根目录下的/aaa目录下；
>
> 如果配置文件放置在src/main/resources/META-INF 下，则默认打包后该配置文件位于jar包的根目录下的 /META-INF目录下；



<!--more-->



例如我们有如下的目录结构，其中在 src/main/resources 中有一个资源文件 application.properties 在 META-INF 中：

![image-20201009174334329](/images/image-20201009174334329.png)

我们将上面的项目进行打包，然后将 jar 解压之后我们可以看到如下的目录：

```default
.
├── META-INF
│   ├── MANIFEST.MF
│   ├── application.properties
│   └── maven
│       └── com.keyllo.demo
│           └── zdemo-01
│               ├── pom.properties
│               └── pom.xml
├── com
    └── mycompany
        └── app
            └── App.class

```

如上所示，我们可以发现项目中的 `src/main/resources` 目录中的文件会被打包在项目根目录（META-INF）中。这里多出来的 `pom.properties` 跟 `pom.xml` 是 Maven 在打包的时候默认生成的，当然你可以创建你自己的打包清单。

但有时候，我们的资源文件没有全部放置的 `src/main/resources` 中，比如 Mybatis 的映射文件有时候会直接放置在相关的类包中，`这时候默认的打包就不会将这些映射文件打包进 jar 中`，引用该 jar 的其他项目在使用相关的类就会报错。这时候我们就需要指定需要打包的资源文件。有几种方法，下面我们分别介绍。

<br>



### 使用 resources 标签

<resources> 标签位于 <build> 标签内，用于指定项目资源文件的位置。例如，我们有一个 `A.xml` 文件，我们的项目要求这个文件打包后位于 META-INF/aaa 中，虽然我们可以将其放置在 src/main/resource/META-INF/aaa 中，但我们给了这个文件自己的目录 src/main/aaa ，为了将其正确地打包进 jar 中，我们可以使用如下的配置：

![image-20201010190020939](/images/image-20201010190020939.png)

- directory：源代码资源文件所在的目录
- `filtering`：是否筛选资源以用参数化值替换标记${xxx}。这些值取自`全局properties` 或`环境 properties` 以及 `filters` 元素中列出的属性。
- targetPath：放置资源文件的目录，默认是根路径
- includes：需要包含的资源文件列表
- excludes：需要排除的资源文件列表
- testResources：测试资源文件列表，配置类似 resources

打包后jar包的文件结构：

```default
.
├── META-INF
│   ├── MANIFEST.MF
│   ├── aaa
│   │   └── A.xml
│   ├── application.properties
│   └── maven
│       └── com.keyllo.demo
│           └── zdemo-01
│               ├── pom.properties
│               └── pom.xml
├── com
    └── mycompany
        └── app
            └── App.class
```

<br>



### 使用 resources 插件

`Apache Maven Resources Plugin` 有 3 个 goals，分别是:

* resources:resources
* resources:testResources
* resources:copy-resources

当我们配置 <resources> 标签的时候，resources:resources 目标就会使用到 <resources> 中的配置，如果不配置 <resources> ，我们可以使用 resources:copy-resources 目标，这里我将其绑定在 process-resources 阶段中。

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-resources-plugin</artifactId>
    <version>3.1.0</version>
    <executions>
        <execution>
            <id>my-resources</id>
            <phase>process-resources</phase>
            <goals>
                <goal>copy-resources</goal>
            </goals>
            <configuration>
                <outputDirectory>${project.build.outputDirectory}</outputDirectory>
                <resources>
                    <resource>
                        <directory>src/main/aaa</directory>
                        <filtering>false</filtering>
                        <targetPath>META-INF/aaa</targetPath>
                        <includes>
                            <include>A.xml</include>
                        </includes>
                        <excludes>
                            <exclude>**/*.properties</exclude>
                        </excludes>
                    </resource>
                    <resource>
                        <directory>src/main/resources</directory>
                        <filtering>true</filtering>
                        <includes>
                            <include>**/*.properties</include>
                        </includes>
                    </resource>
                </resources>
            </configuration>
        </execution>
    </executions>
</plugin>
```

注意：这种方式在手动执行测试方法时 resource-filtering 标签不起作用，但是执行maven test任务或maven打包的时候resource-filtering 标签会起作用。

<br>



### 使用 filters 配置外部属性

例如我们有一个属性文件 `src/main/filters/myfilter.properties`

然后，我们需要在 pom.xml 中为这个文件增加一个引用

![image-20201011122209671](/images/image-20201011122209671.png)

<br>

也可以指定这样配置不同的环境参数，根据全局properties参数 或 根据java运行时参数进行配置：

![image-20210930182655620](/images/image-20210930182655620.png)

运行测试：

```bash
$ mvn test -Dprofile=sit -Dtest=Test01#test2

[INFO] --- maven-surefire-plugin:2.12.4:test (default-test) @ zdemo-spring ---
[INFO] Surefire report directory: /Users/zhangqingli/gitrepors/zdev/zdemo-spring/target/surefire-reports

-------------------------------------------------------
 T E S T S
-------------------------------------------------------
Running Test01
jdbc:mysql://xxx:3306/xxx?useUnicode=true&serverTimezone=Hongkong
Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.607 sec

Results :

Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
```





