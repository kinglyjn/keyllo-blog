title: Java集合及相关集合的排序
author: kinglyjn
tags:
  - collection
categories:
  - java
  - collection
date: 2018-09-10 16:12:00
---
# 概述

集合分为两大类，即Collection（List、ArrayList、LinkedList、Vector；HashSet、LinkedHashSet、TreeSet） 和 Map（HashMap、LinkedHashMap、TreeMap、Hashtable&Properties-古老的实现类线程安全并且键不能为null），Map的key使用set集合进行存储（组成keySet），所以map的key不能重复。使用Collections操作collection及map，使用Arrays操作数组。 

<!-- more -->

Set里面的记录是无序的，如果想使用Set，然后又想里面的记录是有序的，就可以使用TreeSet，而不是HashSet，在使用TreeSet的时候，里面的元素必须是实现了Comparable接口的，TreeSet在进行排序的时候就是通过比较它们的Comparable接口的实现！

HashSet、LinkedHashSet、TreeSet的元素的存储位置都是无序的，由元素的hashCode决定，不同之处在于HashSet是按照hashCode决定的存储位置对Set遍历的；LinkedHashSet维护了一个双向链表，能够按照元素的添加顺序进行遍历；TreeSet是根据其Comparable接口的compareTo方法对其元素进行顺序遍历的。

那么，Set中的元素是如何存储的呢？其实它是使用了hashCode方法，计算当前元素的hashCode值，此hashCode值决定了此元素在Set中的存储位置，若此位置之前没有存储过元素，则这个对象直接被存储到该位置；若此位置之前存储过对象，则再通过equals方法比较前后两个元素是否相同，如果相同则后一个对象就添加不进来，所以一般要求hashCode和equals方法需要一致。

顺便说一下常见几个集合之间的区别，如下：
`ArrayList和LinkedList`：
ArrayList：数组实现，增删慢，查询快
LinkedList：链表实现，增删快，查询慢
`HashMap和Hashtable`：
HashMap：轻量级，速度快，线程不安全，允许键和值为null
Hashtable：重量级，速度慢，线程安全，不允许键和值为null


# 使用Comparator实现外部排序示例

``` java
public static void main(String[] args) {
    List<Integer> list = new ArrayList<Integer>();
    list.add(-3);
    list.add(1);
    list.add(2);

    for (Integer i : list) {
      System.out.println(i);
    } //-3 1 2

    Collections.sort(list, new Comparator<Integer>() {
      @Override
      public int compare(Integer o1, Integer o2) {
        return Math.abs(o1)-Math.abs(o2);
      }
    });

    for (Integer i : list) {
      System.out.println(i);
    } //1 2 -3
}

public static void main(String[] args) {
    Set<Integer> set = new TreeSet<Integer>(new Comparator<Integer>() {
      @Override
      public int compare(Integer o1, Integer o2) {
        return Math.abs(o1)-Math.abs(o2);
      }
    });
    set.add(-3);
    set.add(1);
    set.add(2);

    for (Integer i : set) {
      System.out.println(i);
    } //1 2 -3
}

public static void main(String[] args) {
	Map<Integer, String> map = 
    	new TreeMap<Integer,String>(new Comparator<Integer>() {
			@Override
			public int compare(Integer o1, Integer o2) {
				return Math.abs(o1)-Math.abs(o2);
        	}
		});
        
	map.put(-3, "aaa");
	map.put(1, "bbb");
	map.put(2, "ccc");

	Set<Integer> keySet = map.keySet();
	for (Integer key : keySet) {
		System.out.println(key + "--->" + map.get(key));
	}
	
	//1--->bbb
	//2--->ccc
	//-3--->aaa
}
```