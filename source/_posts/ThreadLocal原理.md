title: ThreadLocal原理
author: kinglyjn
tags:
  - thread
categories:
  - java
  - thread
date: 2018-09-14 15:27:00
---

### ThreadLocal是什么

早在JDK 1.2的版本中就提供Java.lang.ThreadLocal，ThreadLocal为解决多线程程序的并发问题提供了一种新的思路。使用这个工具类可以很简洁地编写出优美的多线程程序。

<!--more-->

当使用ThreadLocal维护变量时，ThreadLocal为每个使用该变量的线程提供独立的变量副本，所以每一个线程都可以独立地改变自己的副本，而不会影响其它线程所对应的副本。

从线程的角度看，目标变量就象是线程的本地变量，这也是类名中“Local”所要表达的意思。所以，在Java中编写线程局部变量的代码相对来说要笨拙一些，因此造成线程局部变量没有在Java开发者中得到很好的普及。

### ThreadLocal的方法

ThreadLocal类很简单，只有4个方法，我们先来了解一下：

* void set(Object value) 设置当前线程的线程局部变量的值。
* public Object get() 该方法返回当前线程所对应的线程局部变量。
* public void remove() 将当前线程局部变量的值删除，目的是为了减少内存的占用，该方法是JDK 5.0新增的方法。需要指出的是，当线程结束后，对应该线程的局部变量将自动被垃圾回收，所以显式调用该方法清除线程的局部变量并不是必须的操作，但它可以加快内存回收的速度。
* protected Object initialValue() 返回该线程局部变量的初始值，该方法是一个protected的方法，显然是为了让子类覆盖而设计的。这个方法是一个延迟调用方法，在线程第1次调用get()或set(Object)时才执行，并且仅执行1次。ThreadLocal中的缺省实现直接返回一个null。

值得一提的是，在JDK5.0中，ThreadLocal已经支持泛型，该类的类名已经变为ThreadLocal<T>。API方法也相应进行了调整，新版本的API方法分别是void set(T value)、T get()以及T initialValue()。

### ThreadLocal的使用

ThreadLocal是如何做到为每一个线程维护变量的副本的呢？其实实现的思路很简单：在ThreadLocal类中有一个Map，用于存储每一个线程的变量副本，Map中元素的键为线程对象，而值对应线程的变量副本。我们自己就可以提供一个简单的实现版本：

```java
public class TestNum {
	// ①通过匿名内部类覆盖ThreadLocal的initialValue()方法，指定初
	public static ThreadLocal<Integer> seqNum = new ThreadLocal<Integer>() {
		@Override
		protected Integer initialValue() {
			return 0;
		}
	}
	// ②获取下一个序列值
	public int getNextInt() {
		seqNum.set(seqNum.get() + 1);
		return seqNum.get();
	}
	// ③3个线程共享sn，各自产生序列号测试  
	public static void main(String[] args) {
		TestNum sn = new TestNum();
		TestClient t1 = new TestClient(sn);
		TestClient t2 = new TestClient(sn);
		TestClient t3 = new TestClient(sn);
		t1.start();
		t2.start();
		t3.start();
	}
}

class TestClient extends Thread {
	private TestNum sn;
	
	public TestClient(TestNum sn) {
		this.sn = sn;
	}
	@Override
	public void run() {
		for (int i=0; i<3; i++) {
			// ④每个线程打出3个序列值
			System.out.println(Thread.currentThread().getName() + "----> sn:" + sn.getNextInt());
		}
	}
}

//运行结果
Thread-0----> sn:1
Thread-2----> sn:1
Thread-1----> sn:1
Thread-2----> sn:2
Thread-0----> sn:2
Thread-2----> sn:3
Thread-1----> sn:2
Thread-0----> sn:3
Thread-1----> sn:3
```

我们发现每个线程所产生的序号虽然都共享同一个TestNum实例，但它们并没有发生相互干扰的情况，而是各自产生独立的序列号，这是因为我们通过ThreadLocal为每一个线程提供了单独的副本。

### ThreadLocal和线程同步机制的比较

ThreadLocal和线程同步机制都是为了解决多线程中相同变量的访问冲突问题。

在线程同步机制中，通过对象的锁机制保证同一时间只有一个线程访问变量。这时该变量是多个线程共享的，使用同步机制要求程序慎密地分析什么时候对变量进行读写，什么时候需要锁定某个对象，什么时候释放对象锁等繁杂的问题，程序设计和编写难度相对较大。而ThreadLocal则从另一个角度来解决多线程的并发访问。ThreadLocal会为每一个线程提供一个独立的变量副本，从而隔离了多个线程对数据的访问冲突。因为每一个线程都拥有自己的变量副本，从而也就没有必要对该变量进行同步了。ThreadLocal提供了线程安全的共享对象，在编写多线程代码时，可以把不安全的变量封装进ThreadLocal。

概括起来说，对于多线程资源共享的问题，同步机制采用了“以时间换空间”的方式，而ThreadLocal采用了“以空间换时间”的方式。前者仅提供一份变量，让不同的线程排队访问，而后者为每一个线程都提供了一份变量，因此可以同时访问而互不影响。

Spring使用ThreadLocal解决线程安全问题。我们知道在一般情况下，只有无状态的Bean才可以在多线程环境下共享，在Spring中，绝大部分Bean都可以声明为singleton作用域。就是因为Spring对一些Bean（如RequestContextHolder、TransactionSynchronizationManager、LocaleContextHolder等）中非线程安全状态采用ThreadLocal进行处理，让它们也成为线程安全的状态，所以有状态的Bean就可以在多线程中共享了。

一般的Web应用划分为展现层、服务层和持久层三个层次，在不同的层中编写对应的逻辑，下层通过接口向上层开放功能调用。在一般情况下，从接收请求到返回响应所经过的所有程序调用都同属于一个线程，如图一所示：

![图一](/images/pasted-2.png)

同一线程贯通三层这样你就可以根据需要，将一些非线程安全的变量以ThreadLocal存放，在同一次请求响应的调用线程中，所有关联的对象引用到的都是同一个变量。

下面的实例能够体现Spring对有状态Bean的改造思路：

非线程安全conn：

```java
import java.sql.Connection;  
import java.sql.SQLException;  
import java.sql.Statement;  
  
public class TestDao {  
    private Connection conn;// ①一个非线程安全的变量  
  
    public void addTopic() throws SQLException {  
        Statement stat = conn.createStatement();// ②引用非线程安全变量  
        // …  
    }  
} 
```

线程安全conn：

```java
import java.sql.Connection;  
import java.sql.SQLException;  
import java.sql.Statement;  
  
public class TestDaoNew {  
    // ①使用ThreadLocal保存Connection变量  
    private static ThreadLocal<Connection> connThreadLocal = new ThreadLocal<Connection>();  
  
    public static Connection getConnection() {  
        // ②如果connThreadLocal没有本线程对应的Connection创建一个新的Connection，  
        // 并将其保存到线程本地变量中。  
        if (connThreadLocal.get() == null) {  
            Connection conn = Conn.getNewConnection();  
            connThreadLocal.set(conn);  
            return conn;  
        } else {  
            return connThreadLocal.get();// ③直接返回线程本地变量  
        }  
    }  
    public void addTopic() throws SQLException {  
        // ④从ThreadLocal中获取线程对应的Connection  
        Statement stat = getConnection().createStatement();  
    }  
}  
```

不同的线程在使用TopicDao时，先判断connThreadLocal.get()是否是null，如果是null，则说明当前线程还没有对应的Connection对象，这时创建一个Connection对象并添加到本地线程变量中；如果不为null，则说明当前的线程已经拥有了Connection对象，直接使用就可以了。这样，就保证了不同的线程使用线程相关的Connection，而不会使用其它线程的Connection。因此，这个TopicDao就可以做到singleton共享了。

当然，这个例子本身很粗糙，将Connection的ThreadLocal直接放在DAO只能做到本DAO的多个方法共享Connection时不发生线程安全问题，但无法和其它DAO共用同一个Connection，要做到同一事务多DAO共享同一Connection，必须在一个共同的外部类使用ThreadLocal保存Connection。

```java
import java.sql.Connection;  
import java.sql.DriverManager;  
import java.sql.SQLException;  
  
public class ConnectionManager {  

    //初始化
    private static ThreadLocal<Connection> connectionHolder = 
    new ThreadLocal<Connection>() {  
        @Override  
        protected Connection initialValue() {  
            Connection conn = null;  
            try {  
                JdbcConfig jdbcConfig=XmlConfigReader.GetInstance().getJdbcConfig();  
                Class.forName(jdbcConfig.getDriverName());  
                conn=DriverManager.jdbcConfig.getUserName(),jdbcConfig.getPassword());    
            } catch (SQLException e) {  
                e.printStackTrace();  
            }  
            return conn;  
        }  
    };  
  
    //获取连接
    public static Connection getConnection() {  
        return connectionHolder.get();  
    }  
    //将连接放入局部线程变量
    public static void setConnection(Connection conn) { 
        connectionHolder.set(conn);  
    }
    //关闭连接   
    public static void closeConnection() {  
        Connection conn = connectionHolder.get();  
        if (conn != null) {  
            try {  
                conn.close();  
                //从ThreadLocal中清除Connection   
                connectionHolder.remove();  
            } catch (SQLException e) {  
                e.printStackTrace();  
            }     
        }  
    }   
    //关闭Statement（用于执行静态 SQL 语句并返回它所生成结果的对象。）   
    public static void close(Statement pstmt) {  
        if (pstmt != null) {  
            try {  
                pstmt.close();  
            } catch (SQLException e) {  
                e.printStackTrace();  
            }  
        }  
    }
    //关闭结果集   
    public static void close(ResultSet rs ) {  
        if (rs != null) {  
            try {  
                rs.close();  
            } catch (SQLException e) {  
                e.printStackTrace();  
            }  
        }  
    } 
    //开启事务   
    public static void beginTransaction(Connection conn) {  
        try {  
            if (conn != null) {  
                if (conn.getAutoCommit()) {  
                    conn.setAutoCommit(false); //手动提交   
                }  
            }  
        }catch(SQLException e) {}  
    } 
    //提交事务   
    public static void commitTransaction(Connection conn) {  
        try {  
            if (conn != null) {  
                if (!conn.getAutoCommit()) {  
                    conn.commit();  
                }  
            }  
        }catch(SQLException e) {}  
    } 
    //回滚事务   
    public static void rollbackTransaction(Connection conn) {  
        try {  
            if (conn != null) {  
                if (!conn.getAutoCommit()) {  
                    conn.rollback();  
                }  
            }  
        }catch(SQLException e) {}  
    }       
}
```

### ThreadLocal的实现原理

那么到底ThreadLocal类是如何实现这种“为每个线程提供不同的变量拷贝”的呢？先来看一下ThreadLocal的set()方法的源码是如何实现的：

```java
 /** 
  * Sets the current thread's copy of this thread-local variable 
  * to the specified value.  Most subclasses will have no need to 
  * override this method, relying solely on the {@link #initialValue} 
  * method to set the values of thread-locals. 
  * @param value the value to be stored in the current thread's copy of this thread-local. 
  */  
 public void set(T value) {  
     Thread t = Thread.currentThread();  
     ThreadLocalMap map = getMap(t);  
     if (map != null)  
         map.set(this, value);  
     else  
         createMap(t, value);  
 } 
```
在这个方法内部我们看到，首先通过getMap(Thread t)方法获取一个和当前线程相关的ThreadLocalMap，然后将变量的值设置到这个ThreadLocalMap对象中，当然如果获取到的ThreadLocalMap对象为空，就通过createMap方法创建。

线程隔离的秘密，就在于ThreadLocalMap这个类。ThreadLocalMap是ThreadLocal类的一个静态内部类，它实现了键值对的设置和获取（对比Map对象来理解），每个线程中都有一个独立的ThreadLocalMap副本，它所存储的值，只能被当前线程读取和修改。ThreadLocal类通过操作每一个线程特有的ThreadLocalMap副本，从而实现了变量访问在不同线程中的隔离。因为每个线程的变量都是自己特有的，完全不会有并发错误。还有一点就是，ThreadLocalMap存储的键值对中的键是this对象指向的ThreadLocal对象，而值就是你所设置的对象了。

为了加深理解，我们接着看上面代码中出现的getMap和createMap方法的实现：

```java
/** 
 * Get the map associated with a ThreadLocal. Overridden in 
 * InheritableThreadLocal. 
 * @param  t the current thread 
 * @return the map 
 */  
ThreadLocalMap getMap(Thread t) {  
    return t.threadLocals;  
}  
  
/** 
 * Create the map associated with a ThreadLocal. Overridden in 
 * InheritableThreadLocal. 
 * @param t the current thread 
 * @param firstValue value for the initial entry of the map 
 * @param map the map to store. 
 */  
void createMap(Thread t, T firstValue) {  
    t.threadLocals = new ThreadLocalMap(this, firstValue);  
}  
```

接下来再看一下ThreadLocal类中的get()方法:

```java
/** 
 * Returns the value in the current thread's copy of this 
 * thread-local variable.  If the variable has no value for the 
 * current thread, it is first initialized to the value returned 
 * by an invocation of the {@link #initialValue} method. 
 * @return the current thread's value of this thread-local 
 */  
public T get() {  
    Thread t = Thread.currentThread();  
    ThreadLocalMap map = getMap(t);  
    if (map != null) {  
        ThreadLocalMap.Entry e = map.getEntry(this);  
        if (e != null)  
            return (T)e.value;  
    }  
    return setInitialValue();  
}  
```

再来看setInitialValue()方法:<br>

```java
/** 
  * Variant of set() to establish initialValue. Used instead 
  * of set() in case user has overridden the set() method. 
  * @return the initial value 
  */  
 private T setInitialValue() {  
     T value = initialValue();  
     Thread t = Thread.currentThread();  
     ThreadLocalMap map = getMap(t);  
     if (map != null)  
         map.set(this, value);  
     else  
         createMap(t, value);  
     return value;  
 }
```

获取和当前线程绑定的值时，ThreadLocalMap对象是以this指向的ThreadLocal对象为键进行查找的，这当然和前面set()方法的代码是相呼应的。

进一步地，我们可以创建不同的ThreadLocal实例来实现多个变量在不同线程间的访问隔离，为什么可以这么做？因为不同的ThreadLocal对象作为不同键，当然也可以在线程的ThreadLocalMap对象中设置不同的值了。通过ThreadLocal对象，在多线程中共享一个值和多个值的区别，就像你在一个HashMap对象中存储一个键值对和多个键值对一样，仅此而已。

