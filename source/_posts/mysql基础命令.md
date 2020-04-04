title: mysql基础命令
author: kinglyjn
tags:
  - mysql
categories:
  - database
  - mysql
date: 2019-01-03 20:09:00
---
### MySQL的权限管理（DCL）

<!--more-->

``` sql
--mysql涉及到的授权表
select * from mysql.user;
select * from mysql.tables_priv;
select * from mysql.columns_priv;

--显示当前的用户
select user();

--添加超级用户（DBA）
-- *.* 表示是所有的库，所有的表
-- keyllo@localhost表示用户名和允许用户登录使用的ip段
-- identified by 后面是用户登录所需的密码
-- with grant option 表示该用户还能给其他用户赋权
grant all privileges on *.* to keyllo@localhost identified by '123456' with grant option;

--添加普通用户
grant create,create temporary tables,update,execute,select,show view,usage,delete on test.* to keyllo2@localhost  identified by '123456' with grant option;

--使权限立即生效
flush privileges;

--收回用户的某些权限
revoke select,update on test.* from keyllo2@localhost;

--删除一个用户
drop user keyllo2@localhost;

--查看一个用户有哪些权限
show grants for root@localhost;
```

### MySQL数据的备份和恢复

``` sql
-- 数据备份
mysqldump -hlocalhost -uroot -p --all-databases > xxx/xxx.dump
mysqldump -hlocalhost -uroot -pxxx dbxxx > xxx/xxx.dump
mysqldump -hlocalhost -uroot -pxxx dbxxx tablexxx > xxx/xxx.dump

-- 数据还原
mysql -hlocalhost -uroot -p < xxx_all_databases.dump
mysql -hlocalhost -uroot -pxxx dbxxx < xxx/xxx.dump
mysql -hlocalhost -uroot -pxxx dbxxx < xxx/xxxexe.sql
mysql -hlocalhost -uroot -pxxx dbxxx -e "select * from tablexxx"

-- 通过可视化工具进行数据库的备份和恢复(导出和导入)
mysql_workbench | navicat | dbeaver | sqlyog
```

### MySQL常用DDL&DML

``` sql
--显示创建指令
show create database test;
show create table test.t_user;

--更改数据库的编码方式
alter database test CHARACTER SET = utf8;

--查看表、字段、索引
show tables from test;
show clumns from test.t_user;
show indexes from test.t_user;

--重命名--可能导致视图或者存储过程失效
rename table old_table_name to new_table_name;
alter table t_user change old_column_name new_column_name type;

--添加字段
alter table t_stu3 add pwd varchar(255) after name; --或者 first
--删除字段
alter table t_stu3 drop pwd, drop sex;
--修改字段
alter table t_stu3 modify stu_name varchar(20) not null after id;
alter table t_stu3 change stu_name sname varchar(20) not null after id;

--添加索引
alter table t_stu4 add index index_stu_name(stu_name);
alter table t_stu4 add constraint pk_stu4 primary key(id);
alter table t_stu4 add constraint fk_stu4_clazz4 foreign key(clazz_id) references t_clazz4(id) on delete restrict;
alert table t_stu4 add unique(name);
alter table t_stu3 alter column sex set default 3;

--删除索引
alter table t_stu3 drop index index_xxx;
alter table t_stu4 drop foreign key fk_stu4_clazz4;
alter table t_stu3 alter column sex drop default;

#插入记录
insert into t_clazz3(name) values('23班');
insert into t_clazz4 values(default, '23班');
insert into t_clazz4 set name='24班';
insert into t_clazz3(name) select name from t_clazz4;

#更新记录
update t_stu3 set name='keyllo', age=18 where id=1;

#删除记录
delete from t_stu3 where where id=1; --只删除数据
truncate table t_stu3; --除了删除数据，也删除索引等，可能主键id自增也会重置
drop table t_stu3;
```

