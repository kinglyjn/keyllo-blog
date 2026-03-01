title: Redis 分布式锁的实现

author: kinglyjn

tags:

  - redis
  - lettuce
  - lock
  - cap_base

categories:

  - db_cache

  - redis

date: 2023-06-02 10:12:23

---



## Redis 分布式锁实现的思路

我们知道，Redis 有一个天然支持锁的指令 `set <key> <value> NX PX <ttl_millis> `，这个指令本身就是原子性的，这就是 redis 实现分布式锁的基础。通过这条指令实现简单的分布式互斥锁，那基本就是手到擒来，但在实际的生产环境，我们更推荐使用 LUA 脚本进行封装。理由如下：

<!--more-->

* **语义的一致性**：分布式锁本质上包含两个核心动作：**加锁** 和 **释放锁**。为防止误删除锁（A 加的锁，不能被 B 删掉），释放锁必须用 Lua，因为需要要判断 value 是否相等再删除，而原生命令做不到。对应的加锁如果用原生命令，释放锁用 Lua，那么你的代码里就会混杂着两种不同的调用方式。所以更好的方法是统一收拢到 Lua 脚本中，让代码逻辑更整洁，方便后续的统一维护。
* **功能的可扩展性：为 “可重入” 留后路**：如果你今天用 SET NX PX，明天业务需求变了，要求锁必须是 “可重入” 的（即同一个线程拿了锁之后可以再拿一次），原生指令就彻底没戏了。 如果是 Lua 脚本，你只需要改脚本内部的逻辑，Java 代码一行都不用动。

<br>



**那么使用 LUA 脚本实现分布式锁我们性能损耗如何？**

先说结论：在高并发场景下，使用 Lua 脚本相比原生指令的性能损耗几乎可以忽略不计（通常在微秒级别），物理层面的对比仅是微秒之差。

* 原生指令 (SET NX PX)：Redis 直接解析协议，执行 C 语言函数。耗时极短。
* Lua 脚本：Redis 需要从缓存中找到已编译的 Lua 脚本（SHA1），在内置的 Lua 解释器中执行。损耗点在 Lua 虚拟机的启动（仅微秒级）和脚本上下文的切换。实际测算在普通的生产级服务器上，单次原生操作可能耗时 **10-20μs**，而同样的 Lua 脚本操作可能耗时 **30-50μs**。
* 对于应用程序来说，网络 IO（RTT）通常在 1ms (1000μs) 以上，这 20μs 的差距在网络延迟面前完全被掩盖了。

对于应用程序而言，我们更关注应用功能的可扩展性和代码的可维护性，这几微妙的损耗相比于网络传输的性能 损耗，真的可以忽略不计。可以这么说，对于分布式锁，业界最标准的做法是基于 **Redisson** 或 **Lua 脚本**。而我们这里介绍的就是基于 **Lua 脚本 + 唯一请求 ID** 实现的的企业级分布式锁。

<br>



**我们的LUA分布式锁要实现哪些基本目标？**

* **原子性**：加锁和设置过期时间必须一气呵成（Lua 解决）。
* **防误删**：A 加的锁，不能被 B 删掉（通过 value 设置标识唯一 UUID 解决）。
* **续期问题（Watch Dog）**：业务没跑完，锁过期了怎么办？（通常建议设置一个合理的保底超时时间，或使用异步心跳续期）。
* **可重入性（Reentrant Lock）**：可重入锁（Reentrant Lock）的核心要解决的问题是，同一个线程在持有锁的情况下，再次请求同一把锁时，可以避免 “自我死锁” （Self-Deadlock）并保证业务逻辑的连续性。

<br>





## 非重入分布式锁的实现



### 切面实现

RedisLockAspect：

```java
import com.demo.componet.RedisLockExecutor;
import com.demo.componet.lock.RedisLock;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * @author KJ
 * @description Redis 分布式锁切面实现
 */
@Aspect
@Component
// 优先级比限流还高，或者紧随其后
// 执行链：分布式锁 -> 限流 -> 缓存 -> 事务 -> 业务。
// 这样可以确保如果一个用户拿到了锁，但因为请求太频繁被限流了，锁也会在 finally 中安全释放。
@Order(-1) 
@Slf4j
public class RedisLockAspect {

    private boolean redisLockEnabled = true;

    @Resource
    private RedisLockExecutor redisLockExecutor;

    @Around("@annotation(redisLock)")
    public Object doAround(ProceedingJoinPoint joinPoint, RedisLock redisLock) throws Throwable {
        // 判断是否开启（应对突发的 redis 集群不可用）
        if (!redisLockEnabled) {
            return joinPoint.proceed();
        }

        long startTime = System.currentTimeMillis(); ////
        String keySuffix = SpringExpressionUtils.parseSpel(redisLock.keyExpression(), joinPoint);
        String lockKey = redisLock.prefix() + keySuffix;

        // 生成唯一标识：用于防误删
        String lockValue = UUID.randomUUID() + ":" + Thread.currentThread().getId();

        boolean acquired = false;
        int tryTimes = redisLock.retryTimes();
        int currentTry = 0;

        while (currentTry <= tryTimes) {
            acquired = redisLockExecutor.tryLock(lockKey, lockValue, redisLock.expire());
            if (acquired) {
                startTime = System.currentTimeMillis(); ////
                break;
            }

            if (currentTry < tryTimes) {
                try {
                    long sleepTime = calculateSleepTime(redisLock.intervalStrategy(), currentTry, redisLock.retryInterval());
                    Thread.sleep(sleepTime);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt(); // 保持中断状态
                    throw new RuntimeException("系统异常，操作被中断");
                }
            }
            currentTry++;
        }

        if (!acquired) {
            log.warn("获取分布式锁失败: {}", lockKey);
            throw new RuntimeException("系统繁忙，请稍后再试"); // 实际使用业务异常
        }

        try {
            // 2. 执行业务逻辑
            return joinPoint.proceed();
        } finally {
            if (acquired) {
                // 3. 释放锁：必须在 finally 中，且使用 Lua 脚本保证安全释放
                redisLockExecutor.unlock(lockKey, lockValue);
            }

            long costTime = System.currentTimeMillis() - startTime; ////
            if (costTime > redisLock.expire()) {
                log.error("【安全警报】业务耗时({})大于锁过期时间({})，锁已提前失效！lockKey: {}，lockValue:{}",
                        costTime, redisLock.expire(), lockKey, lockValue);
            }
        }
    }

    /**
     * 计算等待时间：线性 vs 指数
     */
    private long calculateSleepTime(RetryIntervalStrategy strategy, int currentTry, long interval) {
        final long MAX_SLEEP_TIME = 2000L;
        long resultTime;

        if (strategy == RetryIntervalStrategy.EXPONENTIAL) {
            // 指数退避：interval * 1.5^n
            double backoff = interval * Math.pow(1.5, currentTry);
            resultTime = (long) Math.min(backoff, (double) MAX_SLEEP_TIME);
        } else {
            // 线性重试：直接使用固定间隔
            resultTime = interval;
        }

        // 无论哪种策略，都加上随机抖动，分散线程唤醒时间
        long jitter = ThreadLocalRandom.current().nextLong(0, 50);

        return Math.max(10L, resultTime + jitter);
    }
}
```

<br>



### Redis 分布式锁的实现

RedisLockExecutor：

我们在这里使用 MasterStringRedisTemplate 确实意味着所有相关的 Redis 操作（无论是写锁还是查锁）都会路由到 Redis 的主库（Master）。在工业级分布式锁的实现中，**锁操作必须全部走主库** 实际上是一个非常关键的设计决策。原因在于分布式锁的核心价值在于`绝对的互斥性`。Redis 的主从同步是异步进行的。假如有一个场景：

* 线程 A 在主库加锁成功，主库还没来得及把这个 key 同步到从库
* 此时主库宕机，从库被提升为新主库
* 线程 B 请求加锁，新主库发现没有这个 key，也加锁成功。

结果就是分布式锁失效，两个线程同时进入了临界区（造成资损或数据破坏）。所以 为了保证锁的强一致性，所有的加锁（SET NX）和解锁（LUA/DEL）必须在主库完成。那我们要问这种 “都走主库” 的做法会对主库造成巨大压力吗？一般分布式锁不会，比如与分布式限流器相比：

* 限流器（RateLimiter）：这是高频操作。如果你的系统有极高的流量（例如每秒百万级），主库可能会产生压力。如果限流压力过大，业界通常会将 “限流专用 Redis” 和 “业务数据 Redis” 做物理集群隔离，即限流操作去一套专门的 Redis 集群。
* 分布式锁（RedisLock）：通常只针对特定业务 ID，并发量虽大但 Key 散列，主库处理 SET NX 或 Lua 解锁 的性能极高（单机可达 10W+ QPS），通常不是瓶颈。

```java
import jakarta.annotation.Resource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;
import java.util.Collections;

/**
 * @author KJ
 * @date 2026/2/12 19:39
 * @description Redis 分布式锁的实现
 */
@Component
public class RedisLockExecutor {

    @Resource
    private StringRedisTemplate masterStringRedisTemplate;

    private static final DefaultRedisScript<Long> LOCK_SCRIPT;
    private static final DefaultRedisScript<Long> UNLOCK_SCRIPT;

    static {
        LOCK_SCRIPT = new DefaultRedisScript<>();
        LOCK_SCRIPT.setLocation(new ClassPathResource("lua/dist_lock.lua"));
        LOCK_SCRIPT.setResultType(Long.class);

        UNLOCK_SCRIPT = new DefaultRedisScript<>();
        UNLOCK_SCRIPT.setLocation(new ClassPathResource("lua/dist_unlock.lua"));
        UNLOCK_SCRIPT.setResultType(Long.class);
    }

    public boolean tryLock(String lockKey, String lockValue, long expireMillis) {
        Long result = masterStringRedisTemplate.execute(
                LOCK_SCRIPT,
                Collections.singletonList(lockKey),
                lockValue,
                String.valueOf(expireMillis)
        );
        return Long.valueOf(1).equals(result);
    }

    public boolean unlock(String lockKey, String lockValue) {
        Long result = masterStringRedisTemplate.execute(
                UNLOCK_SCRIPT,
                Collections.singletonList(lockKey),
                lockValue
        );
        return Long.valueOf(1).equals(result);
    }
}
```

<br>

dist_lock.lua

```lua
-- KEYS[1]: 锁的名称
-- ARGV[1]: 锁的唯一标识 (UUID:ThreadID)
-- ARGV[2]: 过期时间 (毫秒)
if redis.call('set', KEYS[1], ARGV[1], 'NX', 'PX', ARGV[2]) then
    return 1
else
    return 0
end
```

<br>

dist_unlock.lua

可以有效防止以下误删的场景：

* 线程 A 加锁成功，设置过期时间 60s。
* 线程 A 业务逻辑太慢，跑了 65s。此时锁在第 60s 自动过期了。
* 线程 B 趁虚而入，加锁成功。
* 线程 A 终于跑完了，执行 DEL lock:user:1。结果是线程 A 删掉了线程 B 正在持有的锁！

```lua
-- KEYS[1]: 锁的名称
-- ARGV[1]: 锁的唯一标识
if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
else
    return 0
end
```

<br>



### 核心组件

RedisLock：

```java
/**
 * @author KJ
 * @description Redis 分布式锁
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RedisLock {
    String prefix() default "lock:";    // Redis 锁的 Key 前缀
    String keyExpression();             // Redis 锁的 Key 后缀，通过解析 Key 的 SpEL 表达式获取

    long expire() default 5000;         // 锁的超时时间，默认 5 秒，实际的业务中其设置要大于业务执行时间
    int retryTimes() default 10;        // 重试次数
    long retryInterval() default 100;   // 重试间隔
    RetryIntervalStrategy intervalStrategy() default RetryIntervalStrategy.LINEAR;

    // 计算总等待时间 = retryTimes x retryInterval，比如计算得是 1000ms，如果你的业务需要执行至少10秒，那么就会出现第一个线程要至少 10 秒
    // 才释放锁，而其他线程只愿意等 1 秒，其它所有线程在尝试了 10 次（即耗时 1 秒）后，都由于拿不到锁而报错 获取分布式锁失败，然后直接返回了。

    // 对于库存扣减这种 “必须成功” 的场景，可以适当调大 retryTimes
    // 更好的方案是采用 Redis 分段锁（把 50 个库存拆成 5 个 Key，每个 Key 存 10 个），从而降低单 Key 的竞争压力。
}
```

<br>

RetryIntervalStrategy:：

```java
/**
 * @author KJ
 * @date 2026/2/13 00:08
 * @description 重试间隔的时间策略
 */
public enum RetryIntervalStrategy {

    /**
     * 线性重试：适合锁竞争非常激烈的抢购场景，保证线程排队效率。
     * 等额节奏：重试间隔固定（如 100ms, 100ms, 100ms...），一旦锁释放，排队者能较快地捕捉到信号并抢占。
     * 适合做：“抢购” 类任务
     */
    LINEAR,

    /**
     * 指数退避：适合重试第三方接口，保护下游系统
     * 间隔越来越长（如 100ms, 200ms, 400ms, 800ms...），给被访问的系统留出足够的喘息和恢复时间。
     * 适合做：比如支付结果回调任务
     */
    EXPONENTIAL;
}
```

<br>



### 演示和测试单元

StockService：

```java
/**
 * @author KJ
 * @description 超卖演示业务类
 */
@Slf4j
@Service
public class StockService {

    // 模拟数据库中的商品库存：ID -> 库存数量
    private final Map<String, Integer> stockRepo = new HashMap<>();

    public void initStock(String productId, int count) {
        stockRepo.put(productId, count);
    }

    public int getStock(String productId) {
        return stockRepo.getOrDefault(productId, 0);
    }

    /**
     * 扣减库存逻辑
     * 使用 @RedisLock 保护，确保同一时间只有一个线程能执行查询并修改
     */
    @RedisLock(prefix = "stock_lock:", keyExpression = "#productId",
            expire = 6000, retryTimes = 100, retryInterval = 60, intervalStrategy = RetryIntervalStrategy.EXPONENTIAL)
    public void deductStock(String productId) {
        int currentStock = stockRepo.get(productId);
        if (currentStock > 0) {

            try {
                // 模拟业务处理耗时，让并发问题更明显
                Thread.sleep(2000);
            } catch (InterruptedException ignored) {
                // ignore
            }

            stockRepo.put(productId, currentStock - 1);
            log.info("线程 {} 扣减成功，剩余库存: {}", Thread.currentThread().getId(), currentStock - 1);
        } else {
            log.warn("库存不足！");
        }
    }
}
```

<br>

RedisLockTest：

```java
/**
 * @author KJ
 * @description
 */
@Slf4j
@SpringBootTest(classes = App.class)
public class RedisLockTest {

    @Resource
    private StockService stockService;

    @Test
    @DisplayName("高并发库存扣减测试：验证分布式锁有效性")
    public void testConcurrentDeduct() throws InterruptedException {
        String productId = "PROD_001";
        int initialStock = 50;  // 初始库存 50
        int clientCount = 100;  // 模拟 100 个并发请求
        stockService.initStock(productId, initialStock);

        // 用于同步所有线程同时开始
        CountDownLatch startLatch = new CountDownLatch(1);
        // 用于等待所有线程执行结束
        CountDownLatch doneLatch = new CountDownLatch(clientCount);
        ExecutorService executorService = Executors.newFixedThreadPool(clientCount);

        for (int i = 0; i < clientCount; i++) {
            executorService.submit(() -> {
                try {
                    startLatch.await(); // 等待发令枪响
                    stockService.deductStock(productId);
                } catch (Exception e) {
                    log.error("请求失败: {}", e.getMessage());
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        long startTime = System.currentTimeMillis();
        startLatch.countDown(); // 发令枪响：所有线程冲出跑道
        doneLatch.await();      // 等待所有线程跑完
        long endTime = System.currentTimeMillis();

        int finalStock = stockService.getStock(productId);
        log.info("测试结束。总耗时: {}ms, 初始库存: {}, 最终剩余: {}", (endTime - startTime), initialStock, finalStock);

        // 验证：如果有锁，50 个库存被 100 个人抢，最终库存必须是 0
        // 如果没有锁，由于并发冲突，最终库存通常会 > 0 (即少扣了)
        assertEquals(0, finalStock, "库存扣减结果不一致，分布式锁可能失效！");
    }
}
```

<br>



## 给我们的锁增加看门狗的逻辑

这个看门狗（Watch Dog）在分布式锁中是一个很重要的可选项，它要解决的问题是应对当业务执行太久（比如突然卡顿 20s）时，自动给锁延时，以防止锁过期导致其他线程闯入。它的核心任务就是：**只要业务没跑完，就定期给 Redis 里的锁续期，防止锁因为达到 expire 时间而自动释放。**



### 改造后的锁

只需要为 RedisLockExecutor 增加 “看门狗” 的逻辑即可。

```java
import com.google.common.util.concurrent.ThreadFactoryBuilder;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.*;

/**
 * @author KJ
 * @date 2026/2/12 19:39
 * @description Redis 分布式锁的实现
 */
@Slf4j
@Component
public class RedisLockExecutor {

    @Resource
    private StringRedisTemplate masterStringRedisTemplate;

    private static final DefaultRedisScript<Long> LOCK_SCRIPT;
    private static final DefaultRedisScript<Long> UNLOCK_SCRIPT;
    private static final DefaultRedisScript<Long> RENEW_SCRIPT;

    // 线程池用于看门狗任务
    // 线程命名：显式命名（如 lock-watchdog-0），监控告警一眼定位。
    // 拒绝策略：可以自定义拒绝策略（如打印日志后丢弃，防止撑爆内存）
    // 线程工厂：可以设置为守护线程（Daemon），防止线程池阻塞 JVM 关闭，从而防止业务线程被看门狗拖垮
    // 阿里规约：强烈推荐（强制开发者明确参数意义）。
    private final ScheduledExecutorService watchdogTimer = new ScheduledThreadPoolExecutor(
            Runtime.getRuntime().availableProcessors(),
            new ThreadFactoryBuilder().setNameFormat("lock-watchdog-%d").setDaemon(true).build(), // Google Guava 库提供的工具类
            new ThreadPoolExecutor.CallerRunsPolicy() // 关键：如果看门狗满了，让业务线程自己去执行续期，保证锁不丢
    );

    // 线程池用于看门狗任务
    // 线程命名：使用默认名（如 pool-1-thread-1），出问题时无法定位。
    // 拒绝策略：默认 AbortPolicy，满了直接抛异常，无法自定义。
    // 线程工厂：使用默认工厂。
    // 阿里规约：生产环境严禁使用（容易因队列堆积导致 OOM）。
    // private final ScheduledExecutorService watchdogExecutor = Executors.newScheduledThreadPool(4);

    // 保存正在运行的看门狗任务，Key 是 lockValue
    private final Map<String, ScheduledFuture<?>> renewalTasks = new ConcurrentHashMap<>();

    static {
        LOCK_SCRIPT = new DefaultRedisScript<>();
        LOCK_SCRIPT.setLocation(new ClassPathResource("lua/dist_lock.lua"));
        LOCK_SCRIPT.setResultType(Long.class);

        UNLOCK_SCRIPT = new DefaultRedisScript<>();
        UNLOCK_SCRIPT.setLocation(new ClassPathResource("lua/dist_unlock.lua"));
        UNLOCK_SCRIPT.setResultType(Long.class);

        RENEW_SCRIPT = new DefaultRedisScript<>();
        RENEW_SCRIPT.setLocation(new ClassPathResource("lua/dist_renew.lua"));
        RENEW_SCRIPT.setResultType(Long.class);
    }

    public boolean tryLock(String lockKey, String lockValue, long expireMillis) {
        Long result = masterStringRedisTemplate.execute(
                LOCK_SCRIPT,
                Collections.singletonList(lockKey),
                lockValue,
                String.valueOf(expireMillis)
        );
        boolean success = Long.valueOf(1).equals(result);
        if (success) {
            // 加锁成功，启动看门狗
            startWatchdog(lockKey, lockValue, expireMillis);
        }
        return success;
    }

    public boolean unlock(String lockKey, String lockValue) {
        try {
            Long result = masterStringRedisTemplate.execute(
                    UNLOCK_SCRIPT,
                    Collections.singletonList(lockKey),
                    lockValue
            );
            return Long.valueOf(1).equals(result);
        } finally {
            // 无论解锁结果如何，都必须停止看门狗
            stopWatchdog(lockValue);
        }
    }

    /**
     * 尝试给锁续期
     */
    public boolean renew(String lockKey, String lockValue, long expireMillis) {
        Long result = masterStringRedisTemplate.execute(
                RENEW_SCRIPT,
                Collections.singletonList(lockKey),
                lockValue,
                String.valueOf(expireMillis));
        return !Long.valueOf(0).equals(result);
    }

    /**
     * 启动看门狗任务
     */
    private void startWatchdog(String lockKey, String lockValue, long expireMillis) {
        // 防御编程：避免重复启动
        if (renewalTasks.containsKey(lockValue)) return;

        // 续期周期通常为 expireTime / 3
        long period = expireMillis / 3;
        ScheduledFuture<?> task = watchdogTimer.scheduleAtFixedRate(() -> {
            try {
                boolean renew = renew(lockKey, lockValue, expireMillis);
                if (renew) {
                    log.debug("看门狗续期成功: lockValue:{}", lockValue);
                } else {
                    // 锁可能已被主动释放或异常丢失，停止续期
                    stopWatchdog(lockValue);
                }
            } catch (Exception e) {
                // ScheduledExecutorService 的一个特性：如果定时任务内部抛出了未捕获的异常，这个任务就会停止，且不会有任何报错。
                // 所以这里要捕获异常，并记录日志。
                log.error("看门狗续期异常，lockKey:{}, lockValue:{}", lockKey, lockValue, e);
            }
        }, period, period, TimeUnit.MILLISECONDS);
        renewalTasks.put(lockValue, task);
    }

    /**
     * 停止看门狗任务
     */
    private void stopWatchdog(String lockValue) {
        ScheduledFuture<?> task = renewalTasks.remove(lockValue);
        if (task != null) {
            task.cancel(false);
            log.debug("看门狗移除成功: lockValue:{}", lockValue);
        }
    }
}
```

<br>



### 增加的 LUA 脚本支持

dist_renew.lua

```lua
-- KEYS[1]: 锁的名称
-- ARGV[1]: 锁的唯一标识 (UUID:ThreadID)
-- ARGV[2]: 续期时间 (毫秒)
if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('pexpire', KEYS[1], ARGV[2])
else
    return 0
end
```

<br>



## 如何在此基础上实现可重入锁

### 为什么需要可重入锁？

**典型场景：** 你有一个 A() 方法加了锁，它内部调用了 B() 方法，而 B() 方法也加了同一把锁。

- **不可重入锁**：执行到 B() 时，线程会发现锁被占用了（虽然是被自己占用了），然后陷入死锁或不断重试。
- **可重入锁**：B() 发现是同一个 UUID+ThreadID，直接计数器 +1 成功运行。

在复杂的企业级开发中，你无法预见一个加了锁的方法将来会被谁调用，比如：

- **场景**：你写了一个底层的 updateInventory()（更新库存）方法，为了安全，你在里面加了锁。
- **问题**：后来同事写了一个 batchOrderProcess()（批量订单处理）方法，也需要加锁来保证一致性，并且它需要调用你的 updateInventory()。
- **痛点**：如果锁不可重入，同事必须把 updateInventory() 里的锁去掉，或者重写一套不带锁的逻辑。这破坏了代码的封装性。
- **解决**：有了可重入锁，开发者可以放心地在任何层级加锁，无需担心嵌套调用导致的崩溃。

<br>



### 实现的思路

要实现可重入锁（Reentrant Lock），核心逻辑在于：**不再是简单地判断 Key 是否存在，而是记录“谁”持有了锁，以及 “持有了几次”。**在 Redis 中，我们通常使用 **Hash** 数据结构替代 String。

* **Key**: 锁的名字（如 stock_lock:PROD_001）。

* **Field**: 持有者的标识（即 lockValue，即 UUID + 线程 ID）。

* **Value**: 重入次数（Counter）。

<br>



### 具体代码

#### 修改Lua 脚本部分

可重入锁必须保证加锁、解锁的原子性，因此 Lua 脚本需要大幅调整。

**加锁脚本 dist_lock.lua：**

核心的逻辑是，如果锁不存在，设置并设次数为 1；如果锁已存在且是我的，次数 +1。

```lua
-- KEYS[1]: 锁 Key (e.g., stock_lock:001)
-- ARGV[1]: 锁标识 (e.g., UUID:ThreadID)
-- ARGV[2]: 过期时间 (毫秒)
if (redis.call('exists', KEYS[1]) == 0) then
    redis.call('hset', KEYS[1], ARGV[1], 1);
    redis.call('pexpire', KEYS[1], ARGV[2]);
    return 1;
end;
if (redis.call('hexists', KEYS[1], ARGV[1]) == 1) then
    redis.call('hincrby', KEYS[1], ARGV[1], 1);
    redis.call('pexpire', KEYS[1], ARGV[2]);
    return 1;
end;
return 0;
```

<br>

**解锁脚本 dist_unlock.lua：**

核心逻辑是，如果不是我的锁则返回null；如果是我的则次数 -1；如果减到 0就删除锁。

```lua
-- KEYS[1]: 锁 Key
-- ARGV[1]: 锁标识
if (redis.call('hexists', KEYS[1], ARGV[1]) == 0) then
    return nil; -- 锁不是我的，返回 null
end;
local counter = redis.call('hincrby', KEYS[1], ARGV[1], -1);
if (counter > 0) then
    return 0; -- 还在重入中
else
    redis.call('del', KEYS[1]);
    return 1; -- 彻底释放
end;
```

<br>

**锁续命脚本 dist_renew.lua**

需要适配 Hash 结构

```lua
if (redis.call('hexists', KEYS[1], ARGV[1]) == 1) then
    return redis.call('pexpire', KEYS[1], ARGV[2]);
else
    return 0;
end;
```

<br>



#### 修改锁的实现

核心逻辑变动： 加入重入判断，防止看门狗重复启动。

```java
@Slf4j
@Component
public class RedisLockExecutor {

    @Resource
    private StringRedisTemplate masterStringRedisTemplate;

    private static final DefaultRedisScript<Long> LOCK_SCRIPT;
    private static final DefaultRedisScript<Long> UNLOCK_SCRIPT;
    private static final DefaultRedisScript<Long> RENEW_SCRIPT;

    private final ScheduledExecutorService watchdogTimer = new ScheduledThreadPoolExecutor(
            Runtime.getRuntime().availableProcessors(),
            new ThreadFactoryBuilder().setNameFormat("lock-watchdog-%d").setDaemon(true).build(),
            new ThreadPoolExecutor.CallerRunsPolicy()
    );

    private final Map<String, ScheduledFuture<?>> renewalTasks = new ConcurrentHashMap<>();

    static {
        // ... 加载脚本保持不变 ...
        LOCK_SCRIPT = new DefaultRedisScript<>();
        LOCK_SCRIPT.setLocation(new ClassPathResource("lua/dist_lock.lua"));
        LOCK_SCRIPT.setResultType(Long.class);

        UNLOCK_SCRIPT = new DefaultRedisScript<>();
        UNLOCK_SCRIPT.setLocation(new ClassPathResource("lua/dist_unlock.lua"));
        UNLOCK_SCRIPT.setResultType(Long.class);

        RENEW_SCRIPT = new DefaultRedisScript<>();
        RENEW_SCRIPT.setLocation(new ClassPathResource("lua/dist_renew.lua"));
        RENEW_SCRIPT.setResultType(Long.class);
    }

    public boolean tryLock(String lockKey, String lockValue, long expireMillis) {
        Long result = masterStringRedisTemplate.execute(
                LOCK_SCRIPT,
                Collections.singletonList(lockKey),
                lockValue,
                String.valueOf(expireMillis)
        );
        boolean success = Long.valueOf(1).equals(result);
        if (success) {
            // MODIFIED: 只有第一次进入（renewalTasks 不存在时）才启动看门狗
            if (!renewalTasks.containsKey(lockValue)) {
                startWatchdog(lockKey, lockValue, expireMillis);
            }
        }
        return success;
    }

    public boolean unlock(String lockKey, String lockValue) {
        try {
            Long result = masterStringRedisTemplate.execute(
                    UNLOCK_SCRIPT,
                    Collections.singletonList(lockKey),
                    lockValue
            );
            
            // NEW: 逻辑分支处理
            if (result == null) {
                log.warn("试图释放不属于自己的锁, lockKey:{}, lockValue:{}", lockKey, lockValue);
                return false;
            }
            
            if (Long.valueOf(1).equals(result)) {
                // MODIFIED: 只有当 Lua 返回 1（即计数器归零）时，才停止并移除看门狗
                stopWatchdog(lockValue);
                log.info("看门狗移除成功: lockValue:{}", lockValue);
                return true;
            }
            
            log.info("锁重入计数减1，锁尚未完全释放: {}", lockKey);
            return true;
        } finally {
            // 注意：这里不再像以前那样无脑 stopWatchdog 了
        }
    }

    private void startWatchdog(String lockKey, String lockValue, long expireMillis) {
        long period = expireMillis / 3;
        ScheduledFuture<?> task = watchdogTimer.scheduleAtFixedRate(() -> {
            try {
                Long result = masterStringRedisTemplate.execute(
                        RENEW_SCRIPT,
                        Collections.singletonList(lockKey),
                        lockValue,
                        String.valueOf(expireMillis));
                
                if (result != null && result > 0) {
                    log.debug("看门狗续期成功: {}", lockKey);
                } else {
                    // NEW: 增加失败日志，明确知道为什么停
                    log.warn("看门狗续期失败（锁已不存在），停止续期: {}", lockKey);
                    stopWatchdog(lockValue);
                }
            } catch (Throwable t) { // MODIFIED: 捕获 Throwable，更安全
                log.error("看门狗线程执行异常！lockKey:{}", lockKey, t);
            }
        }, period, period, TimeUnit.MILLISECONDS);
        renewalTasks.put(lockValue, task);
    }

    private void stopWatchdog(String lockValue) {
        ScheduledFuture<?> task = renewalTasks.remove(lockValue);
        if (task != null) {
            task.cancel(false);
        }
    }
}
```

<br>



#### 锁切面的改动

RedisLockAspect：增加 ThreadLocal 保证同一个线程在递归/嵌套调用时使用同一个 lockValue，并优化了耗时统计逻辑。

```java
@Slf4j
@Aspect
@Component
public class RedisLockAspect {

    @Resource
    private RedisLockExecutor redisLockExecutor;

    // NEW: 使用 ThreadLocal 存储当前线程持有的 lockValue
    // 这样在 A 方法调用 B 方法时，B 能够获取到 A 生成的相同 UUID，从而触发“可重入”
    private static final ThreadLocal<String> LOCK_VALUE_HOLDER = new ThreadLocal<>();

    @Around("@annotation(redisLock)")
    public Object doAround(ProceedingJoinPoint joinPoint, RedisLock redisLock) throws Throwable {
        String lockKey = redisLock.key(); 
        
        // NEW: 尝试从 ThreadLocal 获取，如果为空则生成新的（代表第一次加锁）
        String lockValue = LOCK_VALUE_HOLDER.get();
        boolean isFirstLevel = false;
        if (lockValue == null) {
            lockValue = UUID.randomUUID().toString() + ":" + Thread.currentThread().getId();
            LOCK_VALUE_HOLDER.set(lockValue);
            isFirstLevel = true;
        }

        long expire = redisLock.expire();
        long timeout = redisLock.timeout();
        
        long waitStartTime = System.currentTimeMillis();
        boolean isLocked = false;

        try {
            // 重试逻辑
            // 此处进行小优化：
            // timeout：获取锁的等待超时时间，防止线程在拿不到锁时死等，导致系统线程池被撑爆。
            // expire：锁的过期/持有时间，防止某个线程拿到锁后崩溃（没来得及解锁），导致这把锁永远无法被别人获取（死锁）。
            while (System.currentTimeMillis() - waitStartTime < timeout) {
                if (redisLockExecutor.tryLock(lockKey, lockValue, expire)) {
                    isLocked = true;
                    break;
                }
                Thread.sleep(50); // 线性重试间隔
            }

            if (!isLocked) {
                throw new RuntimeException("获取锁超时: " + lockKey);
            }

            // NEW: 拿到锁之后记录业务开始时间（避免包含排队时间）
            long businessStartTime = System.currentTimeMillis();
            
            Object result = joinPoint.proceed();

            long businessCost = System.currentTimeMillis() - businessStartTime;
            if (businessCost > expire) {
                log.error("【安全警报】业务执行耗时({})ms，已超过锁过期时间({})ms！", businessCost, expire);
            }

            return result;

        } finally {
            if (isLocked) {
                // MODIFIED: 执行解锁
                redisLockExecutor.unlock(lockKey, lockValue);
            }
            // NEW: 如果是最外层方法结束，清理 ThreadLocal
            if (isFirstLevel) {
                LOCK_VALUE_HOLDER.remove();
            }
        }
    }
}
```

起码其它部分基本保持不变即可。

<br>



#### 测试类和测试单元

ReentrantTestService：

```java
@Service
@Slf4j
public class ReentrantTestService {

    @Resource
    private ReentrantTestService self; // 注入自身以触发 AOP 代理

    @RedisLock(key = "reentrant_lock_test", timeout = 5000)
    public void methodA() {
        log.info(">>> 进入 methodA，已持有锁");
        // 调用嵌套加锁的方法
        self.methodB();
        log.info("<<< 退出 methodA");
    }

    @RedisLock(key = "reentrant_lock_test", timeout = 5000)
    public void methodB() {
        log.info(">>>>>> 进入 methodB，成功重入锁！");
        // 模拟业务耗时
        try { Thread.sleep(500); } catch (InterruptedException e) {}
        log.info("<<<<<< 退出 methodB");
    }
}
```

<br>

RedisLockReentrantTest：

```java
@SpringBootTest
@Slf4j
class RedisLockReentrantTest {

    @Resource
    private ReentrantTestService reentrantTestService;

    @Resource
    private StringRedisTemplate stringRedisTemplate;

    @Test
    @DisplayName("测试分布式锁的可重入性")
    void testReentrant() {
        String lockKey = "reentrant_lock_test";
        
        // 1. 执行重入调用
        assertDoesNotThrow(() -> {
            reentrantTestService.methodA();
        }, "重入锁不应抛出任何异常");

        // 2. 验证 Redis 状态
        Boolean hasKey = stringRedisTemplate.hasKey(lockKey);
        assertFalse(hasKey, "测试结束后，Redis 锁 Key 应该已被彻底删除");
        
        log.info("JUnit 测试通过：可重入逻辑验证成功，且锁已正确释放。");
    }
}
```

<br>

