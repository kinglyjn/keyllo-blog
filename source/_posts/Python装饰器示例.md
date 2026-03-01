title: Python装饰器示例

author: kinglyjn

tags:

  - python

categories:

  - python
  - core

date: 2019-01-25 12:56:01

---

装饰器的本质是一个高阶函数。以下一段代码，当你使用 @log 时，Python 会根据你是否传参来选择不同的执行路径： <!--more-->

* 情况 A：直接使用 @log (不带括号)
  * 此时 x 接收的是函数本身（即 f）。
  * 代码进入 if callable(x) 分支，直接返回包装后的函数。
* 情况 B：使用 @log('execute') (带参数)
  * 此时 x 接收的是字符串 'execute'。
  * 代码进入 else: 分支，返回一个名为 decorate 的新装饰器，由它来接收函数 f2。

```python
import functools

def log(x):
    if callable(x):
        @functools.wraps(x)
        def wrapper(*args, **kw):
            print("call %s(): " % x.__name__)
            return x(*args, **kw)
        return wrapper
    else:
        def decorate(func):
            @functools.wraps(func)
            def wrapper2(*args, **kw):
                print("call %s %s(): " % (x, func.__name__))
                return func(*args, **kw)
            return wrapper2
        return decorate

@log
def f(x):
    return x ** 2
 
@log('execute')
def f2(x):
    return x ** 3
  
 
# 使用内置的 @property 给对象赋值（setter & getter）
class Student(object):
    @property  #内置
    def score(self):
        return self._score

    @score.setter
    def score(self, value):
        if not isinstance(value, int):
            raise ValueError('score must be an integer!')
        if value < 0 or value > 100:
            raise ValueError('score must between 0 ~ 100!')
        self._score = value
```

<br>

