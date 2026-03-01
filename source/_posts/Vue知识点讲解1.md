title: Vue知识点讲解1

author: kinglyjn

tags:
  - vue

categories:
  - frontend
  - vue

date: 2022-01-16 11:59:51

---



## Vue是个啥？

Vue是一套用于 `构建用户界面` 的 `渐进式` JS框架。具有 `组件式开发和声明式编码` 的特点。[点击进入官网](https://cn.vuejs.org/index.html)


​			

<!--more-->



简单示例：

![image-20220116132945754](/images/image-20220116132945754.png)



## Vue数据绑定的原理

```javascript
let person = {
  name: "张三",
  sex: "男"
}

let n = 18;
Object.defineProperty(person, 'age', {
  enumerable: true,   // 默认为false不可以被枚举，即默认使用 for-in 等方法不能被遍历
  configurable: true, // 默认为false属性不能被删除，即默认使用 delete person.age 等方法不能删除 person.age 这个属性

  // value: 18,
  // writable: true,  // 默认为false属性值不可以被修改，即默认使用 person.age = 12 等方法不能更改 person.age 的值。另外 writable 和 value 不能和 getter/setter 一块使用
  get() {
    return n;
  },
  set:function(value) {
    n = value
  }
});
```

啥是数据代理呢？简单来说就是通过一个对象代理另外一个对象中属性的操作（读/写）。

通过上面的 Object.defineProperty 方法，person.age 和 变量n就完成了数据的双向绑定，即：

1）修改n，访问 person.age 也会发生变化 

2）修改 person.age，访问 n 也会发生变化







