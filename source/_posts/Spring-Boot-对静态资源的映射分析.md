title: Spring Boot 对静态资源的映射分析
author: kinglyjn
tags:
  - springboot
categories:
  - framework
  - springboot
date: 2019-03-06 17:44:00
---
### 关键代码

springmvc的相关配置都在 `WebMvcAutoConfiguration` 中（还记的 XxxAutoConfiguration 和 XxxProperties吧），映射静态资源的关键代码如下：

<!--more-->

``` java
@Override
public void addResourceHandlers(ResourceHandlerRegistry registry) {
  if (!this.resourceProperties.isAddMappings()) {
    logger.debug("Default resource handling disabled");
    return;
  }
  Duration cachePeriod = this.resourceProperties.getCache().getPeriod();
  CacheControl cacheControl = this.resourceProperties.getCache()
    .getCachecontrol().toHttpCacheControl();
  if (!registry.hasMappingForPattern("/webjars/**")) {
    customizeResourceHandlerRegistration(registry
                         .addResourceHandler("/webjars/**")
                         .addResourceLocations("classpath:/META-INF/resources/webjars/")
                         .setCachePeriod(getSeconds(cachePeriod))
                         .setCacheControl(cacheControl));
  }
  String staticPathPattern = this.mvcProperties.getStaticPathPattern();
  if (!registry.hasMappingForPattern(staticPathPattern)) {
    customizeResourceHandlerRegistration(
      registry.addResourceHandler(staticPathPattern)
      .addResourceLocations(getResourceLocations(
        this.resourceProperties.getStaticLocations()))
      .setCachePeriod(getSeconds(cachePeriod))
      .setCacheControl(cacheControl));
  }
}

//...
  
@Bean
public WelcomePageHandlerMapping welcomePageHandlerMapping( // 配置欢迎页的映射
  ApplicationContext applicationContext) {
  return new WelcomePageHandlerMapping(
    new TemplateAvailabilityProviders(applicationContext),
    applicationContext, getWelcomePage(),
    this.mvcProperties.getStaticPathPattern());
}

// ... 

@Configuration
@ConditionalOnProperty(value = "spring.mvc.favicon.enabled", matchIfMissing = true)
public static class FaviconConfiguration implements ResourceLoaderAware { // 配置图标的映射
  private final ResourceProperties resourceProperties;
  private ResourceLoader resourceLoader;
  // ...
  @Bean
  public SimpleUrlHandlerMapping faviconHandlerMapping() {
    SimpleUrlHandlerMapping mapping = new SimpleUrlHandlerMapping();
    mapping.setOrder(Ordered.HIGHEST_PRECEDENCE + 1);
    mapping.setUrlMap(Collections.singletonMap("**/favicon.ico",
                                               faviconRequestHandler()));
    return mapping;
  }
  // ...
}
```

<br>

### webjars的方式引入静态资源

所有 /webjars/** 的映射，都去 classpath:/META-INF/resources/webjars/ 路径下找资源。

详见 [webjars官网](https://www.webjars.org/)，下面以引入jquery的静态资源为例进行说明。

1) 首先在webjars的官网找到jquery的maven jar包依赖，并引入到项目中：

``` xml
<dependency>
    <groupId>org.webjars</groupId>
    <artifactId>jquery</artifactId>
    <version>3.3.1</version>
</dependency>
```

![图一](/images/pasted-32.png)


访问方式为：

``` bash
curl localhost:8080/webjars/jquery/3.3.1/jquery.js
```

2) 可以设置资源相关参数：

由 WebMvcAutoConfiguration#addResourceHandlers 可以看到，在 ResourceProperties 中还可以设置静态资源的缓存时间等参数。
<br>

### 对于 "/**" 的映射资源

``` java
@ConfigurationProperties(prefix = "spring.resources", ignoreUnknownFields = false)
public class ResourceProperties {
  	// ...
	private static final String[] CLASSPATH_RESOURCE_LOCATIONS = {
			"classpath:/META-INF/resources/", "classpath:/resources/",
			"classpath:/static/", "classpath:/public/" };
  	// ...
}
```

由 WebMvcAutoConfiguration#addResourceHandlers 可知，如果静态资没人处理（如没有被webjar处理），那么会匹配到 WebMvcProperties.staticPathPattern，即"/**"，这些静态资源文件默认会去ResourceProperties.CLASSPATH_RESOURCE_LOCATIONS 和 WebMvcAutoConfiguration.SERVLET_LOCATIONS（当前项目的根路径）包含的路径寻找，即：

``` 
classpath:/META-INF/resources/
classpath:/resources/
classpath:/static/
classpath:/public/
/
```

访问方式示例：

``` bash
curl http://localhost:8080/js/jquery/3.3.1/jquery.js
```

更改静态资源的目录位置（更改application.properties配置文件）：

``` properties
spring.resources.static-locations=classpath:/hello01,classpath:/hello02
```

<br>

### 对于欢迎页的映射

由 WebMvcAutoConfiguration#welcomePageHandlerMapping 可知，静态资源文件夹下的所有 index.html 被 ”/**“ 映射，访问方式示例：

``` bash
curl http://localhost:8080/
```

<br>

### 对于标题图标的映射

由 WebMvcAutoConfiguration#faviconHandlerMapping 可知，静态资源文件夹下的所有 favicon.ico 被 ”**/favicon.ico“ 映射，访问方式示例：

```bash
curl http://localhost:8080/favicon.ico
```

<br>