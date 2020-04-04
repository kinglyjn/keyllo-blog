title: Java泛型测试示例
author: kinglyjn
tags:
  - genericity
categories:
  - java
  - genericity
date: 2018-09-10 16:59:00
---
Java 泛型（generics）是 JDK 5 中引入的一个新特性, 泛型提供了编译时类型安全检测机制，该机制允许程序员在编译时检测到非法的类型。泛型的本质是参数化类型，也就是说所操作的数据类型被指定为一个参数。

假定我们有这样一个需求：写一个排序方法，能够对整型数组、字符串数组甚至其他任何类型的数组进行排序，该如何实现？

答案是可以使用 Java 泛型。

使用 Java 泛型的概念，我们可以写一个泛型方法来对一个对象数组排序。然后，调用该泛型方法来对整型数组、浮点数数组、字符串数组等进行排序。

<!--more-->


### 泛型类

```java
public class Fanxinglei<T> {
	private T obj;
	public T getObj() {
		return obj;
	}
	public void setObj(T obj) {
		this.obj = obj;
	}
	@Override
	public String toString() {
		return "Fanxinglei [obj=" + obj + "]";
	}
    
	public static void main(String[] args) {
		Fanxinglei<String> fxl = new Fanxinglei<String>();
		fxl.setObj("哈哈哈");
		System.out.println(fxl);
	}
}

//运行结果
Fanxinglei [obj=哈哈哈]
```
<br>

### 泛型方法

```java
public <T extends Number> double add(T t1, T t2) {
	double sum = 0.0;
	sum = t1.doubleValue() + t2.doubleValue();
	return sum;
}

public static <T> T getObj(Class<T> c) throws Exception {
	return c.newInstance();
}
```
<br>

### 泛型接口

```java
public class Fanxing {
	public static void main(String[] args) {
		InterImpl<String> interImpl = new InterImpl<String>();
		interImpl.show("哈哈哈");
	}
}

interface Inter<T> { //interface
	void show(T t);
}

class InterImpl<T> implements Inter<T> { //interafceImpl
	@Override
	public void show(T t) {
		System.out.println(t);
	}
}
```
<br>

### 四种泛型类型及其测试

```java
package test;

import java.lang.reflect.Field;
import java.lang.reflect.GenericArrayType;
import java.lang.reflect.Method;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.lang.reflect.TypeVariable;
import java.lang.reflect.WildcardType;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * 泛型：编译的过程中进行检查，编译完成后生成的class文件已将泛型擦除
 * 获取泛型：getGenericSuperClass、getGenericType
 * 泛型类型：
 *  ParameterizedType：
 *	  含有泛型的列表的Type，如 BaseDao<Student>、Map<K,V>、List<? extends Person>
 *  TypeVariable：
 *	  本身就是泛型的Type，如 E、T、K、V
 *  GenericArrayType：	
 *	  数组中含有泛型的Type，如 Map<String,Integer>[]、List<? extends Person>[]
 *  WildcardType：
 *	  含有通配符的Type，如 List<? extends Person>、List<? super Student>  		
 */
public class StudentDao<E extends Person> extends BaseDao<Student> {
	private Map<String, E> map;
	private List<? extends Person> list;
	private E[] vtypeArray;
	private Map<String,Integer>[] mapArray;

	public void wildcardParamsMethod(
      		List<? extends Person> list1, 
      		List<? super Student> list2, 
      		Class<?> clazz1, 
      		Class<Student> claszz2) {
		// TODO
	}
	
	/**
	 * main
	 * 
	 */
	public static void main(String[] args) throws Exception {
		StudentDao<Person> studentDao = new StudentDao<Person>();
		
		/**
		 * 测试含有泛型的父类
		 */
		Type genericSuperclass = studentDao.getClass().getGenericSuperclass(); 
      		//判断StudentDao的父类有没有泛型化（即BaseDao后面有没有<..>）
		if (genericSuperclass instanceof ParameterizedType) { 
			 /*
			 * 返回这个Type泛型列表对应的实际类型数组 
			 * 如 Map<String,Person> 这个ParameterizedType返回的是
			 * String和Person类的全限定类名的 Type Array
			 */
			Type[] actualTypeArguments = 
              			((ParameterizedType) genericSuperclass).getActualTypeArguments();
			System.out.println(actualTypeArguments[0]); //class test.Student							
			 /*
			 * 返回的是当前这个ParameterizedType的Type。
			 * 如 Map<String,Person>这个ParameterizedType返回的是
			 * Map类的全限定类名的 Type Array
			 */
			Type rawType = ((ParameterizedType) genericSuperclass).getRawType();
			System.out.println(rawType); //class test.BaseDao
		}
		
		
		/**
		 * 测试含有泛型的属性
		 */
		System.out.println();
		Field[] fields = studentDao.getClass().getDeclaredFields(); //获取自身私有或公开的属性
		for (Field field : fields) {
			Type genericType = field.getGenericType();
			/*
			 * 判断属性本身属于哪一类
			 */
            		//含有泛型列表的元素，如Map<K,V>、List<? extends T>
			if (genericType instanceof ParameterizedType) { 
				Type[] actualTypeArguments = 
                  ((ParameterizedType) genericType).getActualTypeArguments();
				for (Type type : actualTypeArguments) {
					/*
					 * 判断属性的泛型列表元素属于哪一类
					 */
					if (type instanceof TypeVariable) { //Map<K,V>、List<T>
						Type[] bounds = ((TypeVariable<?>) type).getBounds();
						StringBuffer sb = new StringBuffer();
						for (Type boundType : bounds) {
							sb.append(boundType.getTypeName() + ",");
						}
						System.out.println(field.getName() 
                                           + "：ParameterizedType-泛型列表-泛型类 " 
                                           + type.getTypeName() + "，泛型类的上边界为 " 
                                           + sb.substring(0, sb.lastIndexOf(",")) );
					} else { //Map<String,Integer>、List<? extends Person>
						System.out.println(field.getName() 
                                           + "：ParameterizedType-泛型列表-普通类 " 
                                           + type.getTypeName());
					}
				}
			} else if (genericType instanceof GenericArrayType) { 
                		//数组的元含有泛型，如T[]、List<String>[]
				Type genericComponentType = 
                  ((GenericArrayType) genericType).getGenericComponentType();
				/*
				 * 判断数组元素属于哪一类
				 */
				if (genericComponentType instanceof ParameterizedType) {
                    			//Map<String,Integer>[]、List<String>[]
					Type rawType = 
                      ((ParameterizedType) genericComponentType).getRawType();
					Type[] actualTypeArguments = 
                      ((ParameterizedType) genericComponentType).getActualTypeArguments();
					System.out.println(field.getName() 
                                       + "：GenericArrayType-数组元素及其泛型列表为 " 
                                       + rawType.getTypeName() 
                                       + Arrays.toString(actualTypeArguments));
				} else if (genericComponentType instanceof TypeVariable) { //E[]
					String typeName = ((TypeVariable<?>) genericComponentType).getName();
					System.out.println(field.getName() 
                                       + "：TypeVariable-数组元素及其泛型名称为 " 
                                       + typeName);
				} else {
					System.out.println(field.getName() + "：待论");
				}
			}
			System.out.println("------------------------------");
		}
		
		
		/**
		 * 测试含有泛型的方法
		 */
		System.out.println();
		Method wildcardParamsMethod = studentDao.getClass()
          			.getDeclaredMethod("wildcardParamsMethod", 
                     new Class[]{List.class, List.class, Class.class, Class.class});
		Type[] genericParameterTypes = 
        		wildcardParamsMethod.getGenericParameterTypes(); //参数列表个元素的type
		for (Type type : genericParameterTypes) {
			/*
			 * 判断Type是否含有泛型列表，如果没有则继续遍历
			 */
			if (!(type instanceof ParameterizedType)) {
				continue;
			}
			
			/*
			 * 判断Type泛型列表中是否含有通配符
			 */
			Type[] actualTypeArguments =
              ((ParameterizedType)type).getActualTypeArguments();
			for (Type actualType : actualTypeArguments) {
				if (!(actualType instanceof WildcardType)) {
					continue;
				}
				WildcardType wildcardType = (WildcardType) actualType;
				Type[] lowerBounds = wildcardType.getLowerBounds();
				Type[] upperBounds = wildcardType.getUpperBounds();
				System.out.println(type.getTypeName() 
                                   + "：下边界为 " + Arrays.toString(lowerBounds) 
                                   + "，上边界为 " + Arrays.toString(upperBounds));
			}
		}
	}
}

/*
测试结果：
==========================================================
class test.Student
class test.BaseDao

map：ParameterizedType-泛型列表-普通类 java.lang.String
map：ParameterizedType-泛型列表-泛型类 E，泛型类的上边界为 test.Person
------------------------------
list：ParameterizedType-泛型列表-普通类 ? extends test.Person
------------------------------
vtypeArray：TypeVariable-数组元素及其泛型名称为 E
------------------------------
mapArray：GenericArrayType-数组元素及其泛型列表为 java.util.Map[class java.lang.String, class java.lang.Integer]
------------------------------

java.util.List<? extends test.Person>：下边界为 []，上边界为 [class test.Person]
java.util.List<? super test.Student>：下边界为 [class test.Student]，上边界为 [class java.lang.Object]
java.lang.Class<?>：下边界为 []，上边界为 [class java.lang.Object]
==========================================================
 */

```