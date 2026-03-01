title:  Shiro的常用组件介绍

author: kinglyjn

tags:

  - shiro


categories:

  - java

  - janusx

date: 2019-08-21 15:21:51

---



# Shiro 概述

在 Java 安全框架的领域中，如果说 Spring Security 是全副武装、规则森严的 “重装骑士”，那么 Apache Shiro 则更像是一位身轻如燕、化繁为简的 “太极宗师”。

长期以来，开发者们往往被 “安全” 二字背后的复杂性所震慑：权限绕过、Session 丢失、加密算法选型、多数据源对冲…… 这些问题如同乱麻一般交织在业务代码中。而 Shiro 的出现，核心宗旨只有八个字：**“简单易用，直觉开发”**。

<!--more-->



在接下来的文章中，我们将深度拆解 Shiro 的各个核心组件。我们将不再枯燥地罗列 API，而是通过 “五星级办公大楼” 的形象类比，带你穿透繁杂的源码，直击安全设计的底层灵魂。无论你是正在维护经典项目的开发者，还是追求极致交互的项目中构建安全模块的工程师，这篇指南都将为你提供一份清晰的 “安保设计图纸”。

<br>



# Shiro的关键组件



##  大楼的核心：访问者和调度者



### Subject 你是谁？

这个 subject 并不仅仅代表当前的浏览器用户，也可以是指一个访问程序，一个调用接口——总之，不管你是谁在访问，通通都叫做 Subject。Subject 是 Shiro 的对外入口。它并不直接执行逻辑，而是将请求委托给 SecurityManager。核心代码：

```java
// 典型用法：获取当前用户并登录
Subject currentUser = SecurityUtils.getSubject();
currentUser.login(token);
```

* Subject 并不直接存储数据，它是 SecurityManager 的一个逻辑视图。它绑定了当前线程（通过 ThreadContext），让你在代码的任何地方通过 SecurityUtils.getSubject() 都能抓到它。
* 它内部持有一个 Principals（身份，如用户名）和 Authenticated（是否登录的状态）。当你调用 login() 时，它其实是执行了 securityManager.login(this, token)。

<br>



### SecurityManager 谁调度？

SecurityManager 可以类比成 “大楼安保总监”。它是整个shiro 的中枢，调度所有人手。本质上 SecurityManager 是一个外观模式（Facade）的实现，内部聚合了 Realm、Authentication、Authorization、SessionManager、CacheManager、 rememberMeManager、ShiroFilterFactoryBean 等所有其他组件，它是 “整栋楼” 的调度中枢，虽然不亲自处理逻辑，但它知道该找谁。

在 Web 环境下通常是 SecurityManager 通常由 DefaultWebSecurityManager 来充当，它维护了全套的安保工具包。

<br>



## 认证与授权：进门与权限



### Realm（域）

你可以把 Realm 类比成这座大楼的 “人事档案库/数据库”。它的核心功能就是告诉 shiro 从哪里获取用户的密码和权限数据。它是 是 Shiro 的 “翻译官”，把你的数据库信息转换成 Shiro 能识别的 SimpleAuthenticationInfo。开发中，你通常只需要继承 AuthorizingRealm，实现 doGetAuthenticationInfo（认证）和 doGetAuthorizationInfo（授权）方法即可。

<br>



### Authenticator（认证器）

这个组件就像是大楼的门禁，你可以通过给它输密码、刷脸、或核对身份证等各种方式进入大楼里面。其中有一个认证器比较牛逼，就是 ModularRealmAuthenticator，它就像是一个 ”联合档案组“，它定义了如果公司有多个档案库（LDAP、数据库、第三方），该听谁的，内部维护了 AuthenticationStrategy 认证策略，默认的多数据源策略是 AtLeastOneSuccessfulStrategy。

<br>



### HashedCredentialsMatcher（密码匹配器）

它就是专门解决 ”绝对不能在档案库里存明文密码“ 的安全问题。 在 doGetAuthenticationInfo 返回数据库里的密文后，该组件会自动将用户输入的明文进行同样的 1024 次 SHA-256 计算，最后调用 Arrays.equals 比对。

<br>



### Authorizer（授权器）

定义了你在大楼里能干啥？有哪些访问和操作资源？能不能进总裁办公室？还是只能在工位敲代码 😂。

* 核心组件：ModularRealmAuthorizer
* 解决问题：判断用户是否有诸如 "user:delete" 的权限
* 原理：它会遍历所有 Realm，只要有一个 Realm 说“有”，那就返回 true。它还负责解析字符串权限（如通配符 *）。

<br>



### PermissionResolver（权限解析器）

* 核心痛点：字符串 "admin:edit" 怎么变成对象逻辑？
* 实现原理：默认使用 WildcardPermissionResolver。它将权限字符串拆解为领域（Domain）、动作（Action）和实例（Instance），从而支持 user:edit:123 这种细粒度的控制。

<br>



## 会话管理：在大楼里的活动踪迹



### SessionManager （会话管理器）

你可以把它类比成 “大楼工牌发放与识别处”。

* 核心问题：你进门之后，总不能每走一步都掏出身份证查一遍吧？
* 详细解释：它负责管理所有用户的 Session。Shiro 最强大的一点是它拥有独立的 Session 机制，不依赖于 Tomcat 等 Web 容器。这意味着在 Java 桌面程序甚至后台定时任务里，你都能用它的 Session。
* 实现原理：在 Web 环境下是 DefaultWebSecurityManager，它负责 Session 的创建、检索和失效。

<br>



### SessionDAO (数据访问对象)

这是大楼的 “工牌档案寄存柜”。

* 核心问题：如果大楼突然停电（服务器重启），这些已经发出去的工牌（Session）是不是就全失效了？

* 详尽解释：DAO 负责 Session 的持久化。默认是存在内存里的，但你可以通过实现 SessionDAO 把 Session 存进 Redis 或数据库。这样即便服务器重启，用户也无需重新登录。

  ```java
  // 典型操作：将 Session 存入 Redis
  public interface SessionDAO {
      Serializable create(Session session); // 登录成功，存入持久化层。
      Session readSession(Serializable sessionId);  // 每次请求通过 Cookie 里的 ID 查出来。
      void update(Session session);
      void delete(Session session);
  }
  ```

<br>



### SessionFactory（session印刷机）

这就是个 “工牌印刷机”。它决定了 Session 对象长什么样，你可以通过它往 Session 里塞入自定义的初始信息。

```java
public class OnlineSessionFactory implements SessionFactory {
    @Override
    public Session createSession(SessionContext initData) {
        OnlineSession session = new OnlineSession(); // extends SimpleSession
        if (initData instanceof WebSessionContext sessionContext) {
            HttpServletRequest request = (HttpServletRequest) sessionContext.getServletRequest();
            if (request != null) {
                String userAgent = request.getHeader("User-Agent");
                // 获取客户端操作系统
                String os = UserAgentUtils.getOperatingSystem(userAgent);
                // 获取客户端浏览器
                String browser = UserAgentUtils.getBrowser(userAgent);
                session.setHost(IpUtils.getIpAddr(request));
                session.setBrowser(browser);
                session.setOs(os);
            }
        }
        return session;
    }
}
```

<br>



### SessionValidationScheduler（大楼巡检员）

它是一个定时任务，专门负责清理那些 “已经下班（超时）却没归还工牌” 的无效 Session，防止内存被撑爆。

<br>



## 过滤器链：走廊里的关卡



### ShiroFilterFactoryBean（过滤器工厂）

可以将其通俗比喻成  “整栋大楼的安保红线图”。它告诉告诉shiro，哪些房间（URL）需要刷卡，哪些走廊（URL）可以随便走。本质上它是 Shiro 在 Spring 里的总代理。它会生成一个巨大的 Filter 链，把守住大楼的每一个入口（URL）。

<br>



### FilterChainDefinitionMap（过滤链定义图）

这就是大楼的 “通行规则清单”。核心规则例如：

* `/login = anon`（一楼大厅，谁都能进）
* `/notice/**=user`（二楼走廊，曾经刷卡过，可以访问一些 rememberMe 资源，想要进办公区还得刷卡）

* `/user/** = authc`（办公区，必须刷卡）

* `/admin/** = roles[admin]`（总裁办，必须是高级主管）

注意：它是有顺序的，规则从上往下匹配，一旦匹配成功就不再往下走（就像你拿着通票进场，只要第一道岗让你过了，后面更细的规则就不管你了）。

```java
@Bean
public ShiroFilterFactoryBean shiroFilterFactoryBean(SecurityManager securityManager,
                                                     CacheManager cacheManager,
                                                     SessionManager sessionManager,
                                                     SessionDAO sessionDAO) {
    CustomShiroFilterFactoryBean shiroFilterFactoryBean = new CustomShiroFilterFactoryBean();
    // Shiro的核心安全接口,这个属性是必须的
    shiroFilterFactoryBean.setSecurityManager(securityManager);
    // 身份认证失败，则跳转到登录页面的配置
    shiroFilterFactoryBean.setLoginUrl(loginUrl);
    // 权限认证失败，则跳转到指定页面
    shiroFilterFactoryBean.setUnauthorizedUrl(unauthorizedUrl);

    // Shiro连接约束配置，即过滤链的定义
    shiroFilterFactoryBean.setFilterChainDefinitionMap(setupFilterChainDefinitionMap());

    // 自定义过滤器
    Map<String, Filter> filters = new LinkedHashMap<>();
    filters.put("onlineSession", onlineSessionFilter(sessionDAO));
    if (sessionDAO instanceof OnlineSessionDAO onlineSessionDAO) {
        filters.put("syncOnlineSession", syncOnlineSessionFilter(onlineSessionDAO));
    }
    filters.put("captchaValidate", captchaValidateFilter()); // 在shiro验证码过滤器
    filters.put("csrfValidateFilter", csrfValidateFilter());
    filters.put("kickout", kickoutSessionFilter(cacheManager, sessionManager));
    filters.put("logout", logoutFilter());  // 注销成功，则跳转到指定页面
    shiroFilterFactoryBean.setFilters(filters);
    return shiroFilterFactoryBean;
}

private static LinkedHashMap<String, String> setupFilterChainDefinitionMap() {
    LinkedHashMap<String, String> filterChainMap = new LinkedHashMap<>();

    // 配置过滤器链 (定义哪些资源可以匿名访问)，基本的权限强度 anon -> user[记住我] -> authc
    filterChainMap.put("/favicon.ico**", "anon");
    filterChainMap.put("/owlias.png**", "anon");
    filterChainMap.put("/html/**", "anon");
    filterChainMap.put("/css/**", "anon");
    filterChainMap.put("/docs/**", "anon");
    filterChainMap.put("/fonts/**", "anon");
    filterChainMap.put("/img/**", "anon");
    filterChainMap.put("/ajax/**", "anon");
    filterChainMap.put("/js/**", "anon");
    filterChainMap.put("/owlias/**", "anon");
    filterChainMap.put("/captcha/captchaImage**", "anon");

    // 退出 logout地址，shiro去清除session
    filterChainMap.put("/logout", "logout");

    // 不需要拦截的访问
    filterChainMap.put("/login", "anon,captchaValidate"); // 指定登录接口需先经过验证码校验

    // 注册相关
    filterChainMap.put("/register", "anon,captchaValidate");

    // 所有请求需要认证
    filterChainMap.put("/**", "user,kickout,onlineSession,syncOnlineSession,csrfValidateFilter");
    return filterChainMap;
}
```

<br>



### 过滤器家族 (Filter, AccessControlFilter, PathMatchingFilter)

* **Filter**：最基本的关卡。

* **PathMatchingFilter**：“路径匹配岗“。专门负责看你走的是哪条路，只拦截匹配特定路径的请求。例如 SyncOnlineSessionFilter。
* **AccessControlFilter**：“准入控制器”。这是所有安全拦截器的父类，例如 CaptchaValidateFilter、CsrfValidateFilter、KickoutSessionFilter、OnlineSessionFilter、它定义了两个神级方法：
  * `isAccessAllowed()`：先看看你有证吗？
  * `onAccessDenied()`：没证怎么办？是把你踢到登录页面，还是直接报警（返回 403）？

<br>





## 后勤支撑：性能与记忆



### CacheManager (缓存管理器)

可以类比成 “安保处的便签条”。用户每点一个网页都要去档案室（数据库）查一次权限，档案室压力太大了，有了这个贴墙上的便签，就不用每次都去数据库查询了。更具体地说，它负责缓存用户的权限和角色信息。第一次查完后，先记在 “便签条” 上放内存里，下次再点直接看便签，速度飞快。实际中，通常会接入 **Ehcache**、**Caffeine**、 或 **Redis**。

<br>



### RememberMeManager（老熟人通行证）

* 核心问题：用户昨天来过，今天又来了，能不能免去登录步骤？

* 实现原理：它将用户的身份信息（Principals）加密成字符串存入浏览器的 Cookie。当你下次访问时，Shiro 会自动解密并把你当做类似的 “已认证” 处理。

【注意】：RememberMe （user）的安全级别比正式登录低，涉及改密码、付钱等关键操作时，依然应该让 Shiro 要求你重新登录。

<br>



# Shiro 小结

当一个用户 (Subject）访问应用大楼时：

<span style='color:red'>大门岗哨 </span>：用户刚走到门口，ShiroFilter 立即拦截。它低头看了一眼 FilterChainDefinitionMap（安保红线图），确定这个路口是开放的（anon）还是必须查证的（authc）。

⬇

<span style='color:blue'>安保总监介入 </span>：如果是必须查证的路口，SecurityManager 立即接管，它就是大楼的 CPU，开始调度各部门协作。

⬇

<span style='color:red'>认证器身份确认 </span>：

* SecurityManager 问 Authenticator（认证器）：“他是谁？” 
* Authenticator 启动 ModularRealmAuthenticator（多库调查组），去 Realm（档案库）里翻找。
* 此时，HashedCredentialsMatcher（密码粉碎机）出场，把用户输入的明文密码 “粉碎” 后，与档案库里的密文对比。

⬇

<span style='color:blue'>工牌发放 (Session 体系) </span>：

* 身份确认后，SessionManager 登场，利用 SessionFactory（工牌生产线）现场搓出一个 “电子工牌”（Session）。
* SessionDAO（寄存柜）立刻把这个工牌信息存入 Redis 或数据库，防止大楼断电导致数据丢失。
* 与此同时，SessionValidationScheduler（巡逻保安）开始计时，盯着这个工牌看它什么时候过期。

⬇

<span style='color:blue'>老熟人识别 </span>：如果用户这次没登录，但他上次走的时候办了“老熟人通行证”，RememberMeManager 会从他兜里的 Cookie 中读取加密信息，帮他完成 “自动入场”，此时不需要发放 session “工牌”。

⬇

<span style='color:red'>授权器权限审批 </span>

* 用户想进总裁办公室，Authorizer（授权器）登场。它先问 PermissionResolver（权限解析器）：“‘这个指令代表什么权限？”
* 解析清楚后，再去 Realm 查（或缓存中）该用户是否拥有对应的权限标签。

⬇

<span style='color:blue'>效率加速 (CacheManager) </span>：为了不用每次进门都去档案室翻半天，CacheManager（安保便签本）会把查到的结果记下来。下次用户再去隔壁的财务室，保安看一眼便签就放行了。

⬇

<span style='color:red'>拦截放行 (Filter 家族) </span>：最后，AccessControlFilter（准入过滤器）根据上面的审批结果，执行动作：通过了就请进，没通过就由 onAccessDenied 方法负责把他送回登录界面或报 403。

<br>









