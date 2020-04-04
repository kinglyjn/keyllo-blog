title: '形如data:image/png的data类型的Url格式'
author: kinglyjn
tags:
  - html5
categories:
  - html&css
  - html5
date: 2018-09-10 17:30:00
---
所谓”data”类型的Url格式，是在RFC2397中 提出的，目的对于一些“小”的数据，可以在网页中直接嵌入，而不是从外部文件载入。例如对于img这个Tag，哪怕这个图片非常非常的小，小到只有一个 点，也是要从另外一个外部的图片文件例如gif文件中读入的，如果浏览器实现了data类型的Url格式，这个文件就可以直接从页面文件内部读入了。
data类型的Url格式早在1998年就提出了，时至今日，Firfox、Opera、Safari和Konqueror这些浏览器都已经支持，但是IE直到7.0版本都还没有支持，IE不支持的东西太多了，也不差这一个。

<!--more-->

小例子 下面这个html代码可以在支持data类型Url的浏览器中运行，例如Firefox。运行后会看到一条蓝色渐变底色的标题（图一）。

``` html
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" 
"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"> 
<html xmlns="http://www.w3.org/1999/xhtml" > 
<head> 
<style type="text/css"> 
.title { 
background-image:url(data:image/gif;base64,R0lGODlhAQAcALMAAMXh96HR97XZ98Hf98Xg97DX97nb98Lf97vc98Tg973d96rU97ba97%2Fe96XS9wAAACH5BAAAAAAALAAAAAABABwAAAQVMLhVBDNItXESAURyDI2CGIxQLE4EADs%3D); 
background-repeat:repeat-x; 
height:28px; 
line-height: 28px; 
text-align:center; 
} 
</style> 
</head> 
<body> 
<div class="title">Hello, world!</div> 
</body> 
</html> 
</body> 
```

![图一](/images/pasted-0.png)

这个渐变的蓝色底色实际上是用一个1x28的小图片通过横行重复(repeat-x)形成的。这个图片很小，不过104个字节，直接嵌入到html或css文件还是很合适的。 

data格式的Url最直接的好处是，这些Url原本会引起一个新的网络访问，因为那里是一个网页的地址，现在不会有新的网络访问了，因为现在这里是网页的内容。这样做，会减少服务器的负载，当然同时也增加了当前网页的大小。所以对“小”数据特别有好处。

data类型Url的形式，既然是Url，当然也可以直接在浏览器的地址栏中输入:

``` html
data:text/html,<html><body><p><b>Hello, world!</b></p></body></html> 
```

在浏览器中输入以上的Url，会得到一个加粗的”Hello, world!”。也就是说，data:后面的数据直接用做网页的内容，而不是网页的地址。 简单的说，data类型的Url大致有下面几种形式：

```
data:,<文本数据> 
data:text/plain,<文本数据> 
data:text/html,<HTML代码> 
data:text/html;base64,<base64编码的HTML代码> 
data:text/css,<CSS代码> 
data:text/css;base64,<base64编码的CSS代码> 
data:text/javascript,<Javascript代码> 
data:text/javascript;base64,<base64编码的Javascript代码> 
data:image/gif;base64,base64编码的gif图片数据 
data:image/png;base64,base64编码的png图片数据 
data:image/jpeg;base64,base64编码的jpeg图片数据 
data:image/x-icon;base64,base64编码的icon图片数据 
```

因为Url是一种基于文本的协议，所以gif/png/jpeg这种二进制属于需要用base64进行编码。 换句话说，引入base64以后，就可以支持任意形式的数据格式。
可以在Html的Img对象中使用，例如：

``` html
<img src="data:image/x-icon;base64,AAABAAEAEBAAAAAAAABoBQAAF..." /> 
```

可以在Css的background-image属性中使用，例如：

``` css
div.image { 
    width:100px; 
    height:100px; 
    background-image:url(data:image/x-icon;base64,AAABAAEAEBAAAAAAAABoBQAAF...); 
} 
```

可以在Html的Css链接处使用，例如：

``` html
<link rel="stylesheet" type="text/css" href="data:text/css;base64,LyogKioqKiogVGVtcGxhdGUgKioq..." /> 
```

可以在Html的Javascript链接处使用，例如：

``` js
<script type="text/javascript" href="data:text/javascript;base64,dmFyIHNjT2JqMSA9IG5ldyBzY3Jv..."></script>
```

完整的语法定义在RFC中，完整的语法定义如下。

```
dataurl := "data:" [ mediatype ] [ ";base64" ] "," data 
mediatype := [ type "/" subtype ] *( ";" parameter ) 
data := *urlchar 
parameter := attribute "=" value 
```

urlchar指的就是一般url中允许的字符，有些字符需要转义，例如”=”要转义为”%3D”，不过我测试下来，至少在Firefox里面，不转义也是可以的。
parameter可以对mediatype进行属性的扩展，常见的是charset，用来定义编码格式，在多语言情况下需要用到。例如下面的例子：

```
data:text/plain;charset=UTF-8;base64,5L2g5aW977yM5Lit5paH77yB 
```

![图二](/images/pasted-1.png)