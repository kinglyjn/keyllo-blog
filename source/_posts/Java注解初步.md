title: Java注解初步
author: kinglyjn
tags:
  - annotation
categories:
  - java
  - annotation
date: 2018-09-10 16:43:00
---
## 元注解

要深入学习注解，我们就必须能定义自己的注解，并使用注解，在定义自己的注解之前，我们就必须要了解Java为我们提供的元注解和相关定义注解的语法。元注解的作用就是负责注解其他注解。Java5.0定义了4个标准的meta-annotation类型，它们被用来提供对其它 annotation类型作说明。Java5.0定义的元注解：

<!--more-->

1. @Target,
2. @Retention,
3. @Documented,
4. @Inherited

这些类型和它们所支持的类在java.lang.annotation包中可以找到。下面我们看一下每个元注解的作用和相应分参数的使用说明。


### `@Target`

@Target说明了Annotation所修饰的对象范围：Annotation可被用于 packages、types（类、接口、枚举、Annotation类型）、类型成员（方法、构造方法、成员变量、枚举值）、方法参数和本地变量（如循环变量、catch参数）。在Annotation类型的声明中使用了target可更加明晰其修饰的目标。

作用：用于描述注解的使用范围（即：被描述的注解可以用在什么地方）
取值(ElementType)有：

1. CONSTRUCTOR:用于描述构造器
2. FIELD:用于描述域
3. LOCAL_VARIABLE:用于描述局部变量
4. METHOD:用于描述方法
5. PACKAGE:用于描述包
6. PARAMETER:用于描述参数
7. TYPE:用于描述类、接口(包括注解类型) 或enum声明

示例：

```java
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)  
public @interface Table {
	public String tableName() default "className";
}


import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME) 
public @interface NoDBColumn {
	
}
```

注解Table 可以用于注解类、接口(包括注解类型) 或enum声明,而注解NoDBColumn仅可用于注解类的成员变量。


### `@Retention`

@Retention定义了该Annotation被保留的时间长短：某些Annotation仅出现在源代码中，而被编译器丢弃；而另一些却被编译在class文件中；编译在class文件中的Annotation可能会被虚拟机忽略，而另一些在class被装载时将被读取（请注意并不影响class的执行，因为Annotation与class在使用上是被分离的）。使用这个meta-Annotation可以对 Annotation的“生命周期”限制。

作用：表示需要在什么级别保存该注释信息，用于描述注解的生命周期（即：被描述的注解在什么范围内有效）

取值（RetentionPoicy）有：

1. SOURCE: 在源文件中有效（即源文件保留）
2. CLASS: 在class文件中有效（即class保留）
3. RUNTIME: 在运行时有效（即运行时保留）

Retention meta-annotation类型有唯一的value作为成员，它的取值来自java.lang.annotation.RetentionPolicy的枚举类型值。具体实例如下：

```java
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Column {
	public String name() default "fieldName";
	public String setFuncName() default "setField";
	public String getFuncName() default "getField";
	public boolean defaultDBValue() default false;
}
```

Column注解的的RetentionPolicy的属性值是RUNTIME,这样注解处理器可以通过反射，获取到该注解的属性值，从而去做一些运行时的逻辑处理。<br><br>


### `@Documented`

@Documented用于描述其它类型的annotation应该被作为被标注的程序成员的公共API，因此可以被例如javadoc此类的工具文档化。Documented是一个标记注解，没有成员。

```java
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface Column {
	public String name() default "fieldName";
	public String setFuncName() default "setField";
	public String getFuncName() default "getField";
	public boolean defaultDBValue() default false;
}
```


### `@Inherited`

@Inherited 元注解是一个标记注解，@Inherited阐述了某个被标注的类型是被继承的。如果一个使用了@Inherited修饰的annotation类型被用于一个class，则这个annotation将被用于该class的子类。

注意：@Inherited annotation类型是被标注过的class的子类所继承。类并不从它所实现的接口继承annotation，方法并不从它所重载的方法继承annotation。

当@Inherited annotation类型标注的annotation的Retention是RetentionPolicy.RUNTIME，则反射API增强了这种继承性。如果我们使用java.lang.reflect去查询一个@Inherited annotation类型的annotation时，反射代码检查将展开工作：检查class和其父类，直到发现指定的annotation类型被发现，或者到达类继承结构的顶层。

示例：

```java
import java.lang.annotation.ElementType;
import java.lang.annotation.Inherited;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME) 
@Inherited
public @interface Table {
	public String tableName() default "className";
}


import java.lang.annotation.ElementType;
import java.lang.annotation.Inherited;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME) 
@Inherited
public @interface Table2 {
	public String tableName() default "className";
}


import java.lang.annotation.Annotation;
@Table
public class Student extends St2 {
	public static void main(String[] args) {
		Annotation[] annotations = Student.class.getAnnotations(); //获取本身及其父类公开注解
		for (Annotation annotation : annotations) {
			System.out.println(annotation);
		}
	}
}
@Table2
class St2 {}


//运行结果：
@test.threadlocal.Table2(tableName=className)
@test.threadlocal.Table(tableName=className)


//如果将Table2注解的@Inherited源注解注释掉，结果为：
@test.threadlocal.Table(tableName=className)
```
<br>


## 自定义注解

使用@interface自定义注解时，自动继承了java.lang.annotation.Annotation接口，由编译程序自动完成其他细节。在定义注解时，不能继承其他的注解或接口。@interface用来声明一个注解，其中的每一个方法实际上是声明了一个配置参数。方法的名称就是参数的名称，返回值类型就是参数的类型（返回值类型只能是基本类型、Class、String、enum）。可以通过default来声明参数的默认值。<br>

定义注解格式：<br>
public @interface 注解名 {定义体} <br>

注解参数的可支持数据类型：<br>

1. 所有基本数据类型（int,float,boolean,byte,double,char,long,short)
2. String类型
3. Class类型
4. Enum类型
5. Annotation类型
6. 以上所有类型的数组

Annotation类型里面的参数该怎么设定: <br>

* 第一,只能用public或默认(default)这两个访问权修饰.例如,String value();这里把方法设为defaul默认类型；
* 第二,参数成员只能用基本类型 byte,short,char,int,long,float,double,boolean八种基本数据类型和 String,Enum,Class,annotations 等数据类型,以及这一些类型的数组。例如，`String value();` 这里的参数成员就为String；
* 第三,如果只有一个参数成员,最好把参数名称设为"value",后加小括号。例:下面的例子FruitName注解就只有一个参数成员。

简单的自定义注解和使用注解实例：<br>

```java
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface FruitName {
	String value() default "";
}


import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface FruitColor {
	//颜色枚举
	public enum Color {BLUE, RED, GREEN};
	//颜色属性
	Color fruitColor() default Color.GREEN;
}
```
<br>

### 注解元素的默认值

注解元素必须有确定的值，要么在定义注解的默认值中指定，要么在使用注解时指定，非基本类型的注解元素的值不可为null。因此, 使用空字符串或0作为默认值是一种常用的做法。这个约束使得处理器很难表现一个元素的存在或缺失的状态，因为每个注解的声明中，所有元素都存在，并且都具有相应的值，为了绕开这个约束，我们只能定义一些特殊的值，例如空字符串或者负数，一次表示某个元素不存在，在定义注解时，这已经成为一个习惯用法。例如：<br>

```java
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface FruitProvider {
	//供应商编号
	public int id() default -1;
	//供应商名称
	public String name() default "";
	//供应商地址
	public String address() default "";
}
```

### 根据注解信息控制程序流程

定义了注解，并在需要的时候给相关类，类属性加上注解信息，如果没有响应的注解信息处理流程，注解可以说是没有实用价值。如何让注解真真的发挥作用，主要就在于注解处理方法，下面我们给出注解信息的获取和处理示例：<br>

```java
public class FruitInfoUtil {
    public static void getFruitInfo(Class<?> clazz){
        
        String strFruitName=" 水果名称：";
        String strFruitColor=" 水果颜色：";
        String strFruitProvicer="供应商信息：";
        
        Field[] fields = clazz.getDeclaredFields();
        
        for(Field field :fields){
            if(field.isAnnotationPresent(FruitName.class)){
                FruitName fruitName = (FruitName) field.getAnnotation(FruitName.class);
                strFruitName=strFruitName+fruitName.value();
                System.out.println(strFruitName);
            }
            else if(field.isAnnotationPresent(FruitColor.class)){
                FruitColor fruitColor= (FruitColor) field.getAnnotation(FruitColor.class);
                strFruitColor=strFruitColor+fruitColor.fruitColor().toString();
                System.out.println(strFruitColor);
            }
            else if(field.isAnnotationPresent(FruitProvider.class)){
                FruitProvider fruitProvider= (FruitProvider) field.getAnnotation(FruitProvider.class);
                strFruitProvicer=" 供应商编号："+fruitProvider.id()+" 供应商名称："+fruitProvider.name()+" 供应商地址："+fruitProvider.address();
                System.out.println(strFruitProvicer);
            }
        }
    }
}
```

### java8 支持可重复注解


``` java
/**
 * 可重复注解
 * 自从Java 5中引入注解以来，这个特性开始变得非常流行，并在各个框架和项目中被广泛使用。
 * 不过，注解有一个很大的限制是：在同一个地方不能多次使用同一个注解。Java 8打破了这个
 * 限制，引入了重复注解的概念，允许在同一个地方多次使用同一个注解。
 * 在Java 8中使用@Repeatable注解定义重复注解，实际上，这并不是语言层面的改进，而是编
 * 译器做的一个trick，底层的技术仍然相同。
 * 
 * 这里的Filter类使用@Repeatable(Filters.class)注解修饰，而Filters是存放Filter
 * 注解的容器，编译器尽量对开发者屏蔽这些细节。这样，Filterable接口可以用两个Filter
 * 注解注释（这里并没有提到任何关于Filters的信息）。
 * 另外，反射API提供了一个新的方法：getAnnotationsByType()，可以返回某个类型的重复注解
 * 
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
static @interface Filters {
	Filter[] value();
}
@Target( ElementType.TYPE )
@Retention( RetentionPolicy.RUNTIME )
@Repeatable(Filters.class)
static @interface Filter {
	String value();
}
@Filter("filter1")
@Filter("filter2")
static interface Filterable {
	// ...
}
@Test
public void test03() {
	// 获取某个类型的重复注解
	Filter[] filters = Filterable.class.getAnnotationsByType(Filter.class);
	for (Filter filter : filters) {
		System.out.println(filter.value()); //filter1 filter2
	}
	
	// 由于Filterable接口使用了两个相同的@Filter注解，相当于使用Filters注解，故此处得到的值为null
	System.out.println("--------------");
	Filter filter = Filterable.class.getAnnotation(Filter.class);
	System.out.println(filter); //null
	
	// 返回值为 @test04_annotation.Test01$Filters(value=...
	System.out.println("--------------");
	Filters fs = Filterable.class.getAnnotation(Filters.class);
	System.out.println(fs);
}
```