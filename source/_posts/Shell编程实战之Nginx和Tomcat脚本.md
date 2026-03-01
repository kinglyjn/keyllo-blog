title: Shell编程实战之Nginx和Tomcat脚本

author: kinglyjn

tags:

  - nginx
  - tomcat
  - shell

categories:

  - ops

  - linux

date: 2017-04-22 10:24:22

---



## 功能简介

Tomcat用于发布JSP Web页面，根据企业实际需求，会在单台服务器配置N个Tomcat实例，同时手动将Tomcat创建后的实例加入至Nginx虚拟主机中，同时重启Nginx,开发Nginx、Tomcat自动创建Tomcat实例及Nginx虚拟机管理脚本能大大减轻人工的干预，实现快速交付。<br>



本篇shell脚本实现Nginx自动安装、虚拟主机及自动将Tomcat加入虚拟机，实现思路如下：

1. 手动拷贝Tomcat与脚本一致的目录（可自行修改）；
2. 手动修改Tomcat端口为6001、7001、8001（可自行修改）；
3. 脚本指定参数为v1.example.com；
4. 创建v1.example.com Tomcat实例；
5. 修改Tomcat实例端口，保证Port唯一；
6. 将Tomcat实例加入Nginx虚拟

<br>



<!--more-->



## 具体实现

具体实现脚本如下：

```shell
#!/bin/bash

#Auto config Nginx and tomcat cluster

#By author falnet

#Define Path variables

NGINX_CONF="/usr/local/nginx/conf"

install_nginx(){

        NGINX_FILE=nginx-1.16.0.tar.gz

       NGINX_DIR='echo $NGINX_FILE|sed 's/.tar.*//g''

       wget -c http://nginx.org/download/$NGINX_FILE

       yum install pcre-devel pcre -y

       rm -rf $NGINX_DIR; tar xf $NGINX_FILE

      cd $NGINX_DIR; useradd www;  ./configure --user=www --group=www  --prefix=/usr/local/nginx2  --with-http_stub_status_module --with-http_ssl_module

      make && make install
      cd ../

}

install_tomcat(){

      JDK_FILE="jdk1.7.0_25.tar.gz"

      JDK_DIR='echo $JDK_FILE|sed 's/.tar.*//g''

      tar -xzf $JDK_FILE  ; mkdir -p /usr/java/ ; mv $JDK_DIR /usr/java/

      sed -i '/JAVA_HOME/d; /JAVA_BIN/d; /JAVA_OPTS/d' /etc/profile

      cat>> /etc/profile <<EOF

      export JAVA_HOME=/export/servers/$JAVA_DIR

      export JAVA_BIN=/export/servers/$JAVA_DIR/bin

      export PATH=\$JAVA_HOME/bin:\$PATH

      export CLASSPATH=.:\$JAVA_HOME/lib/dt.jar:\$JAVA_HOME/lib/tools.jar

      export JAVA_HOME JAVA_BIN PATH CLASSPATH

EOF

      source /etc/profile; java -version

      #install tomcat start 

     ls tomcat

}

config_tomcat_nginx(){

     #config tomcat nginx vhost

     grep " include domains" $NGINX_CONF/nginx.conf >>/dev/null 2>&1

     if [ $? -ne 0 ]; then

           sed -i '$d' $NGINX_CONF/nginx.conf

           echo -e "\n include domains/*; \n}" >>$NGINX_CONF/nginx.conf

           mkdir -p $NGINX_CONF/domains/

fi

VHOSTS=$1

NUM='ls /usr/local/|grep -c tomcat'

if [ $NUM -eq 0 ]; then

       cp -r tomcat /usr/local/tomcat_$VHOSTS

       cp -r xxx.example.com $NGINX_CONF/domains/$VHOSTS

       #sed -i "s/VHOSTS/$VHOSTS/g" $NGINX_CONF/domains/$VHOSTS

       sed -i "s/xxx/$VHOSTS/g" $NGINX_CONF/domains/$VHOSTS

       exit 0

fi

       #......................................................................................

       #VHOSTS=$1

       VHOSTS_NUM='ls $NGINX_CONF/domains/|grep -c $VHOSTS'

       SERVER_NUM='grep -c "127" $NGINX_CONF/domains/$VHOSTS'

       SERVER_NUM_1 ='expr $SERVER_NUM + 1'

       rm -rf /tmp/.port.txt

       for i in 'find /usr/local/ -maxdepth 1 - name "tomcat"'; do

       grep "port" $i/conf/server.xml | e grep -v "\--|8080||SSL Enabled"|awk '{print $2}'|sed 's/port=//g; s/\"//g'|sort -nr >>/tmp/.port.txt

      done

      MAX_PORT='cat /tmp/.port.txt|grep -v 8443|sort -nr|head -1'

      PORT_1='expr $MAX_PORT - 2000 + 1'

      PORT_2='expr $MAX_PORT - 1000 + 1'  

      PORT_3='expr $MAX_PORT + 1'

      if [ $VHOSTS_NUM -eq 1 ]; then

               read -p "The $VHOSTS is exists, You sure create mulit Tomcat for the $VHOSTS? yes or no " INPUT

               if [ $INPUT == "YES" -o $INPUT == "Y" -o $INPUT == "yes" ]; then

                     cp -r tomcat /usr/local/tomcat_${VHOSTS}_${SERVER_NUM_1}

                     sed -i "s/6001/$PORT_1/g"

/usr/local/tomcat_${VHOSTS}_${SERVER_NUM_1}/conf/server.xml

                      sed -i "s/7001/$PORT_2/g"

/usr/local/tomcat_${VHOSTS}_${SERVER_NUM_1}/conf/server.xml

                      sed -i "s/8001/$PORT_3/g"

/usr/local/tomcat_${VHOSTS}_${SERVER_NUM_1}/conf/server.xml

                      sed -i "/^upstream/a  server 127.0.0.1:${PORT_2} weight=1 max_fails=2 fail_timeout=30s; " $NGINX_CONF/domains/$VHOSTS

                      exit 0

            fi

           exit

     fi

    cp -r tomcat /usr/local/tomcat_$VHOSTS

          cp -r xxx.example.com $NGINX_CONF/domains/$VHOSTS

          sed -i "s/VHOSTS/$VHOSTS/g" $NGINX_CONF/domains/$VHOSTS

          sed -i "s/xxx/$VHOSTS/g" $NGINX_CONF/domains/$VHOSTS

     sed -i "s/7001/${PORT_2}/g" $NGINX_CONF/domains/$VHOSTS

     ##########config tomcat 

          sed -i "s/6001/$PORT_1/g" /usr/local/tomcat_${VHOSTS}/conf/server.xml

          sed -i "s/7001/$PORT_2/g" /usr/local/tomcat_${VHOSTS}/conf/server.xml

          sed -i "s/8001/$PORT_3/g" /usr/local/tomcat_${VHOSTS}/conf/server.xml

}

if [ ! -d $NGINX_CONF -o ! -d /usr/java/$JDK_DIR]; then

           install_nginx

           install_tomcat

fi

config_tomcat_nginx $1   

```

<br>


