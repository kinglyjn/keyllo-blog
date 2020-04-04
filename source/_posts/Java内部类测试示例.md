title: Java内部类测试示例
author: kinglyjn
tags: []
categories:
  - java
  - syntax
date: 2018-09-10 18:32:00
---
## 概述

1. 内部类是指在一个外部类的内部再定义一个类。类名不需要和文件夹相同。
2. 内部类可以是静态static的，也可用public，default，protected和private修饰，而外部顶级类即类名和文件名相同的只能使用public和default
3. 内部类是一个编译时的概念，一旦编译成功，就会成为完全不同的两类。对于一个名为outer的外部类和其内部定义的名为inner的内部类，编译完成后出现outer.class和outer$inner.class两类，所以内部类的成员变量/方法名可以和外部类的相同。

<!--more-->

## 内部类的分类

内部类主要可分为成员内部类、局部内部类、嵌套内部类、匿名内部类，下面将一一介绍这几种内部类。

### 成员内部类

1. 成员内部类，就是作为外部类的成员，可以直接使用外部类的所有成员和方法，即使是private的。同时外部类要访问内部类的所有成员变量/方法，则需要通过内部类的对象来获取；
2. 要注意的是，成员内部类不能含有static的变量和方法。因为成员内部类需要先创建了外部类，才能创建它自己的，了解这一点，就可以明白更多事情，在此省略更多的细节了；
3. 在成员内部类要引用外部类对象时，使用outer.this来表示外部类对象；
4. 而需要创建内部类对象，可以使用outer.inner obj = outerobj.new inner()。

``` java
public class Outer {
	public class Inner {
		public void say(String str) {
			System.out.println(str);
		}
	}
	
	//个人推荐使用getxxx()来获取成员内部类，尤其是该内部类的构造函数无参数时 
	public Inner getInner() {
		return new Inner();
	}
	
	public static void main(String[] args) {
		Outer outer = new Outer();
		
		Inner inner = outer.new Inner();
		inner.say("hello world!");
	
		Inner inner2 = outer.getInner();
		inner2.say("你好，世界！");
	}
}
```

### 局部内部类

局部内部类，是指内部类定义在方法和作用域内。请看如下两个例子
定义在方法内：

``` java
public class Outer {
	
	interface Spider {
		void fly();
	}
	public Spider getSpiderman() {
		//定义局部内部类
		class Spiderman implements Spider {
			@Override
			public void fly() {
				System.out.println("我是超人我会飞！");
			}
		}
		//使用局部内部类
		return new Spiderman();
	}
	
	public static void main(String[] args) {
		Spider spider = new Outer().getSpiderman();
		spider.fly();
	}
}
```

定义在作用域内：

``` java
public class Outer {
	private static final String NOTICE = "我是超人我会飞！";
	
	private void spidermanSayHello(boolean flag) {
		if (flag) {
			//定义局部内部类
			class Spiderman {
				public void fly() {
					System.out.println(NOTICE);
				}
			}
			//使用局部内部类
			new Spiderman().fly();
		}
	}
	
	public void spidermanSayHello() {
		spidermanSayHello(true);
	}
	
	public static void main(String[] args) {
		Outer outer = new Outer();
		outer.spidermanSayHello();
	}
}
```

局部内部类也像别的类一样进行编译，但只是作用域不同而已，只在该方法或条件的作用域内才能使用，退出这些作用域后无法引用的。

### 嵌套内部类

1. 嵌套内部类，就是修饰为static的内部类。声明为static的内部类，不需要内部类对象和外部类对象之间的联系，就是说我们可以直接引用outer.inner，即不需要创建外部类，也不需要创建内部类。
2. 嵌套类和普通的内部类还有一个区别：普通内部类不能有static数据和static属性，也不能包含嵌套类，但嵌套类可以。而嵌套类不能声明为private，一般声明为public，方便调用。

``` java
public class Outer {
	public static String STR = "I am in outer";
	
	public static void say() {
		System.out.println("outer: " + STR);
	}
	
	static class Inner {
		public static String STR = "I am in inner";
		
		public static void say() {
			System.out.println(STR);
			Outer.say();
		}
	}
	
	public static void main(String[] args) {
		String ss = Outer.Inner.STR;
		System.out.println(ss); //I am in inner
		
		Outer.Inner.say(); //I am in inner  //outer: I am in outer
	}
}
```

### 匿名内部类

1. 有时候我为了免去给内部类命名，便倾向于使用匿名内部类，因为它没有名字。
2. 匿名内部类不能加访问修饰符。

``` java
/**
* 被内部类使用到的外部类的方法的形参（注意city没有被内部类使用到），必须为final。
* 为什么要定义为final呢？
* 简单理解就是，在拷贝引用时，为了避免引用值发生改变，例如被外部类的方法修改，而导致内部类得到的值不一致，于是用final来让该引用不可改变。
*/
public class Outer {
	//
	interface Spider {
		String getName();
	}
	//
	public Spider getSpiderman(final String name, String city) {
		System.out.println("city: " + city);
		return new Spider() {
			private String nameStr = name;
			
			@Override
			public String getName() {
				return nameStr;
			}
		};
	}
	
	public static void main(String[] args) {
		Outer outer = new Outer();
		Spider spiderman = outer.getSpiderman("Parker", "New York");
		System.out.println(spiderman.getName()); //Parker
	}
}
```

## 内部类的继承

内部类的继承，是指内部类被继承，普通类 extents 内部类。而这时候代码上要有点特别处理，具体看以下例子:

``` java
public class A extends Outer.Inner {
	//无参构造函数A()是不能通过编译的，一定要加上形参
	A(Outer outer) {
		outer.super();
	}
	
	public static void main(String[] args) {
		Outer outer = new Outer();
		A a = new A(outer);
		a.say("hello!");
	}
}

class Outer {
	class Inner {
		public void say(String str) {
			System.out.println(str);
		}
	}
}
```