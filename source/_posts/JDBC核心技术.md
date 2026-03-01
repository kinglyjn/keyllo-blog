title: JDBC核心技术
author: kinglyjn
tags:

  - java
  - jdbc

categories:
  - java
  - mvcx

date: 2020-08-22 12:19:19

---



## JDBC概述

### 数据的持久化

持久化(persistence):

把数据保存到可掉电式存储设备中以供之后使用。大多数情况下，特别是企业级应用，数据持久化意味着将内存中的数据保存到硬盘上加以”固化”，而持久化的实现过程大多通过各种关系数据库来完成。持久化的主要应用是将内存中的数据存储在关系型数据库中，当然也可以存储在磁盘文件、XML数据文件中。在Java中，数据库存取技术可分为如下几类:

* JDBC直接访问数据库
* JDO (Java Data Object )技术
* 第三方O/R工具，如Hibernate, Mybatis 等

JDBC是java访问数据库的基石，JDO、Hibernate、MyBatis等只是更好的封装了JDBC。

<br>



<!--more-->



### JDBC介绍

JDBC(Java Database Connectivity) 是一个独立于特定数据库管理系统、通用的SQL数据库存取和操作的公共接 口(一组API)，定义了用来访问数据库的标准Java类库，(java.sql,javax.sql)使用这些类库可以以一种标 准的方法、方便地访问数据库资源。

* JDBC为访问不同的数据库提供了一种统一的途径，为开发者屏蔽了一些细节问题。
* JDBC的目标是使Java程序员使用JDBC可以连接任何提供了JDBC驱动程序的数据库系统，这样就使得程序员无需 对特定的数据库系统的特点有过多的了解，从而大大简化和加快了开发过程。

![image-20200822132856920](/images/image-20200822132856920.png)



### JDBC体系结构

JDBC是sun公司提供一套用于数据库操作的接口，java程序员只需要面向这套接口编程即可。 不同的数据库厂商，需要针对这套接口，提供不同实现。不同的实现的集合，即为不同数据库的驱动（面向接口编程）。

JDBC接口(API)包括两个层次:

* 面向应用的API:Java API，抽象接口，供应用程序开发人员使用(连接数据库，执行SQL语句，获得结 果)。
* 面向数据库的API:Java Driver API，供开发商开发数据库驱动程序用。

<br>



### JDBC程序编写步骤

![image-20200822133504139](/images/image-20200822133504139.png)

<br>



## 获取数据库连接

### Driver接口介绍

java.sql.Driver 接口是所有 JDBC 驱动程序需要实现的接口。这个接口是提供给数据库厂商使用的，不同数据库

厂商提供不同的实现。在程序中不需要直接去访问实现了 Driver 接口的类，而是由驱动程序管理器类(java.sql.DriverManager)去调用这些Driver实现。

* Oracle的驱动: oracle.jdbc.driver.OracleDriver
* mySql的驱动: com.mysql.jdbc.Driver（mysql6以上版本为 com.mysql.cj.jdbc.Driver）
* postgreSQL的驱动：org.postgresql.Driver

<br>



### 数据库连接方式举例

```java
String driver = "com.mysql.cj.jdbc.Driver";
String url = "jdbc:mysql://host-rdbms:3306/test01?serverTimezone=GMT%2B8";
String user = "xxx";
String password = "xxx";

// 方式1
public static void getConn1() throws Exception {
  Driver driver = new com.mysql.cj.jdbc.Driver();
  Properties props = new Properties();
  props.setProperty("user", user);
  props.setProperty("password", password);

  Connection conn = driver.connect(url, props);
  System.out.println(conn);
}

// 方式2
public static void getConn2() throws Exception {
  Properties props = new Properties();
  props.setProperty("user", user);
  props.setProperty("password", password);

  Class<?> clazz = Class.forName(driver);
  Connection conn = ((Driver) clazz.newInstance()).connect(url, props);
  System.out.println(conn);
}

// 方式3
public static void getConn3() throws Exception {
  Class<?> clazz = Class.forName(driver);
  DriverManager.registerDriver((Driver) clazz.newInstance());
  Connection conn = DriverManager.getConnection(url, user, password);
  System.out.println(conn);
}

// 方式4
public static void getConn3() throws Exception {
  Class.forName(driver);
  Connection conn = DriverManager.getConnection(url, user, password);
  System.out.println(conn);
}

// 【注】DriverManager.registerDriver(driver) 可以省略的原因是因为在mysql的Driver类中声明有
public class Driver extends NonRegisteringDriver implements java.sql.Driver {
    // Register ourselves with the DriverManager
    static {
        try {
            java.sql.DriverManager.registerDriver(new Driver());
        } catch (SQLException E) {
            throw new RuntimeException("Can't register driver!");
        }
    } 
    ...
}
```

<br>



## 使用 PrepareStatement 实现 CURD


### 操作和访问数据库

数据库连接被用于向数据库服务器发送命令和 SQL 语句，并接受数据库服务器返回的结果。其实一个数据库连 接就是一个Socket连接。在 java.sql 包中有 3 个接口分别定义了对数据库的调用的不同方式:

* Statement: 用于执行静态 SQL语句并返回它所生成结果的对象。
* PrepatedStatement: SQL语句被预编译并存储在此对象中，可以使用此对象多次高效地执行该语句。
* CallableStatement: 用于执行 SQL 存储过程



![image-20200822163932822](/images/image-20200822163932822.png)

<br>



### 使用Statement操作数据表的弊端

通过调用 Connection 对象的 createStatement() 方法创建该对象。该对象用于执行静态的 SQL 语句，并且返回执行结果。Statement 接口中定义了下列方法用于执行 SQL 语句:

```java
int excuteUpdate(String sql)        //执行更新操作INSERT、UPDATE、DELETE
ResultSet executeQuery(String sql)  //执行查询操作SELECT
```

但是使用Statement操作数据表存在弊端:

* 问题一:存在拼串操作，繁琐
* 问题二:存在SQL注入问题，对于 Java 而言，要防范 SQL 注入，只要用 PreparedStatement(从Statement扩展而来) 取代 Statement 就可 以了。



> 注：SQL 注入是利用某些系统没有对用户输入的数据进行充分的检查，而在用户输入数据中注入非法的 SQL 语句段 或命令(如:SELECT user, password FROM user_table WHERE user='a' OR 1 = ' AND password = ' OR '1' = '1') ，从而利用系统的 SQL 引擎完成恶意行为的做法。



Statement测试代码：

``` java
public static void main(String[] args) throws ClassNotFoundException, SQLException {
  Connection conn = getConn();
  String sql = "select dept_id, dept_name, leader, phone, create_time from sys_dept";

  Statement stmt = conn.createStatement();
  ResultSet rs = stmt.executeQuery(sql);
  ResultSetMetaData rsMeta = rs.getMetaData();
  int columnCount = rsMeta.getColumnCount();
  while (rs.next()) {
    for (int i = 0; i < columnCount; i++) {
      // 1. 获取列的别名
      String columnName = rsMeta.getColumnLabel(i+1);
      // 2. 根据列名获取对应数据表中的数据
      Object columnValue = rs.getObject(columnName);
      System.out.println(columnName + ": " + columnValue);
    }
    System.out.println("--------");
  }

  rs.close();
  stmt.close();
  conn.close();
}
```

<br>



### PreparedStatement的优点

PreparedStatement 接口是 Statement 的子接口，它表示一条预编译过的 SQL 语句，与 Statement 相比，具有如下优点：

* 代码的可读性和可维护性更好
* PreparedStatement 能最大可能提高性能:
  * DBServer会对`预编译`语句提供性能优化。因为预编译语句有可能被重复调用，所以语句在被DBServer的 编译器编译后的执行代码被缓存下来，那么下次调用时只要是相同的预编译语句就不需要编译，只要将参 数直接传入编译过的语句执行代码中就会得到执行（批量操作效率较高）。
  * 在statement语句中,即使是相同操作但因为数据内容不一样,所以整个语句本身不能匹配,没有缓存语句的意 义.事实是没有数据库会对普通语句编译后的执行代码缓存。这样每执行一次都要对传入的语句编译一次。（语法检查，语义检查，翻译成二进制命令，缓存）
* PreparedStatement 可以`防止 SQL 注入`
* PreparedStatement 可以对` Blob 类型的字段`进操作，而Statement是做不到的

<br>



### Java与SQL对应数据类型转换表

| Java类型           | SQL类型                                                      |
| ------------------ | ------------------------------------------------------------ |
| boolean            | BIT                                                          |
| byte               | TINYINT                                                      |
| short              | SMALLINT                                                     |
| int                | INTEGER                                                      |
| long               | BIGINT                                                       |
| float              | FLOAT                                                        |
| double             | DOUBLE                                                       |
| BigDecimal         | DECIMAL                                                      |
| String             | CHAR, VARCHAR, LONG VARCHAR, TEXT                            |
| java.sql.Date      | DATE                                                         |
| java.sql.Time      | TIME                                                         |
| java.sql.Timestamp | TIMESTAMP                                                    |
| java.sql.Timestamp | DATETIME                                                     |
| byte[]             | BINARY, VAR BINARY,  TINYBLOB【255】, BLOB【65K】, MediumBlob【16M】, LongBlob【4G】 |

<br>



### PreparedStatement实现增删改查

增删改

```java
public static int executeUpdate(String sql, Object ... args) {
    Connection conn = null;
    PreparedStatement ps = null;
    int result = 0;
    try {
        conn = JDBCUtils.getConnection();
        ps = conn.prepareStatement(sql);
        for (int i = 0; i < args.length; i++) { // 填充占位符
            ps.setObject(i + 1, args[i]);
        }
        result = ps.executeUpdate();
    } catch (Exception e) {
        e.printStackTrace();
    } finally {
        JDBCUtils.closeResourse(conn, ps,null);
    }
    return result;
}
```

注：几种方法的比较

* `executeQuery`：用于产生单个结果集（ResultSet）的语句，例如 SELECT 语句。 被使用最多的执行 SQL 语句的方法。这个方法被用来执行 SELECT 语句，它几乎是使用最多的 SQL 语句。但也只能执行查询语句，执行后返回代表查询结果的ResultSet对象。
* `executeUpdate`：用于执行 INSERT、UPDATE 或 DELETE 语句以及 SQL DDL（数据定义语言）语句，例如 CREATE TABLE 和 DROP TABLE。INSERT、UPDATE 或 DELETE 语句的效果是修改表中零行或多行中的一列或多列。executeUpdate 的返回值是一个整数（int），指示受影响的行数（即更新计数）。对于 CREATE TABLE 或 DROP TABLE 等不操作行的语句，executeUpdate 的返回值总为零。
* `execute`：可用于执行任何SQL语句，返回一个boolean值，表明执行该SQL语句是否返回了ResultSet。如果执行后第一个结果是ResultSet，则返回true，否则返回false。但它执行SQL语句时比较麻烦，通常我们没有必要使用execute方法来执行SQL语句，而是使用executeQuery或executeUpdate更适合，但如果在不清楚SQL语句的类型时则只能使用execute方法来执行该SQL语句了。

<br>

查：

```java
public static void executeQuery(String sql, Object ... args) {
    Connection conn = null;
    PreparedStatement ps = null;
    ResultSet rs = null;
    try {
        conn = JDBCUtils.getConnection();	
        ps = conn.prepareStatement(sql);
        for (int i = 0; i < args.length; i++) {
           ps.setObject(i+1, args[i]);
        }
        rs = ps.executeQuery();
        ResultSetMetaData rsMeta = rs.getMetaData();
        int columnCount = rsMeta.getColumnCount();
        while (rs.next()) {
            for (int i = 0; i < columnCount; i++) {
                // 1. 获取列的数据类型和别名
                int columnType = rsMeta.getColumnType(i + 1);
                String columnName = rsMeta.getColumnLabel(i+1);
                // 2. 根据列名获取对应数据表中的数据及类型
                Object columnValue = rs.getObject(columnName);
                String columnJavaType = columnValue==null ? "null" : columnValue.getClass().getSimpleName().toLowerCase();
                System.out.println("[" + columnType + "]" + columnName + " = [" + columnJavaType + "]" + columnValue);
            }
            System.out.println("--------");
        }
    } catch (Exception e) {
        e.printStackTrace();
    } finally {
        JDBCUtils.closeResourse(conn,ps, rs);
    }
}

public static void main(String[] args) {
    String sql = "select * from t_user where id < ?";
    executeQuery(sql, 10);
}
```

<br>



### PreparedStatement实现高效的批量插入

当需要成批插入或者更新记录时，可以采用Java的批量更新机制，这一机制允许多条语句一次性提交给数据库批量处 理。通常情况下比单独提交处理更有效率。JDBC的批量处理语句包括下面三个方法:

* addBatch(String):添加需要批量处理的SQL语句或是参数;
* executeBatch():执行批量处理语句;
* clearBatch():清空缓存的数据

通常我们会遇到两种批量执行SQL语句的情况:

* 多条SQL语句的批量处理;
* 一个SQL语句的批量传参;



批量插入（方式一）：

```java
public static void executeBatch01() {
    Connection conn = null;
    PreparedStatement ps = null;
    try {
        conn = JDBCUtils.getConnection();
        ps = conn.prepareStatement("insert into t_user(username, password) values(?, ?)");
        for (int i = 0; i < 10; i++) {
            ps.setObject(1,"username_" + i);
            ps.setObject(2,"password_" + i);
            ps.executeUpdate();
        }
    } catch (Exception e) {
        e.printStackTrace();
    } finally {
        JDBCUtils.closeResourse(conn, ps,null);
    }
}
```

<br>

批量插入（优化方式二）：

```java
public static void executeBatch02() {
    Connection conn = null;
    PreparedStatement ps = null;
    try {
        conn = JDBCUtils.getConnection();
        ps = conn.prepareStatement("insert into t_user(username, password) values(?, ?)");
        for (int i = 0; i < 100; i++) {
            ps.setObject(1,"username_" + i);
            ps.setObject(2,"password_" + i);

            // 攒 sql
            ps.addBatch();
            if (i % 10 == 0 || i == 99) {
                // 执行 batch
                ps.executeBatch();
                // 清空 batch
                ps.clearBatch();
            }
        }
    } catch (Exception e) {
        e.printStackTrace();
    } finally {
        JDBCUtils.closeResourse(conn, ps,null);
    }
}
```

注意：mysql服务器默认是关闭批处理的，我们需要通过一个参数，让mysql开启批处理的支持。

?rewriteBatchedStatements=true 写在配置文件的url后面。

<br>

批量插入（继续优化方式三）：

```java
public static void executeBatch03() throws SQLException {
    Connection conn = null;
    PreparedStatement ps = null;
    try {
        conn = JDBCUtils.getConnection();
        conn.setAutoCommit(false); // 事务控制市值为手动
        ps = conn.prepareStatement("insert into t_user(username, password) values(?, ?)");
        for (int i = 0; i < 100; i++) {
            ps.setObject(1,"username_" + i);
            ps.setObject(2,"password_" + i);

            // 攒 sql
            ps.addBatch();
            if (i % 10 == 0 || i == 99) {
                // 执行 batch
                ps.executeBatch();
                // 清空 batch
                ps.clearBatch();
            }
        }
        conn.commit(); // 统一提交批量
    } catch (Exception e) {
        e.printStackTrace();
        conn.rollback();
    } finally {
        JDBCUtils.closeResourse(conn, ps,null);
    }
}
```

<br>



## 使用 CallableStatement 执行存储过程

创建和调用存储过程示例（mysql）：

```sql
-- 操作类存储过程
delimiter $$
create procedure delete_user(in in_id int) 
begin
  delete from t_user where id=in_id;
end$$
delimiter ;

> call delete_user(1);


-- 查询类存储过程
delimiter $$
create procedure user_count() 
begin
  select count(1) from t_user;
end$$
delimiter ;

> call user_count(1);
```

<br>

使用jdbc调用存储过程示例：

```java
public static int executeProcedure(String sql, Object ... args) {
    Connection conn = null;
    CallableStatement cs = null;
    int result = 0;
    try {
        conn = JDBCUtils.getConnection();
        cs = conn.prepareCall(sql);
        for (int i = 0; i < args.length; i++) { // 填充占位符
            cs.setObject(i + 1, args[i]);
        }
        result = cs.executeUpdate();
    } catch (Exception e) {
        e.printStackTrace();
    } finally {
        JDBCUtils.closeResourse(conn, cs, null);
    }
    return result;
}

public static void main(String[] args) {
    String sql = "call delete_user(?)";
    int result = executeProcedure(sql, 2);
    System.out.println(result);
}
```

<br>



## 关于 ResultSet与ResultSetMetaData

### ResultSet

* 查询需要调用PreparedStatement 的 executeQuery() 方法，查询结果是一个ResultSet 对象
* ResultSet 对象以逻辑表格的形式封装了执行数据库操作的结果集，ResultSet 接口由数据库厂商提供实现
* ResultSet 返回的实际上就是一张数据表。有一个指针指向数据表的第一条记录的前面。
* ResultSet 对象维护了一个指向当前数据行的游标，初始的时候，游标在第一行之前，可以通过 ResultSet 对象 的 next() 方法移动到下一行。调用 next()方法检测下一行是否有效。若有效，该方法返回 true，且指针下移。 相当于Iterator对象的 hasNext() 和 next() 方法的结合体。
* 当指针指向一行时, 可以通过调用 getXxx(int index) 或 getXxx(int columnName) 获取每一列的值。例如: getInt(1), getString("name") 。注意: `Java与数据库交互涉及到的相关Java API中的索引都从1开始`。

![image-20200823015605677](/images/image-20200823015605677.png)

<br>



### ResultSetMetaData

* 可用于获取关于 ResultSet 对象中列的类型和属性信息的对象
* ResultSetMetaData meta = rs.getMetaData();
  * getColumnCount():返回当前 ResultSet 对象中的列数
  * getColumnName(int column):获取指定列的名称
  * getColumnLabel(int column):获取指定列的别名
  * getColumnTypeName(int column):检索指定列的数据库特定的类型名称
  * getColumnDisplaySize(int column):指示指定列的最大标准宽度，以字符为单位
  * isNullable(int column):指示指定列中的值是否可以为 null
  * isAutoIncrement(int column):指示是否自动为指定列进行编号，这样这些列仍然是只读的

<br>



## 关于资源的释放

需要释放资源的对象 ResultSet、Statement、Connection。数据库连接(Connection)是非常稀有的资源，用完后必须马上释放，如果Connection不能及时正确的关闭将 导致系统宕机。Connection的使用原则是尽量晚创建，尽量早的释放。可以在finally中关闭，保证及时其他代码出现异常，资源也一定能被关闭。工具代码示例如下：

```java
/**
 * @Author KJ
 * @Date 2020-08-22 5:17 下午
 * @Description
 */
public class JDBCUtils {
    private static String driver;
    private static String url;
    private static String user;
    private static String password;
    static {
        InputStream is = null;
        try {
            is = JDBCUtils.class.getClassLoader().getResourceAsStream("db/jdbc.properties");
            Properties props = new Properties();
            props.load(is);
            driver = props.getProperty("jdbc.driver", "com.mysql.cj.jdbc.Driver");
            url = props.getProperty("jdbc.url", "localhost");
            user = props.getProperty("jdbc.user", "root");
            password = props.getProperty("jdbc.password", "123456");
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            try {
                is.close();
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
    }
    private static ThreadLocal<Connection> tlConn = new ThreadLocal<Connection>();

    /**
     * 获取线程绑定的连接资源
     */
    public static Connection getConnection() throws Exception {
        if (tlConn.get() == null) {
            Class.forName(driver);
            Connection conn = DriverManager.getConnection(url, user, password);
            tlConn.set(conn);
        }
        return tlConn.get();
    }

    /**
     * 释放资源
     */
    public static void closeResourse(Connection conn, Statement stmt, ResultSet rs) {
        try {
            if (conn != null) {
                conn.setAutoCommit(true);
                conn.close();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        try {
            if (stmt != null) {
                stmt.close();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        try {
            if (rs != null) {
                rs.close();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
```

<br>



## 关于往数据库中存储blob类型

### MySQL BLOB类型

* MySQL中，BLOB是一个二进制大型对象，是一个可以存储大量数据的容器，它能容纳不同大小的数据。
* 插入BLOB类型的数据必须使用PreparedStatement，因为BLOB类型的数据无法使用字符串拼接写的。
* MySQL的四种BLOB类型(除了在存储的最大信息量上不同外，他们是等同的)
* 实际使用中根据需要存入的数据大小定义不同的BLOB类型。
* 需要注意的是:如果存储的文件过大，数据库的性能会下降。
* 如果在指定了相关的Blob类型以后，还报错:xxx too large，那么在mysql的安装目录下，找my.ini文件加上如 下的配置参数: `max_allowed_packet=16M`。同时注意:修改了my.ini文件之后，需要重新启动mysql服务。

![image-20200823154806366](/images/image-20200823154806366.png)



示例代码：

```java
public static int executeUpdate(String sql, Object ... args) {
    Connection conn = null;
    PreparedStatement ps = null;
    int result = 0;
    try {
        conn = JDBCUtils.getConnection();
        ps = conn.prepareStatement(sql);
        for (int i = 0; i < args.length; i++) {
            if (args[i] instanceof InputStream) {
                ps.setBlob(i+1, (InputStream) args[i]);
            } else {
                ps.setObject(i+1, args[i]);
            }
        }
        result = ps.executeUpdate();
    } catch (Exception e) {
        e.printStackTrace();
    } finally {
        JDBCUtils.closeResourse(conn, ps, null);
    }
    return result;
}


public static void executeQuery(String sql, Object ... args) {
    Connection conn = null;
    PreparedStatement ps = null;
    try {
        conn = JDBCUtils.getConnection();
        ps = conn.prepareStatement(sql);
        for (int i = 0; i < args.length; i++) {
            ps.setObject(i+1, args[i]);
        }

        ResultSet rs = ps.executeQuery();
        ResultSetMetaData rsMetaData = rs.getMetaData();
        int columnCount = rsMetaData.getColumnCount();
        while (rs.next()) {
            for (int i = 0; i < columnCount; i++) {
                String columnName = rsMetaData.getColumnLabel(i + 1);
                int columnType = rsMetaData.getColumnType(i + 1);
                if (columnType == -2 || columnType == -4 || 
                    columnType == 2004 || columnType == 2005) { // blob
                    Blob columnBlobValue = rs.getBlob(i + 1);
                    if (columnBlobValue != null) {
                        InputStream is = columnBlobValue.getBinaryStream();
                        FileOutputStream os = new FileOutputStream(
                          new File( UUID.randomUUID() + ".jpg"));
                        byte[] bs = new byte[1024];
                        int len = 0;
                        while ((len=is.read(bs)) != -1) {
                            os.write(bs, 0, len);
                            os.flush();
                        }
                        os.close();
                        is.close();
                    }
                } else {
                    Object columnValue = rs.getObject(i + 1);
                    System.out.println(columnName + " = " + columnValue);
                }
            }
        }
    } catch (Exception e) {
        e.printStackTrace();
    } finally {
        JDBCUtils.closeResourse(conn, ps, null);
    }
}


public static void main(String[] args) throws FileNotFoundException {
    // 存
    String sql = "insert into t_user(username, password, photo) values (?, ?, ?)";
    InputStream is = Test03.class.getClassLoader().getResourceAsStream("img/dev.jpg");
    int result = executeUpdate(sql, "小娟", "123456", is);
    System.out.println(result);

    // 查
    sql = "select * from t_user where id=?";
    executeQuery(sql, 2);
}
```

<br>



## 数据库事务

###  数据库事务介绍

事务: `一组逻辑操作单元，使数据从一种状态变换到另一种状态`。

* 事务处理(事务操作): 保证所有事务都作为一个工作单元来执行，即使出现了故障，都不能改变这种执行方 式。当在一个事务中执行多个操作时，要么所有的事务都被提交(commit)，那么这些修改就永久地保存下来; 要么数据库管理系统将放弃所作的所有修改，整个事务回滚(rollback)到最初状态。
* 为确保数据库中数据的一致性，数据的操纵应当是离散的成组的逻辑单元:当它全部完成时，数据的一致性可 以保持，而当这个单元中的一部分操作失败，整个事务应全部视为错误，所有从起始点以后的操作应全部回退 到开始状态。

<img src="/images/image-20200823175208393.png" alt="image-20200823175208393" style="zoom:50%;" />

<br>



###  JDBC事务处理

哪些操作会导致数据的自动提交？

* DDL操作一旦执行，都会自动提交（不管autocommit开启与否）
* DML操作默认情况下，一旦执行就会自动提交（可以通过autocommit参数设置是否开启自动提交）
* Connection连接关闭时会提交数据。如果多个操作，每个操作使用的是自己单独的连接，则无法保证 事务。即同一个事务的多个操作必须在同一个连接下。

<br>

JDBC程序中为了让多个 SQL 语句作为一个事务执行：

* 调用 Connection 对象的 setAutoCommit(false)  以取消自动提交事务
* 在所有的 SQL 语句都成功执行后，调用 commit() 方法提交事务
* 在出现异常时，调用 rollback() 方法回滚事务
* 若此时 Connection 没有被关闭，还可能被重复使用，则需要恢复其自动提交状态 setAutoCommit(true)。尤其是在使用数据库连接池技术时，执行close()方法前，建议恢复自动提交状态。

<br>



代码演示转账操作:

```java
public static int executeUpdate(String sql, Object... args) {
    Connection conn = null;
    PreparedStatement ps = null;
    int result = 0;
    try {
        conn = JDBCUtils.getConnection();
        ps = conn.prepareStatement(sql);
        for (int i = 0; i < args.length; i++) {
            if (args[i] instanceof InputStream) {
                ps.setBlob(i + 1, (InputStream) args[i]);
            } else {
                ps.setObject(i + 1, args[i]);
            }
        }
        result = ps.executeUpdate();
    } catch (Exception e) {
        e.printStackTrace();
    }
    return result;
}

public static void main(String[] args) throws Exception {
    Connection conn = null;
    try {
        conn = JDBCUtils.getConnection(); // 此处连接对象是与线程绑定的（保证一条线串起来）
        conn.setAutoCommit(false); //

        String sql1 = "update t_user set balance=balance-100 where username=?";
        int result1 = executeUpdate(sql1, "AA");
        System.out.println("result1=" + result1);

        int i = 1/0;

        String sql2 = "update t_user set balance=balance+100 where username=?";
        int result2 = executeUpdate(sql2, "BB");
        System.out.println("result2=" + result2);

        conn.commit();   //
    } catch (Exception e) {
        e.printStackTrace();
        conn.rollback(); //
    } finally {
        JDBCUtils.closeResourse(conn, null, null);
    }
}
```

<br>



## 事务的 ACID 属性

### 事务的四个天然性质

* `原子性(Atomicity)`：原子性指事务是一个不可分割的工作单位，事务中的操作要么都发生，要么都不发生。
* `一致性(Consistency)`：事务必须使数据库从一个一致性状态变换到另外一个一致性状态。
* `隔离性(Isolation)`：事务隔离性是指一个事务的执行不能被其他事务干扰，即一个事务内部的操作及使用的数据对并发的其他事务是隔离的，并发执行的各个事务之间不能互相干扰。
* `持久性(Durability)`：持久性是指一个事务一旦被提交，它对数据库中数据的改变就是永久性的，接下来的其他操作和数据库故障不应该对其有任何影响。

<br>



### 对事务隔离性的解释

对于同时运行的多个事务, 当这些事务访问数据库中相同的数据时, 如果没有采取必要的隔离机制, 就会导致各种并发问题，如下：

* `脏读`：对于两个事务 T1和T2，T1 读取了已经被 T2 更新但还没有被提交的字段。之后若 T2 回滚，T1读取的 内容就是临时且无效的。
* `不可重复读`：对于两个事务T1和 T2，T1 读取了一个字段,，然后 T2 更新了该字段。之后,T1再次读取同一个字 段，值就不同了。
* `幻读`：对于两个事务T1和 T2，T1 从一个表中读取了一个字段，然后 T2 在该表中插入了一些新的行。之后,如果 T1 再次读取同一个表，就会多出几行。

数据库事务的隔离性: 数据库系统必须具有隔离并发运行各个事务的能力, 使它们不会相互影响, 避免各种并发问 题。一个事务与其他事务隔离的程度称为隔离级别。数据库规定了多种事务隔离级别，不同隔离级别对应不同的干扰程度，隔离级别越高，数据一致性就越好，但并发性越弱。<br>

JDBC 四种标准隔离级别：

| 隔离级别                     | 描述                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| READ UNCOMMITTED（读未提交） | 允许事务读取未被其他事务提交的变更（脏读、不可重复读、幻读问题都会出现） |
| READ COMMITTED（读已提交）   | 只允许事务读取已经被其他事务提交的变更（可以避免脏读，但不可重复读和幻读仍会出现） |
| REPEATABLE READ（可重复读）  | 确保事务可以从同一个字段中读取相同的值，在这个事务持续期间，禁止对这个字段进行更新（可以避免脏读和不可重复读，但幻读问题仍然存在） |
| SERIALIZABLE（串行化）       | 确保事务可以从一个表中读取相同的行，在这个事务持续期间，禁止其他事务对该表执行插入、更新和删除操作（所有并发问题都可以避免，但是性能十分低下） |

注：

* Oracle 支持的 2 种事务隔离级别:READ COMMITED, SERIALIZABLE。 Oracle 默认的事务隔离级别为: READ COMMITED 。
* Mysql 支持 4 种事务隔离级别。Mysql 默认的事务隔离级别为: REPEATABLE READ。

<br>



### 在MySql中设置隔离级别

每启动一个 mysql 程序, 就会获得一个单独的数据库连接. 每个数据库连接都有一个全局变量 `@@tx_isolation` 表示当前的事务隔离级别。

查看当前的隔离级别:

```sql
-- 设置当前 mySQL 连接的隔离级别
SELECT @@tx_isolation;

-- 设置当前 mySQL 连接的隔离级别
set transaction isolation level read committed;

-- 设置数据库系统的全局的隔离级别（需要退出客户端再进入才能看到效果）
set global transaction isolation level read committed;
```

<br>

补充操作：

```sql
-- 创建mysql数据库用户
create user tom identified by 'abc123';

-- 授予权限
-- 授予通过网络方式登录的tom用户，对所有库所有表的全部权限，密码设为abc123
grant all privileges on *.* to tom@'%' identified by 'abc123';

-- 给tom用户使用本地命令行方式，授予atguigudb这个库下的所有表的插删改查的权限
grant select,insert,delete,update on atguigudb.* to tom@localhost identified by 'abc123';
```

<br>



通过jdbc获取和设置数据库的隔离级别：

```java
public static void main(String[] args) throws Exception {
    Connection conn = JDBCUtils.getConnection();

    int isolation = conn.getTransactionIsolation();
    System.out.println(isolation);

    conn.setTransactionIsolation(Connection.TRANSACTION_READ_COMMITTED);
    isolation = conn.getTransactionIsolation();
    System.out.println(isolation);
}
```

<br>



## 数据库连接池技术

### 为什么要使用数据库连接池

在使用开发基于数据库的web程序时，传统的模式基本是按以下步骤:

* 在主程序(如servlet、beans)中建立数据库连接
* 进行sql操作
* 断开数据库连接

这种模式开发，存在的问题:

* 普通的JDBC数据库连接使用 DriverManager 来获取，每次向数据库建立连接的时候都要将 Connection 加载到内存中，再验证用户名和密码(得花费0.05s~1s的时间)。需要数据库连接的时候，就向数据库要求 一个，执行完成后再断开连接。这样的方式将会消耗大量的资源和时间。数据库的连接资源并没有得到很 好的重复利用。若同时有几百人甚至几千人在线，频繁的进行数据库连接操作将占用很多的系统资源，严 重的甚至会造成服务器的崩溃。
* 对于每一次数据库连接，使用完后都得断开。否则，如果程序出现异常而未能关闭，将会导致数据库系统中的内存泄漏，最终将导致重启数据库。
* 这种开发不能控制被创建的连接对象数，系统资源会被毫无顾及的分配出去，如连接过多，也可能导致内 存泄漏，服务器崩溃。

为解决传统开发中的数据库连接问题，所以需要采用数据库连接池技术。

`数据库连接池的基本思想`：就是为数据库连接建立一个“缓冲池”。预先在缓冲池中放入一定数量的连接，当需要 建立数据库连接时，只需从“缓冲池”中取出一个，使用完毕之后再放回去。

数据库连接池负责分配、管理和释放数据库连接，它允许应用程序重复使用一个现有的数据库连接，而不是重 新建立一个。数据库连接池在初始化时将创建一定数量的数据库连接放到连接池中，这些数据库连接的数量是由最小数据库 连接数来设定的。无论这些数据库连接是否被使用，连接池都将一直保证至少拥有这么多的连接数量。连接池 的最大数据库连接数量限定了这个连接池能占有的最大连接数，当应用程序向连接池请求的连接数超过最大连 接数量时，这些请求将被加入到等待队列中。

![image-20200823214544905](/images/image-20200823214544905.png)

数据库连接池技术的优点:

* 资源重用：由于数据库连接得以重用，避免了频繁创建，释放连接引起的大量性能开销。在减少系统消耗的基础上，另一 方面也增加了系统运行环境的平稳性。

* 更快的系统反应速度：数据库连接池在初始化过程中，往往已经创建了若干数据库连接置于连接池中备用。此时连接的初始化工作均 已完成。对于业务请求处理而言，直接利用现有可用连接，避免了数据库连接初始化和释放过程的时间开销， 从而减少了系统的响应时间。

*  新的资源分配手段：对于多应用共享同一数据库的系统而言，可在应用层通过数据库连接池的配置，实现某一应用最大可用数据库连接数的限制，避免某一应用独占所有的数据库资源。

* 统一的连接管理，避免数据库连接泄漏：在较为完善的数据库连接池实现中，可根据预先的占用超时设定，强制回收被占用连接，从而避免了常规数据 库连接操作中可能出现的资源泄露。

<br>



### 多种开源的数据库连接池

JDBC 的数据库连接池使用 javax.sql.DataSource 来表示，DataSource 只是一个接口，该接口通常由服务器(Weblogic, WebSphere, Tomcat) 提供实现，也有一些开源组织提供实现:

* `C3P0`：是一个开源组织提供的一个数据库连接池，速度相对较慢，稳定性还可以。hibernate官方推荐使用

* `DBCP`：是Apache提供的数据库连接池。tomcat 服务器自带dbcp数据库连接池。速度相对c3p0较快，但因 自身存在BUG，Hibernate3已不再提供支持。
* `BoneCP`：是一个开源组织提供的数据库连接池，速度快。
* `Proxool`：是sourceforge下的一个开源项目数据库连接池，有监控连接池状态的功能，稳定性较c3p0差一 点
* `Druid`：是阿里提供的数据库连接池，据说是集DBCP 、C3P0 、Proxool 优点于一身的数据库连接池，但是 速度不确定是否有BoneCP快

DataSource 通常被称为数据源，它包含连接池和连接池管理两个部分，习惯上也经常把 DataSource 称为连接池。DataSource 用来取代DriverManager来获取Connection，获取速度快，同时可以大幅度提高数据库访问速 度。特别注意的是，数据源和数据库连接不同，数据源无需创建多个，它是产生数据库连接的工厂，因此整个应用只需要一个 数据源即可。当数据库访问结束后，程序还是像以前一样关闭数据库连接:conn.close(); 但conn.close()并没有关闭数 据库的物理连接，它仅仅把数据库连接释放，归还给了数据库连接池。

<br>



### C3P0连接池

maven依赖包：

```xml
<dependency>
    <groupId>com.mchange</groupId>
    <artifactId>c3p0</artifactId>
    <version>0.9.5.2</version>
</dependency>
```

<br>



获取连接方式一：

```java
public static Connection getConnection1() throws Exception {
    ComboPooledDataSource cpds = new ComboPooledDataSource();
    cpds.setDriverClass("com.mysql.cj.jdbc.Driver");
    cpds.setJdbcUrl("jdbc:mysql://host-rdbms:3306/test01?serverTimezone=GMT%2B8");
    cpds.setUser("root");
    cpds.setPassword("123456");

    cpds.setInitialPoolSize(5);
    cpds.setAcquireIncrement(5);
    cpds.setMinPoolSize(5);
    cpds.setMaxPoolSize(10);
    cpds.setMaxStatements(20);
    cpds.setMaxStatementsPerConnection(5);

    Connection conn = cpds.getConnection();
    return conn;
}
```

<br>



获取方式二：

首先在类路径下配置c3p0-config.xml：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<c3p0-config>
    <named-config name="hello-c3p0">
        <!-- 获取连接的4个基本信息 -->
        <property name="user">root</property>
        <property name="password">123456</property>
        <property name="jdbcUrl">jdbc:mysql://host-rdbms:3306/test01?serverTimezone=GMT%2B8</property>
        <property name="driverClass">com.mysql.cj.jdbc.Driver</property>

        <!-- 涉及到数据库连接池的管理的相关属性的设置 -->
        <!-- 初始化数据库连接池时连接的数量 -->
        <property name="initialPoolSize">5</property>
        <!-- 若数据库中连接数不足时, 一次向数据库服务器申请多少个连接 -->
        <property name="acquireIncrement">5</property>
        <!-- 数据库连接池中的最小的数据库连接数 -->
        <property name="minPoolSize">5</property>
        <!-- 数据库连接池中的最大的数据库连接数 -->
        <property name="maxPoolSize">10</property>
        <!-- C3P0 数据库连接池可以维护的 Statement 的个数 -->
        <property name="maxStatements">20</property>
        <!-- 每个连接同时可以使用的 Statement 对象的个数 -->
        <property name="maxStatementsPerConnection">5</property>
    </named-config>
</c3p0-config>
```

获取连接代码：

```java
private static DataSource cpds = new ComboPooledDataSource("hello-c3p0");
public static Connection getConnection2() throws SQLException {
    Connection conn = cpds.getConnection();
    return conn;
}
```

<br>



### DBCP连接池

DBCP 是 Apache 软件基金组织下的开源连接池实现，该连接池依赖该组织下的另一个开源系统: Common-pool。如需使用该连接池实现，应在系统中增加如下两个 jar 文件:

* Commons-dbcp.jar: 连接池的实现
* Commons-pool.jar: 连接池实现的依赖库

Tomcat 的连接池正是采用该连接池来实现的。该数据库连接池既可以与应用服务器整合使用，也可由应用程 序独立使用。<br>



配置属性说明：

| 属性                       | 默认值 | 说明                                                         |
| -------------------------- | ------ | ------------------------------------------------------------ |
| initialSize                | 0      | 连接池启动时创建的初始化连接数量                             |
| maxActive                  | 8      | 连接池中可同时连接的最大的连接数                             |
| maxIdle                    | 8      | 连接池中最大的空闲的连接数，超过的空闲连接将被释放，如果 设置为负数表示不限制 |
| minIdle                    | 0      | 连接池中最小的空闲的连接数，低于这个数量会被创建新的连 接。该参数越接近maxIdle，性能越好，因为连接的创建和销 毁，都是需要消耗资源的;但是不能太大。 |
| maxWait                    | 无限制 | 最大等待时间，当没有可用连接时，连接池等待连接释放的最大时间，超过该时间限制会抛出异常，如果设置-1表示无限等待 |
| poolPreparedStatements     | false  | 开启池的Statement是否prepared                                |
| maxOpenPreparedStatements  | 无限制 | 开启池的prepared 后的同时最大连接数                          |
| minEvictableIdleTimeMillis |        | 连接池中连接，在时间段内一直空闲， 被逐出连接池的时间        |
| removeAbandonedTimeout     | 300    | 超过时间限制，回收没有用(废弃)的连接                         |
| removeAbandoned            | false  | 超过removeAbandonedTimeout时间后，是否进 行没用连接 (废弃)的回收 |

<br>



maven依赖包：

```xml
<dependency>
    <groupId>org.apache.tomcat</groupId>
    <artifactId>dbcp</artifactId>
    <version>6.0.37</version>
</dependency>
```

<br>



获取连接方式一：

```java
public static Connection getConnection1() throws Exception {
    BasicDataSource source = new BasicDataSource();
    source.setDriverClassName("com.mysql.jdbc.Driver");
    source.setUrl("jdbc:mysql://host-rdbms:3306/test01?serverTimezone=GMT%2B8");
    source.setUsername("root");
    source.setPassword("123456");
    source.setInitialSize(10);

    Connection conn = source.getConnection();
    return conn;
}
```

<br>



获取连接方式二：

dbcp.properties

首先配置文件 dbcp.properties:

```properties
driverClassName=com.mysql.cj.jdbc.Driver
url=jdbc:mysql://host-rdbms:3306/test01?rewriteBatchedStatements=true&useServerPrepStmts=false&serverTimezone=GMT%2B8
username=root
password=123456
initialSize=10
```

代码：

```java
private static DataSource source = null;
static {
    InputStream is = null;
    try {
      Properties pros = new Properties();
      is = Test02.class.getClassLoader().getResourceAsStream("dbcp.properties");
      pros.load(is);
      source = BasicDataSourceFactory.createDataSource(pros);
    } catch (Exception e) {
      e.printStackTrace();
    } finally {
      try {
        is.close();
      } catch (IOException e) {
        e.printStackTrace();
      }
    }
}
public static Connection getConnection2() throws SQLException {
  	return source.getConnection();
}
```

<br>



### Druid连接池

Druid是阿里巴巴开源平台上一个数据库连接池实现，它结合了C3P0、DBCP、Proxool等DB池的优点，同时加入了 日志监控，可以很好的监控DB池连接和SQL的执行情况，可以说是针对监控而生的DB连接池，可以说是目前最好的连接池之一。<br>

```xml
<dependency>
    <groupId>com.alibaba</groupId>
    <artifactId>druid</artifactId>
    <version>1.1.21</version>
</dependency>
```

<br>



获取连接示例代码：

druid.properties

```properties
url=jdbc:mysql://host-rdbms:3306/test01?rewriteBatchedStatements=true&serverTimezone=GMT%2B8
username=root
password=123456
driverClassName=com.mysql.cj.jdbc.Driver
initialSize=10
maxActive=20
maxWait=1000
filters=wall
```

代码：

```java
public static Connection getConnection1() throws Exception {
    Properties props = new Properties();
    props.load(Test03.class.getClassLoader().getResourceAsStream("druid.properties"));

    DataSource dataSource = DruidDataSourceFactory.createDataSource(props);
    Connection conn = dataSource.getConnection();
    return conn;
}
```

<br>



详细配置参数:

| 配置                          | 缺省  | 说明                                                         |
| ----------------------------- | ----- | ------------------------------------------------------------ |
| name                          |       | 配置这个属性的意义在于，如果存在多个数据源，监控的时候可以通过 名字来区分开来。 如果没有配置，将会生成一个名字，格式 是:”DataSource-” + System.identityHashCode(this) |
| url                           |       | 连接数据库的url                                              |
| driverClassName               |       | 根据url自动识别 这一项可配可不配，如果不配置druid会根据url自动 识别dbType，然后选择相应的driverClassName(建议配置下) |
| username                      |       | 连接数据库的用户名                                           |
| password                      |       | 连接数据库的密码。如果你不希望密码直接写在配置文件中，可以使用 ConfigFilter。[详细看这里](https://github.com/alibaba/druid/wiki/%E4%BD%BF%E7%94%A8ConfigFilter) |
| initialSize                   | 0     | 初始化时建立物理连接的个数。初始化发生在显示调用init方法，或者第一次getConnection时 |
| maxActive                     | 8     | 最大连接池数量                                               |
| maxIdle                       | 8     | 已经不再使用，配置了也没效果                                 |
| minIdle                       |       | 最小连接池数量                                               |
| maxWait                       |       | 获取连接时最大等待时间，单位毫秒。配置了maxWait之后，缺省启 用公平锁，并发效率会有所下降，如果需要可以通过配置 useUnfairLock属性为true使用非公平锁。 |
| poolPreparedStatements        | false | 是否缓存preparedStatement，也就是PSCache。PSCache对支持游 标的数据库性能提升巨大，比如说oracle。在mysql下建议关闭。 |
| maxOpenPreparedStatements     | -1    | 要启用PSCache，必须配置大于0，当大于0时， poolPreparedStatements自动触发修改为true。在Druid中，不会存 在Oracle下PSCache占用内存过多的问题，可以把这个数值配置大一 些，比如说100 |
| validationQuery               |       | 用来检测连接是否有效的sql，要求是一个查询语句。如果 validationQuery为null，testOnBorrow、testOnReturn、 testWhileIdle都不会起作用。 |
| testOnBorrow                  | true  | 申请连接时执行validationQuery检测连接是否有效，做了这个配置会 降低性能。 |
| testOnReturn                  | false | 归还连接时执行validationQuery检测连接是否有效，做了这个配置会 降低性能 |
| testWhileIdle                 | false | 建议配置为true，不影响性能，并且保证安全性。申请连接的时候检 测，如果空闲时间大于timeBetweenEvictionRunsMillis，执行 validationQuery检测连接是否有效。 |
| timeBetweenEvictionRunsMillis |       | 有两个含义: 1)Destroy线程会检测连接的间隔时间  2)testWhileIdle的 判断依据，详细看testWhileIdle属性的说明 |
| numTestsPerEvictionRun        |       | 不再使用，一个DruidDataSource只支持一个EvictionRun           |
| connectionInitSqls            |       | 物理连接初始化的时候执行的sql                                |
| exceptionSorter               |       | 根据dbType自动识别 当数据库抛出一些不可恢复的异常时，抛弃连接 |
| filters                       |       | 属性类型是字符串，通过别名的方式配置扩展插件，常用的插件有: 监控统计用的filter:stat日志用的filter:log4j防御sql注入的filter:wall |
| proxyFilters                  |       | 类型是List，如果同时配置了filters和proxyFilters，是组合关系，并非 替换关系 |

<br>



## 自定义BaseDAO及其使用

DAO：Data Access Object访问数据信息的类和接口，包括了对数据的CRUD(Create、Retrival、Update、 Delete)，而不包含任何业务相关的信息。有时也称作 BaseDAO。作用是为了实现功能的模块化，更有利于代码的维护和升级。



JDBCUtils:

```java
public class JDBCUtils {
    private static DataSource dataSource;

    static {
        InputStream is = null;
        try {
            Properties props = new Properties();
            is = JDBCUtils.class.getResourceAsStream("/druid.properties");
            props.load(is);
            dataSource = DruidDataSourceFactory.createDataSource(props);
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            try {
                is.close();
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
    }

    /**
     * 从连接池取连接
     */
    public static Connection getConnection() throws SQLException {
        return dataSource.getConnection();
    }

    /**
     * 释放资源
     */
    public static void closeResource(Connection conn, Statement stmt, ResultSet rs) {
        try {
            if (conn != null) {
                conn.setAutoCommit(true);
                conn.close();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        try {
            if (stmt != null) {
                stmt.close();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        try {
            if (rs != null) {
                rs.close();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
```

<br>

BaseDao:

```java
public abstract class BaseDao<T> {

    private Class<T> clazz;
    {
        // 获取 ParameterizedTypeImpl
        ParameterizedType type = (ParameterizedType) this.getClass().getGenericSuperclass();
        // 获取具体的泛型类型 getActualTypeArguments 获取具体的泛型的类型，这个方法会返回一个Type的数组
        Type[] types = type.getActualTypeArguments();
        this.clazz = (Class<T>) types[0];
    }

    /**
     * 通用的增删改操作
     */
    public int executeUpdate(Connection conn, String sql, Object ... args) {
        PreparedStatement ps = null;
        int result = 0;
        try {
            ps = conn.prepareStatement(sql);
            for (int i = 0; i < args.length; i++) {
                if (args[i] instanceof InputStream) {
                    ps.setBlob(i+1, (InputStream) args[i]);
                } else {
                    ps.setObject(i+1, args[i]);
                }
            }
            result = ps.executeUpdate();
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            JDBCUtils.closeResource(null,ps, null);
        }
        return result;
    }

    /**
     * 获取一个对象
     */
    public T getBean(Connection conn, String sql, Object ... args) {
        PreparedStatement ps = null;
        ResultSet rs = null;
        T t = null;
        try {
            ps = conn.prepareStatement(sql);
            for (int i = 0; i < args.length; i++) {
                ps.setObject(i+1, args[i]);
            }
            rs = ps.executeQuery();
            ResultSetMetaData rsMeta = rs.getMetaData();
            int columnCount = rsMeta.getColumnCount();
            if (rs.next()) {
                t = clazz.newInstance();
                for (int i = 0; i < columnCount; i++) {
                    String columnLabel = rsMeta.getColumnLabel(i + 1);
                    int columnType = rsMeta.getColumnType(i + 1);
                    try {
                        Field f = clazz.getDeclaredField(columnLabel);
                        Object columnValue = null;
                      	// 根据字段类型进行相应赋值
                        if (Objects.equals(columnType, Types.TIMESTAMP)) { 
                            columnValue = new Date(rs.getTimestamp(i+1).getTime());
                        } else {
                            columnValue = rs.getObject(i + 1, f.getType());
                        }

                        f.setAccessible(true);
                        f.set(t, columnValue);
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            JDBCUtils.closeResource(null, ps, rs);
        }
        return t;
    }

    /**
     * 获取对象列表
     */
    public List<T> getBeanList(Connection conn, String sql, Object ... args) {
        PreparedStatement ps = null;
        ResultSet rs = null;
        List<T> ts = new LinkedList<T>();
        try {
            ps = conn.prepareStatement(sql);
            for (int i = 0; i < args.length; i++) {
                ps.setObject(i+1, args[i]);
            }
            rs = ps.executeQuery();
            ResultSetMetaData rsMeta = rs.getMetaData();
            int columnCount = rsMeta.getColumnCount();
            while (rs.next()) {
                T t = clazz.newInstance();
                for (int i = 0; i < columnCount; i++) {
                    String columnLabel = rsMeta.getColumnLabel(i + 1);
                    int columnType = rsMeta.getColumnType(i + 1);
                    try {
                        Field f = clazz.getDeclaredField(columnLabel);
                        Object columnValue = null;
                        // 根据字段类型进行相应赋值
                        if (Objects.equals(columnType, Types.TIMESTAMP)) { 
                            columnValue = new Date(rs.getTimestamp(i+1).getTime());
                        } else {
                            columnValue = rs.getObject(i + 1, f.getType());
                        }

                        f.setAccessible(true);
                        f.set(t, columnValue);
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
                ts.add(t);
            }
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            JDBCUtils.closeResource(null, ps, rs);
        }
        return ts;
    }

    /**
     * 获取某个数值（专门用来执行像 select count(*)...这样的sql语句）
     */
    public <E> E getValue(Connection conn, String sql, Object ... args) {
        PreparedStatement ps = null;
        ResultSet rs = null;
        E result = null;
        try {
            ps = conn.prepareStatement(sql);
            for (int i = 0; i < args.length; i++) {
                ps.setObject(i+1, args[i]);
            }
            rs = ps.executeQuery();
            if (rs.next()) {
                result = (E) rs.getObject(1);
            }
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            JDBCUtils.closeResource(null, ps, rs);
        }
        return result;
    }
}
```

<br>

User:

```java
public class User implements Serializable {
    private Long id;
    private String username;
    private String password;
    private boolean gender;
    private Date birthday;
    private BigDecimal balance;
		// getter & setter ...
}
```

<br>

UserDao:

```java
public interface UserDao {
    int add(Connection conn, User user);
    int update(Connection conn, User user);
    int delete(Connection conn, Long id);

    User getById(Connection conn, Long id);
    List<User> getAll(Connection conn);
    Long count(Connection conn);
}
```

<br>

UserDaoImpl:

```java
public class UserDaoImpl extends BaseDao<User> implements UserDao {
  
    @Override
    public int add(Connection conn, User user) {
        String sql = "insert into t_user(username, password, gender, birthday, balance) values(?,?,?,?,?)";
        return this.executeUpdate(conn, sql, user.getUsername(), user.getPassword(), user.isGender(), user.getBirthday(), user.getBalance());
    }

    @Override
    public int update(Connection conn, User user) {
        String sql = "update t_user set username=?, password=?, gender=?, birthday=?, balance=? where id=?";
        return this.executeUpdate(conn, sql, user.getUsername(), user.getPassword(), user.isGender(), user.getBirthday(), user.getBalance(), user.getId());
    }

    @Override
    public int delete(Connection conn, Long id) {
        String sql = "delete from t_user where id=?";
        return this.executeUpdate(conn, sql, id);
    }

    @Override
    public User getById(Connection conn, Long id) {
        String sql = "select id, username, password, gender, birthday, balance from t_user where id=?";
        return this.getBean(conn, sql, id);
    }

    @Override
    public List<User> getAll(Connection conn) {
        String sql = "select id, username, password, gender, birthday, balance from t_user";
        return this.getBeanList(conn, sql);
    }

    @Override
    public Long count(Connection conn) {
        String sql = "select count(1) from t_user";
        return this.getValue(conn, sql);
    }
}
```

<br>

UserTest:

```java
public class UserTest {
    private static UserDao userDao = new UserDaoImpl();

    public static void main(String[] args) throws SQLException {
        Connection conn = JDBCUtils.getConnection();

        try {
            // 新增测试
            /*User user = new User();
            user.setUsername("张三");
            user.setPassword("123123");
            user.setGender(true);
            user.setBirthday(new Date());
            user.setBalance(new BigDecimal(100));
            userDao.add(conn, user);*/

            // 测试查询 和 更新
            /*User user = userDao.getById(conn, 219L);
            user.setBalance(new BigDecimal(400));
            userDao.update(conn, user);*/

            // 测试查所有
            /*List<User> users = userDao.getAll(conn);
            users.forEach(System.out::println);*/

            // 测试查询count
            Long count = userDao.count(conn);
            System.out.println(count);
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            JDBCUtils.closeResource(conn, null, null);
        }
    }
}
```

<br>



## Apache-DBUtils实现CRUD操作

commons-dbutils 是 Apache 组织提供的一个开源 JDBC工具类库，它是对JDBC的简单封装，学习成本极低， 并且使用dbutils能极大简化jdbc编码的工作量，同时也不会影响程序的性能。

```xml
<dependency>
    <groupId>commons-dbutils</groupId>
    <artifactId>commons-dbutils</artifactId>
    <version>1.7</version>
</dependency>
```

<br>



核心API:

* org.apache.commons.dbutils.`QueryRunner`：提供数据库操作的一系列重载的 update 和 query 操作

  * update：用来执行 一个更新(插入、更新或删除)操作。
  * insert：只支持INSERT语句
  * batch：INSERT, UPDATE, or DELETE语句
  * insertBatch：只支持INSERT语句
  * query：执行一个查询操作，在这个查询中，对象数组中的每个元素值被用来作为查询语句 的置换参数。该方法会自行处理 PreparedStatement 和 ResultSet 的创建和关闭

* org.apache.commons.dbutils.`ResultSetHandler`：处理结果集，不同结果集由不同子类实现（handle）

  * ArrayHandler:把结果集中的第一行数据转成对象数组
  * ArrayListHandler:把结果集中的每一行数据都转成一个数组，再存放到List中
  * BeanHandler:将结果集中的第一行数据封装到一个对应的JavaBean实例中。
  * BeanListHandler:将结果集中的每一行数据都封装到一个对应的JavaBean实例中，存放到List里。
  * ColumnListHandler:将结果集中某一列的数据存放到List中。
  * KeyedHandler(name):将结果集中的每一行数据都封装到一个Map里，再把这些map再存到一个map 里，其key为指定的key。
  * MapHandler:将结果集中的第一行数据封装到一个Map里，key是列名，value就是对应的值。
  * MapListHandler:将结果集中的每一行数据都封装到一个Map里，然后再存放到List
  * ScalarHandler:查询单个值对象

* org.apache.commons.dbutils.`DbUtils`：数据库连接工具类，里面的所有方法都是静态的。

  * close：DbUtils类提供了三个重载的关闭方 法。这些方法检查所提供的参数是不是NULL，如果不是的话，它们就关闭Connection、Statement和 ResultSet。
  * closeQuietly：这一类方法不仅能在Connection、Statement和ResultSet为NULL情 况下避免关闭（已try-catch SQLException 异常）
  * commitAndClose：用来提交连接的事务， 然后关闭连接
  * commitAndCloseQuietly：用来提交连接，然后关闭连接（已try-catch SQLException 异常）
  * rollback：允许conn为null，因为方法内部做 了判断
  * rollbackAndClose
  * rollbackAndCloseQuietly
  * loadDriver


<br>



测试示例：

```java
public static void testDbUtils() throws SQLException {
    Connection conn = null;
    try {
        conn = JDBCUtils.getConnection();
        conn.setAutoCommit(false);

        QueryRunner runner = new QueryRunner();
        /*String sql = "insert into t_user (username, password, balance, birthday, gender) values(?,?,?,?,?)";
        int rows = runner.update(conn, sql, "张三", "232323", new BigDecimal("12.111"), new Date(), false);
        System.out.println("添加了" + rows + "条记录");*/

        /*String sql = "delete from t_user where id>?";
        int rows = runner.update(conn, sql, 221);
        System.out.println("删除了" + rows + "条记录");*/


        /*String sql = "select id, username, password, balance, birthday, gender from t_user where id=?"; // 根据列别名匹配实体字段
        BeanHandler<User> handler = new BeanHandler<>(User.class);
        User user = runner.query(conn, sql, handler, 221);
        System.out.println(user);*/

        /*String sql = "select id, username, password, balance, birthday, gender from t_user";
        BeanListHandler<User> handler = new BeanListHandler<>(User.class);
        List<User> list = runner.query(conn, sql, handler);
        list.forEach(System.out::println);*/


        /*
        String sql = "select id, username, password, balance, birthday, gender from t_user where id=?";
        MapHandler handler = new MapHandler();
        Map<String, Object> map = runner.query(conn, sql, handler, 221);
        if (map != null) {
            map.forEach((k, v) -> {
                System.out.println("k=" + k + ", v=" + v + ", vclass=" + v.getClass());
            });
        }*/

        /*String sql = "select id, username, password, balance, birthday, gender from t_user";
        MapListHandler handler = new MapListHandler();
        List<Map<String, Object>> list = runner.query(conn, sql, handler);
        System.out.println(list);*/


        /*String sql = "select id, username, password, balance, birthday, gender from t_user where id=?";
        ArrayHandler handler = new ArrayHandler();
        Object[] record = runner.query(conn, sql, handler, 221);
        for (int i = 0; i < record.length; i++) {
            System.out.println(record[i]);
        }*/

        /*String sql = "select id, username, password, balance, birthday, gender from t_user";
        ArrayListHandler handler = new ArrayListHandler();
        List<Object[]> list = runner.query(conn, sql, handler);
        System.out.println(list);*/


        /*String sql = "select count(1) from t_user";
        ScalarHandler<Long> handler = new ScalarHandler<>();
        Long count = runner.query(conn, sql, handler);
        System.out.println(count);*/

        /*String sql = "select birthday from t_user where id=?";
        ScalarHandler<Date> handler = new ScalarHandler<>();
        Date birthday = runner.query(conn, sql, handler, 221);
        System.out.println(birthday);*/


        String sql = "select username, password, birthday from t_user where id=?";
        ResultSetHandler<User> handler = new ResultSetHandler<User>() {
            @Override
            public User handle(ResultSet rs) throws SQLException {
                User user = null;
                if (rs.next()) {
                    user = new User();
                    user.setUsername(rs.getString("username"));
                    user.setBirthday(rs.getDate("birthday"));
                }
                return user;
            }
        };
        User user = runner.query(conn, sql, handler, 221);
        System.out.println(user);

        conn.commit();
    } catch (SQLException e) {
        e.printStackTrace();
        conn.rollback();
    } finally {
        conn.setAutoCommit(true);
        conn.close();
    }
}
```

<br>















