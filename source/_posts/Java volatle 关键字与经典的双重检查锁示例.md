title: Java volatle 关键字与经典的双重检查锁示例

author: kinglyjn

tags:

  - java
  - lock


categories:

  - java

  - core

date: 2018-10-10 11:22:00

---



### 这 volatile 是个啥？



简单来说，volatile 是 Java 中的一个轻量级数据同步机制，它只能修饰成员变量（静态变量或实例变量），不能修饰方法，也不能修饰方法内部的局部变量。这东西有两大核心神技：



<!--more-->



* 第一是可见性（Visibility）： 保证一个线程修改了变量后，其他线程能立即“ 看到” 最新的值。
* 第二是禁止指令重排序（Ordering）：编译器和处理器为了性能，有时会乱写代码的执行顺序。volatile 就像一个交警，告诉它们：“这一行代码前后的顺序不准乱动！”（这在单例模式的 DPL 实现中非常重要）。

<br>

> **注意：** volatile 不能保证 **原子性**。比如 i++ 操作，它实际上分三步：读、加、写。volatile 没法保证这三步在执行过程中不被别人打断。如果需要原子性，还是得用 synchronized 或 AtomicInteger。

<br>



### 经典的双重检查锁案例

理解 volatile 的一个经典的案例是双重检查锁（Double-Check Locking, DCL）。如果没有 volatile，看似完美的 DCL 实际上会在高并发下 “翻车”。以下是最标准、最安全的 DCL 单例写法：

```java
public class Singleton {
    
    // 必须加 volatile，防止指令重排序
    private static volatile Singleton instance;

    private Singleton() {
        // 私有构造方法，防止外部实例化
    }

    public static Singleton getInstance() {
        // 第一次检查：如果已经实例化，直接返回，避免不必要的锁竞争
        if (instance == null) {
            synchronized (Singleton.class) {
                // 第二次检查：获取锁后再次确认，防止多个线程同时通过了第一次检查
                if (instance == null) {
                    instance = new Singleton();
                }
            }
        }
        return instance;
    }
}
```

<br>



**为什么需要“双重检查”？**

* **第一层检查：** 为了性能。如果 instance 已经创建好了，直接返回即可，不需要进入 synchronized 块。因为加锁也是一个较重的操作。
* **第二层检查：** 为了安。假设 A、B 两个线程同时通过了第一层检查。A 先拿到锁，创建了对象；如果没有第二层检查，A 释放锁后，B 拿到锁再次创建一个新对象，单例就失效了。

<br>



**核心问题：为什么必须加 `volatile`？**

核心原因在于 `instance = new Singleton();` 这一行代码，在 CPU/编译器层面其实分为 3 步指令：

1. 分配内存空间（给对象找块地）。
2. 初始化对象（执行构造方法，装修房子）。
3. 将 instance 指向内存地址（把门牌号挂上去，此时 instance != null）。

**致命隐患在于：指令重排序** 。为了优化性能，编译器可能把顺序优化为 **1 -> 3 -> 2**。

* 线程 A 执行到了第 3 步（挂了门牌号），但第 2 步（装修）还没做。
* 此时线程 B 正好执行到“第一层检查”，它发现 instance != null，于是开心地拿着这个还没装修完的空房子（半成品对象）去用了。
* 结果就是线程 B 在访问对象成员时，可能会报空指针异常或得到错误数据。

volatile 的作用就在于加上它之后，它会建立一个 “内存屏障”，强制禁止指令重排序，保证执行顺序必须是 **1 -> 2 -> 3**。这样，当 instance != null 时，对象一定已经初始化完成了。

<br>





