title: Java I/O流的分类及常见输入/输出流
author: kinglyjn
tags:
  - io
categories:
  - java
  - io
date: 2018-09-14 10:05:00
---
## 概述

在程序运行的过程当中，JVM的内存中必然会存放很多数据，包括基本类型和对象类型。但是当程序结束，JVM关闭的时候，这些数据必然会随之消失。我们可能希望通过某种方式，让这些数据能够保存下来，以备再次使用。因此我们会把数据存入文件，或通过网络发送出去，或存入数据库。反之，我们当然也需要用某种方式，把保存的数据重新读回JVM。这些，都涉及到JVM与外部进行数据交换。将JVM中的数据写出去，我们称为数据的输出。反之，将数据读入JVM，我们称之为数据的输入。因此，Java中解决这部分问题的API被称为I/O。

<!--more-->

## File类

这个类在java.io包中，对于一个File对象来说，它能够代表硬盘上的一个文件或一个文件夹。

### 初识File类

1. File对象不仅能够代表一个文件，还能够代表一个文件夹
2. File对象是“代表”一个文件或者文件夹。怎么来理解“代表”两个字呢？
	* 首先，当我们创建一个File对象时，指的是在内存中分配了一块数据区域，也就是说，创建一个File对象并不会在系统中真的创建一个文件或者文件夹，而只是在JVM的内存中创建了一个对象。通过这个对象能够跟磁盘打交道，从而操作底层的文件。
    * 其次，既然File对象是“代表”磁盘中的文件，因此并不要求File对象所代表的文件或者文件夹在磁盘中一定存在。也就是说，File对象所代表的文件或者文件夹可能不存在。
3. File类的四个构造方法：
``` java
public File(String pathname);
public File(String parent, String child);
public File(File parent, String child);
public File(URI, uri);
```

需要注意的是，在创建File对象的时候，需要指定文件的路径，指定的时候，可以用绝对路径，也可以用相对路径。另外，要注意路径分隔符的问题。在Windows中，路径分隔符使用的是反斜杠“\”，而在Java中反斜杠是用来转义的，因此如果要使用反斜杠的话，必须使用“\”来表示一个反斜杠。例如，如果要表示D盘的abc目录，则在Java中的字符串应当这样写：”D:\abc”	另外，也可以用一个正斜杠用来做Windows中的路径分隔，这样就不需要转义。因此，也可以使用正斜杠的表示方式：”D:/abc”。

### File类的基本操作

``` java
// 创建新文件，若这个文件在系统中已经存在，createNewFile方法不会覆盖原有文件
public boolean createNewFile() throws IOException
// 创建文件夹，所不同的是mkdir()只能创建一层文件夹，而mkdirs可创建多层文件夹
public boolean mkdir()
public boolean mkdirs()
// 立刻删除File所代表的文件或文件夹
public boolean delete()
// 等程序退出后删除文件
public void deleteOnExit()
// 返回路径
public String grtPath() 
// 返回绝对路径
public String getAbsolutePath()
// getAbsolutePath和getCanonicalPath都会返回绝对路径
// 只不过，如果在路径中存在“.”以及“..”这两个符号的话，
// 则getCanonicalPath会修正路径，而不让返回值中存在“.”和“..”这两个符号
public String Canonicalpath() throws IOException 
// 返回文件名
public String getName()
// 返回所在的文件夹
public String getParent()
// 判断File对象表示的文件或文件夹是否存在
public boolean exists() 
// 判断File对象是否代表的时一个文件
public boolean isFile() 
// 判断File对象是否代表的是一个隐藏文件，隐藏的具体定义域系统有关
public boolean isHidden() 
// 判断File对象是否代表的是一个文件夹
public boolean isDirectory()
// 返回一个File数组，这个数组表示File对象所代表文件夹下的所有内容
public File[] listFiles()
```

简单测试：
``` java
public static void main(String[] args) {
	File f = new File("e:/proword");	
	try {
		System.out.println(f.getCanonicalPath());
	} catch (IOException e) {};
	System.out.println(f.getAbsolutePath());
	System.out.println();
	
	File[] fs = f.listFiles();
	for (int i =0; i < fs.length; i++) {
		System.out.println(fs[i].getName());
	}
}
```

## IO流

### 简介
    
对于Java来说，进行I/O操作需要使用“流”对象。所谓的流，指的是：`用来传输数据的对象`。例如，在生活中，电线就是一种流，这个对象用来传输电力；水管是一种流，这个对象是用来传输水；输油管也是流，用来传输石油，等等。

### 分类

按流的方向分：

* `输入流`
* `输出流`

所谓输入、输出的方向，都是相对于JVM而言的。所谓读取文件，指的是从硬盘中的文件里读取数据，然后这些数据就会传入JVM中。这个过程，就是数据从虚拟机的外部“进入”JVM的过程，这就是“输入”。而写文件，就是把JVM中的数据保存到文件中，是数据从JVM“输出”到文件中，这就是“输出”。

按数据单位分：

* `字节流`
* `字符流`

字节流传输的单位是字节，字符流传输的待为字符。
首先，对于任何系统中的所有文件来说，底层都是0和1组成的，这就是二进制的位（bit）的概念。而8个bit组成一个字节，这也就是计算机中处理数据的最小单位。换而言之，由于任何数据都是bit组成的，而我们可以每次都传输8个bit形成一个字节，也就是说，任何数据都可以按照字节的方式进行传输。因此，字节流可以用来传输任何一种文件类型，包括mp3、电影、图片、网页、文本……等等。	而系统中，有一种文件比较特殊：文本文件。这种文件大量存在于系统中，例如源代码、html源码、xml配置文件，等等。我们在进行I/O的时候可能会频繁跟文本文件打交道。字节流同样可以处理文本文件，但是会有一些小问题。例如，大部分中文的文本，一个汉字可能占用的空间不止一个字节。假设一个汉字需要占用两个字节的空间，如果要用字节流处理文本的话，就需要读入两个字节，然后再把这两个字节拼成一个完整的汉字。更有可能在传输错误的时候，产生只保存了“半个汉字”这种问题。为了解决这种问题，我们提供了字符流。字符流传输数据的单位是字符。这种流专门用于处理文本，能够方便的处理字符编码的问题。关于字符编码的问题，后续会详细介绍。

按照功能来分：

* `节点流`
* `过滤流`

节点流是指真正能够完成传输功能的流。
过滤流不能真正完成数据传输，它只是为其他流增强功能。如何来理解呢？在输电线中，真正能够传输电力的，是输电线中的金属丝，这就相当于节点流。而输电线往往会包一层绝缘的胶布，这层胶布并不能用来传输电力，而是为节点流增强功能（增加了绝缘保护的功能），这一层绝缘胶布就被称之为过滤流。在节点流和过滤流的设计上，I/O框架中使用了一种设计模式，这种设计模式被称为“装饰模式”。

### 常见字节流

`InputStream`、`FileInputStream`
`OutputStream`、`FileOutputStream`

字节流的特点是传输的数据单位是字节，也意味着字节流能够处理任何一种文件。
首先，介绍一下所有字节流的父类。所有输入字节流的父类是InputStream，所有输出字节流的父类是OutputStream，他们都处于java.io包下。要学习这两个类，就需要创建这两个类的对象。查阅JDK文档，我们可以知道这两个类都是抽象类，无法创建对象。因此，为了学习这两个类的用法，我们需要先获得这两个类的某个子类。我们将使用FileInputStream和FileOutputStream这两个类来学习InputStream和OutputStream。

#### FileInputStream

FileInputStream 是文件输入流，从功能上说，这是一个节点流，能够读取硬盘上的文件；而FileOutputStream是文件输出流，能够写出到文件。

FileInputStream 构造方法，最常用的是下面两种：
``` java
// 需要注意的是，FileInputStream在创建对象的时候，当要读取的文件不存在时，就会抛出异常：FileNotFoundException。由于这是一个已检查异常，因此必须要处理
FileInputStream(String filename) throws FileNotFoundException
FileInputString(File file) throws FileNotFoundException
```

FileInputStream还有一些值得注意的方法：
``` java
// 关闭文件流，释放资源。当我们结束输入时，应当调用此方法来关闭流
public void close() throws IOException 
// 每次从文件中读取一个字节，并把读到的内容返回容返回,当读到流末尾时，返回-1
// 虽然返回值是一个int类型，但是每次读文件时只读取一个字节，这个字节作为int四个字节中的最低位返回
public int read() throws IOException 
// 把读取到的数据放入bs数组中，一次调用尽量读取bs.length个字节   // 当读到流末尾时，返回-1，【返回值表示的是读到的字节数】   
public int read(byte[] bs) throws IOException 
//这个方法并没有使用整个bs数组来存放读到的数据，而是使用了数组的一部分
public int read(byte[] bs, int off, int len)
```

简单测试：
``` java
public static void main(String[] args) {
	FileInputStream fin = null;
	try {
		fin = new FileInputStream("xxx/test.txt");
		byte[] bs = new byte[5];
		int len = 0;
		while ((len=fin.read(bs)) != -1) {
			for (int i=0; i<len; i++) {
				System.out.print((char) bs[i]);
			}
		}
	} catch(IOException e) {
		e.printStackTrace();
	} finally {
		try {
			fin.close();
		} catch (IOException e) {
			e.printStackTrace();
		}
	}
}
```

#### FileOutputStream

常用构造方法：
``` java
public FileOutputStream(String path) throws FileNotFoundException
public FileOutputStream(File file) throws FileNotFoundException
public FileOutputStream(File file, boolean append) throws FileNotFoundException
```

常用操作方法：
``` java
//关闭流
close() 
//写出一个字节，每次只写入int类型中最后的那个字节
void write(int v) 
//写出一个byte数组
void write(byte[] bs) 
//数据内容从数组下标off的位置开始，写出len个字节
void write(byte[] bs, int off, int len) 
```

简单测试：
``` java
public static void main(String[] args) {
	FileOutputStream fos = null;
	
	try {
		fos = new FileOutputStream("xxx/test.txt", false);
		byte[] bs = "床前明月光\n".getBytes();
		fos.write(bs);
	} catch (IOException e) {
		e.printStackTrace();
	} finally {
		if (fos!=null) {
			try {
				fos.close();
			} catch (IOException e) {
				e.printStackTrace();
			}
		}
	}
	
}
```

运行这个代码之前，当前目录下并不存在test.txt文件。运行之后，在当前目录下产生test.txt文件，其中的内容为：Hello World。这也就提示我们：如果文件不存在，FileOutputStream会创建新文件。

### 常见过滤流

在学习过滤流的时候，关键的关键在于，一定要搞清楚过滤流增强了什么功能，以及在什么情况之下要使用过滤流的这种功能。

过滤流的使用分为四步：
1. 创建节点流：这个步骤是使用过滤流的先决条件，由于过滤流无法直接实现数据传输功能，因此必须现有一个节点流，才能够进行数据传输。
2. 封装过滤流：封装过滤流。所谓的“封装”，指的是创建过滤流的时候，必须以其他的流作为构造方法的参数。可以为一个节点流封装多个过滤流。
3. 读/写数据
4. 关闭外层流：关闭流的时候，只需要关闭最外层的过滤流即可，内层流会随着外层流的关闭而一起被关闭。

常见过滤流：
* DataInputStream / DataOutputStream
* ObjectInputSream / ObjectOutputStream
* BufferedInputStream / BufferedOutputStream
* BufferedReader / PrintWriter

#### DataInputStream/DataOutputStream

增强了读写八种基本类型和字符串的功能。
我们可以看一下DataOutputStream的方法：除了有OutputStream中有的几个write方法之外，还有writeBoolean, writeByte, writeShort … 等一系列方法，这些方法接受某一种基本类型，把基本类型写入到流中。
需要注意的是，有一个`writeInt(int n)`方法，这个方法接受一个int类型的参数。这个方法和`write(int v)`方法不同。writeInt方法是DataOutputStream特有的方法，这个方法一次写入参数n的四个字节。而write方法则一次写入参数v的最后一个字节。 与之对应的，DataInputStream的方法中，除了有几个read方法之外，还有readBoolean，readByte，readInt等一系列方法，这些方法能够读入若干个字节，然后拼成所需要的数据。例如readDouble方法，就会一次读入8个字节，然后把这8个字节拼接成一个double类型。 最后要提示的是，DataXXXStream中有readUTF和writeUTF这两个方法用来读写字符串，但是一般来说，我们读写字符串的时候几乎不使用Data流。Data流主要是用在8种基本类型的读写上。

``` java
// DataInputStream的唯一的构造方法
public DataInputStream(InputStream is) 
// DataOutputStream的唯一的构造方法
public DtaInputStream(OutputStream os) 
```
过滤流的构造方法中参数表示的是过滤流为哪个流增强功能

简单测试：
``` java
public static void main(String[] args) throws IOException {
	FileOutputStream fout = new FileOutputStream("xxx/test.data");
	DataOutputStream dout = new DataOutputStream(fout);
	dout.writeDouble(3.14);
	dout.writeInt(12);
	dout.close();
	
	FileInputStream fin = new FileInputStream("xxx/test.data");
	DataInputStream din = new DataInputStream(fin);
	double pi = din.readDouble(); //注意顺序
	int i = din.readInt();
	din.close();
	System.out.println(pi);
	System.out.println(i);
}
```

#### ObjectInputSream/ObjectOutputStream

这两个流增强的功能如下：

1. 增强了缓冲区功能
2. 增强了读写八种基本类型和字符串的功能。读写基本类型和字符串的方式，与Data流完全一样
3. 增强了读写对象的功能，这是这两个流最主要的作用

在ObjectInputStream类有一个`readObject`方法，这个方法能够从流中读取一个对象；而ObjectOutputStream类中有一个`writeObject`方法，这个方法能够向流中写入一个对象。
如上所述，ObjectInputStream和ObjectOutputStream能够完成对对象的读写。这种把对象放到流上进行传输的过程，称之为“`对象序列化`”。一个对象如果能够放到流上进行传输，则我们称这个对象是“可序列化”的。

##### Serializable`接口和`transient`关键字`：

需要注意的是，并不是所有对象都是“可序列化”的。举个例子说，搬家就是一个传输对象的过程。然而，搬家的时候并不是所有对象都能够搬走的。例如，家具、电器，这些对象往往在搬家的时候是能够搬走的，但是，门、窗户、地板，这些对象无法搬走。那我们可以说家具、电器是可序列化的对象，而窗户、地板是不可序列化的对象。

那怎么让对象能够在流上进行传输呢？如果要让一个类成为可序列化的，只要让这个类实现一个接口：java.io.Serializable接口即可。要实现这个接口，就要实现这个接口中的所有方法。好了，现在请去查一下Serializable接口，看看这个接口中定义了哪些方法？让你惊讶吧，这个接口中没有任何的方法。也就是说，如果要实现这个Serializable接口，只需要写上implements Serializable就可以了。

另外，在使用对象序列化的时候，注意这样两个问题：

1. 不要使用追加的方式写对象。也就是说，如果我们创建一个文件输出流采用FileOutputStream(file, true)的方式创建节点流，然后再在外面封装ObjectOutputStream，这样将无法完成我们设想的结果。如果对一个文件多次写入的话，读取对象的时候只能读取第一次写入的对象，而后面用追加的方式写入的对象将无法被读取。这是对象序列化底层机制所决定的。
2. 如果一个对象的属性又是一个对象，则要求这个属性对象也实现了Serializable接口，如果一个对象的属性是一个集合，则要求集合中所有对象都实现Serializable接口。除非这个对象的属性被标记为transient，不参与序列化。

这就是最基本的对象序列化的内容。关于对象序列化的更多内容，可以参考Oracle公司的网站以及相关文档。

简单测试：
``` java
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.io.Serializable;

public class FileTest {
	public static void main(String[] args) throws IOException, ClassNotFoundException {
		ObjectOutputStream oos = new ObjectOutputStream(new FileOutputStream("xxx/test.obj"));
		oos.writeObject(new Student("张三", 25));
		oos.writeObject(new Student("小娟", 23));
		oos.close();
	
		ObjectInputStream ois = new ObjectInputStream(new FileInputStream("xxx/test.obj"));
		Student stu1 = (Student) ois.readObject();
		Student stu2 = (Student) ois.readObject();
		ois.close();
		System.out.println(stu1);
		System.out.println(stu2);
	}
}

class Student implements Serializable {
	private static final long serialVersionUID = 1L;
	private String name;
    // 加了trancient关键字，表示属性age不参与序列化
	private transient int age; 
	
	public Student() {
		super();
	}
	public Student(String name, int age) {
		super();
		this.name = name;
		this.age = age;
	}
	
	public String getName() {
		return name;
	}
	public void setName(String name) {
		this.name = name;
	}
	public int getAge() {
		return age;
	}
	public void setAge(int age) {
		this.age = age;
	}
	
	@Override
	public String toString() {
		return "Student [name=" + name 
        + ", age=" + age + "]";
	}
}

//运行结果：
Student [name=张三, age=0]
Student [name=小娟, age=0]
```

#### BufferedInputStream/BufferedOutputStream

这两个流增强了缓冲区的功能。

``` java
public static void main(String[] args) throws IOException {
	BufferedOutputStream bos = new BufferedOutputStream(new FileOutputStream("xxx/test.txt"));
	bos.write("床前明月光\n".getBytes());
	bos.flush();
	bos.close();
}
```

需要注意的是，如果把bout.close()方法去掉，此时在看test.txt文件，会发现文件的内容为空。这是因为，我们在调用write方法的时候，其实并没有真正把数据写入到文件中，而只是把数据写入到缓冲区中。那什么时候缓冲区中的数据会真正写入到文件中呢？有三种情况：第一种情况是`缓冲区已满`，第二种情况是`调用close方法`。除了这两种情况之外，假设程序员希望在缓冲区没有满并且不关闭流的情况下，把缓冲区内的东西真正写入流中，应当调用一个方法：`flush()`。这个方法用来清空缓冲区，往往用在输出流上面。当一个带缓冲的输出流调用flush()之后，就能保证之前在缓冲区中的内容真正进行了I/O操作，而不是仅仅停留在缓冲区。

### 字符流及字符流的增强

#### 字符编码的概念

要理解字符流，首先要理解字符编码的含义。
计算机中显示文字的时候，本质上是在屏幕上绘制一些图像用来显示文字。从这个意义上说，文字就是一种特殊的图片。	然而，在计算机中保存文字的时候，并不是按照图片的方式保存。当保存文件的时候，计算机底层会把文字转换成数字，然后再进行保存。计算机把字符转换为数字的过程，称之为“编码”。而读取文件的时候，则过程相反，计算机会把数字转化为文字，并绘制到屏幕上。计算机把数字转换为字符的过程，称之为“解码”。
很显然，不同的字符必须对应不同的数字，不然，在解码时会遇到问题。那么，什么字符对应于什么数字呢？有些标准化组织，会规定字符和数字之间的对应关系，这种对应关系就是所谓的编码规范。

常见的编码规范如下：

* `ASCII`: 最早的编码方式，规定了英文字母和英文标点对应的编码
* `ISO-8859-1`: 这种编码方式包括了所有的西欧字符以及西欧标点
* `GB2312/GBK`: 大陆广泛使用的简体中文编码。其中，GB2312是GBK的一个子集，GBK是简体中文Windows的默认编码方式
* `Big5`: 台湾地区广泛使用的繁体中文编码。
* `UTF-8`：一种国际通用编码，包括简体和繁体中文。与GB2312/GBK不兼容。大部分简体中文Linux使用的是UTF-8编码

``` java
public static void main(String[] args) 
        throws UnsupportedEncodingException {
	String str = "你好，张三!";
	//编码
	byte[] bs = str.getBytes("GBK");
	for (byte b : bs) { //-60-29-70-61-93-84-43-59-56-333
		System.out.print(b);
	}
	System.out.println();
	//解码
	System.out.println(new String(bs, "GBK")); //你好，张三!
}
```

由于编码方式的不一致，导致了传输文本的时候会有一些比较棘手的问题。为了让传输文本文件更加方便，我们使用字符流。	

#### 字节流的父类 Reader/Writer 及 FileReader/FileWriter

所有输入字符流的父类是`Reader`，所有输出字符流的父类是`Writer`。与InputStream和OutputStream类似，这两个类也是抽象类。 此外，与FileInputStream以及FileOutputStream类似，有两个类`FileReader`和`FileWriter`，这两个类分别表示文件输入字符流和文件输出字符流。这两个流的使用与FileInputStream以及FileOutputStream也非常雷同，在此不多介绍，需要注意的是，使用这两个流的时候，无法指定编解码方式。

``` java
public static void main(String[] args) 
		throws IOException {
	FileWriter fos = new FileWriter("/Users/zhangqingli/Desktop/test.txt");
	fos.write("床前明月光\n");
	fos.flush();
	fos.close();
}
```

#### InputStreamReader/OutputStreamWriter 和桥转换

下面，我们介绍两个流：`InputStreamReader`和`OutputStreamWriter`。

InputStreamReader这个类本身是Reader类的子类，因此这个类的对象是一个字符流。而这个流的构造方法如下：

``` java
// 接受字一个节流作为参数创建字符流
public InputStreamReader(InputStream in) 
// 创建使用指定字符集的InputStreamReader
public InputSreamReader(InputStream in, String charsetName) throws UnsupportedEncodingException

// 创建使用给定字符集的InputStreamReader
public InputStreamReader(InputStream in, Charset cs) 
// 创建给定字符集解码器的InputStreamReader
public InputStreamReader(InputStream in, CharsetDocoder doc) 
```

可以看到，这个流所有构造方法，都可以接受一个InputStream类型的参数。也就是说，通过这个流，可以接受一个字节流作为参数，创建一个字符流。这个对象就起到了字节流向字符流转换的功能，我们往往称之为：`桥转换`。

类似的，OutputStreamWriter类能够把一个输出字节流转换为一个输出字符流。在桥转换的过程中，我们还可以指定编解码方式。如果不指定的话，则编码方式采用系统默认的编码方式。

#### 常用字符流的增强 BufferedReader/PrintWriter

介绍完如何获得字符流之后，下面单刀直入，介绍两个最常用的字符过滤流：读入使用`BufferedReader`，写出使用`PrintWriter`。

顾名思义，`BufferedReader` 提供了缓冲区功能。但是更重要的是，BufferedReader中有一个`readLine()`方法，签名如下：
``` java
public String readLine()
```
这个方法也很容易理解：每次读入一行文本，并把读入的这一行文本当做返回值返回。当读到流末尾时，返回一个null值。下面给出一个示例代码，介绍BufferedReader的使用。首先在当前目录下准备一个文本文件，文本文件中保存一段文字。如下：
``` java
public static void main(String[] args) 
		throws IOException {
	BufferedReader br = new BufferedReader(new InputStreamReader(new FileInputStream("xxx/test.txt"), "utf-8"));
	String line = null;
	while ((line=br.readLine()) != null) {
		System.out.println(line);
	}
	br.close();
}
```

`PrintWriter`是一个很特殊的类
首先，PrintWriter可以作为一个过滤流。这个流可以接受一个Writer作为参数。增强了如下一些功能：

1. 缓冲区的功能。因此使用PrintWriter应当及时关闭或刷新
2. 写八种基本类型和字符串的功能
3. 写对象的功能

PrintWriter类的一些特点：
1. 在PrintWriter类中，有`一系列print`方法，这些方法能够接受八种基本类型、字符串和对象。同样的，还有`一系列println`方法，这些方法在写入数据之后，会在数据后面写入一个换行符。
2. 要注意的是，PrintWriter写基本类型的方式，是把基本类型`转换为字符串`再写入流中，与Data流不同。举例来说，对于3.14这个double类型的数，Data流会把这个数拆分成8个字节写入文件，而PrintWriter会把这个数字转化为字符串“3.14”，写入文件中。
3. 此外，PrintWriter写对象的时候，`写入的是对象的toString()方法返回值`，与对象序列化有本质区别。
4. PrintWriter除了可以作为过滤流之外，还可以作为节点流。PrintWriter类的构造方法中，可以直接接受一个文件名或File对象作为参数，直接获得一个输出到文件的PrintWriter。当然，编码方式采用的是系统默认的编码方式。
5. 最后，PrintWriter的构造方法可以接受一个InputStream，也就是说，可以使用PrintWriter进行桥转换。只不过使用PrintWriter进行桥转换的时候，无法指定编码方式，采用的是系统默认的编码方式。

简单测试：
``` java
public static void main(String[] args) 
		throws IOException {
	PrintWriter pw = new PrintWriter(new OutputStreamWriter(new FileOutputStream("xxx/test.txt", true), "utf-8"));
	pw.println("咋啦哥们，让人煮了？");
	pw.println("感冒啦，正发烧呢！");
	pw.close();
}
```


## 综合测试

``` java
package iotest;
import java.io.BufferedOutputStream;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.io.PushbackInputStream;
import java.io.SequenceInputStream;
import java.io.Serializable;
import java.util.Enumeration;
import java.util.Vector;

/*
 字节流：
 	InputStream
 		FileInputStream
 		FileterIputStream
 			BufferedInputStream
 			DataInputStream
 			PushbackInputStream
 		ObjectInputStream
 		PipedInputStream
 		SequenceInputStream
 		StringBufferInputStream
 		ByteArrayInputStream
 	OutputStream
 		FileOutputStream
 		FilterOutPutStream
 			BufferedOutputStream
 			DataOutputStream
 			PrintStream
 		ObjectOutputStream
 		PipedOutputStream
 		ByteArrayOutputStream
 		
 字符流：
 	Reader
 		BufferedReader
 		InputStreamReader
 			FileReader
 		StringReader
 		PipedReader
 		ByteArrayReader
 		FilterReader
 			PushbackReader
 	Writer
 		BufferedWriter
 		OutputStreamWriter
 			FileWriter
 		PrintWriter
 		StringWriter
 		PipedWriter
 		CharArrayWriter
 		FilterWriter
 */

public class IOTest {
	
	/**
	 * 字节流
	 */
	//一次读取1或n个字符
	public static int getFileSize(File file) {
		int count = 0;
		InputStream is = null;
		try {
			/*is = new FileInputStream(file);
			while (is.read()!=-1) {
				count++;
			}*/
			is = new FileInputStream(file);
			byte[] bs = new byte[100];
			int n = 0;
			while ((n=is.read(bs)) != -1) {
				count+=n;
			}
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			if (is != null) {
				try {
					is.close();
				} catch (IOException e) {
					e.printStackTrace();
				}
			}
		}
		return count;
	}
	
	//复制文件
	public static void copyFile(File srcFile, File disFile) {
		FileInputStream fin = null;
		FileOutputStream fos = null;
		try {
			fin = new FileInputStream(srcFile);
			fos = new FileOutputStream(disFile);
			byte[] bs = new byte[1024];
			int len = 0;
			while ((len=fin.read(bs)) != -1) {
				fos.write(bs, 0, len);
			}
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				fos.close();
				fin.close();
			} catch (IOException e) {
				e.printStackTrace();
			}
		}
	}
	
	//读写对象
	public static void writeAndReadObjectTest(File file) {
		ObjectOutputStream oos = null;
		ObjectInputStream ois = null;
		try {
			oos = new ObjectOutputStream(new FileOutputStream(file));
			oos.writeObject(new Student("张三", 23));
			oos.writeObject(new Student("小娟", 20));
			oos.flush();
			
			ois = new ObjectInputStream(new FileInputStream(file));
			for (int i = 0; i < 2; i++) {
				Student student = (Student) ois.readObject();
				System.out.println(student);
			}
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				oos.close();
				ois.close();
			} catch (IOException e) {
				e.printStackTrace();
			}
		}
	}
	
	//回退字节流
	public static void pushbackTest() {
		PushbackInputStream pis = null;
		try {
			String str = "hello,world,haha!";
			pis = new PushbackInputStream(new ByteArrayInputStream(str.getBytes()));
			int ch = 0;
			while ((ch=pis.read()) != -1) {
				if (ch==',') { //判断读取的是否是逗号  
					pis.unread(ch);
					ch = pis.read();
					System.out.println("(回退"+ (char)ch +")");
				} else {
					System.out.println((char)ch);
				}
			}
		} catch (IOException e) {
			e.printStackTrace();
		} finally {
			try {
				pis.close();
			} catch (IOException e) {
				e.printStackTrace();
			}
		}
	}
	
	//合并多个输入流
	public static void sequenceIsTest() {
		SequenceInputStream sis = null;
		BufferedOutputStream bos = null;
		try {
			// 构建流集合
			Vector<InputStream> vector = new Vector<InputStream>();
			vector.add(new FileInputStream(new File("/Users/zhangqingli/Desktop/log.txt")));
			vector.add(new FileInputStream(new File("/Users/zhangqingli/Desktop/log2.txt")));
			vector.add(new FileInputStream(new File("/Users/zhangqingli/Desktop/log3.txt")));
			Enumeration<InputStream> es = vector.elements();
			sis = new SequenceInputStream(es);
			
			bos = new BufferedOutputStream(new FileOutputStream(new File("/Users/zhangqingli/Desktop/log4.txt")));
			byte[] bs = new byte[1024];
			int len = 0;
			while ((len=sis.read(bs)) != -1) {
				bos.write(bs, 0, len);
				bos.flush();
			}
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				bos.close();
				sis.close();
			} catch (IOException e) {
				e.printStackTrace();
			}
		}
	}
	
	
	public static void main(String[] args) {
		//System.out.println(getFileSize(new File("/Users/zhangqingli/Desktop/log.txt")));
		//copyFile(new File("/Users/zhangqingli/Desktop/log.txt"), new File("/Users/zhangqingli/Desktop/log2.txt"));
		//writeAndReadObjectTest(new File("/Users/zhangqingli/Desktop/log.txt"));
		//pushbackTest();
		//sequenceIsTest();
	}
}

class Student implements Serializable {
	private static final long serialVersionUID = 1L;
	public String name;
	public transient int age;
	public Student(String name, int age) {
		this.name = name;
		this.age = age;
	}
	@Override
	public String toString() {
		return "Student [name=" + name + ", age=" + age + "]";
	}
}
```