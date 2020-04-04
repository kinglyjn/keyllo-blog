title: 初识java多线程
author: kinglyjn
tags:
  - thread
categories:
  - java
  - thread
date: 2018-09-14 14:38:00
---

### 多线程与多线程概念

首先，我们来介绍一下并发的基本概念和原理。对于现代操作系统来说，大部分操作系统都是多任务操作系统。什么是“多任务”呢？指的是每个系统在同时能够运行多个进程。例如，在windows中，可能开着一个Word窗口写文档，开着一个eclipse写代码，开着一个QQ聊天，开着一个IE浏览网页，开着一个Winamp听歌……这就意味着，在一个操作系统中，同时有多个程序在内存中运行着。每一个运行着的程序，就是操作系统中运行着的一个任务，也就是我们所说的“进程”。例如，在windows中，可以通过“任务管理器”来查看系统中有多少进程正在运行。

<!--more-->

一个操作系统中可以同时运行多个进程，这就是进程的并发。

CPU执行多任务的原理：(操作系统多进程的概念)											
利用很短的CPU时间片运行程序，在多个程序之间进行CPU时间片的进行快速切换。可以把这种运行方式总结成为一句话：宏观上并行，微观上串行。这是说，从宏观上来看，一个系统同时运行多个程序，这些程序是并行执行的；而从微观上说，每个时刻都只有一个程序在运行，这些程序是串行执行的。

由于Java代码是运行在JVM中的，对于某个操作系统来说，一个JVM就相当于一个进程。而Java代码不能够越过JVM直接与操作系统打交道，因此，Java语言中没有多进程的概念。也就是说，我们无法通过Java代码写出一个多进程的程序来。

Java中的并发，采用的是线程的概念。简单的来说，一个操作系统可以同时运行多个程序，也就是说，一个系统并发多个进程；而对于每个进程来说，可以同时运行多个线程，也就是：一个进程并发多个线程。<br>

从上面的描述上我们可以看出，线程就是在一个进程中并发运行的一个程序流程。当若干的CPU时间片分配给JVM进程的时候，系统还可以把时间片进一步细分，分给JVM中的每一个线程来执行，从而达到“宏观上并行，微观上串行”的线程执行效果。

### 线程运行的条件

目前为止，我们见到的Java程序只有一个线程，也就是说，只有一个程序执行流程。这个流程从main方法的第一行开始执行，以main方法的退出作为结束。这个线程我们称之为“主线程”。

一个线程运行需要的条件

* `CPU`
* `代码`
* `数据`

首先，必须要给线程赋予代码。通俗的来说，就是必须要为线程写代码。这些代码是说明，启动线程之后，这个线程完成了什么功能，我们需要这个线程来干什么。
其次，为了能够运行，线程需要获得CPU。只有获得了CPU之后，线程才能真正启动并且执行线程的代码。CPU的调度工作是由操作系统来完成的。
第三，运行线程时，线程必须要获得数据。也就是说，在进行运算的时候，线程需要从内存空间中获得数据。关于线程的数据，有一个结论，叫做“堆空间共享，栈空间独立”。所谓的“堆空间”，保存的是我们利用new关键字创建出来的对象；而所谓的栈空间，保存的是程序运行时的局部变量。“堆空间共享，栈空间独立”的意思是：多线程之间共享同一个堆空间，而每个线程又拥有各自独立的栈空间。因此，运行程序时，多个不同线程能够访问相同的对象，但是多个不同线程彼此之间的局部变量是独立的，不可能出现多个线程访问同一个局部变量的情况。

CPU、代码、数据，是线程运行时所需要的三大条件。在这三大条件中，CPU是操作系统分配的，Java程序员无法控制；数据这部分，需要把握住“堆空间共享，栈空间独立”的概念（关于这个概念，我们在后面还会继续提到）；而下面将为大家介绍，如何为线程赋予代码。

### 创建线程最简单的两种方式

为线程赋予代码最简单的两种方法：`继承Thread类`，`实现Runnable接口`。

1) 用java.lang.Thread类为线程赋予代码：

```java
class MyThread1 extends Thread{
	public void run(){
		for(int i = 1; i<=1000; i++){
			System.out.println(i + " $$$");
		}
	}		
}

class MyThread2 extends Thread{
	public void run(){
		for(int i = 1; i<=1000; i++){
			System.out.println(i + " ###");			
		}
	}
}
```

上面的代码中，我们定义了两个线程类，并为这两个线程类赋予了代码。有了这两个线程类之后，我们就可以利用这两个类来创建和处理线程了。那应该如何利用自定义的线程类来创建新线程呢？
首先，应当利用自定义的线程类创建线程对象，之后，调用线程的start()，就能够启动新线程。注意，在我们自定义的线程类中，并没有自己添加start
方法，这个方法是从Thread类中继承来的。相关代码如下：

```java
public class TestThread{
	public static void main(String args[]){
		Thread t1 = new MyThread1();
		Thread t2 = new MyThread2();
		t1.start();
		t2.start();
	}
}

//运行结果：
0$$$
0###
1$$$
1###
2###
2$$$
3$$$
4$$$
3###
5$$$
...
```

2) 用java.lang包下的Runnable接口为线程赋予代码

Runnable接口在java.lang包中定义，在这个接口中，只包含一个方法：run()方法。该方法签名为：`void run()`。
由于这个方法定义在接口中，因此默认就是public的。在实现Runnable接口的时候，只需要实现这个run方法就可以了。
下面我们修改刚刚的MyThread2这个类，把这个类改名为MyRunnable2，并且由继承Thread类改为实现Runnable接口。相应代码如下：

```java
class MyRunnable2 implementsRunnable{
	public void run(){
		for(int i = 1; i<=10; i++){
			System.out.println(i + " ###");
		}
	}
}
```

在上面的代码中，对run()方法的实现没有任何修改，而只是改动了第一行：把继承Thread类改成了实现Runnable接口。<br>
修改完了线程的实现之后，还必须要修改一下创建线程的代码。由于MyRunnable2类不是Thread类的子类，因此创建的MyRunnable2类型的对象不能直接赋值给Thread类型的引用。换句话说，我们利用MyRunnable2创建出来的不是一个线程对象，而是一个所谓的“目标”对象。代码如下：

```java
Runnable target = new MyRunnable2();
```
创建了目标对象之后，可以利用目标对象再来创建线程对象，代码如下：
```java
Thread t2 = new Thread(target);	
```

通过上面的两行代码，我们就可以利用Runnable接口的实现类来创建线程对象。创建完线程对象之后，需要启动线程时，同样要调用线程对象的
start()方法。


### 线程的状态

```
主线程[main]
子线程[Thread-n]
                                           阻塞状态
                                           锁池状态
                                           /|  |
                                            |  |
                                            |  |
                                       sleep|  |睡了n毫秒
                                       join |  |join了n毫秒 或 join线程执行完毕
                                       I/O  |  |IO完毕
                                            |  |
 synchronized 或 obj.notify唤醒某个对象的互斥锁 |  | 同步线程执行完毕 或 obj.wait暂时释放obj对象的互斥锁
                                            |  |
                                            |  |
                                            |  |/
             初始状态----(start())-------->可运行状态-------->运行状态-----(run()退出)--->终止状态
```

### 线程的阻塞状态

线程有一个很重要的状态：阻塞状态。

什么是阻塞状态呢？我们知道，如果一个线程要进入运行状态，则必须要获得CPU时间片。但是，在某些情况下，线程运行不仅需要CPU进行运算，还需要一些别的条件，例如等待用户输入、等待网络传输完成，等等。如果线程正在等待其他的条件完成，在这种情况下，即使线程获得了CPU时间片，也无法真正运行。因此，在这种情况下，为了能够不让这些线程白白占用CPU的时间，会让这些线程会进入阻塞状态。最典型的例子就是等待I/O，也就是说，如果线程需要与JVM外部进行数据交互的话（例如等待用户输入、读写文件、网络传输等），这个时候，当数据传输没有完成时，线程即使获得CPU也无法运行，因此就会进入阻塞状态。

可以这么来理解：我们可以把CPU当做是银行的柜员，而去银行的准备办理业务的顾客就好比是线程。顾客希望能够让银行的柜员为自己办事，就好像线程希望获得CPU来运行线程代码一样。但有时会出现这种情况：比如有个顾客想去银行汇款，排队等到了银行的职员为自己服务，却事先没有填好汇款单。这个时候，这个银行职员即使想为你服务，也无法做到；这就相当于线程没有完成I/O，此时线程即使获得CPU也无法运行。一般这个时候，银行的工作人员也不会傻等，而是会非常礼貌的给顾客一张单子，让他去旁边找个地方填写汇款单，而职员自己则开始接待下一位顾客；这也就相当于让一个线程进入阻塞状态。

当所等待的条件完成之后，处于阻塞状态的线程就会进入可运行状态，等待着操作系统为自己分配时间片。还是用我们银行职员的比喻：当顾客填写汇款单的时候，就好比是线程进入了阻塞状态；而当顾客把汇款单填完了之后，这就好比是线程的I/O完成，所等待的条件已经满足了。这样，这个顾客就做好了办理业务所需要的准备，就等着能够有一个银行职员来为自己服务了。

那为什么从阻塞状态出来之后，线程不能马上进入运行状态呢？因为当线程所等待的条件完成的时候，可能有一个线程正处于运行状态。由于处于运行状态的线程只能有一个，因此当线程从阻塞状态出来之后，只能在可运行状态中暂时等待。这就好比，当顾客填完汇款单之后，银行的职员可能正在为其他顾客服务。这个时候，你不能把其他用户赶走，强行让银行职员为你服务，而只能重新在后面排队，等着有银行职员为你服务。

等待I/O会进入阻塞状态，还可以调用Thread类的sleep方法进入阻塞状态。顾名思义，sleep方法就是让线程进入“睡眠”状态。你可以想象，如果一个顾客在银行办理业务的时候睡着了，那样的话，银行职员会让这个顾客在一旁先待着，等什么时候顾客睡醒了，再什么时候为这个顾客服务。

`sleep()`方法的签名： 
``` java
public static void sleep(long millis) throws InterruptedException
```

这个方法是一个static方法，也就意味着可以通过类名来直接调用这个方法。sleep方法的参数是一个long类型，表示要让这个线程“睡”多少个毫秒（注意，1秒=1000毫秒）。另外，这个方法抛出一个InterruptedException异常，这个异常是一个已检查异常，根据异常处理的规则，这个异常必须要处理。

除了使用sleep()和等待IO之外，还有一个方法会导致线程阻塞，这就是线程的`join()`方法，方法签名为：
``` java
// 等待线程终止
public final void join() throws InterruptedException 
// 等待线程终止的时间最长为millis毫秒
public final void join(long millis) throws InterruptedException
// 等待线程终止的时间最长为millis毫秒+nanos纳秒
public final void join(long millis, int nanos) throws InterruptedException
```

简单测试：

```java
//TestJoin()
class MyRunnable1 implements Runnable {
	public void run() {
		for (int i = 0; i < 10; i++) {
			System.out.println(i + "$$$$$$");
		}
	}
}

class MyThread2 extends Thread {
	Thread t;
	public void run() {
		for (int i = 0; i < 10; i++) {
			try {
				t.join();
			}
			catch (Exception e) {}
			System.out.println(i + "######");
		}
	}
}

class Test {
	public static void main(String[] args) {
		Runnable target1 = new MyRunnable1();
		Thread t1 = new Thread(target1);
		MyThread2 t2 = new MyThread2();
		t2.t = t1;
		
		t1.start();
		t2.start();
	}
}

//运行结果：
0$$$$$$
1$$$$$$
2$$$$$$
3$$$$$$
4$$$$$$
5$$$$$$
6$$$$$$
7$$$$$$
8$$$$$$
9$$$$$$
0######
1######
2######
3######
4######
5######
6######
7######
8######
9######
```

上面这个程序中，MyThread2对象增加了一个属性t。在主方法中，把t1对象赋值给t，也就是让t属性和t1引用指向同一个对象。
在MyThread2类的run()方法中，调用了t属性的join()方法。这个方法能够让MyThread2线程由运行状态进入阻塞状态，直到t线程结束。
下面结合程序的状态转换图，来说明一下执行的过程。

首先main方法中，创建了两个线程对象，并且调用了t1和t2线程的start()方法，这样，这两个线程就进入了可运行状态。假设操作系统首先挑选了t1线程进入了可运行状态，于是输出若干个“$$$”。经过一段时间之后，由于CPU时间片到期，t1线程进入了可运行状态。假设经过了一段时间之后，操作系统选择了t2线程进入了可运行状态。进入了t2线程的run()方法之后，调用了t属性的join()方法。由于t属性与t1指向同一个对象，因此这也就意味着在t2线程中，调用了t1线程的join()方法。调用之后，t2线程会进入阻塞状态。此时，运行状态没有线程在执行，因此系统会从可运行状态中选择一个线程执行。由于可运行状态此时只有一个t1线程，因此这个线程会一直占用CPU，直到线程代码执行结束。当t1线程结束之后，t2才会由阻塞状态进入可运行状态，此时才能够执行t2的代码。因此，从输出结果上来看，会先执行t1线程的所有代码，然后再执行t2线程的所有代码。

要注意的是，我们在t2线程中调用t1线程的join()方法，结果是t2阻塞，直到t1线程结束。t2线程是join()方法的调用者，而t1线程是被调用者，在调用join()方法的过程中，方法的调用者被阻塞，阻塞到被调用的线程结束。

我们可以用一个生活中的比喻来解释join()方法。假设顾客到饭店里去吃饭，那么每一个顾客就可以认为是一个线程。顾客点菜，就可以当做是顾客线程要求启动一个厨师线程为自己做饭，在做饭过程中，顾客线程只能等待。因此，这也可以当做是顾客线程调用了厨师线程的join()方法，等厨师做完饭了，顾客才能继续下一步：吃饭。在这个例子中，顾客线程就调用了厨师线程的join()方法。

在调用join方法的过程中，要注意，不能让两个线程相互join()。例如，如果一个顾客点菜，相当于调用了厨师的join()方法，顾客打算等厨师做完饭以后，吃完饭再给钱；而厨师呢，在拿到顾客下的单之后，希望顾客先给钱，之后再开始做饭，于是厨师也调用了顾客的join()方法。这样的结果就是两边互相等待，结果谁都无法继续下去!!!

那怎么解决这个问题呢？首先，写程序的时候应当小心，尽量不应该出现这样的代码。因为这样的代码在编译和运行时都不会出现任何错误和异常。另一方面，Java也为join()方法提供了一个替换的方案。

在Thread类中，除了有一个无参的join()方法之外，还有一个有参的join()方法，方法签名如下：

``` java
public final void join(long millis)throws InterruptedException
```

这个方法接受一个long类型作为参数，表示join()最多等待多少毫秒。也就是说，调用这个join()方法的时候，不会一直处于阻塞状态，而是有一个时间限制。就好像顾客等待厨师做饭时，不会无限制的等下去，如果菜一段时间内还不上，则顾客就会离开，而不会一直傻等下去。

利用这个方法，修改上面的MyThread1类：

```java
class MyThread1 extends Thread{
	Thread t;
	public void run(){
		try{
        	// 这样，MyThread1就不会无限制的等待下去
            // 而是当等待1000毫秒之后，就会从阻塞状态
            // 转为可运行状态，从而执行下去。
			t.join(1000);
		}catch(Exception e){}
		for(int i = 0; i<100; i++){
			System.out.println(i + " $$$");
		}
	}
}
```

### 临界资源和线程的锁池状态

多个线程并发访问同一个对象，如果破坏了不可分割的操作，则有可能产生数据不一致的情况。这其中，有两个专有名词：被多个线程并发访问的对象，也被称之为“`临界资源`”；而不可分割的操作，也被称之为“`原子操作`”。产生的数据不一致的问题，也被称之为`同步问题`。要产生同步问题，多线程访问“临界资源”，破坏了“原子操作”，这两个条件缺一不可。

```java
//临界资源与数据不一致代码示例：
class MyStack{
	char[] data = {'A', 'B', ' '};
	int index = 2;
	public void push(char ch){
		data[index] = ch; //这句代码和index ++ 代码是一个”原子操作“，破坏了”临界数据“原子操作会导致数据不一致
		try{
			Thread.sleep(1000);
		}catch(Exception e){}
		index ++;
	}
	public void pop(){
		index --;
		data[index] = ' ';
	}
	public void print(){
		for(int i = 0; i<data.length; i++){
			System.out.print(data[i] + "\t");
		}
		System.out.println();
	}
}
class PopThread extends Thread{
	MyStack ms;
	public PopThread(MyStack ms){
		this.ms = ms;
	}
	public void run(){
		ms.pop();
		ms.print();
	}
}
class PushThread extends Thread{
	MyStack ms;
	public PushThread(MyStack ms){
		this.ms = ms;
	}
	public void run(){
		ms.push('C');
		ms.print();
	}
}
public class TestMyStack{
	public static void main(String args[]){
		MyStack ms = new MyStack();
		Thread t1 = new PushThread(ms);
		Thread t2 = new PopThread(ms);
		t1.start();
		t2.start();
	}
}
```

那同步问题应该怎么处理和解决呢？

首先，由于在push()方法中存在sleep()方法才造成了原子操作被破坏，那如果把sleep()方法去掉，是不是就能解决同步的问题了呢？

要注意的是，把sleep()方法去掉之后，这样的代码可能运行时一时不会出问题，但是并不代表这代码是没有安全问题的。例如，当push线程进行了push的第一步操作之后，CPU时间片到期了，然后接下来换成pop线程运行，此时，上一节我们描述的同步问题，同样有可能发生。

虽然上面所说的情况可能发生的概率非常的低，但是却不能不说是代码中的一个隐患。并且，当我们的程序成为一个大型企业应用系统的一部分时，由于每天都有大量的客户访问我们的程序，也就有大量的线程在同时访问同一个对象，此时，无论发生同步问题的概率有多小，在大量访问和重复的过程中，发生问题几乎是必然的。而同步问题一旦发生，就有可能造成极为严重的损失。因此，我们在写代码，尤其是有可能被多线程访问的类和对象时，一定要慎重设计，把所有的隐患都杜绝。

那应该怎么杜绝这个隐患呢？我们首先从生活中的一个例子说起：

有两位电工，长期驻扎在一个小区作为物业，一个电工A，上早班，上班时间是6：00 ~ 18：00，另一位电工B，上班时间为18：00 ~ 6：00。这两位电工轮流在小区值班。	某一天，在下午17：55的时候，电工A接到小区居民投诉：小区中的电压不稳，希望电工能够修复一下。虽然马上要到下班时间了，但是电工A还是决定去查看一下。为了爬上电线杆进行高空带电作业，于是电工A暂时把小区的电闸给关了，然后再到高空进行电压不稳的检查。	在A在工作过程中，不知不觉到了18：01，电工B上班了。这个时候，电工B接到小区居民投诉：小区停电了。电工B也决定去查看一下。当他查看到电闸时，一下就明白了：怪不得小区停电呢，谁把闸关了啊。于是，电工B就把电闸打开了。

于是，听到一声惨叫，A从天上掉了下来……半个月以后，等A把伤养得差不多了以后，变电所决定解决吸取教训，争取再也不要发生这样的问题。那这个问题是怎么发生的呢？	我们可以把A和B当做是两个线程，而电闸就当做是临界资源。因此，这样就形成了两个线程共同访问临界资源，由于A检修电路时，“关掉电闸、爬上电线杆检修、打开电闸恢复供电”是不可分割的原子操作，而一旦其中的某一步被打断，就有可能产生问题，这就是两个线程数据不一致的情况。	那怎么办呢？变电所决定，要解决这个问题，这就借助于一样东西：锁。在电闸上挂一个挂锁。平时没有问题时，锁是打开的；但是一旦有一个电工需要操作电闸的话，为了防止别人动电闸，他可以把电闸给锁上，并把唯一的钥匙随身携带。这样，当他进行原子操作时，由于临界资源被他锁上了，其他线程就访问不了这个临界资源，因此就能保证他的原子操作不被破坏。

java中采用了类似的机制，也采用锁来保护临界资源，防止数据不一致的情况发生。

在Java中，每个对象都拥有一个“`互斥锁标记`”，这就好比是我们说的挂锁。这个锁标记，可以用来分给不同的线程。之所以说这个锁标记是“互斥的”，因为这个锁标记同时只能分配给一个线程。

光有锁标记还不行，还要利用`synchronized`关键字进行加锁的操作。synchronized关键字有两种用法，我们首先介绍第一种：synchronized + 代码块。

这种用法的语法如下：

```java
//后面紧跟一个代码块，这个代码块被称为“同步代码块”。
synchronized(obj){
	//代码块…
}	
```

这种语法的含义是，如果某一个线程想要执行代码块中的代码，必须要先获得obj所指向对象的互斥锁标记。也就是说，如果有一个线程t1要想进入同步代码块，必须要获得obj对象的锁标记；而如果t1线程正在同步代码块中运行，这意味着t1有着obj对象的互斥锁标记；而这个时候如果有一个t2线程想要访问同步代码块，会因为拿不到obj对象的锁标记而无法继续运行下去。

需要注意的是，synchronized与同步代码块是与对象紧密结合在一起的，加锁是对对象加锁。例如下面的例子，假设有两个同步代码块：

```java
synchronized(obj1){
	//代码块1;
}
synchronized(obj1){
	//代码块2;
}
synchronized(obj2){
	//代码块3;
}
```

假设有一个线程t1正在代码块1中运行，那假设另有一个线程t2，这个t2线程能否进入代码块2呢？能否进入代码块3呢？

由于t1正在代码块1中运行，这也就意味着obj1对象的锁标记被t1线程获得，而此时t2线程如果要进入代码块2，也必须要获得obj1对象的锁标记。但是由于这个标记正在t1手中，因此t2线程无法获得锁标记，因此t2线程无法进入代码块2。但是t2线程能够进入代码块3，原因在于：如果要进入代码块3中，要获得的是obj2对象的锁标记，这个对象与obj1不是同一个对象，此时t2线程能够顺利的获得obj2对象的锁标记，因此能够成功的进入代码块3。

从上面这个例子中，我们可以看出，在分析、编写同步代码块时，一定要搞清楚，同步代码块锁的是哪个对象。只有把这个问题搞清楚了之后，才能正确的分析多线程以及同步的相关问题。

我们下面利用同步代码块修改一下MyStack类，为这个类增加同步的机制。首先，要为MyStack类增加一个属性lock，这个属性用来表示我们所说的“锁”。利用这个对象的互斥锁标记，我们完成对MyStack的同步。

```java
//修改之后的MyStack代码如下：
//TestSynchronized
class MyStack {
	char[] data = {'A', 'B', ' '};
	int index = 2;
	private  Object lock = new Object();
	
	public void push(char ch) {
		synchronized(lock) {
			data[index] = ch;
			try {
				Thread.sleep(1000);
			}
			catch (Exception e) {}
		}
	}
	
	public void pop() {
    	//线程如果要执行pop，需要获得lock 对象的互斥锁标记。
		synchronized(lock) {
			index--;
			data[index] = ' ';
		}
	}
	public void print() {
		for (int i = 0; i < data.length; i++) {
			System.out.print(data[i] + "\t");
		}
		System.out.println();
	}
}

class PushThread extends Thread {
	MyStack ms;
	public PushThread(MyStack ms) {
		this.ms = ms;
	}
	public void run() {
		ms.push('C');
		ms.print();
	}
}

class PopThread extends Thread {
	MyStack ms;
	public PopThread(MyStack ms) {
		this.ms = ms;
	}
	public void run() {
		ms.pop();
		ms.print();
	}
}

class Test {
	public static void main(String[] args) {
		MyStack ms = new MyStack();
		Thread t1 = new PushThread(ms);
		Thread t2 = new PopThread(ms);
		
		t1.start();
		t2.start();
	}
}
```

下面我们结合线程的状态转换，来考察一下synchronized关键字在程序运行中的作用。

首先，如果一个线程获得不了某个对象的互斥锁标记，这个线程就会进入一个状态：锁池状态。当运行中的线程，运行到某个同步代码块，但是获得不了对象的锁标记时，会进入锁池状态。在锁池状态的线程，会一直等待某个对象的互斥锁标记。如果有多个线程都需要获得同一个对象的互斥锁标记，则可以有多个线程进入锁池，而某个线程获得锁标记，执行同步代码块中的代码。
当对象的锁标记被某一个线程释放之后，其他在锁池状态中的线程就可以获得这个对象的锁标记。假设有多个线程在锁池状态中，那么会由操作系统决定，把释放出来的锁标记分配给哪一个线程。当在锁池状态中的线程获得锁标记之后，就会进入可运行状态，等待获得CPU时间片，从而运行代码。
当t1线程启动的时候，它会首先执行push方法。要想执行push方法，必须要获得lock对象的互斥锁标记。由于此时lock对象的锁标记没有分配给其他线程，因此这个锁标记被分配给t1线程。当t1线程调用sleep()方法之后，t1进入阻塞状态，于是t2线程开始运行。由于t2线程调用pop()方法，要调用这个方法，也必须获得lock对象的互斥锁标记。由于这个锁标记已经分配给了t1线程，因此t2线程只能进入lock对象的锁池，从而进入了锁池状态。	之后，当t1线程sleep()方法结束，t1重新进入可运行状态?运行状态，执行完了整个push()方法，退出对lock加锁的同步代码块。此时，t2线程就能获得lock对象的锁标记，于是t2线程就由锁池状态转为了可运行状态。

从上面的分析我们可以看出，虽然MyStack对象还是被两个线程t1、t2同时访问，但是由于对lock对象加锁的原因，当t1线程执行push方法执行到一半进入阻塞状态时，t2线程同样无法操作MyStack对象。这样，就不会破坏原子操作push()，从而保护了临界资源，解决了同步问题。

在上面的例子中，我们专门创建了一个Object类型的lock对象，用来在pop方法和push方法中加锁。然而，对于上面的程序来说，除了lock对象有锁标记之外，MyStack对象本身，也具有互斥锁标记。对于pop方法和push方法来说，也能够对MyStack对象（也就是所谓的“当前对象”）加锁。例如：

```java
class MyStack{
	char[] data = {'A', 'B', ' '};
	int index = 2;
	public void push(char ch){
		synchronized(this){  //同步方法锁
			data[index] = ch;
			try{
				Thread.sleep(1000);
			}catch(Exception e){}
			index ++;
		}
	}
	public void pop(){
		synchronized(this){  //同步方法锁
			index --;
			data[index] = ' ';
		}
	}
	public void print(){
		for(int i = 0; i<data.length; i++){
			System.out.print(data[i] + "\t");
		}
		System.out.println();
	}
}
```

在上面的代码中，我们去掉了lock属性，并且对“this”加锁，也就是对当前对象加锁。上面的代码同样能够完成我们同步的要求。

对于这种，在整个方法内部对“this”加锁的情况，我们可以使用synchronized作为修饰符修饰方法，来表达同样的意思。

用synchronized关键字修饰的方法称之为同步方法，所谓的同步方法，指的是同步方法中整个方法的实现，需要对“当前对象”加锁。哪个线程能够拿到对象的锁标记，哪个线程才能调用对象的同步方法。

上面的MyStack代码可以等价的改为下面的情况：

```java
class MyStack{
	char[] data = {'A', 'B', ' '};
	int index = 2;
	public synchronized void push(char ch){ //也是同步方法锁
		data[index] = ch;
		try{
			Thread.sleep(1000);
		}catch(Exception e){}
		index ++;
	}
	public synchronized void pop(){  //也是同步方法锁
		index --;
		data[index] = ' ';
	}
	public void print(){
		for(int i = 0; i<data.length; i++){
			System.out.print(data[i] + "\t");
		}
		System.out.println();
	}
}
```

当一个线程t1在访问某一个对象的同步方法时（例如pop），另一个线程t2能否访问同一个对象的其他同步方法（例如push）？我们举例来说：假设有一个MyStack对象ms，一个线程t1正在访问pop方法，这意味着ms对象的互斥锁标记正在t1线程手中。而另一个线程t2，如果想要方法push方法的话，必须要获得ms对象的互斥锁标记。由于这个锁标记正在t1线程手中，因此t2线程无法获得，从而t2线程就无法访问push方法。因此，这是一个结论：
`当一个线程正在访问某个对象的同步方法时，其他线程不能访问同一个对象的任何同步方法。`

### 死锁、wait与notify

``` java
// wait()签名
public final void wait() throws InterruptedException
// notify()签名
public final void notify()
```

考虑下面的代码，假设a和b是两个不同的对象：

```java
synchronized(a){
	...//1
	synchronized(b){
	
	}
}

synchronized(b){
	... //2
	synchronized(a){
	
	}
}
```

假设现在有两个线程，t1线程运行到了//1的位置，而t2线程运行到了//2的位置，接下来会发生什么情况呢？此时，a对象的锁标记被t1线程获得，而b对象的锁标记被t2线程获得。对于t1线程而言，为了进入对b加锁的同步代码块，t1线程必须获得b对象的锁标记。由于b对象的锁标记被t2线程获得，t1线程无法获得这个对象的锁标记，因此它会进入b对象的锁池，等待b对象锁标记的释放。而对于t2线程而言，由于要进入对a加锁的同步代码块，由于a对象的锁标记在t1线程手中，因此t2线程会进入a对象的锁池。此时，t1线程在等待b对象锁标记的释放，而t2线程在等待a对象锁标记的释放。由于两边都无法获得所需的锁标记，因此两个线程都无法运行。这就是“死锁”问题。

在Java中，采用了wait和notify这两个方法，来解决死锁机制。

首先，在Java中，每一个对象都有两个方法：`wait`和`notify`方法。这两个方法是定义在Object类中的方法。

对某个对象调用wait()方法，表明让线程暂时释放该对象的锁标记。例如，上面的代码就可以改成：

```java
// 假设t1线程运行到了//1的位置，而t2线程运行到了//2的位置
synchronized(a){
	...//1
	a.wait(); //表示t1线程暂时释放a对象的锁标记
	synchronized(b){
	
	}
}
synchronized(b){
	... //2
	synchronized(a){
		...
		a.notify(); //表示a对象的锁标记被唤醒
	}
}
```

这样的代码改完之后，在//1后面，t1线程就会调用a对象的wait方法。此时，t1线程会暂时释放自己拥有的a对象的锁标记，而进入另外一个状态：等待状态。

要注意的是，如果要调用一个对象的wait方法，前提是线程已经获得这个对象的锁标记。如果在没有获得对象锁标记的情况下调用wait方法，则会产生异常。由于a对象的锁标记被释放，因此，t2对象可以获得a对象的锁标记，从而进入对a加锁的同步代码块。在同步代码块的最后，调用a.notify()方法。这个方法与wait方法相对应，是让一个线程从等待状态被唤醒。

那么t2线程唤醒t1线程之后，t1线程处于什么状态呢？由于t1线程唤醒之后还要在对a加锁的同步代码块中运行，而t2线程调用了notify()方法之后，并没有立刻退出对a加锁的同步代码块，因此此时t1线程并不能马上获得a对象的锁标记。因此，此时，t1线程会在a对象的锁池中进行等待，以期待获得a对象的锁标记。也就是说，一个线程如果之前调用了wait方法，则必须要被另一个线程调用notify()方法唤醒。唤醒之后，会进入锁池状态。

由于可能有多个线程先后调用a对象wait方法，因此在a对象等待状态中的线程可能有多个。而调用a.notify()方法，会从a对象等待状态中的多个线程里挑选一个线程进行唤醒。与之对应的，有一个notifyAll()方法，调用a.notifyAll() 会把a对象等待状态中的所有线程都唤醒。

### 最简单的生产者消费者模型的实现

```java
// wait与notify应用：生产者/消费者问题	
class MyStack { //自己造的栈类
	private char[] data = new char[5];
	private int index = 0;
	
	public char pop() {
		index--;
		return data[index];
	}
	public void push(char ch) {
		data[index] = ch;
		index++;
	}
	public void print() {
		for (int i = 0; i < index; i++) {
			System.out.print(data[i] + '\t');
		}
		System.out.println();
	}
	public boolean isEmpty() {
		if (index == 0) return true;
		else return false;
	}
	public boolean isFull() {
		if (index == 5) return true;
		else return false;
	}
}

class Consumer extends Thread { //消费者（将数据出栈）
	private MyStack ms;
	
	public Consumer(MyStack ms) {
		this.ms = ms;
	}
	public void run() {
		while (true) {
			synchronized (ms) {
				while (ms.isEmpty()) {
					try {
						ms.wait();
					} catch (InterruptedException e) {
						e.printStackTrace();
					}
				}
				System.out.println("Pop" + ms.pop());
				ms.notifyAll();
			}
			try {
				sleep((int)Math.abs(Math.random()*1000));
			} catch (InterruptedException e) {
				e.printStackTrace();
			}
		}
	}
}

class Producer extends Thread { //生产者（将数据入栈）
	private MyStack ms;
	
	public Producer(MyStack ms) {
		this.ms = ms;
	}
	
	public void run() {
		while (true) {
			synchronized (ms) {
				while (ms.isFull()) {
					try {
						ms.wait();
					} catch (InterruptedException e) {
						e.printStackTrace();
					}
				}
				ms.push('A');
				System.out.println("push A");
				ms.notifyAll();
			}
			try {
				sleep((int)Math.abs(Math.random()*2000));
			} catch (InterruptedException e) {
				e.printStackTrace();
			}
		}
	}
}

class Test {
	public static void main(String[] args){ //主函数入口 
		MyStack ms = new MyStack();
		Thread t1 = new Producer(ms);
		Thread t2 = new Consumer(ms);
		
		t1.start();
		t2.start();
	}
}

//运行结果：
push A
PopA
push A
PopA
push A
PopA
push A
PopA
push A
push A
PopA
PopA
push A
PopA
push A
PopA
...
```

