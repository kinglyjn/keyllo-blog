title: linux下编译和安装python3
author: kinglyjn
tags:
  - python
categories:
  - python
  - core
  - ''
date: 2019-01-19 16:21:00
---
Linux下大部分系统默认自带python2.x的版本，最常见的是python2.6或python2.7版本，默认的python被系统很多程序所依赖，比如centos下的yum就是python2写的，所以默认版本不要轻易删除，否则会有一些问题，如果需要使用最新的Python3那么我们可以编译安装源码包到独立目录，这和系统默认环境之间是没有任何影响的，python3和python2两个环境并存即可。

<!--more-->

## linux环境源码安装python3

### 下载源码包

首先去python官网下载python3的源码包，网址：`https://www.python.org/`，进去之后点击导航栏的Downloads，也可以鼠标放到Downloads上弹出菜单选择Source code，表示源码包，这里选择最新版本3.5.1，当然下面也有很多其他历史版本，点进去之后页面下方可以看到下载链接，包括源码包、Mac OSX安装包、Windows安装包。

![图1](/images/pasted-27.png)

这里选择第一个下载即可，下载的就是源码包：Python-3.5.1.tgz，下载好之后上传到linux系统，准备安装。

### 安装python3.6

默认安装路径为/usr/local，修改通过 ./configure 来配置。

``` bash
# 安装报错之缺失依赖库
[root@localhost Python-3.6.1]# ./configure 
checking build system type... x86_64-unknown-linux-gnu
checking host system type... x86_64-unknown-linux-gnu
checking for python3.6... no
checking for python3... no
checking for python... python
checking for --enable-universalsdk... no
checking for --with-universal-archs... no
checking MACHDEP... linux
checking for --without-gcc... no
checking for --with-icc... no
checking for gcc... no
checking for cc... no
checking for cl.exe... no
configure: error: in `/root/Python-3.6.1`:
configure: error: no acceptable C compiler found in $PATH
See `config.log` for more details

# 安装依赖库
[root@localhost Python-3.6.1]# yum install gcc

# 安装python3.6
[root@localhost Python-3.6.1]# make && make install

# make && make install 报错
zipimport.ZipImportError: cant decompress data; zlib not available
make: *** [install] Error 1

# 安装zlib-devel
[root@localhost Python-3.6.1]# yum install zlib-devel

# 重新安装
[root@localhost Python-3.6.1]# make && make install

# python3.6已安装成功（在/usr/local/bin下生成命令python3）
[root@localhost local]# ll /usr/local/bin/
total 24656
lrwxrwxrwx. 1 root root        8 Jun 25 11:22 2to3 -> 2to3-3.6
-rwxr-xr-x. 1 root root      101 Jun 25 11:22 2to3-3.6
-rwxr-xr-x. 1 root root      242 Jun 25 11:22 easy_install-3.6
lrwxrwxrwx. 1 root root        7 Jun 25 11:22 idle3 -> idle3.6
-rwxr-xr-x. 1 root root       99 Jun 25 11:22 idle3.6
-rwxr-xr-x. 1 root root      214 Jun 25 11:22 pip3
-rwxr-xr-x. 1 root root      214 Jun 25 11:22 pip3.6
lrwxrwxrwx. 1 root root        8 Jun 25 11:22 pydoc3 -> pydoc3.6
-rwxr-xr-x. 1 root root       84 Jun 25 11:22 pydoc3.6
lrwxrwxrwx. 1 root root        9 Jun 25 11:22 python3 -> python3.6
-rwxr-xr-x. 2 root root 12604536 Jun 25 11:21 python3.6
lrwxrwxrwx. 1 root root       17 Jun 25 11:22 python3.6-config -> python3.6m-config
-rwxr-xr-x. 2 root root 12604536 Jun 25 11:21 python3.6m
-rwxr-xr-x. 1 root root     3097 Jun 25 11:22 python3.6m-config
lrwxrwxrwx. 1 root root       16 Jun 25 11:22 python3-config -> python3.6-config
lrwxrwxrwx. 1 root root       10 Jun 25 11:22 pyvenv -> pyvenv-3.6
-rwxr-xr-x. 1 root root      441 Jun 25 11:22 pyvenv-3.6

# 查看版本
[root@localhost local]# python3 -V
Python 3.6.1    
[root@localhost local]# python3
Python 3.6.1 (default, Jun 25 2017, 11:20:12) 
[GCC 4.8.5 20150623 (Red Hat 4.8.5-11)] on linux
Type "help", "copyright", "credits" or "license" for more information.
```

`注1`：常见安装依赖库。

``` bash
yum -y install zlib zlib-devel
yum -y install bzip2 bzip2-devel
yum -y install ncurses ncurses-devel
yum -y install readline readline-devel
yum -y install openssl openssl-devel
yum -y install openssl-static
yum -y install xz lzma xz-devel
yum -y install sqlite sqlite-devel
yum -y install gdbm gdbm-devel
yum -y install tk tk-devel
yum -y install libffi libffi-devel
```

`注2`：关于configure。

``` bash
./configure --prefix=/usr/python --enable-shared CFLAGS=-fPIC
```

这里加上--enable-shared和-fPIC之后可以将python3的动态链接库编译出来，默认情况编译完lib下面只有python3.xm.a这样的文件，python本身可以正常使用，但是如果编译第三方库需要python接口的比如caffe等，则会报错；所以这里建议按照上面的方式配置，另外如果openssl不使用系统yum安装的，而是使用自己编译的比较新的版本可以使用--with-openssl=/usr/local/openssl这种方式指定，后面目录为openssl实际安装的目录，另外编译完还要将openssl的lib目录加入ld运行时目录中即可。

`注3`：将python3函数库加入到高速缓存中。<br>
安装完成之后要简单做一下配置：即将python库路径添加到/etc/ld.so.conf配置中，然后执行ldconfig生效；或者添加到$LD_LIBRARY_PATH中，这样在接下来运行python3是就不会报找不到库文件的错误了。

``` bash
$ ll /etc/ld.so.conf.d
-r--r--r--. 1 root root 63 3月   6 2015 kernel-3.10.0-229.el7.x86_64.conf
-rw-r--r--  1 root root 17 8月  16 23:05 mariadb-x86_64.conf

$ cat  /etc/ld.so.conf.d/mariadb-x86_64.conf
/usr/lib64/mysql

$ ll /usr/lib64/mysql
lrwxrwxrwx 1 root root      17 8月  28 14:58 libmysqlclient_r.so -> libmysqlclient.so
lrwxrwxrwx 1 root root      20 8月  28 14:58 libmysqlclient.so -> libmysqlclient.so.18
lrwxrwxrwx 1 root root      24 8月  28 14:56 libmysqlclient.so.18 -> libmysqlclient.so.18.0.0
-rwxr-xr-x 1 root root 3135712 8月  16 23:06 libmysqlclient.so.18.0.0
-rwxr-xr-x 1 root root    6758 8月  16 23:05 mysql_config
drwxr-xr-x 2 root root      52 8月  28 14:56 plugin
```

`注4`：设置python3的软连接。<br>
系统中原来的python在/usr/bin/python，通过ls -l可以看到，python是一个软链接，链接到本目录下的python2.7。这里不要把这个删除，不对原来默认的环境做任何修改，只新建一个python3的软链接即可，只是需要执行python3代码时python要改成python3，或者python脚本头部解释器要改为#!/usr/bin/python3。

``` bash
ln -s /usr/python/bin/python3 /usr/bin/python3
ln -s /usr/python/bin/pip3 /usr/bin/pip3
```
这样就建立好了，以后直接执行python3命令就可以调用python3了，执行pip3可以安装需要的python3模块；另外如果仔细看python安装目录下的bin目录，实际上python3也是个软链接，链接到python3.5.1，这样多次链接也是为了多个版本的管理更加方便。

## 安装ipython方式一

``` bash
# 下载安装包，请访问 https://pypi.org/ 搜索 ipython
$ wget https://pypi.python.org/packages/79/63/b671fc2bf0051739e87a7478a207bbeb45cfae3c328d38ccdd063d9e0074/ipython-6.1.0.tar.gz#md5=1e15e1ce3f3f722da6935d7ac0e51346

# 安装ipython
$ tar xf ipython-6.1.0.tar.gz
$ cd ipython-6.1.0
$ pwd
/root/ipython-6.1.0
$ python3 setup.py install

# 通过pip安装ipython所有缺失模块，直至ipython运行成功
$ ipython
Traceback (most recent call last):
  File "/usr/local/bin/ipython", line 4, in <module>
    from IPython import start_ipython
  File "/usr/local/lib/python3.6/site-packages/IPython/__init__.py", line 54, in <module>
    from .core.application import Application
  File "/usr/local/lib/python3.6/site-packages/IPython/core/application.py", line 23, in <module>
    from traitlets.config.application import Application, catch_config_error
ModuleNotFoundError: No module named 'traitlets'
# 运行ipython是提示缺少'traitlets'模块；
# 安装提示一步步通过pip安装缺失模块
$ pip3 install 'traitlets' 
$ pip3 install 'pygments' 
$ pip3 install 'pexpect'
$ pip3 install 'pickleshare'
$ pip3 install 'prompt_toolkit'
$ pip3 install prompt-toolkit==1.0.15
$ pip3 install 'simplegeneric'

# 重新运行ipython
$ ipython
Python 3.6.1 (default, Jan 19 2019, 16:28:00) 
Type 'copyright', 'credits' or 'license' for more information
IPython 6.1.0 -- An enhanced Interactive Python. Type '?' for help.
In [1]: 
```

## 安装ipython方式二

```bash
pip3 install ipython
```

## Eclipse PyDev搭建开发环境

### 安装PyDev插件

``` bash
# url
# http://pydev.org/updates
```

### 配置PyDev解释器

安装好pydev后， 需要配置Python解释器。

* 在Eclipse菜单栏中，点击Windows ->Preferences。 
* 在对话框中，点击pyDev->Interpreter - Python.  
* 点击New按钮，选择python.exe的路径, 打开后显示出一个包含很多复选框的窗口，点OK。如果是Mac系统，点击“Auto Config” 按钮。

<br>
参考：
[https://www.cnblogs.com/chengd/p/7078639.html](https://www.cnblogs.com/chengd/p/7078639.html) 
[http://www.cnblogs.com/freeweb/p/5181764.html](http://www.cnblogs.com/freeweb/p/5181764.html) 


