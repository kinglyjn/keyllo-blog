title:  Shiro的工程实践

author: kinglyjn

tags:

  - shiro


categories:

  - java

  - janusx

date: 2019-08-25 12:44:43

---



## 依赖项配置

pom.xml 关键项配置：



<!--more-->



```xml
<!--web-->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-web</artifactId>
  <version>3.5.9</version>
</dependency>

<!--thymeleaf-->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-thymeleaf</artifactId>
  <version>3.5.9</version>
</dependency>

<!-- Shiro核心框架 -->
<dependency>
  <groupId>org.apache.shiro</groupId>
  <artifactId>shiro-core</artifactId>
  <version>2.1.0</version>
</dependency>

<!-- Shiro Spring（注意这里为了使用jakarta版本而不是老版的javax，需要手动排除shiro-web） -->
<!-- 在 Maven 的继承机制中，子项目不会自动继承父项目依赖声明中的 classifier、optional、scope=provided -->
<dependency>
  <groupId>org.apache.shiro</groupId>
  <artifactId>shiro-spring</artifactId>
  <version>2.1.0</version>
  <classifier>jakarta</classifier>
  <exclusions>
    <exclusion>
      <groupId>org.apache.shiro</groupId>
      <artifactId>shiro-web</artifactId>
    </exclusion>
  </exclusions>
</dependency>
<dependency>
  <groupId>org.apache.shiro</groupId>
  <artifactId>shiro-web</artifactId>
  <version>2.1.0</version>
  <classifier>jakarta</classifier>
</dependency>

<!-- thymeleaf 和 shiro 整合 -->
<dependency>
  <groupId>com.github.theborakompanioni</groupId>
  <artifactId>thymeleaf-extras-shiro</artifactId>
  <version>2.1.0</version>
</dependency>

<!-- 缓存支持1：使用EhCache缓存 -->
<dependency>
  <groupId>org.apache.shiro</groupId>
  <artifactId>shiro-ehcache</artifactId>
  <version>2.1.0</version>
</dependency>
<dependency>
  <groupId>net.sf.ehcache</groupId>
  <artifactId>ehcache</artifactId>
  <version>2.1.0</version>
</dependency>

<!--缓存支持2：使用caffeine替代ehcache-->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-cache</artifactId>
</dependency>
<dependency>
  <groupId>com.github.ben-manes.caffeine</groupId>
  <artifactId>caffeine</artifactId>
</dependency>

<!-- 验证码 -->
<dependency>
  <groupId>pro.fessional</groupId>
  <artifactId>kaptcha</artifactId>
  <version>2.3.3</version>
  <exclusions>
    <exclusion>
      <groupId>javax.servlet</groupId>
      <artifactId>javax.servlet-api</artifactId>
    </exclusion>
    <exclusion>
      <groupId>javax.servlet</groupId>
      <artifactId>servlet-api</artifactId>
    </exclusion>
  </exclusions>
</dependency>
```

<br>



## 核心配置类

### ShiroCoreConfig

```java
import at.pollux.thymeleaf.shiro.dialect.ShiroDialect;
import com.owlias.common.constant.Constants;
import com.owlias.framework.shiro.realm.UserRealm;
import org.apache.shiro.cache.CacheManager;
import org.apache.shiro.mgt.RememberMeManager;
import org.apache.shiro.mgt.SecurityManager;
import org.apache.shiro.session.mgt.SessionManager;
import org.apache.shiro.spring.security.interceptor.AuthorizationAttributeSourceAdvisor;
import org.apache.shiro.web.mgt.DefaultWebSecurityManager;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Role;

@Configuration
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
public class ShiroCoreConfig {
    /**
     * 安全管理器
     */
    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    public SecurityManager securityManager(UserRealm userRealm,
                                           RememberMeManager rememberMeManager,
                                           CacheManager cacheManager,
                                           SessionManager sessionManager) {
        DefaultWebSecurityManager securityManager = new DefaultWebSecurityManager();
        // 设置realm
        securityManager.setRealm(userRealm);
        // 记住我
        securityManager.setRememberMeManager(rememberMe ? rememberMeManager : null);
        // 注入缓存管理器
        securityManager.setCacheManager(cacheManager);
        // session管理器
        securityManager.setSessionManager(sessionManager);
        return securityManager;
    }
  
    /**
     * 自定义Realm
     */
    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    public Realm myRealm(CacheManager cacheManager, 
                         HashedCredentialsMatcher credentialsMatcher) {
        // 使用自定义 MyRealm
        UserRealm userRealm = new UserRealm();
        // 设置加密匹配器
        userRealm.setCredentialsMatcher(credentialsMatcher);
        // 设置开启缓存（这对性能至关重要）
        userRealm.setCacheManager(cacheManager);
        userRealm.setAuthenticationCachingEnabled(true); // 开启认证缓存
        userRealm.setAuthorizationCachingEnabled(true);  // 开启授权缓存
        return userRealm;
    }
  
    /**
     * 基础密码匹配器
     */
    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    public static HashedCredentialsMatcher hashedCredentialsMatcher() {
        HashedCredentialsMatcher matcher = new HashedCredentialsMatcher();
        matcher.setHashAlgorithmName("MD5"); // 以 MD5 算法为例
        matcher.setHashIterations(1);  // 循环次数
        return matcher;
    }
  
    /**
     * thymeleaf 和 shiro 整合
     */
    @Bean
    public ShiroDialect shiroDialect() {
        return new ShiroDialect();
    }
  
    /**
     * 开启Shiro注解通知器
     * 必须是 static，确保切面处理器尽早加载，不依赖 ShiroConfig 的实例
     */
    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    public static AuthorizationAttributeSourceAdvisor authorizationAttributeSourceAdvisor(
            @Qualifier("securityManager") SecurityManager securityManager) {
        AuthorizationAttributeSourceAdvisor authorizationAttributeSourceAdvisor = new AuthorizationAttributeSourceAdvisor();
        authorizationAttributeSourceAdvisor.setSecurityManager(securityManager);
        return authorizationAttributeSourceAdvisor;
    }
}
```

<br>



### UserRealm

```java
@Slf4j
public class UserRealm extends AuthorizingRealm {
    public static final String REALM_NAME = "UserRealm";
  	
  	@Resource
    @Lazy // 打断启动时的循环依赖链
    private UserService userService;
  	
    public UserRealm() {
        // 在构造阶段就定好名字，确保任何初始化逻辑拿到的都是这个缓存
        super.setAuthenticationCacheName("sys-authenCache");
        super.setAuthorizationCacheName("sys-authorCache");
    }

    @Override
    public String getName() {
        return REALM_NAME;
    }  	
  
    /**
     * 获取授权信息
     */
    @Override
    protected AuthorizationInfo doGetAuthorizationInfo(PrincipalCollection principals) {
        SysUser user = ShiroUtils.getSysUser();
        // 角色列表
        Set<String> roles;
        // 功能列表
        Set<String> menus;
        SimpleAuthorizationInfo info = new SimpleAuthorizationInfo();
        // 管理员拥有所有权限
        if (user.isAdmin()) {
            info.addRole("admin");
            info.addStringPermission("*:*:*");
        } else {
            roles = roleService.selectRoleKeys(user.getUserId());
            menus = menuService.selectPermsByUserId(user.getUserId());
            // 角色加入AuthorizationInfo认证对象
            info.setRoles(roles);
            // 权限加入AuthorizationInfo认证对象
            info.setStringPermissions(menus);
        }
        return info;
    }
  
    /**
     * 获取认证信息
     */
    @Override
    protected AuthenticationInfo doGetAuthenticationInfo(AuthenticationToken authenticationToken) throws AuthenticationException {
        UsernamePasswordToken token = (UsernamePasswordToken) authenticationToken;
        String loginName = token.getUsername();
        SysUser user = userService.selectUserByLoginName(username);
        if (Objects.isNull(user)) {
            return null;
        }
        String password = user.getPassword();
        ByteSource salt = ByteSource.Util.bytes(user.getSalt()); // 放盐
        return new SimpleAuthenticationInfo(loginName, password, salt, getName());
    }
}
```

<br>



### 基本的身份认证逻辑

MyToken

```java
public class MyToken extends UsernamePasswordToken {
    @Getter
    @Setter
    private int userType; // 这是我们新加的业务字段

    public MyToken(String username, String password, int userType) {
        super(username, password);
        this.setUserType(userType);
    }

    public MyToken(String username, String password, boolean rememberMe, int userType) {
        super(username, password, rememberMe);
        this.setUserType(userType);
    }
}
```

登录 ：

```java
// Controller 调用
userService.checkLogin(username, password, rememberMe, userType);

// Service 核心认证逻辑
public void checkLogin(String username, String password, boolean rememberMe, int userType) {
    // 防御逻辑：验证码校验、用户合法性校验、IP黑名单、业务黑名单等等
    
    // core
    MyToken token = new MyToken(username, password, rememberMe, userType);
    Subject subject = SecurityUtils.getSubject();  // 从当前线程（ThreadLocal）中拿得当前用户
    subject.login(token);  //// 【认证流程核心源码】
    
    // 登陆成功：记录登录日志、设置用户的业务角色和业务权限等
}
```

注册：

```java
// Controller 调用
registerService.register(user);

// Service 核心注册逻辑
public String register(SysUser user) {
   // 防御逻辑：验证码校验、用户合法性校验等
   
   // core
   // 生成加密密码和盐
   user.setUserName(loginName);
   user.setSalt(PasswordUtils.getRandomSalt());
   user.setPassword(PasswordUtils.encryptPassword(password, salt));
   boolean result = userService.registerUser(user);
  
   // 注册成功：记录日志。。
}
```

<br>



## 加入本地缓存支持

无论哪种缓存，最终需要：

```java
// 注入缓存管理器
securityManager.setCacheManager(cacheManager);
```

<br>

### 缓存方式一：EhCache

ShiroCacheConfig：

```java
@Configuration
@Role(BeanDefinition.ROLE_INFRASTRUCTURE) // 标记为基础设施
public class ShiroCacheConfig {
    /**
     * 缓存管理器：将 EH CacheManager 包装为 shiro CacheManager
     * 相关API封装，请参考 {@link CacheUtils}
     */
    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    public CacheManager cacheManager() {
        net.sf.ehcache.CacheManager ehCacheManager = net.sf.ehcache.CacheManager.getCacheManager("owlias");
        if (StringUtils.isNull(ehCacheManager)) {
            ehCacheManager = new net.sf.ehcache.CacheManager(getCacheManagerConfigFileInputStream());
        }
        EhCacheManager em = new EhCacheManager();
        em.setCacheManager(ehCacheManager);
        return em;
    }

    /**
     * 返回配置文件流 避免ehcache配置文件一直被占用，无法完全销毁项目重新部署
     */
    protected InputStream getCacheManagerConfigFileInputStream() {
        String configFile = "classpath:ehcache/ehcache-shiro.xml";
        InputStream inputStream = null;
        try {
            inputStream = ResourceUtils.getInputStreamForPath(configFile);
            byte[] b = IOUtils.toByteArray(inputStream);
            return new ByteArrayInputStream(b);
        } catch (IOException e) {
            throw new ConfigurationException("Unable to obtain input stream for cacheManagerConfigFile [" + configFile + "]", e);
        } finally {
            IOUtils.closeQuietly(inputStream);
        }
    }
}
```

ehcache-shiro.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ehcache name="owlias" updateCheck="false">

    <!-- 磁盘缓存位置 -->
    <diskStore path="java.io.tmpdir"/>

    <!-- maxEntriesLocalHeap：堆内存中最大缓存对象数，0没有限制 -->
    <!-- maxElementsInMemory：在内存中缓存的element的最大数目。-->
    <!-- eternal：elements是否永久有效，如果为true，timeouts将被忽略，element将永不过期 -->
    <!-- timeToIdleSeconds：失效前的空闲秒数，当eternal为false时，这个属性才有效，0为不限制 -->
    <!-- timeToLiveSeconds：失效前的存活秒数，创建时间到失效时间的间隔为存活时间，当eternal为false时，这个属性才有效，0为不限制 -->
    <!-- overflowToDisk：如果内存中数据超过内存限制，是否要缓存到磁盘上 -->
    <!-- statistics：是否收集统计信息。如果需要监控缓存使用情况，应该打开这个选项。默认为关闭（统计会影响性能）。这个属性已废弃 -->

    <!-- 默认缓存 -->
    <defaultCache
            maxEntriesLocalHeap="1000"
            eternal="false"
            timeToIdleSeconds="3600"
            timeToLiveSeconds="3600"
            overflowToDisk="false">
    </defaultCache>

    <!-- 登录记录缓存 锁定10分钟 -->
    <cache name="loginRecordCache"
           maxEntriesLocalHeap="2000"
           eternal="false"
           timeToIdleSeconds="600"
           timeToLiveSeconds="0"
           overflowToDisk="false">
    </cache>

    <!-- 系统活跃用户缓存 -->
    <cache name="sys-userCache"
           maxEntriesLocalHeap="10000"
           overflowToDisk="false"
           eternal="false"
           diskPersistent="false"
           timeToLiveSeconds="0"
           timeToIdleSeconds="0">
    </cache>

    <!-- 系统用户认证缓存  没必要过期 -->
    <cache name="sys-authenCache"
           maxEntriesLocalHeap="10000"
           overflowToDisk="false"
           eternal="false"
           diskPersistent="false"
           timeToLiveSeconds="0"
           timeToIdleSeconds="0"
           memoryStoreEvictionPolicy="LRU"/>
 	
    <!-- 系统用户授权缓存  没必要过期 -->
    <cache name="sys-authorCache"
           maxEntriesLocalHeap="10000"
           overflowToDisk="false"
           eternal="false"
           diskPersistent="false"
           timeToLiveSeconds="0"
           timeToIdleSeconds="0"
           memoryStoreEvictionPolicy="LRU"/>

    <!-- 系统缓存 -->
    <cache name="sys-cache"
           maxEntriesLocalHeap="1000"
           eternal="true"
           overflowToDisk="true">
    </cache>

    <!-- 系统参数缓存 -->
    <cache name="sys-config"
           maxEntriesLocalHeap="1000"
           eternal="true"
           overflowToDisk="true">
    </cache>

    <!-- 系统字典缓存 -->
    <cache name="sys-dict"
           maxEntriesLocalHeap="1000"
           eternal="true"
           overflowToDisk="true">
    </cache>

    <!-- 系统会话缓存 -->
    <cache name="shiro-activeSessionCache"
           maxEntriesLocalHeap="10000"
           overflowToDisk="false"
           eternal="false"
           diskPersistent="false"
           timeToLiveSeconds="0"
           timeToIdleSeconds="0"/>
</ehcache>
```

适配工具类：

```java
import com.owlias.common.utils.spring.SpringUtils;
import lombok.extern.slf4j.Slf4j;
import org.apache.shiro.cache.Cache;
import org.apache.shiro.cache.CacheManager;
import org.apache.shiro.cache.ehcache.EhCacheManager;
import java.util.Iterator;
import java.util.Set;

@Slf4j
public class CacheUtils {
    /**
     * 此处使用的 cacheManager 是 shiro 包装的 cache。
     * 也可以用原生的 ehcache API，各有利弊：使用 shiro 包装可以方便切换到如 redis cache，使用原生 ehcache API 性能和 API 更丝滑
     */
    private static final CacheManager cacheManager = SpringUtils.getBean(CacheManager.class);

    private static final String SYS_CACHE = "sys-cache";


    /**
     * 获取SYS_CACHE缓存
     *
     * @param key
     * @return
     */
    public static Object get(String key) {
        return get(SYS_CACHE, key);
    }

    /**
     * 获取SYS_CACHE缓存
     *
     * @param key
     * @param defaultValue
     * @return
     */
    public static Object get(String key, Object defaultValue) {
        Object value = get(key);
        return value != null ? value : defaultValue;
    }

    /**
     * 写入SYS_CACHE缓存
     *
     * @param key
     * @return
     */
    public static void put(String key, Object value) {
        put(SYS_CACHE, key, value);
    }

    /**
     * 从SYS_CACHE缓存中移除
     *
     * @param key
     * @return
     */
    public static void remove(String key) {
        remove(SYS_CACHE, key);
    }

    /**
     * 获取缓存
     *
     * @param cacheName
     * @param key
     * @return
     */
    public static Object get(String cacheName, String key) {
        return getCache(cacheName).get(getKey(key));
    }

    /**
     * 获取缓存
     *
     * @param cacheName
     * @param key
     * @param defaultValue
     * @return
     */
    public static Object get(String cacheName, String key, Object defaultValue) {
        Object value = get(cacheName, getKey(key));
        return value != null ? value : defaultValue;
    }

    /**
     * 写入缓存
     *
     * @param cacheName
     * @param key
     * @param value
     */
    public static void put(String cacheName, String key, Object value) {
        getCache(cacheName).put(getKey(key), value);
    }

    /**
     * 从缓存中移除
     *
     * @param cacheName
     * @param key
     */
    public static void remove(String cacheName, String key) {
        getCache(cacheName).remove(getKey(key));
    }

    /**
     * 从缓存中移除所有
     *
     * @param cacheName
     */
    public static void removeAll(String cacheName) {
        Cache<String, Object> cache = getCache(cacheName);
        Set<String> keys = cache.keys();
        for (Iterator<String> it = keys.iterator(); it.hasNext(); ) {
            cache.remove(it.next());
        }
        log.info("[removeAll] 清理缓存：{} => {}", cacheName, keys);
    }

    /**
     * 从缓存中移除指定key
     *
     * @param keys
     */
    public static void removeByKeys(Set<String> keys) {
        removeByKeys(SYS_CACHE, keys);
    }

    /**
     * 从缓存中移除指定key
     *
     * @param cacheName
     * @param keys
     */
    public static void removeByKeys(String cacheName, Set<String> keys) {
        for (Iterator<String> it = keys.iterator(); it.hasNext(); ) {
            remove(it.next());
        }
        log.info("[removeByKeys] 清理缓存：{} => {}", cacheName, keys);
    }

    /**
     * 获取缓存键名
     *
     * @param key
     * @return
     */
    private static String getKey(String key) {
        return key;
    }

    /**
     * 获得一个Cache，没有则显示日志。
     *
     * @param cacheName
     * @return
     */
    public static Cache<String, Object> getCache(String cacheName) {
        Cache<String, Object> cache = cacheManager.getCache(cacheName);
        if (cache == null) {
            throw new RuntimeException("当前系统中没有定义“" + cacheName + "”这个缓存。");
        }
        return cache;
    }

    /**
     * 获取所有缓存
     *
     * @return 缓存组
     */
    public static String[] getCacheNames() {
        return ((EhCacheManager) cacheManager).getCacheManager().getCacheNames();
    }
}
```

<br>



### 缓存方式二：shiro and caffeine 原生风格

ShiroCacheConfig：

```java
@Configuration
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
public class ShiroCacheConfig {
    /**
     * shiro缓存管理器（只在在此处切换缓存实现即可）
     * type1：caffeine for shiro 缓存
     */
    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    public CacheManager shiroCacheManager(CaffeineProperties caffeineProperties) {
        return new ShiroStyleCacheManager(caffeineProperties);
    }
}
```

CaffeineProperties：

```java
@Data
@Component
@ConfigurationProperties(prefix = "caffeine")
@Role(BeanDefinition.ROLE_INFRASTRUCTURE) // 告诉 Spring 这是一个基础设施 Bean，不需要查它的岗
public class CaffeineProperties {
    private int initialCapacity = 100;
    private long maximumSize = 1000;
    private Duration expireAfterWrite = Duration.ofMinutes(30);
    private Duration expireAfterAccess;
}
```

application.yml

```yaml
caffeine:
  # 初始缓存容量（同一个key就对应一个缓存名额，比如 authCache+userId1、authCache+userId2 就是两条缓存）
  initial-capacity: 1000
  # 最大条目数（当20001条数据想要挂上来时，缓存会根据类似LRU算法，自动把架子上最久没人碰的东西扔掉，腾出位置给新人）
  maximum-size: 20000
  # 写入后多久过期（例如：30分钟）
  expire-after-write: 30m
  # 访问后多久过期
  expire-after-access: 10m
```

ShiroStyleCacheManager：

```java
import com.demo.config.cache.CaffeineProperties;
import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.extern.slf4j.Slf4j;
import org.apache.shiro.cache.AbstractCacheManager;
import org.apache.shiro.cache.Cache;
import org.apache.shiro.cache.CacheException;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;
import java.lang.reflect.Field;
import java.util.Collections;
import java.util.Map;
import java.util.Set;

/**
 * @author KJ
 * @description Shiro 原生风格的缓存管理器：继承 Shiro 提供的抽象类，它已经处理了缓存实例的并发缓存逻辑
 */
@Slf4j
public class ShiroStyleCacheManager extends AbstractCacheManager implements ApplicationContextAware {

    private ApplicationContext applicationContext; // 运行时容器
    private CaffeineProperties caffeineProperties;

    public ShiroStyleCacheManager(CaffeineProperties caffeineProperties) {
        this.caffeineProperties = caffeineProperties;
    }

    @Override
    public void setApplicationContext(ApplicationContext applicationContext) {
        this.applicationContext = applicationContext;
    }

    /**
     * 实现这个模板方法即可，Shiro 父类会保证：
     * 1. 线程安全
     * 2. 同样的 name 只会调用一次这个方法
     */
    @Override
    protected <K, V> Cache<K, V> createCache(String name) throws CacheException {
        Caffeine<Object, Object> builder = Caffeine.newBuilder()
                .initialCapacity(caffeineProperties.getInitialCapacity())
                .maximumSize(caffeineProperties.getMaximumSize())
                .recordStats();
        if (caffeineProperties.getExpireAfterWrite() != null) builder.expireAfterWrite(caffeineProperties.getExpireAfterWrite());
        if (caffeineProperties.getExpireAfterAccess() != null) builder.expireAfterAccess(caffeineProperties.getExpireAfterAccess());
        com.github.benmanes.caffeine.cache.Cache<K, V> nativeCache = builder.build();

        // 手动绑定到 Actuator 监控
        // 要代码中出现了 MeterRegistry.class 或 CaffeineCacheMetrics 的直接引用，JVM 在加载这个类时就必须解析这些类型。
        // Spring 发现这些类型属于 Actuator (Metrics) 模块，于是为了保证安全，它会提前拉起整个 Actuator 的自动配置
        /*try {
            MeterRegistry meterRegistry = applicationContext.getBean(MeterRegistry.class);
            CaffeineCacheMetrics.monitor(meterRegistry, nativeCache, name);
        } catch (BeansException e) {
            log.warn("bind meterRegistry failed");
        }*/
        return new ShiroStyleCacheAdapter<>(name, nativeCache);
    }


    /**
     * 利用反射获取所有已注册的缓存名称
     */
    public Set<String> getRegisteredCacheNames() {
        try {
            // 突破父类 AbstractCacheManager 的私有 caches 字段
            Field field = AbstractCacheManager.class.getDeclaredField("caches");
            field.setAccessible(true);
            Map<String, ?> caches = (Map<String, ?>) field.get(this);
            return Collections.unmodifiableSet(caches.keySet());
        } catch (Exception e) {
            return Collections.emptySet();
        }
    }
}
```

缓存适配器 ShiroStyleCacheAdapter：

```java
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.shiro.cache.Cache;
import org.apache.shiro.cache.CacheException;
import java.util.Collection;
import java.util.Set;

/**
 * @author KJ
 * @description Shiro 原生风格的缓存适配层实现
 */
@Slf4j
public class ShiroStyleCacheAdapter<K, V> implements Cache<K, V> {

    @Getter
    private final com.github.benmanes.caffeine.cache.Cache<K, V> nativeCache;
    private final String cacheName;

    public ShiroStyleCacheAdapter(String cacheName, com.github.benmanes.caffeine.cache.Cache<K, V> nativeCache) {
        this.cacheName = cacheName;
        this.nativeCache = nativeCache;
    }

    @Override
    public V get(K key) throws CacheException {
        V value = nativeCache.getIfPresent(key);
        log.info("从缓存 [{}] 获取数据 key: [{}]", cacheName, key);
        return value;
    }

    @Override
    public V put(K key, V value) throws CacheException {
        nativeCache.put(key, value);
        log.info("写入缓存 [{}] key: [{}]", cacheName, key);
        return value;
    }

    @Override
    public V remove(K key) throws CacheException {
        V previous = nativeCache.getIfPresent(key);
        nativeCache.invalidate(key);
        log.info("删除缓存 [{}] key: [{}]", cacheName, key);
        return previous;
    }

    @Override
    public void clear() throws CacheException {
        log.info("清空缓存 [{}]", cacheName);
        nativeCache.invalidateAll();
    }

    @Override
    public int size() {
        return (int) nativeCache.estimatedSize();
    }

    @Override
    public Set<K> keys() {
        return nativeCache.asMap().keySet();
    }

    @Override
    public Collection<V> values() {
        return nativeCache.asMap().values();
    }
}
```

<br>



### 缓存方式三：shiro and caffeine Spring 风格

SpringCacheConfig：

```java
@Configuration
@EnableCaching
public class SpringCacheConfig {
    /**
     * 1. 定义 Spring 标准的 CacheManager
     * 这里的配置会覆盖 yml 中的通用配置，或者作为默认实现
     */
    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    public static CacheManager springCacheManager(CaffeineProperties caffeineProperties) {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();
        // 这里可以手动配置，也可以依赖 yml 里的 spring.cache.caffeine.spec
        cacheManager.setCaffeine(Caffeine.newBuilder()
                .initialCapacity(caffeineProperties.getInitialCapacity())
                .maximumSize(caffeineProperties.getMaximumSize())
                .expireAfterWrite(caffeineProperties.getExpireAfterWrite())
                .expireAfterAccess(caffeineProperties.getExpireAfterAccess())
                .recordStats());
        return cacheManager;
    }
}
```

ShiroSpringCacheManager：

```java
public class ShiroSpringCacheManager implements org.apache.shiro.cache.CacheManager {
    private final org.springframework.cache.CacheManager springCacheManager;
    public ShiroSpringCacheManager(org.springframework.cache.CacheManager springCacheManager) {
        this.springCacheManager = springCacheManager;
    }

    @Override
    public <K, V> org.apache.shiro.cache.Cache<K, V> getCache(String name) throws CacheException {
        // 直接向 Spring 要缓存实例
        org.springframework.cache.Cache springCache = springCacheManager.getCache(name);
        if (springCache == null) {
            throw new CacheException("未在 Spring 中找到名为 " + name + " 的缓存配置");
        }
        return new ShiroSpringCacheAdapter<>(name, springCache);
    }
}
```

ShiroSpringCacheAdapter：

```java
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.shiro.cache.CacheException;
import java.util.Collection;
import java.util.Set;

/**
 * @author KJ
 * @description shiro spring cache 适配层实现
 */
@Slf4j
public class ShiroSpringCacheAdapter<K, V> implements org.apache.shiro.cache.Cache<K, V> {

    @Getter
    private final org.springframework.cache.Cache nativeCache;
    private final String cacheName;

    public ShiroSpringCacheAdapter(String cacheName, org.springframework.cache.Cache nativeCache) {
        this.cacheName = cacheName;
        this.nativeCache = nativeCache;
    }

    @Override
    public V get(K key) throws CacheException {
        V value = (V) nativeCache.get(key, Object.class);
        log.info("从缓存 [{}] 获取数据 key: [{}]", cacheName, key);
        return value;
    }

    @Override
    public V put(K key, V value) throws CacheException {
        nativeCache.put(key, value);
        log.info("写入缓存 [{}] key: [{}]", cacheName, key);
        return value;
    }

    @Override
    public V remove(K key) throws CacheException {
        V previous = get(key);
        nativeCache.evict(key);
        log.info("删除缓存 [{}] key: [{}]", cacheName, key);
        return previous;
    }

    @Override
    public void clear() throws CacheException {
        nativeCache.clear();
        log.info("清空缓存 [{}]", cacheName);
    }

    @Override
    public int size() {
        // 从 nativeCache (Caffeine) 获取准确数量
        var nativeCache = (com.github.benmanes.caffeine.cache.Cache<?, ?>) this.nativeCache.getNativeCache();
        return (int) nativeCache.estimatedSize();
    }

    @Override
    public Set<K> keys() {
        var nativeCache = (com.github.benmanes.caffeine.cache.Cache<K, V>) this.nativeCache.getNativeCache();
        return nativeCache.asMap().keySet();
    }

    @Override
    public Collection<V> values() {
        var nativeCache = (com.github.benmanes.caffeine.cache.Cache<K, V>) this.nativeCache.getNativeCache();
        return nativeCache.asMap().values();
    }
}
```

<br>



##  加入记住我功能支持

**核心原理 **：

Session：通常随着浏览器关闭或超时（如 30 分钟无操作）而销毁。

Cookie：可以设置很长。“记住我” 功能就是把一个特殊的 Token 存入持久化 Cookie，哪怕你关了电脑，下次开机它还在。

<br>

注册 ”记住我管理器“：

```java
// 记住我
securityManager.setRememberMeManager(rememberMe ? rememberMeManager : null);
```

ShiroRememberMeConfig：

```java
/**
 * @author KJ
 * @description shiro rememberMe 配置（核心逻辑是“没有 Session，但仍有身份”）
 */
@Configuration
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
public class ShiroRememberMeConfig {

    @Value("${shiro.cookie.cipherKey}")
    private String cipherKey;           // 设置cipherKey密钥
    @Value("${shiro.cookie.domain}")
    private String domain;              // 设置Cookie的域名
    @Value("${shiro.cookie.path}")
    private String path = "/";          // 设置cookie的有效访问路径
    @Value("${shiro.cookie.httpOnly}")
    private boolean httpOnly = true;    // 设置HttpOnly属性
    @Value("${shiro.cookie.maxAge}")
    private int maxAge = 30;            // 设置Cookie的过期时间


    /**
     * 记住我
     */
    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    public RememberMeManager rememberMeManager() {
        CustomCookieRememberMeManager cookieRememberMeManager = new CustomCookieRememberMeManager();
        cookieRememberMeManager.setCookie(rememberMeCookie());
        if (StringUtils.isNotEmpty(cipherKey)) {
            cookieRememberMeManager.setCipherKey(Base64.decode(cipherKey));
        } else {
            cookieRememberMeManager.setCipherKey(CipherUtils.generateNewKey(128, "AES").getEncoded()); // 🤔
        }
        return cookieRememberMeManager;
    }

    /**
     * cookie 属性设置：
     * 开启了记住我，下发者是 RememberMeManager，默认下发的cookie名称是 rememberMe、包含了身份的加密的持久化 cookie，过期取决于你设置的 maxAge
     * 没有开启记住我，下发者是 SessionManiager，默认下发的cookie名称是 JSESSIONID、仅包含JID的临时内存 cookie（默认 maxAge为-1 浏览器关闭即消失）
     */
    public SimpleCookie rememberMeCookie() {
        SimpleCookie cookie = new SimpleCookie("rememberMe");
        cookie.setDomain(domain);
        cookie.setPath(path);
        cookie.setHttpOnly(httpOnly);
        cookie.setMaxAge(maxAge * 24 * 60 * 60);
        return cookie;
    }

    /*public static void main(String[] args) {
        Key key = CipherUtils.generateNewKey(128, "AES");
        String base64Encoded = Base64.encodeToString(key.getEncoded());
        System.out.println("cipherKey: " + base64Encoded);
    }*/
}
```

CustomCookieRememberMeManager：

```java
import com.owlias.common.model.entity.SysRole;
import com.owlias.common.model.entity.SysUser;
import com.owlias.common.utils.spring.SpringUtils;
import com.owlias.framework.shiro.service.SysLoginService;
import org.apache.shiro.subject.PrincipalCollection;
import org.apache.shiro.subject.Subject;
import org.apache.shiro.subject.SubjectContext;
import org.apache.shiro.web.mgt.CookieRememberMeManager;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 自定义 CookieRememberMeManager：
 *
 * 在 Shiro 的默认逻辑里，“记住我”会把用户的所有身份信息（包括角色、权限字符串等）全部打包、序列化、加密后塞进 Cookie。
 * 如果一个用户权限很多，这个 Cookie 会变得极其臃肿。这个类的核心作用：存的时候 “脱水瘦身”，取的时候 “加水还原”。
 */
public class CustomCookieRememberMeManager extends CookieRememberMeManager {
    /**
     * 存入阶段：记住我时去掉角色的 permissions 权限字符串，防止http请求头过大（Http 431 错误）。
     * 触发时机：当用户在登录页面勾选了“记住我（Remember Me）”，并且登录成功时。
     */
    @Override
    protected void rememberIdentity(Subject subject, PrincipalCollection principalCollection) {
        Map<SysRole, Set<String>> rolePermissions = new HashMap<>();
        // 清除角色的permissions权限字符串
        for (Object principal : principalCollection) {
            if (principal instanceof SysUser) {
                List<SysRole> roles = ((SysUser) principal).getRoles();
                for (SysRole role : roles) {
                    rolePermissions.put(role, role.getPermissions());
                    role.setPermissions(null);
                }
            }
        }
        byte[] bytes = convertPrincipalsToBytes(principalCollection);
        // 恢复角色的permissions权限字符串
        for (Object principal : principalCollection) {
            if (principal instanceof SysUser) {
                List<SysRole> roles = ((SysUser) principal).getRoles();
                for (SysRole role : roles) {
                    role.setPermissions(rolePermissions.get(role));
                }
            }
        }
        rememberSerializedIdentity(subject, bytes);
    }

    /**
     * 读取阶段：取记住我身份时恢复角色permissions权限字符串。
     * 触发时机：当用户关闭浏览器后重新打开，或者 Session 已经失效，但用户再次访问系统时调用一次，并不是在每个请求（Request）时都会调用。
     * 当用户第一次通过“记住我”身份进入系统时，Shiro 会调用这个方法恢复身份。一旦恢复成功，Shiro 就会为这个用户创建一个新的 Session。
     */
    @Override
    public PrincipalCollection getRememberedPrincipals(SubjectContext subjectContext) {
        PrincipalCollection principals = super.getRememberedPrincipals(subjectContext);
        if (principals == null || principals.isEmpty()) {
            return principals;
        }
        for (Object principal : principals) {
            if (principal instanceof SysUser) {
                SpringUtils.getBean(SysLoginService.class).setRolePermission((SysUser) principal);
            }
        }
        return principals;
    }
}
```

<br>



## Session 管理器支持

注册 session 管理器：

```java
// session管理器
securityManager.setSessionManager(sessionManager);
```

<br>

### ShiroSessionConfig

```java
package com.owlias.framework.shiro;

import com.owlias.framework.shiro.session.OnlineSessionDAO;
import com.owlias.framework.shiro.session.OnlineSessionFactory;
import com.owlias.framework.shiro.session.OnlineWebSessionManager;
import com.owlias.framework.shiro.session.SpringSessionValidationScheduler;
import org.apache.shiro.cache.CacheManager;
import org.apache.shiro.session.mgt.SessionFactory;
import org.apache.shiro.session.mgt.SessionManager;
import org.apache.shiro.session.mgt.eis.SessionDAO;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Role;
import java.util.concurrent.ScheduledExecutorService;

/**
 * @author KJ
 * @description shiro 会话配置
 */
@Configuration
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
public class ShiroSessionConfig {

    @Value("${shiro.session.expireTime}")
    private int expireTime = 30;                   // Session超时时间（默认30分钟）
    @Value("${shiro.session.validationInterval}")
    private int validationInterval = 10;           // 相隔多久检查一次session的有效性，单位毫秒，默认就是10分钟
    @Value("${shiro.session.dbSyncPeriod}")
    private int dbSyncPeriod = 1;                  // 同步session到数据库的周期（默认1分钟）

    /**
     * 会话管理器
     */
    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    public SessionManager sessionManager(CacheManager cacheManager,
                                         SpringSessionValidationScheduler scheduler,
                                         SessionDAO sessionDAO,
                                         SessionFactory sessionFactory) {
        OnlineWebSessionManager manager = new OnlineWebSessionManager();
        // 加入缓存管理器
        manager.setCacheManager(cacheManager);
        // 删除过期的session
        manager.setDeleteInvalidSessions(true);
        // 设置全局session超时时间
        manager.setGlobalSessionTimeout((long) expireTime * 60 * 1000);
        // 去掉 JSESSIONID。不希望在 URL 后面看到冗长的 “;JSESSIONID=xxx”，禁掉它，让 URL 保持整洁。
        manager.setSessionIdUrlRewritingEnabled(false);

        /**
         * 【打破循环引用】：SessionManager 需要 Scheduler，而 Scheduler 又需要调用 SessionManager.validateSessions()。
         * 在 @Component 模式下，这种双向依赖经常触发 BeanPostProcessorChecker 警告。
         * 在 ShiroConfig 里手动 set，Spring 只把它们当成普通的 Setter 处理，不会在依赖查找上卡死。
         */
        scheduler.setSessionManager(manager);
        // 定义要使用的无效的Session定时调度器
        manager.setSessionValidationScheduler(scheduler);
        // 是否定时检查session
        manager.setSessionValidationSchedulerEnabled(true);

        // 自定义SessionDao
        manager.setSessionDAO(sessionDAO);
        // 自定义sessionFactory
        manager.setSessionFactory(sessionFactory);
        return manager;
    }

    /**
     * 自定义 sessionDAO 会话（预留持久化会话能力）
     */
    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    public SessionDAO sessionDAO() {
        OnlineSessionDAO sessionDAO = new OnlineSessionDAO();
        sessionDAO.setDbSyncPeriod(dbSyncPeriod); // 手动设置
        return sessionDAO;
    }

    /**
     * 自定义 sessionFactory 会话（会话生成器）
     */
    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE) // 标记为基础设施
    public SessionFactory sessionFactory() {
        return new OnlineSessionFactory();
    }

    /**
     * 显式声明调度器 Bean（过期会话定时清理器）
     */
    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    public SpringSessionValidationScheduler springSessionValidationScheduler(
            @Qualifier("scheduledExecutorService") ScheduledExecutorService executor) {

        SpringSessionValidationScheduler scheduler = new SpringSessionValidationScheduler();

        // 从配置文件读取间隔（或者直接传变量）
        scheduler.setSessionValidationInterval(validationInterval);

        // 关键：延迟获取线程池，只有在真正 enable 的时候才去容器拿
        scheduler.setExecutorService(executor);
        return scheduler;
    }
}
```

<br>

### OnlineWebSessionManager

```java
import com.owlias.common.constant.ShiroConstants;
import com.owlias.common.model.entity.SysUserOnline;
import com.owlias.common.utils.DateUtils;
import com.owlias.common.utils.spring.BeanUtils;
import com.owlias.common.utils.spring.SpringUtils;
import com.owlias.common.utils.str.StringUtils;
import com.owlias.system.service.SysUserOnlineService;
import lombok.extern.slf4j.Slf4j;
import org.apache.shiro.session.ExpiredSessionException;
import org.apache.shiro.session.InvalidSessionException;
import org.apache.shiro.session.Session;
import org.apache.shiro.session.mgt.DefaultSessionKey;
import org.apache.shiro.session.mgt.SessionKey;
import org.apache.shiro.web.session.mgt.DefaultWebSessionManager;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;
import java.util.List;

/**
 * 属性变更的 “智能传感器” (setAttribute / removeAttribute)
 * 解决的问题：在分布式或需要持久化 Session 的系统中，如果用户修改了 Session 里的某个值（比如切换了语言、更新了头像），系统该应高效地同步数据库
 *
 * @author KJ
 */
@Slf4j
public class OnlineWebSessionManager extends DefaultWebSessionManager {

    @Override
    public void setAttribute(SessionKey sessionKey, Object attributeKey, Object value) throws InvalidSessionException {
        super.setAttribute(sessionKey, attributeKey, value);
        if (value != null && needMarkAttributeChanged(attributeKey)) {
            OnlineSession session = getOnlineSession(sessionKey);
            session.markAttributeChanged();
        }
    }

    private boolean needMarkAttributeChanged(Object attributeKey) {
        if (attributeKey == null) {
            return false;
        }
        String attributeKeyStr = attributeKey.toString();
        // 优化 flash属性没必要持久化
        if (attributeKeyStr.startsWith("org.springframework")) {
            return false;
        }
        if (attributeKeyStr.startsWith("javax.servlet")) {
            return false;
        }
        if (attributeKeyStr.equals(ShiroConstants.CURRENT_USERNAME)) {
            return false;
        }
        return true;
    }

    @Override
    public Object removeAttribute(SessionKey sessionKey, Object attributeKey) throws InvalidSessionException {
        Object removed = super.removeAttribute(sessionKey, attributeKey);
        if (removed != null) {
            OnlineSession s = getOnlineSession(sessionKey);
            s.markAttributeChanged();
        }
        return removed;
    }

    public OnlineSession getOnlineSession(SessionKey sessionKey) {
        OnlineSession session = null;
        Object obj = doGetSession(sessionKey);
        if (StringUtils.isNotNull(obj)) {
            session = new OnlineSession();
            BeanUtils.copyBeanProp(session, obj); // 浅拷贝、并且只看 getter/setter；不复制静态和 final 属性
        }
        return session;
    }

    /**
     * 验证 session 是否有效，用于删除过期 session 的缓存和数据库记录
     *
     * 触发时机：
     * 1. 定时主动触发：由 ShiroSessionManager 配置的 validationInterval 决定
     * 2. 开发者手动触发：某些特定的业务场景下（比如管理员在后台点击“强制清理所有无效会话”按钮），你可以通过代码手动调用
     */
    @Override
    public void validateSessions() {
        if (log.isInfoEnabled()) {
            log.info("invalidation sessions...");
        }

        int invalidCount = 0;

        int timeout = (int) this.getGlobalSessionTimeout();
        if (timeout < 0) {
            // 永不过期不进行处理
            return;
        }
        Date expiredDate = DateUtils.addMilliseconds(new Date(), -timeout);
        SysUserOnlineService userOnlineService = SpringUtils.getBean(SysUserOnlineService.class);
        // 任何“最后访问时间”早于这个点的 Session，都被视为已经过期的嫌疑人。
        List<SysUserOnline> userOnlineList = userOnlineService.selectOnlineByExpired(expiredDate);
        // 批量过期删除
        List<String> needOfflineIdList = new ArrayList<>();
        for (SysUserOnline userOnline : userOnlineList) {
            try {
                SessionKey key = new DefaultSessionKey(userOnline.getSessionId());
                Session session = retrieveSession(key);  // 尝试去拿真实的 Session
                if (session != null) {
                    throw new InvalidSessionException(); // 如果能拿到，手动抛出异常进入清理逻辑
                }
            } catch (InvalidSessionException e) {
                // 只有进入这个 Catch，才说明该 Session 真的该被清理了
                if (log.isDebugEnabled()) {
                    boolean expired = (e instanceof ExpiredSessionException);
                    String msg = "Invalidated session with id [" + userOnline.getSessionId() + "]"
                            + (expired ? " (expired)" : " (stopped)");
                    log.debug(msg);
                }
                invalidCount++;
                needOfflineIdList.add(userOnline.getSessionId());
                userOnlineService.removeUserCache(userOnline.getLoginName(), userOnline.getSessionId());
            }

        }
        if (!needOfflineIdList.isEmpty()) {
            try {
                userOnlineService.batchDeleteOnline(needOfflineIdList);
            } catch (Exception e) {
                log.error("batch delete db session error.", e);
            }
        }

        if (log.isInfoEnabled()) {
            String msg = "Finished invalidation session.";
            if (invalidCount > 0) {
                msg += " [" + invalidCount + "] sessions were stopped.";
            } else {
                msg += " No sessions were stopped.";
            }
            log.info(msg);
        }

    }

    @Override
    protected Collection<Session> getActiveSessions() {
        throw new UnsupportedOperationException("getActiveSessions method not supported");
    }
}
```

<br>

### SpringSessionValidationScheduler

```java
import com.owlias.common.utils.Threads;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.apache.shiro.session.mgt.SessionValidationScheduler;
import org.apache.shiro.session.mgt.ValidatingSessionManager;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * 自定义任务调度器
 * 强行让 Shiro 使用系统定义的共享线程池（在 ShiroSessionConfig 中定义的那个）
 * 这样可以统一管理线程的创建、销毁和监控，避免在应用关闭时出现“孤儿线程”。
 *
 * @author KJ
 */
@Slf4j
public class SpringSessionValidationScheduler implements SessionValidationScheduler {
    // public static final long DEFAULT_SESSION_VALIDATION_INTERVAL = DefaultSessionManager.DEFAULT_SESSION_VALIDATION_INTERVAL;

    /**
     * 定时器，用于处理超时的挂起请求，也用于连接断开时的重连。
     */
    @Setter
    private ScheduledExecutorService executorService;

    /**
     * 会话验证管理器
     */
    @Setter
    private ValidatingSessionManager sessionManager;

    @Setter
    private long sessionValidationInterval;  // 相隔多久检查一次session的有效性，单位毫秒，默认就是10分钟

    // 任务电闸，防范 “幽灵任务”
    private volatile boolean enabled = false;

    @Override
    public boolean isEnabled() {
        return this.enabled;
    }

    /**
     * Starts session validation by creating a spring PeriodicTrigger.
     * 触发时机：大楼正式开张（Shiro 容器初始化完成时），准确地说是 SessionManager 初始化时
     */
    @Override
    public void enableSessionValidation() {
        enabled = true;
        if (log.isDebugEnabled()) {
            log.debug("Scheduling session validation job using Spring Scheduler with session validation interval of [" + sessionValidationInterval + "]ms...");
        }
        try {
            executorService.scheduleAtFixedRate(() -> {
                if (enabled) {
                    sessionManager.validateSessions();
                }
            }, 1000, sessionValidationInterval * 60 * 1000, TimeUnit.MILLISECONDS);

            this.enabled = true;

            if (log.isDebugEnabled()) {
                log.debug("Session validation job successfully scheduled with Spring Scheduler.");
            }
        } catch (Exception e) {
            if (log.isErrorEnabled()) {
                log.error("Error starting the Spring Scheduler session validation job.  Session validation may not occur.", e);
            }
        }
    }

    /**
     * 当 Web 应用关闭或 Shiro 停止时，优雅地关闭调度器。
     * 触发时机：大楼关门下班（Spring 容器销毁或 Web 应用停止时）。
     */
    @Override
    public void disableSessionValidation() {
        if (log.isDebugEnabled()) {
            log.debug("Stopping Spring Scheduler session validation job...");
        }
        if (this.enabled) {
            Threads.shutdownAndAwaitTermination(executorService);
        }
        this.enabled = false;
    }
}
```

<br>

### OnlineSessionFactory

```java
import com.owlias.common.utils.IpUtils;
import com.owlias.common.utils.http.UserAgentUtils;
import jakarta.servlet.http.HttpServletRequest;
import org.apache.shiro.session.Session;
import org.apache.shiro.session.mgt.SessionContext;
import org.apache.shiro.session.mgt.SessionFactory;
import org.apache.shiro.web.session.mgt.WebSessionContext;

/**
 * @author KJ
 * @description 自定义 sessionFactory
 */
public class OnlineSessionFactory implements SessionFactory {

    /**
     * 创建 session
     * 触发时机：当一个 “无证” 访问者第一次尝试与系统进行“持久交互”时。
     *
     * 显示调用（主动领证）：Subject.login(token) 登录成功、Subject.getSession() 或 Subject.getSession(true) 如果你显式要求获取一个 Session，而当前用户还没有，就会调用该方法。
     *
     * 隐式触发（被动领证）：
     * 访问受限资源：当你访问一个配置了 authc（需要认证）的 URL 时，Shiro 会检查你是否登录。检查过程中如果发现你连 Session 都没有，就会为了后续流程（如存入登录前的 URL 供跳转）而创建一个。
     * 开启了RememberMe：当 “老熟人” 带着 Cookie 回到大楼，getRememberedPrincipals 成功找回身份后，为了让这个身份在本次访问中生效，Shiro 会自动创建一个 Session 来承载这个身份。
     *
     * 翻阅源码，你会发现 createSession 隐藏在这样一条调用路径中：
     * 入口：subject.getSession()
     * 委派：SecurityManager.start(SessionContext)
     * 核心调度：SessionManager.start(SessionContext)
     * 工厂干活：SessionFactory.createSession(SessionContext) <== 就在这里触发
     * 持久化：SessionDAO.create(session) （创建完立刻存库）
     */
    @Override
    public Session createSession(SessionContext initData) {
        OnlineSession session = new OnlineSession();
        if (initData instanceof WebSessionContext sessionContext) {
            HttpServletRequest request = (HttpServletRequest) sessionContext.getServletRequest();
            if (request != null) {
                // 会话诞生的那一刻，就给它强行注入了丰富的 “身份背景信息”（IP、浏览器、操作系统、在线状态等）
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

OnineSession：

```java
@Data
@EqualsAndHashCode(callSuper = false)
public class OnlineSession extends SimpleSession {
    @Serial
    private static final long serialVersionUID = -7802932644484503469L;

    /**
     * 用户ID
     */
    private Long userId;

    /**
     * 用户名称
     */
    private String loginName;

    /**
     * 部门名称
     */
    private String deptName;

    /**
     * 用户头像
     */
    private String avatar;

    /**
     * 登录IP地址
     */
    private String host;

    /**
     * 浏览器类型
     */
    private String browser;

    /**
     * 操作系统
     */
    private String os;

    /**
     * 在线状态
     */
    private OnlineStatus status = OnlineStatus.on_line;

    /**
     * 属性是否改变 优化session数据同步
     */
    @Getter
    private transient boolean attributeChanged = false;

    @Override
    public String getHost() {
        return host;
    }

    @Override
    public void setHost(String host) {
        this.host = host;
    }

    @Override
    public void setAttribute(Object key, Object value) {
        super.setAttribute(key, value);
    }

    @Override
    public Object removeAttribute(Object key) {
        return super.removeAttribute(key);
    }

    public void markAttributeChanged() {
        this.attributeChanged = true;
    }

    public void resetAttributeChanged() {
        this.attributeChanged = false;
    }
}
```

<br>

### OnlineSessionDAO

```java
import com.owlias.common.model.enums.OnlineStatus;
import com.owlias.framework.manager.AsyncManager;
import com.owlias.framework.manager.factory.AsyncFactory;
import com.owlias.framework.shiro.service.SysShiroService;
import jakarta.annotation.Resource;
import lombok.Setter;
import org.apache.shiro.session.Session;
import org.apache.shiro.session.UnknownSessionException;
import org.apache.shiro.session.mgt.eis.EnterpriseCacheSessionDAO;
import org.springframework.context.annotation.Lazy;
import java.io.Serializable;
import java.util.Date;

/**
 * 针对自定义的 ShiroSession 的db操作
 *
 * 优化点：
 * update 是 Shiro 强制要求的“作业”，它执行得太频繁了。
 * syncToDb 优化逻辑。它像一个过滤器，把 90% 没必要的 update（仅仅是时间变了）挡回去，只把关键的、攒够时间的更新发给数据库。
 *
 * @author KJ
 */
public class OnlineSessionDAO extends EnterpriseCacheSessionDAO {

    @Resource
    @Lazy  // 懒加载避免拉起整个 Service 链
    private SysShiroService sysShiroService;

    public OnlineSessionDAO() {
        super();
    }

    @Setter                    // 移除这里的 @Value，避免由于处理注解导致的提前检查
    private int dbSyncPeriod;  // 规定同步session到数据库的周期（默认1分钟）

    /**
     * 上次同步数据库的时间戳
     */
    private static final String LAST_SYNC_DB_TIMESTAMP = OnlineSessionDAO.class.getName() + "LAST_SYNC_DB_TIMESTAMP";


    /**
     * shiro定义方法：根据会话ID获取会话
     * 触发时机：当 Shiro 在内存/缓存中找不到某个 Session，但请求里又带了 SessionID 时。
     * 调用链路：Subject.getSession() -> SessionManager -> SessionDAO.readSession() -> doReadSession()。
     *
     * 场景 A：服务器重启。 用户的浏览器存着 Cookie，但服务器重启后内存清空了。当用户再次访问，Shiro 会通过 doReadSession 去数据库捞回来。
     * 场景 B：记住我（RememberMe）。 长期未操作导致内存 Session 失效，但凭证还在。
     *
     * @param sessionId 会话ID
     * @return ShiroSession
     */
    @Override
    protected Session doReadSession(Serializable sessionId) {
        return sysShiroService.getSession(sessionId);
    }

    /**
     * shiro定义方法：更新会话；
     * 触发时机：每当 Session 的属性、最后访问时间或过期状态发生变化时（如最后访问时间/停止会话/设置超时时间/设置移除属性）
     * 频率极高：在标准的 Shiro 配置中，几乎每一个请求结束前都会调用 update。
     *
     * 在此处只是调用了 super.update(session)。这是为了把数据同步到 EnterpriseCacheSessionDAO 的内部缓存中。它并不直接触发写库。
     */
    @Override
    public void update(Session session) throws UnknownSessionException {
        super.update(session);
    }

    /**
     * 自定义方法：同步session到持久层（如 db 或 redis）
     * 触发时机：由 OnlineWebSessionFilter（或其他拦截器）在请求结束前手动触发。
     * 参考该方法的触发器 {@link com.owlias.framework.shiro.filter.sync.SyncOnlineSessionFilter}
     */
    public void syncToDb(OnlineSession onlineSession) {
        Date lastSyncTimestamp = (Date) onlineSession.getAttribute(LAST_SYNC_DB_TIMESTAMP);
        if (lastSyncTimestamp != null) {
            boolean needSync = isNeedSync(onlineSession, lastSyncTimestamp);
            if (!needSync) {
                return;
            }
        }
        // 更新上次同步数据库时间
        onlineSession.setAttribute(LAST_SYNC_DB_TIMESTAMP, onlineSession.getLastAccessTime());
        // 更新完后 重置标识
        if (onlineSession.isAttributeChanged()) {
            onlineSession.resetAttributeChanged();
        }
        AsyncManager.me().execute(AsyncFactory.syncSessionToDb(onlineSession));
    }

    /**
     * shiro定义方法：销毁session
     * 触发时机：当会话过期/停止（如用户退出时）属性等会调用
     *
     * 场景 A：主动退出。 用户点击 logout，Shiro 会调用 session.stop()，随即触发 doDelete。
     * 场景 B：超时清理。 validateSessions 逻辑，当它发现某个 Session 过期了，会调用删除逻辑。
     * 场景 C：强行踢出。 管理员在后台点击“强退”，底层也会触发这个方法。
     */
    @Override
    protected void doDelete(Session session) {
        OnlineSession onlineSession = (OnlineSession) session;
        if (null == onlineSession) {
            return;
        }
        onlineSession.setStatus(OnlineStatus.off_line);
        sysShiroService.deleteSession(onlineSession);
    }

    /**
     * 判断session是否需要更新
     * 满足时间间隔 & 属性改变 & 登录用户不是访客
     */
    private boolean isNeedSync(OnlineSession onlineSession, Date lastSyncTimestamp) {
        boolean needSync = true;
        long deltaTime = onlineSession.getLastAccessTime().getTime() - lastSyncTimestamp.getTime();
        if (deltaTime < (long) dbSyncPeriod * 60 * 1000) {
            // 时间差不足 无需同步
            needSync = false;
        }
        // isGuest = true 访客
        boolean isGuest = onlineSession.getUserId() == null || onlineSession.getUserId() == 0L;

        // session 数据变更了 同步
        if (!isGuest && onlineSession.isAttributeChanged()) {
            needSync = true;
        }
        return needSync;
    }
}
```

<br>

### OnlineSessionDAO 的两个 Filter 帮手

OnlineSessionFilter & SyncOnlineSessionFilter

```java
/**
 * 自定义访问控制
 *
 * @author KJ
 */
public class OnlineSessionFilter extends AccessControlFilter { // PathMatchingFilter 的增强子类

    /**
     * 强制退出后重定向的地址
     */
    @Value("${shiro.user.loginUrl}")
    private String loginUrl;

    @Getter
    @Setter
    private SessionDAO sessionDAO;

    /**
     * 定义让不让访问：
     *
     * mappedValue 就是配置拦截路径时，写在括号里的参数；
     * 当你配置 filterChainDefinitionMap 时，通常会这样写：filterChainDefinitionMap.put("/admin/**", "roles[admin, manager]");
     * 在这里例子中，拦截器名称就是 roles，mappedValue 就是一个字符串数组 ["admin", "manager"]
     */
    @Override
    protected boolean isAccessAllowed(ServletRequest request, ServletResponse response, Object mappedValue) {
        Subject subject = getSubject(request, response);
        if (subject == null || subject.getSession() == null) {
            return true;
        }
        Session session = sessionDAO.readSession(subject.getSession().getId());
        if (session instanceof OnlineSession onlineSession) {
            // 拦截器链，在此建立 Request 级别的上下文缓存，避免每个拦截器都去 SessionDAO（甚至去数据库）读一遍 Session。
            request.setAttribute(ShiroConstants.ONLINE_SESSION, onlineSession);
            // 把 user 对象设置进去
            boolean isGuest = onlineSession.getUserId() == null || onlineSession.getUserId() == 0L;
            if (isGuest) {
                // Session 诞生（游客）：用户刚打开登录页面，OnlineSessionFactory 就创建了一个 Session。此时，用户没登录，userId 是空的，这就是 Guest（游客）。
                // 当用户输入账号密码，点击登录，Shiro 验证通过之后，需要对原来 sessionDAO 中的 session 进行信息补全，同步到 redis 或者数据库
                SysUser user = ShiroUtils.getSysUser();
                if (user != null) {
                    onlineSession.setUserId(user.getUserId());
                    onlineSession.setLoginName(user.getLoginName());
                    onlineSession.setAvatar(user.getAvatar());
                    onlineSession.setDeptName(user.getDept().getDeptName());
                    onlineSession.markAttributeChanged();
                    sessionDAO.update(onlineSession);
                }
            }
            return onlineSession.getStatus() != OnlineStatus.off_line; // 状态为离线的，则不允许访问，实现了在线【踢人】
        }
        return true; // 请求放行
    }

    /**
     * 定义如果不让访问该怎么办（isAccessAllowed 返回 false 跳转到这里）：
     *
     * 如果返回 true 表示需要继续处理；
     * 如果返回 false 表示请求被拦截，再次终止处理，不再调用下一个拦截器或者处理器。
     */
    @Override
    protected boolean onAccessDenied(ServletRequest request, ServletResponse response) throws Exception {
        Subject subject = getSubject(request, response);
        if (subject != null) {
            subject.logout();
        }
        saveRequestAndRedirectToLogin(request, response);
        return false;  // 请求在此终止
    }

    // 跳转到登录页
    @Override
    protected void redirectToLogin(ServletRequest request, ServletResponse response) throws IOException {
        WebUtils.issueRedirect(request, response, loginUrl);
    }
}



/**
 * @author KJ
 * @description 同步 Session 数据到Db，配合紧接在 {@link OnlineSessionFilter} 过滤器之后
 */
@Setter
public class SyncOnlineSessionFilter extends PathMatchingFilter { // PathMatchingFilter 如果路径匹配则执行 onPreHandle

    private OnlineSessionDAO onlineSessionDAO;

    /**
     * 同步会话数据到DB 一次请求最多同步一次 防止过多处理 需要放到Shiro过滤器之前
     */
    @Override
    protected boolean onPreHandle(ServletRequest request, ServletResponse response, Object mappedValue) throws Exception {
        OnlineSession session = (OnlineSession) request.getAttribute(ShiroConstants.ONLINE_SESSION);
        // 如果 session stop 了，也不同步
        // session 停止时间 stopTimestamp 若不为 null，则代表已停止
        if (session != null && session.getUserId() != null && session.getStopTimestamp() == null) {
            onlineSessionDAO.syncToDb(session);
        }
        return true; // 放行
    }
}



/**
 * 在 ShiroFilterFactoryBean 中注册：
 */
// 1.
Map<String, Filter> filters = new LinkedHashMap<>();
filters.put("onlineSession", onlineSessionFilter(onlineSessionDAO));
filters.put("syncOnlineSession", syncOnlineSessionFilter(onlineSessionDAO));
// ...
shiroFilterFactoryBean.setFilters(filters);

// 2.
LinkedHashMap<String, String> filterChainMap = new LinkedHashMap<>();
// ...
filterChainMap.put("/**", "user,kickout,onlineSession,syncOnlineSession,csrfValidateFilter");
shiroFilterFactoryBean.setFilterChainDefinitionMap(filterChainMap);
```

<br>

### 其他异步执行器支持

AsyncManager：

```java
public class AsyncManager {
    /**
     * 操作延迟10毫秒
     */
    private final int OPERATE_DELAY_TIME = 10;

    /**
     * 异步操作任务调度线程池
     */
    private final ScheduledExecutorService executor = SpringUtils.getBean("scheduledExecutorService");

    /**
     * 单例模式
     */
    private AsyncManager() {}
    private static final AsyncManager me = new AsyncManager();
    public static AsyncManager me() {
        return me;
    }

    /**
     * 执行任务
     * @param task 任务
     */
    public void execute(TimerTask task) {
        executor.schedule(task, OPERATE_DELAY_TIME, TimeUnit.MILLISECONDS);
    }

    /**
     * 停止任务线程池
     */
    public void shutdown() {
        Threads.shutdownAndAwaitTermination(executor);
    }
}
```

AsyncFactory：

```java
/**
 * 异步工厂（产生任务用）
 *
 * @author KJ
 */
public class AsyncFactory {
    private static final Logger sys_user_logger = LoggerFactory.getLogger("sys-user");

    /**
     * 同步session到数据库
     */
    public static TimerTask syncSessionToDb(final OnlineSession session) {
        return new TimerTask() {
            @Override
            public void run() {
                SysUserOnline online = new SysUserOnline();
                online.setSessionId(String.valueOf(session.getId()));
                online.setDeptName(session.getDeptName());
                online.setLoginName(session.getLoginName());
                online.setStartTimestamp(session.getStartTimestamp());
                online.setLastAccessTime(session.getLastAccessTime());
                online.setExpireTime(session.getTimeout());
                online.setIpaddr(session.getHost());
                online.setLoginLocation(AddressUtils.getRealAddressByIP(session.getHost()));
                online.setBrowser(session.getBrowser());
                online.setOs(session.getOs());
                online.setStatus(session.getStatus());
                SpringUtils.getBean(SysUserOnlineService.class).saveOnline(online);

            }
        };
    }

    /**
     * 操作日志记录
     */
    public static TimerTask recordOpt(final SysOptLog optLog) {
        return new TimerTask() {
            @Override
            public void run() {
                // 远程查询操作地点
                optLog.setOperLocation(AddressUtils.getRealAddressByIP(optLog.getOperIp()));
                SpringUtils.getBean(SysOptLogService.class).insertOptLog(optLog);
            }
        };
    }

    /**
     * 记录登录信息
     */
    public static TimerTask recordLoginInfo(final String username, final String status, final String message, final Object... args) {
        final String userAgent = ServletUtils.getRequest().getHeader("User-Agent");
        final String ip = ShiroUtils.getIp();
        return new TimerTask() {
            @Override
            public void run() {
                String address = AddressUtils.getRealAddressByIP(ip);
                StringBuilder s = new StringBuilder();
                s.append(LogUtils.getBlock(ip));
                s.append(address);
                s.append(LogUtils.getBlock(username));
                s.append(LogUtils.getBlock(status));
                s.append(LogUtils.getBlock(message));
                // 打印信息到日志
                sys_user_logger.info(s.toString(), args);
                // 获取客户端操作系统
                String os = UserAgentUtils.getOperatingSystem(userAgent);
                // 获取客户端浏览器
                String browser = UserAgentUtils.getBrowser(userAgent);
                // 封装对象
                SysLoginInfo loginInfo = new SysLoginInfo();
                loginInfo.setLoginName(username);
                loginInfo.setIpaddr(ip);
                loginInfo.setLoginLocation(address);
                loginInfo.setBrowser(browser);
                loginInfo.setOs(os);
                loginInfo.setMsg(message);
                // 日志状态
                if (StringUtils.equalsAny(status, Constants.LOGIN_SUCCESS, Constants.LOGOUT, Constants.REGISTER)) {
                    loginInfo.setStatus(Constants.SUCCESS);
                } else if (Constants.LOGIN_FAIL.equals(status)) {
                    loginInfo.setStatus(Constants.FAIL);
                }
                // 插入数据
                SpringUtils.getBean(SysLoginInfoServiceImpl.class).insertLoginInfo(loginInfo);
            }
        };
    }
}
```

应用共享线程池配置：

```java
/**
 * @author KJ
 * @description 线程池配置
 */
@Configuration
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
public class ThreadPoolConfig {
    // 核心线程池大小
    private final int corePoolSize = 50;

    // 最大可创建的线程数
    private final int maxPoolSize = 200;

    // 队列最大长度
    private final int queueCapacity = 1000;

    // 线程池维护线程所允许的空闲时间
    private final int keepAliveSeconds = 300;

    @Bean(name = "threadPoolTaskExecutor")
    public ThreadPoolTaskExecutor threadPoolTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setMaxPoolSize(maxPoolSize);
        executor.setCorePoolSize(corePoolSize);
        executor.setQueueCapacity(queueCapacity);
        executor.setKeepAliveSeconds(keepAliveSeconds);
        // 线程池对拒绝任务(无线程可用)的处理策略
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        return executor;
    }

    /**
     * 执行周期性或定时任务
     */
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    @Bean(name = "scheduledExecutorService")
    protected ScheduledExecutorService scheduledExecutorService() {
        return new ScheduledThreadPoolExecutor(corePoolSize,
                new BasicThreadFactory.Builder().namingPattern("schedule-pool-%d").daemon(true).build(),
                new ThreadPoolExecutor.CallerRunsPolicy()) {
            @Override
            protected void afterExecute(Runnable r, Throwable t) {
                super.afterExecute(r, t);
                Threads.printException(r, t);
            }
        };
    }
}
```

优雅释放应用资源：

```java
import com.owlias.framework.shiro.session.SpringSessionValidationScheduler;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import net.sf.ehcache.CacheManager;
import org.apache.shiro.cache.ehcache.EhCacheManager;
import org.springframework.stereotype.Component;

/**
 * 确保应用退出时能关闭后台线程
 *
 * @author KJ
 */
@Slf4j
@Component
public class ShutdownManager {

    private final SpringSessionValidationScheduler springSessionValidationScheduler;
    private EhCacheManager ehCacheManager;

    public ShutdownManager(SpringSessionValidationScheduler springSessionValidationScheduler,
                           org.apache.shiro.cache.CacheManager cacheManager) {
        this.springSessionValidationScheduler = springSessionValidationScheduler;
        if (cacheManager instanceof EhCacheManager ehCacheMgr) {
            this.ehCacheManager = ehCacheMgr;
        }
    }

    /**
     * 隐式注册：
     * 当 Spring 看到一个 Bean 方法上标记了 @PreDestroy，它会在自己的 “销毁名单” 里记下一笔。
     * 当应用退出时，Spring 会自动调用所有标记了 @PreDestroy 的组件的方法。
     */
    @PreDestroy
    public void destroy() {
        shutdownSpringSessionValidationScheduler();
        shutdownAsyncManager();
        shutdownEhCacheManager();
    }

    /**
     * 停止Seesion会话检查
     */
    private void shutdownSpringSessionValidationScheduler() {
        if (springSessionValidationScheduler != null && springSessionValidationScheduler.isEnabled()) {
            try {
                log.info("====关闭会话验证任务====");
                springSessionValidationScheduler.disableSessionValidation();
            } catch (Exception e) {
                log.error(e.getMessage(), e);
            }
        }
    }

    /**
     * 停止异步执行任务
     */
    private void shutdownAsyncManager() {
        try {
            log.info("====关闭后台任务任务线程池====");
            AsyncManager.me().shutdown();
        } catch (Exception e) {
            log.error(e.getMessage(), e);
        }
    }

    private void shutdownEhCacheManager() {
        try {
            log.info("====关闭缓存====");
            if (ehCacheManager != null) {
                CacheManager cacheManager = ehCacheManager.getCacheManager();
                cacheManager.shutdown();
            }
        } catch (Exception e) {
            log.error(e.getMessage(), e);
        }
    }
}
```

<br>



## Shiro 过滤器

### ShiroWebFilterConfig

```java
import com.owlias.common.utils.str.StringUtils;
import com.owlias.framework.shiro.filter.CustomShiroFilterFactoryBean;
import com.owlias.framework.shiro.filter.captcha.CaptchaValidateFilter;
import com.owlias.framework.shiro.filter.csrf.CsrfValidateFilter;
import com.owlias.framework.shiro.filter.kickout.KickoutSessionFilter;
import com.owlias.framework.shiro.filter.logout.LogoutFilter;
import com.owlias.framework.shiro.filter.online.OnlineSessionFilter;
import com.owlias.framework.shiro.filter.sync.SyncOnlineSessionFilter;
import com.owlias.framework.shiro.session.OnlineSessionDAO;
import jakarta.servlet.Filter;
import org.apache.shiro.cache.CacheManager;
import org.apache.shiro.mgt.SecurityManager;
import org.apache.shiro.session.mgt.SessionManager;
import org.apache.shiro.session.mgt.eis.SessionDAO;
import org.apache.shiro.spring.web.ShiroFilterFactoryBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Role;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * @author KJ
 * @description shiro 过滤器配置
 */
@Configuration
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
public class ShiroWebFilterConfig {

    @Value("${shiro.user.loginUrl}")
    private String loginUrl;                // 登录地址
    @Value("${shiro.user.unauthorizedUrl}")
    private String unauthorizedUrl;         // 权限认证失败地址
    @Value("${shiro.user.captchaEnabled}")
    private boolean captchaEnabled;         // 验证码开关
    @Value("${shiro.user.captchaType}")
    private String captchaType;             // 验证码类型
    @Value("${shiro.session.kickoutAfter}")
    private boolean kickoutAfter;           // 踢出之前登录的/之后登录的用户，默认踢出之前登录的用户
    @Value("${shiro.session.maxSession}")
    private int maxSession;                 // 同一个用户最大会话数
    @Value("${csrf.enabled: false}")
    private boolean csrfEnabled;            // 是否开启csrf
    @Value("${csrf.whites: ''}")
    private String csrfWhites;              // csrf白名单链接


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

        // 自定义过滤器（仅仅是定义和注册，这里不决定生效顺序，过滤器的排班表在 filterChainLinkedHashMap 中）
        Map<String, Filter> filters = new LinkedHashMap<>();
        filters.put("logout", logoutFilter());  // 注销成功，则跳转到指定页面
        filters.put("captchaValidate", captchaValidateFilter()); // 在shiro验证码过滤器
        filters.put("kickout", kickoutSessionFilter(cacheManager, sessionManager));
        filters.put("csrfValidateFilter", csrfValidateFilter());
        filters.put("onlineSession", onlineSessionFilter(sessionDAO));
        if (sessionDAO instanceof OnlineSessionDAO onlineSessionDAO) {
            filters.put("syncOnlineSession", syncOnlineSessionFilter(onlineSessionDAO));
        }
        shiroFilterFactoryBean.setFilters(filters);

        // Shiro连接约束配置，即过滤链的定义
        LinkedHashMap<String, String> filterChainLinkedHashMap = setupFilterChainDefinitionMap();
        shiroFilterFactoryBean.setFilterChainDefinitionMap(filterChainLinkedHashMap);
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

        // 匿名访问不鉴权注解列表
        /*List<String> permitAllUrl = SpringUtils.getBean(PermitAllUrlProperties.class).getUrls();
        if (StringUtils.isNotEmpty(permitAllUrl)) {
            permitAllUrl.forEach(url -> filterChainMap.put(url, "anon"));
        }*/

        // 退出 logout地址，shiro去清除session
        filterChainMap.put("/logout", "logout");

        // 不需要拦截的访问
        filterChainMap.put("/login", "anon,captchaValidate"); // 指定登录接口需先经过验证码校验

        // 注册相关
        filterChainMap.put("/register", "anon,captchaValidate");

        // 系统权限列表
        // filterChainMap.putAll(SpringUtils.getBean(IMenuService.class).selectPermsAll());

        // 所有请求需要认证
        filterChainMap.put("/**", "user,kickout,onlineSession,syncOnlineSession,csrfValidateFilter");
        return filterChainMap;
    }


    /**
     * 自定义在线用户处理过滤器
     */
    public OnlineSessionFilter onlineSessionFilter(SessionDAO sessionDAO) {
        OnlineSessionFilter onlineSessionFilter = new OnlineSessionFilter();
        onlineSessionFilter.setLoginUrl(loginUrl);
        onlineSessionFilter.setSessionDAO(sessionDAO);
        return onlineSessionFilter;
    }

    /**
     * 自定义在线用户同步过滤器
     */
    public SyncOnlineSessionFilter syncOnlineSessionFilter(OnlineSessionDAO sessionDAO) {
        SyncOnlineSessionFilter syncOnlineSessionFilter = new SyncOnlineSessionFilter();
        syncOnlineSessionFilter.setOnlineSessionDAO(sessionDAO);
        return syncOnlineSessionFilter;
    }

    /**
     * 自定义验证码过滤器
     */
    public CaptchaValidateFilter captchaValidateFilter() {
        CaptchaValidateFilter captchaValidateFilter = new CaptchaValidateFilter();
        captchaValidateFilter.setCaptchaEnabled(captchaEnabled);
        captchaValidateFilter.setCaptchaType(captchaType);
        return captchaValidateFilter;
    }

    /**
     * 同一个用户多设备登录限制
     */
    public KickoutSessionFilter kickoutSessionFilter(CacheManager cacheManager,
                                                     SessionManager sessionManager) {
        KickoutSessionFilter kickoutSessionFilter = new KickoutSessionFilter();
        kickoutSessionFilter.setCacheManager(cacheManager);
        kickoutSessionFilter.setSessionManager(sessionManager);
        // 同一个用户最大的会话数，默认-1无限制；比如2的意思是同一个用户允许最多同时两个人登录
        kickoutSessionFilter.setMaxSession(maxSession);
        // 是否踢出后来登录的，默认是false；即后者登录的用户踢出前者登录的用户；踢出顺序
        kickoutSessionFilter.setKickoutAfter(kickoutAfter);
        // 被踢出后重定向到的地址；
        kickoutSessionFilter.setKickoutUrl("/login?kickout=1");
        return kickoutSessionFilter;
    }

    /**
     * 退出过滤器
     */
    public LogoutFilter logoutFilter() {
        LogoutFilter logoutFilter = new LogoutFilter();
        logoutFilter.setLoginUrl(loginUrl);
        return logoutFilter;
    }

    /**
     * csrf过滤器
     */
    public CsrfValidateFilter csrfValidateFilter() {
        CsrfValidateFilter csrfValidateFilter = new CsrfValidateFilter();
        csrfValidateFilter.setEnabled(csrfEnabled);
        csrfValidateFilter.setCsrfWhites(StringUtils.str2List(csrfWhites, ","));
        return csrfValidateFilter;
    }
}
```

<br>



### CustomShiroFilterFactoryBean

```java
import jakarta.servlet.Filter;
import org.apache.shiro.mgt.SecurityManager;
import org.apache.shiro.spring.web.ShiroFilterFactoryBean;
import org.apache.shiro.web.filter.InvalidRequestFilter;
import org.apache.shiro.web.filter.mgt.DefaultFilter;
import org.apache.shiro.web.filter.mgt.FilterChainManager;
import org.apache.shiro.web.filter.mgt.FilterChainResolver;
import org.apache.shiro.web.filter.mgt.PathMatchingFilterChainResolver;
import org.apache.shiro.web.mgt.WebSecurityManager;
import org.apache.shiro.web.servlet.AbstractShiroFilter;
import org.springframework.beans.factory.BeanInitializationException;
import java.util.Map;

/**
 * @author KJ
 * @description 自定义 ShiroFilterFactoryBean 解决资源中文路径问题
 */
public class CustomShiroFilterFactoryBean extends ShiroFilterFactoryBean {
    @Override
    public Class<?> getObjectType() {
        return MySpringShiroFilter.class;
    }

    @Override
    protected AbstractShiroFilter createInstance() throws Exception {
        SecurityManager securityManager = super.getSecurityManager();
        if (securityManager == null) {
            String msg = "SecurityManager property must be set.";
            throw new BeanInitializationException(msg);
        }

        if (!(securityManager instanceof WebSecurityManager)) {
            String msg = "The security manager does not implement the WebSecurityManager interface.";
            throw new BeanInitializationException(msg);
        }

        // Shiro “底层过滤器不认识‘过滤器管理员’，它只认识‘路径解析器’。所以我们需要把‘管理员’装进‘解析器’里，再把解析器交给底层过滤器使用。”
        FilterChainManager manager = createFilterChainManager();
        PathMatchingFilterChainResolver chainResolver = new PathMatchingFilterChainResolver();
        chainResolver.setFilterChainManager(manager);

        // Shiro 1.6+ 版本后，为了防御安全漏洞（如某些容器对非 ASCII 字符解析不一致导致的绕过），增加了一个默认拦截器 InvalidRequestFilter。这个拦截器默认 blockNonAscii = true。
        // 如果你的资源路径包含中文（例如 /img/头像.png），Shiro 会直接判定为非法请求，返回 400 Bad Request。
        // 这里将 setBlockNonAscii(false)。这意味着 Shiro 不再拦截 URL 中的非 ASCII 字符（如中文）。
        Map<String, Filter> filterMap = manager.getFilters();
        Filter invalidRequestFilter = filterMap.get(DefaultFilter.invalidRequest.name());
        if (invalidRequestFilter instanceof InvalidRequestFilter) {
            // 此处是关键，设置 false 跳过 URL 携带中文 400，servletPath 中文校验 bug
            ((InvalidRequestFilter) invalidRequestFilter).setBlockNonAscii(false);
        }

        // “不管我是用匿名内部类还是自定义一个 MySpringShiroFilter，这都不重要。
        // 重要的是，这个实例必须是一个货真价实的 AbstractShiroFilter，这样它才能接收我们塞给它的‘大脑’和‘路线图’，从而开始干活。”
        return new MySpringShiroFilter((WebSecurityManager) securityManager, chainResolver);
    }

    private static final class MySpringShiroFilter extends AbstractShiroFilter {
        private MySpringShiroFilter(WebSecurityManager webSecurityManager, FilterChainResolver resolver) {
            if (webSecurityManager == null) {
                throw new IllegalArgumentException("WebSecurityManager property cannot be null.");
            } else {
                this.setSecurityManager(webSecurityManager);
                if (resolver != null) {
                    this.setFilterChainResolver(resolver);
                }
            }
        }
    }
}
```

<br>



### 过滤器链的增强

AnonymousFilterLoader：

```java
/**
 * 应用启动时动态扫描并注册安全规则
 *
 * 注意，这个类会扫描所有 Controller，这样的话 Controller 会被 spring 提前拉起
 * 为了防止这种情况的发生，我们使用 @EventListener 的方式回填匿名访问权限
 *
 * @author KJ
 * @description 设置 Anonymous 注解允许匿名访问的url
 */
@Slf4j
@Configuration
public class AnonymousFilterLoader implements ApplicationContextAware {

    private final List<String> urls = new ArrayList<>();

    private ApplicationContext applicationContext;

    @Override
    public void setApplicationContext(ApplicationContext context) throws BeansException {
        this.applicationContext = context;
    }

    /**
     * 监听容器刷新完成事件
     * 此时所有的 Bean（包括 Controller）都已经完全初始化完毕
     */
    @EventListener(ContextRefreshedEvent.class)
    public void onApplicationEvent(ContextRefreshedEvent event) throws Exception {
        // 确保只处理 Root ApplicationContext，避免重复触发
        if (event.getApplicationContext().getParent() == null) {
            log.info("Shiro 动态匿名权限注册器启动...");
            scanAndRegister();
        }
    }

    private void scanAndRegister() throws Exception {
        initAnonymousUrls();
        refreshShiroFilterChain();
    }

    private void initAnonymousUrls() throws Exception {
        urls.clear(); // 1. 防止重复触发导致列表无限膨胀
        log.info("开始扫描 @Anonymous 注解并动态注入 Shiro 匿名访问白名单...");
        Map<String, Object> controllers = applicationContext.getBeansWithAnnotation(Controller.class);
        for (Object bean : controllers.values()) {
            Class<?> beanClass = getRealClass(bean);

            // 处理类级别的匿名访问注解
            if (beanClass.isAnnotationPresent(Anonymous.class)) {
                RequestMapping baseMapping = beanClass.getAnnotation(RequestMapping.class);
                if (Objects.nonNull(baseMapping)) {
                    String[] baseUrl = baseMapping.value();
                    for (String url : baseUrl) {
                        urls.add(prefix(url) + "/**");  // 使用 /** 确保拦截所有子路径
                    }
                    continue;
                }
            }

            // 处理方法级别的匿名访问注解
            Method[] methods = beanClass.getDeclaredMethods();
            for (Method method : methods) {
                if (method.isAnnotationPresent(Anonymous.class)) {
                    RequestMapping baseMapping = beanClass.getAnnotation(RequestMapping.class);
                    String[] baseUrl = {};
                    if (Objects.nonNull(baseMapping)) {
                        baseUrl = baseMapping.value();
                    }
                    processMapping(method, baseUrl);
                }
            }
        }
        log.info("扫描完成，共解析出 {} 条匿名规则", urls.size());
    }

    /**
     * 核心逻辑：动态将解析到的 URL 注入到 Shiro 运行时
     */
    private void refreshShiroFilterChain() {
        if (urls.isEmpty()) return;

        try {
            ShiroFilterFactoryBean factoryBean = applicationContext.getBean(ShiroFilterFactoryBean.class);
            // 获取 ShiroConfig 中定义的初始 LinkedHashMap 备份
            Map<String, String> chains = new LinkedHashMap<>(factoryBean.getFilterChainDefinitionMap());

            // 严格顺序控制：
            // 1. 移除 /** 及其配置，暂时保存
            String lastChainConfig = chains.remove("/**");

            // 2. 将动态解析的 @Anonymous 规则追加到 Map 中（此时刚好在 /** 之前）
            for (String url : urls) {
                if (!chains.containsKey(url)) {
                    chains.put(url, "anon");
                    log.debug("动态注入匿名规则: {} -> anon", url);
                }
            }

            // 3. 将 /** 重新放回末尾，确保它是最后一条规则
            if (lastChainConfig != null) {
                chains.put("/**", lastChainConfig);
            }

            // 4. 将重组后的链应用到运行时
            AbstractShiroFilter shiroFilter = (AbstractShiroFilter) factoryBean.getObject();
            PathMatchingFilterChainResolver resolver;
            if (shiroFilter != null) {
                resolver = (PathMatchingFilterChainResolver) shiroFilter.getFilterChainResolver();
                DefaultFilterChainManager manager = (DefaultFilterChainManager) resolver.getFilterChainManager();
                // 清空并重新创建
                manager.getFilterChains().clear();
                chains.forEach(manager::createChain);
                log.info("Shiro 动态过滤链刷新成功，已严格遵循 [静态规则 -> 动态Anonymous -> 认证规则] 顺序");
            } else {
                log.warn("Shiro 动态过滤链刷新成功，shiroFilter 为空！");
            }
        } catch (Exception e) {
            log.error("动态刷新 Shiro 过滤链失败", e);
        }
    }

    private Class<?> getRealClass(Object bean) {
        try {
            if (bean instanceof Advised) {
                return Objects.requireNonNull(((Advised) bean).getTargetSource().getTarget()).getClass();
            }
        } catch (Exception e) {
            log.error("获取目标对象类型失败", e);
        }
        return bean.getClass();
    }

    private void processMapping(Method method, String[] baseUrl) {
        if (method.isAnnotationPresent(RequestMapping.class)) {
            RequestMapping requestMapping = method.getAnnotation(RequestMapping.class);
            String[] uri = requestMapping.value();
            urls.addAll(rebuildUrl(baseUrl, uri));
        } else if (method.isAnnotationPresent(GetMapping.class)) {
            GetMapping requestMapping = method.getAnnotation(GetMapping.class);
            String[] uri = requestMapping.value();
            urls.addAll(rebuildUrl(baseUrl, uri));
        } else if (method.isAnnotationPresent(PostMapping.class)) {
            PostMapping requestMapping = method.getAnnotation(PostMapping.class);
            String[] uri = requestMapping.value();
            urls.addAll(rebuildUrl(baseUrl, uri));
        } else if (method.isAnnotationPresent(PutMapping.class)) {
            PutMapping requestMapping = method.getAnnotation(PutMapping.class);
            String[] uri = requestMapping.value();
            urls.addAll(rebuildUrl(baseUrl, uri));
        } else if (method.isAnnotationPresent(DeleteMapping.class)) {
            DeleteMapping requestMapping = method.getAnnotation(DeleteMapping.class);
            String[] uri = requestMapping.value();
            urls.addAll(rebuildUrl(baseUrl, uri));
        }
    }

    private List<String> rebuildUrl(String[] bases, String[] uris) {
        List<String> urls = new ArrayList<>();
        for (String base : bases) {
            if (uris.length > 0) {
                for (String uri : uris) {
                    urls.add(prefix(base) + prefix(uri));
                }
            } else {
                urls.add(prefix(base));
            }
        }
        return urls;
    }

    private String prefix(String seg) {
        return seg.startsWith("/") ? seg : "/" + seg;
    }
}
```

<br>



### 典型的过滤器

LogoutFilter：

```java
@Setter
@Getter
@Slf4j
public class LogoutFilter extends org.apache.shiro.web.filter.authc.LogoutFilter {

    /**
     * 退出后重定向的地址
     */
    private String loginUrl;

    @Override
    protected boolean preHandle(ServletRequest request, ServletResponse response) throws Exception {
        try {
            Subject subject = getSubject(request, response);
            String redirectUrl = getRedirectUrl(request, response, subject);
            try {
                SysUser user = ShiroUtils.getSysUser();
                if (StringUtils.isNotNull(user)) {
                    String loginName = user.getLoginName();
                    // 记录用户退出日志
                    AsyncManager.me().execute(AsyncFactory.recordLoginInfo(loginName, Constants.LOGOUT, I18nMsgUtils.message("user.logout.success")));
                    // 清理缓存
                    SpringUtils.getBean(SysUserOnlineService.class).removeUserCache(loginName, ShiroUtils.getSessionId());
                }
                // 退出登录
                subject.logout();
            } catch (SessionException ise) {
                log.error("logout fail.", ise);
            }
            issueRedirect(request, response, redirectUrl);
        } catch (Exception e) {
            log.error("Encountered session exception during logout.  This can generally safely be ignored.", e);
        }
        return false;
    }

    /**
     * 退出跳转URL
     */
    @Override
    protected String getRedirectUrl(ServletRequest request, ServletResponse response, Subject subject) {
        String url = getLoginUrl();
        if (StringUtils.isNotEmpty(url)) {
            return url;
        }
        return super.getRedirectUrl(request, response, subject);
    }
}
```

CaptchaValidateFilter：

```java
@Setter
public class CaptchaValidateFilter extends AccessControlFilter {
    /**
     * 是否开启验证码
     */
    private boolean captchaEnabled = true;

    /**
     * 验证码类型
     */
    private String captchaType = "math";


    @Override
    public boolean onPreHandle(ServletRequest request, ServletResponse response, Object mappedValue) throws Exception {
        request.setAttribute(ShiroConstants.CURRENT_ENABLED, captchaEnabled);
        request.setAttribute(ShiroConstants.CURRENT_TYPE, captchaType);
        return super.onPreHandle(request, response, mappedValue);
    }

    @Override
    protected boolean isAccessAllowed(ServletRequest request, ServletResponse response, Object mappedValue)
            throws Exception {
        HttpServletRequest httpServletRequest = (HttpServletRequest) request;
        // 验证码禁用 或不是表单提交 允许访问
        if (!captchaEnabled || !"post".equalsIgnoreCase(httpServletRequest.getMethod())) {
            return true;
        }
        return validateResponse(httpServletRequest, httpServletRequest.getParameter(ShiroConstants.CURRENT_VALIDATECODE));
    }

    public boolean validateResponse(HttpServletRequest request, String validateCode) {
        Object obj = ShiroUtils.getSession().getAttribute(Constants.KAPTCHA_SESSION_KEY);
        String code = String.valueOf(obj != null ? obj : "");
        // 验证码清除，防止多次使用。
        request.getSession().removeAttribute(Constants.KAPTCHA_SESSION_KEY);
        if (StringUtils.isEmpty(validateCode) || !validateCode.equalsIgnoreCase(code)) {
            return false;
        }
        return true;
    }

    @Override
    protected boolean onAccessDenied(ServletRequest request, ServletResponse response) throws Exception {
        // 虽然验证码没对，但我（过滤器）不打算直接查封这个请求。我先在请求里打个‘验证码错误’ 的标记，然后把它放过去，让后面的过滤器或者 Controller 决定怎么处分它。
        request.setAttribute(ShiroConstants.CURRENT_CAPTCHA, ShiroConstants.CAPTCHA_ERROR);
        return true;
    }
}
```

KickoutSessionFilter：

```java
/**
 * 通过 Ehcache + 双端队列 (Deque) 实现的经典 “踢人” 逻辑。
 * 核心工作流可以分为 登记、判定、驱逐、拦截 四个步骤。
 *
 * @author KJ
 * @description 登录账号控制过滤器
 */
@Setter
public class KickoutSessionFilter extends AccessControlFilter {
    private final static ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 同一个用户最大会话数
     **/
    private int maxSession = -1;

    /**
     * 踢出之前登录的/之后登录的用户 默认false踢出之前登录的用户
     **/
    private Boolean kickoutAfter = false;

    /**
     * 踢出后到的地址
     **/
    private String kickoutUrl;

    private SessionManager sessionManager;
    private Cache<String, Deque<Serializable>> cache;

    @Override
    protected boolean isAccessAllowed(ServletRequest servletRequest, ServletResponse servletResponse, Object o)
            throws Exception {
        return false;
    }

    @Override
    protected boolean onAccessDenied(ServletRequest request, ServletResponse response) throws Exception {
        Subject subject = getSubject(request, response);
        if (!subject.isAuthenticated() && !subject.isRemembered() || maxSession == -1) {
            // 如果没有登录或用户最大会话数为-1，直接进行之后的流程
            return true;
        }
        try {
            Session session = subject.getSession();
            // 当前登录用户
            SysUser user = ShiroUtils.getSysUser();
            String loginName = user.getLoginName();
            Serializable sessionId = session.getId();

            // 读取缓存用户 没有就存入
            Deque<Serializable> deque = cache.get(loginName);
            if (deque == null) {
                // 初始化队列
                deque = new ArrayDeque<>();
            }

            // 如果队列里没有此sessionId，且用户没有被踢出；放入队列
            if (!deque.contains(sessionId) && session.getAttribute("kickout") == null) {
                // 将sessionId存入队列
                deque.push(sessionId);
                // 将用户的sessionId队列缓存
                cache.put(loginName, deque);
            }

            // 如果队列里的sessionId数超出最大会话数，开始踢人
            while (deque.size() > maxSession) {
                // 是否踢出后来登录的，默认是false；即后者登录的用户踢出前者登录的用户；
                Serializable kickoutSessionId = kickoutAfter ? deque.removeFirst() : deque.removeLast();
                // 踢出后再更新下缓存队列
                cache.put(loginName, deque);

                try {
                    // 获取被踢出的sessionId的session对象
                    Session kickoutSession = sessionManager.getSession(new DefaultSessionKey(kickoutSessionId));
                    if (null != kickoutSession) {
                        // 设置会话的kickout属性表示踢出了
                        kickoutSession.setAttribute("kickout", true);
                    }
                } catch (Exception e) {
                    // 面对异常，我们选择忽略
                }
            }

            // 每个请求进来时，都会看一眼自己的 Session 属性里有没有那个“死神标记”。
            // 如果发现自己被踢出了，(前者或后者)直接退出，重定向到踢出后的地址
            if (session.getAttribute("kickout") != null && (Boolean) session.getAttribute("kickout")) {
                // 退出登录
                subject.logout();
                saveRequest(request);
                return isAjaxResponse(request, response);
            }
            return true;
        } catch (Exception e) {
            return isAjaxResponse(request, response);
        }
    }

    private boolean isAjaxResponse(ServletRequest request, ServletResponse response) throws IOException {
        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse res = (HttpServletResponse) response;
        if (ServletUtils.isAjaxRequest(req)) {
            AjaxResult ajaxResult = AjaxResult.error("您已在别处登录，请您修改密码或重新登录");
            ServletUtils.renderString(res, objectMapper.writeValueAsString(ajaxResult));
        } else {
            WebUtils.issueRedirect(request, response, kickoutUrl);
        }
        return false;
    }

    /**
     * 设置Cache的key的前缀
     */
    public void setCacheManager(CacheManager cacheManager) {
        // 必须和ehcache缓存配置中的缓存name一致
        this.cache = Objects.requireNonNull(cacheManager).getCache(ShiroConstants.SYS_USERCACHE);
    }
}
```

CsrfValidateFilter：

```java
/**
 * csrf过滤器：防御 CSRF（跨站请求伪造）攻击。
 * 通过 同步令牌（Synchronizer Token Pattern）机制，确保每一个写操作都是用户在你的网页上真实发出的，而不是黑客诱导用户点击某个恶意链接产生的。
 *
 * 核心原理：令牌比对
 * CSRF 攻击的本质是黑客利用了浏览器自动携带 Cookie 的特性。而这个拦截器要求：除了 Cookie 里的 SessionID 之外，请求头里必须带上一个后端生成的随机令牌（Token）。
 * 黑客可以诱导你发请求，但他们无法从你的 Session 中偷走这个随机 Token。
 *
 * @author KJ
 */
@Setter
@Getter
public class CsrfValidateFilter extends AccessControlFilter {

    /**
     * 白名单链接
     */
    private List<String> csrfWhites;

    @Override
    protected boolean isAccessAllowed(ServletRequest request, ServletResponse response, Object mappedValue)
            throws Exception {
        HttpServletRequest httpServletRequest = (HttpServletRequest) request;
        if (!isAllowMethod(httpServletRequest)) {
            return true;
        }
        if (StringUtils.matches(httpServletRequest.getServletPath(), csrfWhites)) {
            return true; // 白名单豁免
        }
        return validateResponse(httpServletRequest, httpServletRequest.getHeader(ShiroConstants.X_CSRF_TOKEN));
    }

    public boolean validateResponse(HttpServletRequest request, String requestToken) {
        Object obj = ShiroUtils.getSession().getAttribute(ShiroConstants.CSRF_TOKEN);
        String sessionToken = TypeConvert.toStr(obj, "");
        if (StringUtils.isEmpty(requestToken) || !requestToken.equalsIgnoreCase(sessionToken)) {
            return false;
        }
        return true;
    }

    @Override
    protected boolean onAccessDenied(ServletRequest request, ServletResponse response) throws Exception {
        ServletUtils.renderString((HttpServletResponse) response, "{\"code\":\"1\",\"msg\":\"当前请求的安全验证未通过，请刷新页面后重试。\"}");
        return false;
    }

    private boolean isAllowMethod(HttpServletRequest request) {
        String method = request.getMethod();
        return "POST".equalsIgnoreCase(method);
    }
}


// 应用端逻辑：
// 用户访问到 index 页面时，专门给他随机生成一个 CRSF token
request.getSession().setAttribute(ShiroConstants.CSRF_TOKEN, ServletUtils.generateToken());
```

<br>



## 权限注解支持 

关键依赖：

```xml
<dependency>
  <groupId>org.apache.shiro</groupId>
  <artifactId>shiro-spring</artifactId>
  <version>2.1.0</version>
  <classifier>jakarta</classifier>
  <exclusions>
    <exclusion>
      <groupId>org.apache.shiro</groupId>
      <artifactId>shiro-web</artifactId>
    </exclusion>
  </exclusions>
</dependency>
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-aop</artifactId>
  <version>3.5.9</version>
</dependency>
```

核心配置：

```java
@Configuration
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
public class ShiroCoreConfig {

    // ...
  
    /**
     * 开启Shiro注解通知器
     * 必须是 static，确保切面处理器尽早加载，不依赖 ShiroConfig 的实例
     */
    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    public static AuthorizationAttributeSourceAdvisor authorizationAttributeSourceAdvisor(
            @Qualifier("securityManager") SecurityManager securityManager) {
        AuthorizationAttributeSourceAdvisor authorizationAttributeSourceAdvisor = new AuthorizationAttributeSourceAdvisor();
        authorizationAttributeSourceAdvisor.setSecurityManager(securityManager);
        return authorizationAttributeSourceAdvisor;
    }
  
    /**
     * 开启 AOP 代理
     */
    @Bean
    @ConditionalOnMissingBean
    public static DefaultAdvisorAutoProxyCreator defaultAdvisorAutoProxyCreator() {
        DefaultAdvisorAutoProxyCreator proxyCreator = new DefaultAdvisorAutoProxyCreator();
        proxyCreator.setProxyTargetClass(true); // 强制使用 cglib 代理，防止和其它 AOP 冲突
        return proxyCreator;
    }
  
    // ...
}
```

应用示例：

```java
@RequiresPermissions("system:user:list")
@PostMapping("/list")
@ResponseBody
public Rsult<List<SysUser>> list(SysUser user) {
    // ...
}

// 只有特定角色能访问，例如只有特定岗位（如财务）能进
@RequiresRoles

// 仅限游客访问，例如用在注册、登录页
@RequiresGuest  

// 已知身份（已登录或记住我的用户）能访问，例如用在个人主页、普通信息查看
@RequiresUser

// 必须登录才能访问，例如修改密码、账户设置
@RequiresAuthentication
```

<br>



## 与模板引擎整合

关键依赖：

```xml
<!-- thymeleaf 和 shiro 整合 -->
<dependency>
  <groupId>com.github.theborakompanioni</groupId>
  <artifactId>thymeleaf-extras-shiro</artifactId>
  <version>2.1.0</version>
</dependency>
```

核心配置：

```java
@Configuration
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
public class ShiroCoreConfig {

    // ...
  
    /**
     * thymeleaf 模板引擎和 shiro 框架的整合
     */
    @Bean
    public ShiroDialect shiroDialect() {
        return new ShiroDialect();
    }
  
    // ...
}
```

应用示例：

```html
<!doctype html>
<!--在页面中引用 shiro 方言，还是推荐将shiro的指定座位html的属性来使用，而不是直接使用shiro标签-->
<html xmlns:th="http://www.thymeleaf.org"
      xmlns:shiro="http://www.pollix.at/thymeleaf/shiro">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Index</title>
</head>
<body>

<!--&lt;!&ndash;必须是本次会话中输入过密码成功登录的人&ndash;&gt;-->
<!--<div shiro:authenticated="">-->
<!--    <a th:href="@{/user/list}">用户列表</a>-->
<!--</div>-->

<!--&lt;!&ndash;当前没有通过密码登录的人（包括访客和“被记住”但还没输密码的人）&ndash;&gt;-->
<!--<div shiro:notAuthenticated="">-->
<!--    <a th:href="@{/login.html}">请登录</a>-->
<!--</div>-->

<!--既没有登录，也没有被“记住我”，完全的陌生人-->
<div shiro:guest="">
    请先 <a th:href="@{/login.html}">登录</a>
</div>

<!--只要系统“认识”你就行，包括已登录的和被记住的人-->
<div shiro:user="">
    欢迎您，<span shiro:principal property="loginName">[默认登录名]</span><br>
    用户对象：<span shiro:principal="">[用户对象]</span><br>

    当前用户角色：
    <span shiro:hasRole="admin">超级管理员（ry）</span>
    <span shiro:hasRole="common">普通角色（ry）</span>
    <span shiro:hasRole="root">超级管理员</span>
    <span shiro:hasRole="ckm">仓库管理员</span>
    <span shiro:hasRole="xsm">销售员</span>
    <span shiro:hasRole="kfm">客服人员</span>
    <span shiro:hasRole="xzm">行政人员</span>
    <br>

    <a th:href="@{/logout}">退出</a>
</div>

<!--仓库管理-->
<!--hasRole 或 hasPermission 标签，每用一次就相当于查询数据库一次（如果没有配置缓存）-->
<!--为了环节数据库的查询压力，启用shiro的缓存机制是必须的-->
<ul shiro:hasAnyRoles="root,ckm">
    <li shiro:hasPermission="ck:add"><a href="#">库增</a></li>
    <li shiro:hasPermission="ck:delete"><a href="#">库减</a></li>
    <li shiro:hasPermission="ck:update"><a href="#">库改</a></li>
    <li shiro:hasPermission="ck:query"><a href="#">库查</a></li>
</ul>

<div shiro:hasPermission="ck:delete">
    <button>删除库存</button>
</div>
</body>
</html
```

<br>



## 数据访问权限的实现

当前请求权限上下文切面：

```java
/**
 * @author KJ
 * @description 自定义权限拦截器，将权限字符串放到当前请求中以便用于多个角色匹配符合要求的权限
 */
@Aspect
@Order(10)
@Component
public class PermissionsAspect {
    @Before("@annotation(controllerRequiresPermissions)")
    public void doBefore(JoinPoint point, RequiresPermissions controllerRequiresPermissions) throws Throwable {
        handleRequiresPermissions(point, controllerRequiresPermissions);
    }

    protected void handleRequiresPermissions(final JoinPoint joinPoint, RequiresPermissions requiresPermissions) {
        PermissionContextHolder.setContext(StringUtils.join(requiresPermissions.value(), ","));
    }
}
```

数据访问权限处理切面：

```java
/**
 * 数据过滤处理：实现 数据权限（行级过滤） 的核心
 * 本质是利用 AOP 切面技术，在执行 SQL 查询前，动态地根据当前登录用户的角色权限，使用  ${params.dataScope} 往 SQL 中注入一段 AND (dept_id = ...) 查询过滤条件。
 *
 * @author KJ
 */
@Aspect
@Order(30)
@Component
public class DataScopeAspect {

    /**
     * 数据权限过滤关键字
     * 数据权限枚举，请参考 {@link DataScopeEnum}
     */
    public static final String DATA_SCOPE = "dataScope";


    @Before("@annotation(controllerDataScope)")
    public void doBefore(JoinPoint point, DataScope controllerDataScope) {
        clearDataScope(point);
        handleDataScope(point, controllerDataScope);
    }

    protected void handleDataScope(final JoinPoint joinPoint, DataScope controllerDataScope) {
        // 获取当前的用户
        SysUser currentUser = ShiroUtils.getSysUser();
        if (currentUser != null) {
            // 如果是超级管理员，则不过滤数据
            if (!currentUser.isAdmin()) {
                // 优先用注解里的权限字符，没有就去 ContextHolder 拿 PermissionsAspect 存进去的
                String permission = StringUtils.defaultIfEmpty(controllerDataScope.permission(), PermissionContextHolder.getContext());
                // 生成最终的过滤 SQL 片段
                dataScopeFilter(joinPoint, currentUser, controllerDataScope.deptAlias(), controllerDataScope.userAlias(), permission);
            }
        }
    }

    /**
     * 数据范围过滤
     *
     * @param joinPoint  切点
     * @param user       用户
     * @param deptAlias  部门别名
     * @param userAlias  用户别名
     * @param permission 权限字符
     */
    public static void dataScopeFilter(JoinPoint joinPoint, SysUser user, String deptAlias, String userAlias, String permission) {
        // 防御逻辑：如果 baseEntity 为空，则直接返回
        BaseEntity baseEntity = getBaseEntity(joinPoint);
        if (baseEntity == null) {
            return;
        }

        StringBuilder sqlString = new StringBuilder();
        List<Integer> conditions = new ArrayList<>();
        List<String> scopeCustomIds = new ArrayList<>();

        // 处理自定数据权限：从用户拥有的正常角色中搂出当前匹配的那些数据权限，放入 scopeCustomIds
        user.getRoles().forEach(role -> {
            if (DataScopeEnum.DATA_SCOPE_CUSTOM.getScope().equals(role.getDataScope()) && StringUtils.equals(role.getStatus(), UserConstants.ROLE_NORMAL) &&
                    (StringUtils.isEmpty(permission) || StringUtils.containsAny(role.getPermissions(), TypeConvert.toStrArray(permission)))) {
                scopeCustomIds.add(TypeConvert.toStr(role.getRoleId()));
            }
        });

        for (SysRole role : user.getRoles()) {
            Integer dataScope = role.getDataScope();
            // 防御逻辑
            if (conditions.contains(dataScope) || StringUtils.equals(role.getStatus(), UserConstants.ROLE_DISABLE)) {
                continue;
            }
            if (StringUtils.isNotEmpty(permission) && !StringUtils.containsAny(role.getPermissions(), TypeConvert.toStrArray(permission))) {
                continue;
            }

            // 全部数据：只要有一个角色是全部数据，直接清空 sqlString 并退出循环，不再过滤
            if (DataScopeEnum.DATA_SCOPE_ALL.getScope().equals(dataScope)) {
                sqlString = new StringBuilder();
                conditions.add(dataScope);
                break;
            }
            // 自定数据权限：拼接 sqlString
            else if (DataScopeEnum.DATA_SCOPE_CUSTOM.getScope().equals(dataScope)) {
                if (scopeCustomIds.size() > 1) {
                    // 多个自定数据权限使用in查询，避免多次拼接。
                    sqlString.append(StringUtils.format(" OR {}.dept_id IN ( SELECT dept_id FROM sys_role_dept WHERE role_id in ({}) ) ", deptAlias, String.join(",", scopeCustomIds)));
                } else {
                    sqlString.append(StringUtils.format(" OR {}.dept_id IN ( SELECT dept_id FROM sys_role_dept WHERE role_id = {} ) ", deptAlias, role.getRoleId()));
                }
            }
            // 本部门数据权限：拼接 sqlString
            else if (DataScopeEnum.DATA_SCOPE_DEPT.getScope().equals(dataScope)) {
                sqlString.append(StringUtils.format(" OR {}.dept_id = {} ", deptAlias, user.getDeptId()));
            }
            // 本部门及以下数据权限：拼接 拼接 sqlString【find_in_set 把字符串按逗号切分进行完全匹配。但它无法使用索引，仅限于几千条的小表，如果再大就需要创建（ancestor_id, descendant_id, distance）的关系表了】
            else if (DataScopeEnum.DATA_SCOPE_DEPT_AND_CHILD.getScope().equals(dataScope)) {
                sqlString.append(StringUtils.format(" OR {}.dept_id IN ( SELECT dept_id FROM sys_dept WHERE dept_id = {} or find_in_set( {} , ancestors ) )", deptAlias, user.getDeptId(), user.getDeptId()));
            }
            // 仅本人数据权限：拼接 sqlString
            else if (DataScopeEnum.DATA_SCOPE_SELF.getScope().equals(dataScope)) {
                if (StringUtils.isNotBlank(userAlias)) {
                    sqlString.append(StringUtils.format(" OR {}.user_id = {} ", userAlias, user.getUserId()));
                } else {
                    // 数据权限为仅本人且没有userAlias别名不查询任何数据
                    sqlString.append(StringUtils.format(" OR {}.dept_id = 0 ", deptAlias));
                }
            }
            conditions.add(dataScope);
        }

        // 角色都不包含传递过来的权限字符，这个时候sqlString也会为空，所以要限制一下,不查询任何数据（部门id=0是占位的不存在的部门记录）
        if (StringUtils.isEmpty(conditions)) {
            sqlString.append(StringUtils.format(" OR {}.dept_id = 0 ", deptAlias));
        }

        // 最终的拼接与注入
        if (StringUtils.isNotBlank(sqlString.toString())) {
            baseEntity.getParams().put(DATA_SCOPE, " AND (" + sqlString.substring(4) + ")");  // substring(4) 是为了截断第一个 " OR "
        }
    }

    /**
     * 拼接权限sql前先清空params.dataScope参数防止注入
     */
    private void clearDataScope(final JoinPoint joinPoint) {
        BaseEntity baseEntity = getBaseEntity(joinPoint);
        if (baseEntity != null) {
            baseEntity.getParams().put(DATA_SCOPE, "");
        }
    }

    /**
     * 获取查询参数对象
     */
    private static BaseEntity getBaseEntity(final JoinPoint joinPoint) {
        Object[] args = joinPoint.getArgs();
        if (args == null) {
            return null;
        }
        for (Object arg : args) {
            if (arg instanceof BaseEntity) {
                return (BaseEntity) arg;
            }
        }
        return null;
    }
}
```

DataScope：

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface DataScope {
    /**
     * 部门表的别名
     */
    public String deptAlias() default "";

    /**
     * 用户表的别名
     */
    public String userAlias() default "";

    /**
     * 权限字符（用于多个角色匹配符合要求的权限）默认根据权限注解 @RequiresPermissions 获取，多个权限用英文逗号分隔开来
     */
    public String permission() default "";
}
```

应用示例：

```java
@RequiresPermissions("system:user:list")
@PostMapping("/list")
@ResponseBody
public Rsult<List<SysUser>> list(SysUser user) {
  List<SysUser> list = userService.selectUserList(user);
  return Rsult.success(list);
}

@Override
@DataScope(deptAlias = "d", userAlias = "u")
public List<SysUser> selectUserList(SysUser user) {
  return userMapper.selectUserList(user);
}
```

<br>



## 多 Realm 的实现

扩展 UsernamePasswordToken，增加业务字段：

```java
/**
 * @author KJ
 * @description 自定义token，用于多数据源的业务判断场景
 */
public class MyToken extends UsernamePasswordToken {

    @Getter
    @Setter
    private int userType; // 可以根据 userType 判断是系统用户还是普通用户，从而选择不同的 realm 认证

    public MyToken(String username, String password, int userType) {
        super(username, password);
        this.setUserType(userType);
    }

    public MyToken(String username, String password, boolean rememberMe, int userType) {
        super(username, password, rememberMe);
        this.setUserType(userType);
    }
}
```

重写多数据源认证器实现：

```java
/**
 * 自定义多数据源认证器
 * 需要如下两行代码的支持
 * securityManager.setAuthenticator(new MyModularRealmAuthenticator());
 * securityManager.setRealms(List.of(myRealm1, myRealm2));
 *
 * @author KJ
 * @description 自定义多数数据源认证器
 */
@Slf4j
public class MyModularRealmAuthenticator extends ModularRealmAuthenticator {

    @Override
    protected AuthenticationInfo doAuthenticate(AuthenticationToken token) throws AuthenticationException {
        MyToken myToken = (MyToken) token;
        log.info("[doAuthenticate，此处根据传入的自定义token信息写业务逻辑] userType:{}", myToken.getUserType());
        return super.doAuthenticate(token);
    }

    @Override
    protected AuthenticationInfo doMultiRealmAuthentication(Collection<Realm> realms, AuthenticationToken token) {
        MyToken myToken = (MyToken) token;
        log.info("[doMultiRealmAuthentication，此处根据传入的自定义token信息写业务逻辑] userType:{}", myToken.getUserType());
        return super.doMultiRealmAuthentication(realms, token);
    }
}
```

注册这个新的 ModularRealmAuthenticator：

```java
/**
 * Shiro 安全管理器配置
 */
@Bean
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
public DefaultWebSecurityManager securityManager(...) {
  DefaultWebSecurityManager securityManager = new DefaultWebSecurityManager();
  
  // ...

  // 手动设置认证器（定制化需求） {@link MyModularRealmAuthenticator}
  securityManager.setAuthenticator(new MyModularRealmAuthenticator());

  // 设置多个 Realm，默认的多数据源策略是 AtLeastOneSuccessfulStrategy
  securityManager.setRealms(List.of(myRealm1, myRealm2));

  // ...
  return securityManager;
}
```

<br>





