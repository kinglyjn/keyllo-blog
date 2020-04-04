title: Spring Boot 自动配置原理详解
author: kinglyjn
tags:
  - springboot
categories:
  - framework
  - springboot
date: 2019-03-01 16:52:00
---
## 引出问题

大家有没有思考过这样一个问题，那就是spring boot配置文件到底能写什么？怎么写？为什么这样写？

这个 [链接](https://docs.spring.io/spring-boot/docs/2.1.3.RELEASE/reference/htmlsingle/#common-application-properties) 列出了springboot常见的 application.properties/yml 键值。

下面我们就带着这个疑问进行深入的探讨和分析。
<br>

<!--more-->


## 自动配置的原理解析

springboot启动的时候加载主配置类，开启了自动配置功能（@EnableAutoConfiguration），@EnableAutoConfiguration注解的作用就是利用 EnableAutoConfigurationImportSelector 给容器中导入一些组件，下面具体看一下是如何做到的。

Spring Boot 程序入口有`@SpringBootApplication` 注解。

``` java
@SpringBootApplication //标注一个主程序
public class HelloWorldApplication {
    public static void main(String[] args) {
        SpringApplication.run(HelloWorldApplication.class, args);
    }
}
```

进入`@SpringBootApplication` 注解可以看到他的定义：

``` java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@SpringBootConfiguration
@EnableAutoConfiguration
@ComponentScan(excludeFilters = {
		@Filter(type = FilterType.CUSTOM, classes = TypeExcludeFilter.class),
		@Filter(type = FilterType.CUSTOM, classes = AutoConfigurationExcludeFilter.class) })
public @interface SpringBootApplication {
 //... 
}
```

Spring Boot程序的入口会加载主配置类，并且通过`@EnableAutoConfiguration` 开启自动配置的功能。该注解会引入EnableAutoConfigurationImportSelector类。该类又会继承AutoConfigurationImportSelector类。

``` java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@AutoConfigurationPackage
@Import(AutoConfigurationImportSelector.class)
public @interface EnableAutoConfiguration {
	String ENABLED_OVERRIDE_PROPERTY = "spring.boot.enableautoconfiguration";
	/**
	 * Exclude specific auto-configuration classes such that they will never be applied.
	 * @return the classes to exclude
	 */
	Class<?>[] exclude() default {};
	/**
	 * Exclude specific auto-configuration class names such that they will never be
	 * applied.
	 * @return the class names to exclude
	 * @since 1.3.0
	 */
	String[] excludeName() default {};
}
```

AutoConfigurationImportSelector中方法selectImports的源码如下：

``` java
@Override
public String[] selectImports(AnnotationMetadata annotationMetadata) {
  if (!isEnabled(annotationMetadata)) {
    return NO_IMPORTS;
  }
  AutoConfigurationMetadata autoConfigurationMetadata = AutoConfigurationMetadataLoader
    .loadMetadata(this.beanClassLoader);
  AnnotationAttributes attributes = getAttributes(annotationMetadata);
  //该方法会去获取所有自动配置类的名称
  List<String> configurations = getCandidateConfigurations(annotationMetadata,attributes);
  configurations = removeDuplicates(configurations);
  Set<String> exclusions = getExclusions(annotationMetadata, attributes);
  checkExcludedClasses(configurations, exclusions);
  configurations.removeAll(exclusions);
  configurations = filter(configurations, autoConfigurationMetadata);
  fireAutoConfigurationImportEvents(configurations, exclusions);
  return StringUtils.toStringArray(configurations);
}

protected List<String> getCandidateConfigurations(AnnotationMetadata metadata,
			AnnotationAttributes attributes) {
  // loadFactoryNames方法
  List<String> configurations = SpringFactoriesLoader.loadFactoryNames(
    getSpringFactoriesLoaderFactoryClass(), getBeanClassLoader()); /////////////
  Assert.notEmpty(configurations, "No auto configuration classes found in META-INF/spring.factories. If you are using a custom packaging, make sure that file is correct.");
  return configurations;
}

protected Class<?> getSpringFactoriesLoaderFactoryClass() {
  return EnableAutoConfiguration.class; //////
}

public static List<String> loadFactoryNames(Class<?> factoryClass, @Nullable ClassLoader classLoader) {
  String factoryClassName = factoryClass.getName(); // EnableAutoConfiguration
  return loadSpringFactories(classLoader).getOrDefault(factoryClassName, Collections.emptyList()); /////////
}

// loadSpringFactories
private static Map<String, List<String>> loadSpringFactories(@Nullable ClassLoader classLoader) {
  MultiValueMap<String, String> result = cache.get(classLoader);
  if (result != null) {
    return result;
  }

  try {
    // public static final String FACTORIES_RESOURCE_LOCATION = "META-INF/spring.factories";
    Enumeration<URL> urls = (classLoader != null ?
                             classLoader.getResources(FACTORIES_RESOURCE_LOCATION) :
                             ClassLoader.getSystemResources(FACTORIES_RESOURCE_LOCATION));
    result = new LinkedMultiValueMap<>();
    while (urls.hasMoreElements()) {
      URL url = urls.nextElement();
      UrlResource resource = new UrlResource(url);
      Properties properties = PropertiesLoaderUtils.loadProperties(resource);
      for (Map.Entry<?, ?> entry : properties.entrySet()) {
        List<String> factoryClassNames = Arrays.asList(
          StringUtils.commaDelimitedListToStringArray((String) entry.getValue()));
        result.addAll((String) entry.getKey(), factoryClassNames);
      }
    }
    cache.put(classLoader, result);
    return result;
  }
  catch (IOException ex) {
    throw new IllegalArgumentException("Unable to load factories from location [" +
                                       FACTORIES_RESOURCE_LOCATION + "]", ex);
  }
}
```

可以看到FACTORIES_RESOURCE_LOCATION的值为 `META-INF/spring.factories`。

loadSpringFactories方法会扫描jar包路径下的`META-INF/spring.factories` 文件，把扫描到的这些文件内容包装成properties对象。再从properties中获取到EnableAutoConfiguration.class类（类名）对应的值，并且把他们添加到容器中。我们打开`spring.factories`文件。

``` properties
...
# Auto Configure
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
org.springframework.boot.autoconfigure.admin.SpringApplicationAdminJmxAutoConfiguration,\
org.springframework.boot.autoconfigure.aop.AopAutoConfiguration,\
...
org.springframework.boot.autoconfigure.web.servlet.HttpEncodingAutoConfiguration,\
...
...
```

看到的非常多的xxxxAutoConfiguration类，这些类都是容器中的一个组件，加入到容器中，用他们做自动配置。

以 `HttpEncodingAutoConfiguration`组件为例进行剖析：

``` java
@Configuration
@EnableConfigurationProperties(HttpEncodingProperties.class)
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@ConditionalOnClass(CharacterEncodingFilter.class)
@ConditionalOnProperty(prefix = "spring.http.encoding", value = "enabled", matchIfMissing = true)
public class HttpEncodingAutoConfiguration {
	private final HttpEncodingProperties properties;

	public HttpEncodingAutoConfiguration(HttpEncodingProperties properties) {
		this.properties = properties;
	}

	@Bean
	@ConditionalOnMissingBean
	public CharacterEncodingFilter characterEncodingFilter() {
		CharacterEncodingFilter filter = new OrderedCharacterEncodingFilter();
		filter.setEncoding(this.properties.getCharset().name());
		filter.setForceRequestEncoding(this.properties.shouldForce(Type.REQUEST));
		filter.setForceResponseEncoding(this.properties.shouldForce(Type.RESPONSE));
		return filter;
	}

	@Bean
	public LocaleCharsetMappingsCustomizer localeCharsetMappingsCustomizer() {
		return new LocaleCharsetMappingsCustomizer(this.properties);
	}

	private static class LocaleCharsetMappingsCustomizer implements
			WebServerFactoryCustomizer<ConfigurableServletWebServerFactory>, Ordered {

		private final HttpEncodingProperties properties;

		LocaleCharsetMappingsCustomizer(HttpEncodingProperties properties) {
			this.properties = properties;
		}

		@Override
		public void customize(ConfigurableServletWebServerFactory factory) {
			if (this.properties.getMapping() != null) {
				factory.setLocaleCharsetMappings(this.properties.getMapping());
			}
		}

		@Override
		public int getOrder() {
			return 0;
		}
	}
}
```

通过上面的类的注解可以看到，通过使用@EnableConfigurationProperties，可以把配置文件中的属性与HttpEncodingProperties类绑定起来并且加入到IOC容器中，进入HttpEncodingProperties类，可以看到他是通过@ConfigurationProperties 注解把配置文件中的spring.http.encoding值与该类的属性绑定起来的。

``` java
@ConfigurationProperties(prefix = "spring.http.encoding")
public class HttpEncodingProperties {
  //...
}
```

通过上面的分析我们知道了为什么在配置文件中可以配置这些属性。

关于[配置文件可配置属性](https://link.jianshu.com?t=https%3A%2F%2Fdocs.spring.io%2Fspring-boot%2Fdocs%2F1.5.9.RELEASE%2Freference%2Fhtmlsingle%2F%23common-application-properties)，可以参考官方文档。

同时我们可以注意到上面的类中使用了**@ConditionalOnClass**与**@ConditionalOnWebApplication**注解，这两个都是@Conditional的派生注解，作用是必须是@Conditional指定的条件成立，才给容器中添加组件，配置里的内容才会生效。常见@Conditional的派生注解如下：

| @Conditional扩展注解                | 作用（判断是否满足当前指定条件）               |
| ------------------------------- | ------------------------------ |
| @ConditionalOnJava              | 系统中的java版本是否符合要求               |
| @ConditionalOnBean              | 容器中是否存在指定的bean                 |
| @ConditionalOnMissingBean       | 容器中不存在指定的bean                  |
| @ConditionalOnExpression        | 是否满足SpEL表达式                    |
| @ConditionalOnClass             | 系统中是否有指定的类                     |
| @ConditionalOnSingleCandidate   | 容器中只有一个指定的bean，或者这个bean是首选bean |
| @ConditionalOnProperty          | 系统中指定的属性是否有指定的值                |
| @ConditionalOnResource          | 类路径下是否存在指定的资源文件                |
| @ConditionalOnWebApplication    | 当前是否是web环境                     |
| @ConditionalOnNotWebApplication | 当前是否不是web环境                    |
| @ConditionalOnJndi              | JNDI是否存在指定项                    |

<br>

## springboot精髓总结

XxxAutoConfiguration：自动配置类，给容器中添加需要的组件；

XxxPorperties：封装配置文件中的相关属性到需要的组件；

1. SpringBoot启动会加载大量的自动配置类
2. 我们看我们需要的功能有没有SpringBoot默认写好的自动配置类；
3. 我们再来看这个自动配置类中到底配置了哪些组件；（只要我们要用的组件有，我们就不需要再来配置了）
4. 给容器中自动配置类添加组件的时候，会从properties类中获取某些属性。我们就可以在配置文件中指定这些属性的值；


【注】：我们可以通过启用springboot的 `debug=true` 属性，来让控制台打印自动配置报告，这样我们就可以很方便地知道哪些自动配置类生效了：

application.properties

``` pro
debug=true
server.port=8080
```

``` java
...

============================
CONDITIONS EVALUATION REPORT
============================

Positive matches: //自动配置类匹配并启用的
-----------------

   CodecsAutoConfiguration matched:
      - @ConditionalOnClass found required class 'org.springframework.http.codec.CodecConfigurer'; @ConditionalOnMissingClass did not find unwanted class (OnClassCondition)

   CodecsAutoConfiguration.JacksonCodecConfiguration matched:
      - @ConditionalOnClass found required class 'com.fasterxml.jackson.databind.ObjectMapper'; @ConditionalOnMissingClass did not find unwanted class (OnClassCondition)
   ...
       
       
Negative matches: //自动配置类没有匹配，并没有启动的
-----------------

   ActiveMQAutoConfiguration:
      Did not match:
         - @ConditionalOnClass did not find required classes 'javax.jms.ConnectionFactory', 'org.apache.activemq.ActiveMQConnectionFactory' (OnClassCondition)

   AopAutoConfiguration:
      Did not match:
         - @ConditionalOnClass did not find required classes 'org.aspectj.lang.annotation.Aspect', 'org.aspectj.lang.reflect.Advice', 'org.aspectj.weaver.AnnotatedElement' (OnClassCondition)
   ...
```
<br>