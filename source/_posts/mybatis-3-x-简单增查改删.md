title: mybatis 3.x 简单增查改删
author: kinglyjn
tags:
  - mybatis
categories:
  - framework
  - ''
  - mybatis
date: 2019-01-07 19:18:00
---
### 定义mapper接口

``` java
public interface EmpMapper {
    // 增
    void addEmp(Emp emp);
    void addEmp2(Emp emp);
    void addEmp3(Emp emp);
    // 查
    Emp getEmpById(Integer id);
    // 改
    void updateEmp(Emp emp);
    // 删
    void deleteEmp(Integer id);
    int deleteEmp2(Integer id); //成功1，失败0
}
```

<!--more-->

### 编写SQL映射文件

``` xml
<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE mapper
  PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
  "http://mybatis.org/dtd/mybatis-3-mapper.dtd">

<mapper namespace="test04.mapper.crud.EmpMapper">
  	<!-- 增 -->
  	<!-- mybatis底层调用Statement#getGeneratedKeys 获取生成的主键并赋值给实体对象的某个属性 -->
	<insert id="addEmp" databaseId="mysql" useGeneratedKeys="true" keyProperty="id">
		insert into t_emp(last_name,email,gender) values(#{lastName},#{email},#{gender})
	</insert>
	<!-- 使用 selectKey 标签在sql执行前后查询主键并封装到目标对象的某个属性 -->
	<insert id="addEmp2" databaseId="oracle">
		<selectKey keyProperty="id" resultType="integer" order="BEFORE">
			select emp_seq.nextval from dual
		</selectKey>
		insert into t_emp(id,last_name,email,gender) 
      		values(#{id},#{lastName},#{email},#{gender})
	</insert>
	<insert id="addEmp3" databaseId="oracle">
		<selectKey keyProperty="id" resultType="integer" order="AFTER">
			select emp_seq.currentval from dual
		</selectKey>
		insert into t_emp(id,last_name,email,gender) 
      		values(emp_seq.nextval,#{lastName},#{email},#{gender})
	</insert>
	
	<!-- 查 -->
	<select id="getEmpById" resultType="emp" databaseId="mysql">
		select * from t_emp where id = #{id}
	</select>
	
	<!-- 改 -->
	<update id="updateEmp">
		update t_emp set last_name=#{lastName},email=#{email},gender=#{gender} 
        where id=#{id}
	</update>
	
	<!-- 删 -->
	<delete id="deleteEmp">
		delete from t_emp where id=#{id}
	</delete>
  	<delete id="deleteEmp2">
		delete from t_emp where id=#{id}
	</delete>
</mapper>
```

### 全局配置批量注册Mapper

``` xml
<mappers>
  <package name="test04.mapper.crud"/>
</mappers>
```

### 测试代码

``` java
public SqlSessionFactory getSqlSessionFactory() throws IOException {
  String resource = "test04/mapper/crud/mybatis-test04-config.xml";
  InputStream inputStream = Resources.getResourceAsStream(resource);
  return new SqlSessionFactoryBuilder().build(inputStream);
}

@Test
public void addEmp() {// addEmp2 addEmp3 同理
  SqlSession session = null;
  try {
    SqlSessionFactory sf = getSqlSessionFactory();
    session = sf.openSession(); // autoCommit=false
    EmpMapper mapper = session.getMapper(EmpMapper.class);
    Emp emp = new Emp("wangwu", "wangwu@keyllo.com", "1");
    mapper.addEmp(emp);
    System.out.println("插入后的员工对象（含有生成的主键）: " + emp);
  } catch (Exception e) {
    e.printStackTrace();
  } finally {
    session.commit(); // 默认session需手动提交才能生效
    session.close();
  }
}

@Test
public void getEmp() {
  SqlSession session = null;
  try {
    SqlSessionFactory sf = getSqlSessionFactory();
    session = sf.openSession();
    EmpMapper mapper = session.getMapper(EmpMapper.class);
    Emp emp = mapper.getEmpById(1);
    System.out.println(emp);
  } catch (Exception e) {
    e.printStackTrace();
  } finally {
    session.close();
  }
}

@Test
public void updateEmp() {
  SqlSession session = null;
  try {
    session = getSqlSessionFactory().openSession();
    EmpMapper mapper = session.getMapper(EmpMapper.class);
    Emp emp = new Emp("wangwu2", "wangwu2@keyllo.com", "1");
    emp.setId(4);
    mapper.updateEmp(emp);
  } catch (IOException e) {
    e.printStackTrace();
  } finally {
    session.commit();
    session.close();
  }
}

@Test
public void deleteEmp() { // deleteEmp2 同理
  SqlSession session = null;
  try {
    session = getSqlSessionFactory().openSession();
    EmpMapper mapper = session.getMapper(EmpMapper.class);
    mapper.deleteEmp(4);
  } catch (IOException e) {
    e.printStackTrace();
  } finally {
    session.commit();
    session.close();
  }
}
```