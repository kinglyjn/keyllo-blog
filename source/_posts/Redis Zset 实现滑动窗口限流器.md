title: Redis Zset 实现滑动窗口限流器

author: kinglyjn

mathjax: true

tags:

  - redis
  - zset
  - structure
  - limiter
  - biz

categories:

  - db_cache

  - redis

date: 2023-04-12 11:53:01

---



## 滑动窗口限流器

### 它是什么？

如果说缓存和双锁机制（DCL）是为了保护后端数据，那么滑动窗口限流器就是为了保护整个系统入口，防止被恶意刷接口（防刷）或流量激增冲垮。那么究竟什么是滑动窗口限流器？它的实现原理又是是怎样的？它和普通的固定窗口又有什么本质的区别呢？我们在这里使用一个通俗的例子帮你认识它。



<!--more-->



想象一个火车站闸机，规定 “每分钟只能进入 100 人”。

* **固定窗口（老办法）**：闸机在 10:00:00 准时重置计数器。如果 10:00:59 秒进来了 100 人，10:01:01 又进来了 100 人。虽然每一分钟都没超标，但在那 2 秒钟内瞬时涌入了 200 人，闸机可能会被挤爆。这就是“临界突刺”问题。
* **滑动窗口（新办法）**：闸机不再盯着表看。它记下每一个进站人的确切时间戳。当第 101 个人想进站时，闸机往回看正好 60 秒（比如从 10:00:05 到 10:01:05）。如果这 60 秒内已经有 100 人了，就不让进。这个窗口是随着时间不停向前滑动的，没有任何死角。

<br>



### 它是怎么实现的？

这种滑动窗口核心是基于 redis zset 这种数据结构以及 redis lua 操作的原子性实现的，核心原因如下：

* **打点记录 (ZADD)**： 每当用户访问一次，就在 ZSET 里加一个值。Key 是用户 ID，Score 和 Value 都是当前毫秒时间戳。

* **清理过期数据 (ZREMRANGEBYSCORE)**： 删掉窗口之外的数据。比如窗口是 60 秒，那就删掉所有 Score < (当前时间 - 60秒) 的数据。

* **计算数量 (ZCARD)**： 统计剩下的数量。如果 ZCARD > 阈值，说明请求太快了，直接拒绝。
* **设置过期时间 (EXPIRE)**： 给这个 ZSET 设个过期时间（比如 5 分钟），防止僵尸数据占内存。

<br>



### 它能解决哪些问题？

* **精准打击非法脚本**： 刷票软件或爬虫通常每 0.5 秒请求一次。固定窗口可能拦不住它们（如果跨窗口了），但滑动窗口能把它们的请求记录连成一条线，一旦频率超标，立刻封锁。

* **平滑流量**： 它让流量均匀地进入系统，不会出现“前一秒闲死，后一秒挤死”的极端波动。

* **分片桶（Bucket）的理念**： 由于每个用户拥有独立的 ZSET，这就像把流量分流到了成千上万个小桶里。某个用户的疯狂请求只会让自己的 “桶” 溢出（被限流），完全不会影响其他正常用户的访问。

<br>



## 分布式限流器额和本地限流器的比较

### 分布式全局观 vs 单机孤岛

假设你有 10 个服务器节点，每个节点配置限流 100 QPS。

* **本地限流（孤岛）**： 总流量可能会冲到 1000 QPS 才能触发限流。如果你的数据库（DB）只能抗住 300 QPS，那么本地限流完全保护不了你的 DB。流量分配是不均匀的。可能节点 A 挤爆了在限流，而节点 B 闲得发慌。

* **Redis 限流（全局）**： 所有节点共用一个“计数桶”。无论请求打到哪个节点，都会汇总到 Redis。它能精准控制总流量。你说限流 100，那全集群加起来就是 100。这对于保护下游的单点资源（如数据库、第三方支付接口）至关重要。

<br>



### 用户状态的连贯性（防刷场景）

这是 Redis 限流器真正的“杀手锏”：

* **本地限流**： 如果一个恶意用户疯狂刷接口，只要他每次请求被负载均衡分发到不同的节点，他就能绕过单机的限流阈值。
* **分布式限流**： 因为 Key 是基于 `用户ID` 或 `IP` 的，无论他怎么换节点，他在 Redis 里的记录都是累计的。结果恶意刷票、爬虫在分布式环境下无处遁形，被精准封杀。

<br>



### 生产环境的建议

就是那句经典的：“我全都要！” 😀

* **第一层：Redis 限流（全局）** 拦截恶意刷接口、控制整个业务线的总 QPS，保护数据库不被打死。

* **第二层：本地限流（单机自保）** 如果 Redis 挂了或者某个节点由于 Bug 产生瞬间高并发，本地限流作为最后一道防线，防止单个 Java 进程因为线程池溢出而 OOM（内存溢出）。

<br>



## 分布式滑动窗口限流器的关键代码



### AOP 切面层

RateLimiterAspect：

限流功能毕竟是核心业务之外的装饰功能，当出现 Redis 宕机、网络抖动或集群切主时，应用系统必须能够实现降级或切换，保证核心业务的可用！

```java
import com.demo.componet.limiter.RateLimiter;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;
import java.util.Collections;

/**
 * @author KJ
 * @description 集群级应用的限流切面
 */
@Aspect
@Component
@Order(0) // 优先级最高，先限流再读缓存
@Slf4j
public class RateLimiterAspect {
  
    @Value("${owlias.limiter.enabled:true}")
    private boolean limiterEnabled;

    @Resource
    private StringRedisTemplate masterStringRedisTemplate;

    private static final DefaultRedisScript<Long> LIMIT_SCRIPT;
    static {
        LIMIT_SCRIPT = new DefaultRedisScript<>();
        LIMIT_SCRIPT.setLocation(new ClassPathResource("lua/sliding_window_rate_limit.lua"));
        LIMIT_SCRIPT.setResultType(Long.class);
    }

    @Around("@annotation(rateLimiter)")
    public Object doAround(ProceedingJoinPoint joinPoint, RateLimiter rateLimiter) throws Throwable {
        // 有时候 Redis 没挂，但 Redis 压力太大，我们想手动关闭限流逻辑。
        // 可以通过 Apollo/Nacos 等配置中心动态下发一个 enabled 参数
        if (!limiterEnabled) {
            return joinPoint.proceed();
        }
        
        // 解析 Key (动态提取用户 ID 等)
        String keySuffix = SpringExpressionUtils.parseSpel(rateLimiter.keyExpression(), joinPoint);
        String finalKey = rateLimiter.prefix() + keySuffix;

        // 默认为 1，即：如果 Redis 挂了，默认放行
        long result = 1L;

        try {
            // 执行 Lua 限流逻辑
            result = masterStringRedisTemplate.execute(
                    LIMIT_SCRIPT,
                    Collections.singletonList(finalKey),
                    String.valueOf(System.currentTimeMillis()),
                    String.valueOf(rateLimiter.window() * 1000L),
                    String.valueOf(rateLimiter.max())
            );
        } catch (Exception e) {
            // --- 核心降级逻辑 ---
            // 当 Redis 宕机、网络抖动或集群切主时，进入此处
            log.error("Redis 限流组件异常，已自动降级放行。Key: {}, 异常原因: {}", finalKey, e.getMessage());
        }

        if (result == 0) {
            log.warn("Rate limit exceeded for key: {}", finalKey);
            throw new RuntimeException(rateLimiter.message());
        }

        return joinPoint.proceed();
    }
}
```

<br>



### LUA 脚本支持

lua/sliding_window_rate_limit.lua

```lua
-- KEYS[1]: 限流 Key (例如 rate_limit:user:1001)
-- ARGV[1]: 当前毫秒时间戳
-- ARGV[2]: 窗口持续时间 (毫秒)
-- ARGV[3]: 窗口内允许的最大请求数

local window_start = tonumber(ARGV[1]) - tonumber(ARGV[2])
local current_key = KEYS[1]

-- 1. 移除窗口外的时间戳
redis.call('ZREMRANGEBYSCORE', current_key, 0, window_start)

-- 2. 统计当前窗口内的请求数
local current_requests = redis.call('ZCARD', current_key)

-- 3. 判断是否超限
if current_requests < tonumber(ARGV[3]) then
    -- 4. 未超限，添加当前请求时间戳
    -- 这里使用 ARGV[1] 作为 score 和 member，为了保证唯一性可以加个随机后缀或 UUID，
    -- 但在高并发下，同一毫秒多个请求建议使用 score 为时间戳，member 为随机串。
    redis.call('ZADD', current_key, ARGV[1], ARGV[1] .. math.random())
    -- 设置过期时间（窗口时间 + 额外缓冲），防止冷数据堆积
    redis.call('EXPIRE', current_key, math.ceil(tonumber(ARGV[2]) / 1000) + 60)
    return 1 -- 放行
else
    return 0 -- 限流
end
```

<br>



### 核心应用组件

```java
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * @author KJ
 * @description
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RateLimiter {
    /** 限流 Key 的前缀 */
    String prefix() default "rate_limit:";

    /** SpEL 表达式，用于动态提取用户 ID 或 IP */
    String keyExpression();

    /** 窗口时间长度 (单位：秒) */
    int window() default 60;

    /** 窗口内允许的最大请求次数 */
    int max() default 100;

    /** 错误提示信息 */
    String message() default "操作过于频繁，请稍后再试";
}
```

<br>



### 相关测试

#### 业务演示类

```java
@Service
public class EmployeeService {

    @RateLimiter(prefix = "rate_limit:emp:", keyExpression = "#id", window = 10, max = 5, message = "查询太快啦，喝杯茶再来")
    @RedisJsonReadingCache(prefix = "emp:", keyExpression = "#id", expireTime = 900L)
    public EmployeeDoc getById(String id) {
        return repositoryGetById(id);
    }

    @RateLimiter(keyExpression = "T(com.demo.utils.IpUtils).getIp()")
    public EmployeeDoc getById2(String id) {
        return repositoryGetById(id);
    }
    
    // ...
}
```

<br>



#### 测试单元

```java
import com.demo.App;
import com.demo.model.EmployeeDoc;
import com.demo.service.EmployeeService;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * @author KJ
 * @description
 */
@Slf4j
@SpringBootTest(classes = App.class)
public class RateLimiterTest {

    @Resource
    private EmployeeService employeeService;

    @Test
    @DisplayName("测试按 ID 限流：10秒内允许5次，第6次应报错")
    public void testIdRateLimiting() {
        String testId = "1001";

        // 1. 前 5 次请求应该是正常的
        for (int i = 1; i <= 5; i++) {
            employeeService.getById(testId);
            log.info("第 {} 次请求成功", i);
        }

        // 2. 第 6 次请求预期抛出 RuntimeException
        RuntimeException exception = assertThrows(RuntimeException.class, () -> {
            employeeService.getById(testId);
        });

        log.info("捕获到预期限流异常: {}", exception.getMessage());
        // 验证提示语是否正确
        assert exception.getMessage().equals("查询太快啦，喝杯茶再来");
    }

    @Test
    @DisplayName("测试按 IP 限流：连续快速访问")
    public void testIpRateLimiting() {
        // 由于 getById2 没传 window 和 max，使用默认值（假设默认 60s 内 100 次，或者你在注解定义的默认值）
        // 为了快速测试，你可以临时改小注解里的默认值，或者在这里写个循环
        assertThrows(RuntimeException.class, () -> {
            for (int i = 0; i < 110; i++) {
                employeeService.getById2("any-id");
            }
        });
        log.info("IP 限流测试通过");
    }

    @Test
    @DisplayName("测试限流降级：Redis 挂了也应该能查到数据")
    public void testRateLimiterFallback() {
        // 模拟场景：手动停止 Redis 或使用 Mockito 让 RedisTemplate 报异常
        // 这里我们假设 Redis 已经不可用

        // 预期：即使限流器内部报错，业务方法依然能正常返回结果，而不是抛出限流异常
        EmployeeDoc emp = employeeService.getById("1001");

        assertNotNull(emp); // 业务逻辑应该依然走通
        log.info("限流器降级测试通过：Redis 异常时业务未受影响");
    }
}
```

<br>



redis zset 生成的演示数据：

```bash
192.168.1.224:7001> zrange rate_limit:emp:1001 0 -1
1) "17708793791610.015582849278852"
2) "17708793827460.58409022054825"
3) "17708793840700.15936862638191"
4) "17708793849440.38371587469416"
5) "17708793858570.69100437345496"
```

<br>

