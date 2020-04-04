title: Spring Boot 常用模板引擎 Thymeleaf
author: kinglyjn
tags:
  - springboot
categories:
  - framework
  - springboot
date: 2019-05-31 19:34:00
---
### Spring Boot 的模板引擎

现在市场上有很多模板引擎，比较典型的有 JSP、Velocity、Freemarker、Thymeleaf。所有模板引擎的思想都是一样的，都是通过组合 `数据` 和 `模板` 来生成 `目标文本`。Spring Boot 推荐的模板引擎是 Thymeleaf，语法简单，功能强大。
<br>

<!--more-->


### 使用Thymeleaf

导入依赖jar包

``` xml
<!-- 对于springboot1.x -->
<properties>
	<!--默认使用thymeleaf2.x，使用thymeleaf3.x需要覆盖默认dependencies版本--> 
	<thymeleaf.version>3.0.2.RELEASE</thymeleaf.version>
  	<!--布局功能的支持程序版本：thymeleaf3 适配 layout2及以上版本-->
  	<thymeleaf-layout-dialect.version>2.1.1</thymeleaf-layout-dialect.version>
</properties>
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-thymeleaf</artifactId>
</dependency>

<!-- 对于springboot2.x，注意我使用的版本是 2.1.2 -->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-thymeleaf</artifactId>
</dependency>
```

spring-boot-autoconfigure-2.1.2.RELEASE.jar 中查看 ThymeleafProperties.java：

``` java
@ConfigurationProperties(
    prefix = "spring.thymeleaf"
)
public class ThymeleafProperties {
    private static final Charset DEFAULT_ENCODING;
    // 只要我们把html页面放在 classpath:/template/，thymeleaf就能自动渲染 
    public static final String DEFAULT_PREFIX = "classpath:/templates/";
    public static final String DEFAULT_SUFFIX = ".html";
    private boolean checkTemplate = true;
    private boolean checkTemplateLocation = true;
    private String prefix = "classpath:/templates/";
    private String suffix = ".html";
    private String mode = "HTML";
    // ...
}
```
<br>


### Thymeleaf使用和语法

使用和语法参考 [thymeleaf语法及下载页](https://www.thymeleaf.org/documentation.html)，下面进行大概介绍：

1）导入 thymeleaf 的名称空间（有语法提示）

``` xml
<html lang="en" xmlns:th="http://www.thymeleaf.org">
	<!--...-->
</html>
```

2）前端模板及后端参数值

``` html
<!DOCTYPE html>
<html lang="en" xmlns:th="http://www.thymeleaf.org">
<head>
    <meta charset="UTF-8">
    <title>success</title>
</head>
<body>
    <h1>成功！</h1>
    <!--这种参数回填方式有利于前后端分离和开发-->
    <div id="defaut_id" th:id="${param_value_in_back}" class="default_class" th:class="${param_value_in_back}"  th:text="${param_value_in_back}">这是前端默认的文本</div>
</body>
</html>
```

``` java
@RequestMapping("/success")
public String success(Map<String, Object> map) {
  map.put("param_value_in_back", "这是后台传到前端的参数值");
  return "success";
}
```

3）语法规则

* th:text: 改变当前元素里面的文本内容，并且需要注意的是，th:xxx 不仅能够改变当前html标签体里面的文本内容，而且它还可以替换html标签原生属性的值，例如上述示例的运行结果为：

  ``` html
  <div id="这是后台传到前端的参数值" class="这是后台传到前端的参数值">这是后台传到前端的参数值</div>
  ```

* 常见thymeleaf标签及其优先级：

  ``` default
  Order   Feature                           Attributes         remarks
  --------------------------------------------------------------------------------------
  1     Fragment inclusion                  th:insert          片段包含，类似于jsp:include  
                                            th:replace         
  2     Fragment iteration                  th:each            遍历，类似于c:foreach
  3     Conditional evaluation              th:if              条件判断，类似于c:if
                                            th:unless          
                                            th:switch
                                            th:case
  4     Local variable definition           th:object          变量声明，类似于c:set
                                            th:with
  5     General attribute modification      th:attr            任意属性的修改
                                            th:attrprepend     前面追加内容
                                            th:attrappend      后面追加内容
  6     Specific attribute modification     th:value           修改html标签任意指定属性的值
                                            th:href
                                            th:src
                                            ...
  7     Text (tag body modification)        th:text            修改html标签体里面的文本内容
                                                              （转义特殊字符，例如html标签）
                                            th:utext           修改html标签体里面的文本内容
                                                              （不转义特殊字符）
  8     Fragment specification              th:fragment        声明片段
  9     Fragment removal                    th:remove          移除片段
  ```

* thymeleaf能写哪些表达式呢？

  ``` properties
  Simple expressions (五种表达式):
      1. VariableExpressions: ${...}
                       #1) 获取变量值用，底层是OGNL，支持OGNL语法，包括：
                       ${person.father.name}、$person['father']['name']
                       ${map['k1'].age}
                       ${personArray[0].name}
                       ${person.createCompleteNameWithSeparator('-')}
                       
                       #2) 还可以使用内置的基本对象，包括：
                       上下文对象： <span th:text="${#ctx}"></span>
                       上下文参数： <span th:text="${#vars}">
                       上下文本地变量： <span th:text="${#locale.country}"></span>
                       HttpServletRequest请求对象： <span th:text="${#request}"></span>
                       HttpServletResponse响应对象： <span th:text="${#response}"></span>
                       HttpSession对象： <span th:text="${#session}"></span>
                       ServletContext对象： <span th:text="${#servletContext}"></span>
                       请求参数对象：<span th:text="${param.foo} + ${param.size()} +
                             ${param.isEmpty()} + ${param.containsKey('foo')}"></span>
                             
                       #3) 此外还可以使用一些工具对象，包括：
                       ${#execInfo} : information about the template being processed.
                       ${#messages} : methods for obtaining externalized messages inside variables expressions, in the same way as they would be obtained using #{...} syntax.
                       ${#uris} : methods for escaping parts of URLs/URIs
                       ${#conversions} : methods for executing the configured conversion service (if any).
                       ${#dates} : methods for java.util.Date objects: formatting, component extraction, etc.
                       ${#calendars} : analogous to #dates , but for java.util.Calendar objects.
                       ${#numbers} : methods for formatting numeric objects.
                       ${#strings} : methods for String objects: contains, startsWith, prepending/appending, etc.
                       ${#objects} : methods for objects in general.
                       ${#bools} : methods for boolean evaluation.
                       ${#arrays} : methods for arrays.
                       ${#lists} : methods for lists.
                       ${#sets} : methods for sets.
                       ${#maps} : methods for maps.
                       ${#aggregates} : methods for creating aggregates on arrays or collections.
                       ${#ids} : methods for dealing with id attributes that might be repeated (for example, as a result of an iteration).
                       
      2. SelectionVariableExpressions: *{...} 
                       #1) 变量的选择表达式，和 ${} 在功能上是一样的，但它还有一个高级的应用：
                       <div th:object="${session.user}">
                         <!--firstName和lastName的继承自父标签中的session.user-->
                         <p><span th:text="*{firstName}"></span></p>
                         <p><span th:text="*{lastName}"></span></p>
                       </div>
                       
      3. MessageExpressions: #{...} 
                       #获取国际化内容
                       
      4. LinkURLExpressions: @{...} 
                       #用来定义URL链接
                       <a href="default_url" th:href="@{/xxx/details(orderId=
                       ${o.id},orderType=${o.type})}"></a>
      
      5. Fragment Expressions: ~{...}
                        #插入片段文档
                        <div th:insert="~{commons :: main}"> ... </div>
     
     
  Literals (字面量):
      Text literals: 'one text' , 'Another one!' ,... 
      Number literals: 0 , 34 , 3.0 , 12.3 ,... 
      Boolean literals: true , false
      Nullliteral: null
      Literal tokens: one , sometext , main ,... 

  Text operations (文本操作):
      Stringconcatenation: +
      Literal substitutions: |The name is ${name}|

  Arithmetic operations (数学运算):
      Binaryoperators: +, -, *, /, %
      Minussign(unaryoperator): - 

  Boolean operations (布尔运算):
      Binary operators: and , or
      Boolean negation (unary operator): ! , not

  Comparisons and equality (比较运算):
      Comparators: >, <, >=, <= (gt, lt, ge, le)
      Equality operators: == , != ( eq , ne ) 

  Conditional operators (条件运算):
      If-then: (if) ? (then)
      If-then-else: (if) ? (then) : (else) 
      Default: (value) ?: (defaultvalue)

  Special tokens (特殊操作符):
  	No-Operation: _
  ```



4) 示例

``` html
<div id="defaut_id" th:id="${param_value_in_back}" class="default_class" th:class="${param_value_in_back}"  th:utext="${param_value_in_back}">这是前端默认的文本</div>


<p th:utext="#{${welcomeMsgKey}(${session.user.name})}"></p>
<p>
  Today is: 
  <span th:text="${#calendars.format(today,'dd MMMM yyyy')}">13 May 2011</span>
</p>


<!-- 'http://localhost:8080/gtvg/order/details?orderId=3' (plus rewriting) -->
<a href="details.html"
th:href="@{http://localhost:8080/gtvg/order/details(orderId=${o.id})}">view</a>
<!-- '/gtvg/order/details?orderId=3' (plus rewriting) -->
<a href="details.html" th:href="@{/order/details(orderId=${o.id})}">view</a>
<!-- '/gtvg/order/3/details' (plus rewriting) -->
<a href="details.html" th:href="@{/order/{orderId}/details(orderId=${o.id})}">view</a>
<a th:href="@{${url}(orderId=${o.id})}">view</a>
<a th:href="@{'/details/'+${user.login}(orderId=${o.id})}">view</a>

<p>Please select an option</p>
<ol>
<li><a href="product/list.html" th:href="@{/product/list}">Product List</a></li>
<li><a href="order/list.html" th:href="@{/order/list}">Order List</a></li>
<li><a href="subscribe.html" th:href="@{/subscribe}">Subscribe to our Newsletter</a></li>
<li><a href="userprofile.html" th:href="@{/userprofile}">See User Profile</a></li>
</ol>


<!-- th:each 每次遍历到一项就会生成一个当前标签 -->
<h4 th:text="${user}" th:each="user:${users}"></h4>
<!-- [[ xxx ]] 等价于 th:text，而 [( xxx )] 等价于 th:utext -->
<span th:each="user:${users}">[[${user}]]</span>

<!--
If you don’t explicitly set a status variable, Thymeleaf will always create one for you by suffixing Stat to the name of the iteration variable:
-->
<table>
<tr>
<th>NAME</th>
<th>PRICE</th>
<th>IN STOCK</th>
</tr>
<tr th:each="prod,iterStat : ${prods}" th:class="${iterStat.odd}? 'odd'">
<td th:text="${prod.name}">Onions</td>
<td th:text="${prod.price}">2.41</td>
<td th:text="${prod.inStock}? #{true} : #{false}">yes</td>
</tr>
</table>

<!--
Sometimes you will need a fragment of your template to only appear in the result if a certain condition is met.
-->
<table>
<tr>
<th>NAME</th>
<th>PRICE</th>
<th>IN STOCK</th>
<th>COMMENTS</th>
</tr>
<tr th:each="prod : ${prods}" th:class="${prodStat.odd}? 'odd'">
<td th:text="${prod.name}">Onions</td>
<td th:text="${prod.price}">2.41</td>
<td th:text="${prod.inStock}? #{true} : #{false}">yes</td>
<td>
<span th:text="${#lists.size(prod.comments)}">2</span> comment/s
<a href="comments.html"
th:href="@{/product/comments(prodId=${prod.id})}"
th:if="${not #lists.isEmpty(prod.comments)}">view</a>
</td>
</tr>
</table>


<div th:insert="~{commons :: main}">...</div>
<div th:with="frag=~{footer :: #main/text()}">
	<p th:insert="${frag}">
</div>


<p>In two years, it will be <span th:text="2013 + 2">1494</span>.</p>
<div th:if="${user.isAdmin()} == false"> ...</div>
<div th:if="${variable.something} == null"> ...</div>
<div th:with="isEven=(${prodStat.count} % 2 == 0)"></div>
<div th:if="${prodStat.count} &gt; 1"></div>


<span th:text="'Execution mode is ' + ( (${execMode} == 'dev')? 'Development' : 'Production')"></span>
<tr th:class="${row.even}? 'even' : 'odd'">...</tr>
<tr th:class="${row.even}? (${row.first}? 'first' : 'even') : 'odd'">...</tr>
<div th:switch="${user.role}">
  <p th:case="'admin'">User is an administrator</p>
  <p th:case="#{roles.manager}">User is a manager</p>
</div>


<span th:text="|Welcome to our application, ${user.name}|"></span>
<span th:text="'Welcome to our application, ' + ${user.name}"></span>


<form action="subscribe.html" th:attr="action=@{/subscribe}">
<fieldset>
	<input type="text" name="email" />
	<input type="submit" value="Subscribe!" th:attr="value=#{subscribe.submit}"/>
</fieldset>
</form>
<img src="../../images/gtvglogo.png"
th:attr="src=@{/images/gtvglogo.png},title=#{logo},alt=#{logo}"/>


<input type="button" value="Do it!" class="btn" th:attrappend="class=${' ' + cssStyle}" />
<tr th:each="prod : ${prods}" class="row" th:classappend="${prodStat.odd}? 'odd'"></tr>
<span th:whatever="${user.name}">...</span>


<input type="checkbox" name="option2" checked /> <!-- HTML -->
<input type="checkbox" name="option1" checked="checked" /> <!-- XHTML -->
<input type="checkbox" name="active" th:checked="${user.active}" />
<!--
th:async          th:autofocus   th:autoplay
th:checked        th:controls    th:declare
th:default        th:defer       th:disabled
th:formnovalidate th:hidden      th:ismap
th:loop           th:multiple    th:novalidate
th:nowrap         th:open        th:pubdate
th:readonly       th:required    th:reversed
th:scoped         th:seamless    th:selected
-->
```