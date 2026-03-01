title: Redis 原生技术栈之 RediSearch 的使用

author: kinglyjn

mathjax: true

tags:

  - RediSearch

  - redis

categories:

  - db_cache

  - redis

date: 2023-02-10 15:33:45

---



## RediSearch 概述

打个形象的比喻，如果将 RedisJSON 比作一个存储复杂结构的“抽屉”，那么 RediSearch 就是给所有抽屉装上“实时雷达” 的高性能搜索引擎。在 Redis 8.2+ 的语境下，RediSearch 不再仅仅是一个简单的关键词匹配工具，它已经演变成一个**多模态搜索与索引引擎**。关于在 RediSearch 和 ElasticSearch 技术选型的问题，在《RediSearch 和 RedisJSON 的编译安装》中我们已经有所介绍，不再赘述。

<br>



<!--more-->



### RediSearch 是什么

传统的 Redis 只能通过 Key 来找 Value。如果你想找“所有价格在 100 到 200 之间且描述里包含 “Linu” 的商品，原生 Redis 只能笨拙地遍历所有 Key（SCAN），这在生产环境下是灾难性的。

**RediSearch 的核心逻辑：** 它在 Redis 内存中维护了**倒排索引（Inverted Index）**。当你往 Redis 存入数据时，RediSearch 会在后台自动提取关键词并建立索引。查询时，它直接在索引中高速定位结果，响应时间通常在 **微秒或毫秒级**。

<br>



### 它能做什么

RediSearch 的强大之处在于它支持多种索引类型：

1. **全文搜索 (Text Search)**：支持词干提取（Stemming）、模糊匹配、前缀搜索。
2. **数值过滤 (Numeric Filtering)**：支持对数字范围的高效筛选（如价格、时间戳）。
3. **地理位置搜索 (Geo-filtering)**：基于经纬度的半径查询。
5. **聚合统计 (Aggregation)**：类似于 SQL 的 GROUP BY，可以对搜索结果进行实时统计、求和、分组。
5. **向量搜索 (Vector Search)**：**这是目前 AI 领域最火的功能，也是多模态搜索的基础**。它可以存储和检索高维向量，用于实现 AI 语义搜索、图片相似度检索或推荐系统。

<br>



### 关键的概念

使用 RediSearch 通常遵循以下经典的 “三步走” 流程：

1. 定义 Schema（创建索引）：
   * 你不需要给每个文档建索引，而是定义一个“规则”。
   * 指令：FT.CREATE 告诉 Redis：“我要监听所有以 "user:" 开头的 Key，并把 JSON 里的 "name" 当作文本索引，"age" 当作数值索引。”
2. 自动同步（数据写入）：
   * 你只需要正常使用 JSON.SET 存入数据。
   * RediSearch 模块会自动检测到数据变化，实时异步（或同步）更新索引。你不需要额外写索引代码。
3. 执行查询：
   * 指令：FT.SEARCH 支持复杂的逻辑组合，例如 "@age:[20 30] @skills:{Linux}"。

<br>

可以先来感受一下：

```bash
# 1. 创建索引
# 注意，这里我们在创建索引时的写法 $.tags[*] AS tags TAG，
# 这里的 [*] 告诉 RediSearch：去遍历这个数组里的所有元素。
# 如果写成 "$.tags AS tags TAG"，即漏掉了星号，当 tags 是数组时，索引可能会失效。
> FT.CREATE idx:emp ON JSON PREFIX 1 emp: SCHEMA 
$.name AS name TEXT 
$.age AS age NUMERIC 
$.tags[*] AS tags TAG

# 2. 存入一个数据 (RedisJSON 操作)
> JSON.SET emp:1 $ '{"name":"Owlias", "age":30, "tags":["admin", "developer"]}'

# 3. 搜索：名字里开头是 Owl 且年龄在 20-40 之间的员工
> FT.SEARCH idx:emp "@name:Owl* @age:[20 40]"
1) (integer) 1
2) "emp:1"
3) 1) "$"
   2) "{\"name\":\"Owlias\",\"age\":30,\"tags\":[\"admin\",\"developer\"]}"
```

这里针对字段 name、age、tags，我们用到了三种字段类型：

* `TEXT`：表示对字段分词、去停用词（如 a, the）、词干提取、转小写。适用于描述、名称、或者长文本。语法例如 "@name:Owl*" (前缀), "@desc:(hello %orl%)"。
* `NUMERIC`：表示存储为数值范围树。适用于价格、年龄、时间戳、坐标。语法例如 "@age:[20 30]" 、"@price:[-inf 100]"。
* `TAG`：表示整体存储（不分词）。虽然叫 Tag，但你可以把它看作 “精确匹配字符串”。
* `GEO`：表示地理位置，专门用于存储经纬度坐标，实现附近的人、外卖配送范围、门店搜索等。
  * 存储格式：字符串 "经度,纬度" (例如 "116.397,39.908")。
  * 核心功能：支持圆形范围查询。
  * 查询语法："@loc:[lon lat radius m|km|ft|mi]"。
* `VECTOR`：这是目前最强大的类型，用于存储由机器学习模型（如 Embedding 模型）生成的浮点数数组。
  * 存储格式：二进制形式的浮点数向量。
  * 算法支持：`FLAT`（暴力搜索，高精度）或 `HNSW`（近似最近邻，高性能）。
    * FLAT：暴力搜索，不建立任何复杂的导航网，搜索时直接计算查询向量与库中每一个向量的距离，然后排序。它的特点就是查所有人，绝对不会漏掉最像的那一个，但是数据量一旦上万，搜索速度会直线下降。可以用在几千条的小规模数据，或不能容忍任何近似误差的场景。
    * HNSW：一种近似最近邻搜索（ANN）。它预先构建一个多层图结构，搜索时像“跳跃表”一样快速逼近目标。特点就是快，即使在百万、千万级数据中，也能在毫秒级返回结果。但是为了维护那个 “导航网”，它需要额外的内存。经常用在大规模搜索（10万+ 数据量）的场景，比如实时推荐系统**、**识图搜索**、**大模型（LLM）的知识库检索。
  * 核心功能：计算向量间的余弦相似度、欧式距离。

<br>



## 检索查询指令

FT.SEARCH 是 RediSearch 的检索指令。FT.SEARCH 后的名称既可以是索引的真实名称，也可以是索引的别名。

### 逻辑组合

```bash
# AND (默认就是 AND)
> FT.SEARCH idx:emp "@name:Owl* @age:[20 40]"

# OR (使用 | 符号)
> FT.SEARCH idx:emp "@name:Owl* | @tags:{developer}"

# NOT (在前面加 - 符号)
> FT.SEARCH idx:emp "@name:Owl* -@tags:{admin}"

# 查找状态为 active 或 pending 的用户
> FT.SEARCH idx:emp "@status:{active | pending}"
```

<br>

### 数组字段

比如在示例 JSON 里，tags 是一个数组 \["admin", "developer"\]。 RediSearch 极其擅长处理这种 “多值” 字段。你可以非常轻松地筛选出 "只要包含" 其中一个标签的文档：

```bash
# 只要有 developer 标签的
> FT.SEARCH idx:emp "@tags:{developer}"
```

<br>

### 权重搜索	

假设你想搜包含 "Manager" 的文档，但希望标题（title）匹配的优先级高于描述（desc）。

```bash
> FT.SEARCH idx:emp "(@title:Manager) | (@desc:Manager)"
```

<br>

### 短语匹配

**短语匹配 (Exact Phrase)**：搜“Software Engineer”这个完整词组，而不是包含这两个词的文档。

```bash
> FT.SEARCH idx:emp "@title:\"Software Engineer\""
```

<br>

### 音近匹配

处理拼写错误，比如搜 Owlias 但用户输错了。

```bash
# 使用 % 包裹，1个 % 代表允许 1 个字母错误
> FT.SEARCH idx:emp "@name:%Owlis%"
```

<br>

### 地理位置查询

如果你的 JSON 里存了经纬度（格式为 `"lon,lat"`），你可以实现“附近的人”。创建索引时需指定 GEO 类型： `SCHEMA $.location AS loc GEO`。

```bash
# 查找坐标 116.39, 39.90 半径 5 公里内的员工。
> FT.SEARCH idx:emp "@loc:[116.4 39.9 5 km]" RETURN 2 name location
1) (integer) 1
2) "emp:1"
3) 1) "name"
   2) "zhangsan"
   3) "location"
   4) "116.397,39.908"
```

<br>



### 向量查询举例

初始化数据：

```bash
# 我们创建一个简单的员工索引。
## 为了方便演示，我们只使用2维向量（比如维度1代表“技术力”，维度2代表“沟通力”）
### $.vec AS v：表示文档字段和索引字段的映射，告诉RS去JSON数据里的vec字段找数据，在索引里它的名字叫v
### VECTOR：声明这个字段不是普通的文本或数字，而是一个向量
### HNSW：表示使用高效的HNSW向量搜索算法，后面跟的6表示参数的数量。
### 这个6告诉 Redis，接下来的代码里会有 6 个关于这个向量索引的具体设置
### 注意每一个“配置项名称” 和它的 “具体值” 都要分别计入总数，比如 TYPE FLOAT32 是两个参数，所以这里是6！
> FT.CREATE idx:emp_v
    ON JSON
    PREFIX 1 emp:
    SCHEMA 
        $.name AS name TEXT 
        $.vec AS v VECTOR HNSW 6 
            TYPE FLOAT32 
            DIM 2                 # DIM 2：只有两个数字的特征向量，它决定了RS如何解析这串二进制数据
            DISTANCE_METRIC L2    # L2：欧几里得距离（即坐标轴上的直线距离，越小越近）。
            
# 写入数据（手动构造二进制向量）
## 在 JSON 中，我们可以直接写数组，RediSearch 会自动帮我们转为二进制。
### 张三：纯技术大牛 [1.0, 0.1]
JSON.SET emp:1 $ '{"name":"张三", "vec":[1.0, 0.1]}'
### 李四：纯管理领导 [0.1, 1.0]
JSON.SET emp:2 $ '{"name":"李四", "vec":[0.1, 1.0]}'
### 王五：技术管理两手抓 [0.6, 0.6]
JSON.SET emp:3 $ '{"name":"王五", "vec":[0.6, 0.6]}'
```

执行向量搜索：

假设我们要搜：“找一个技术很强的人”。我们假设 “技术强” 对应的目标坐标是 \[1.0, 0.0\]。

在 redis-cli 中，我们需要把 \[1.0, 0.0\] 转为 32 位浮点数的二进制十六进制表示。1.0 的十六进制是 0000803f，0.0的十六进制是 00000000，合并后（小端字节序）："\x00\x00\x80\x3f\x00\x00\x00\x00"。

```bash
# 指令解释
## "*=>": 这部分是过滤条件，* 代表不过滤，直接全库进行向量比对。
## KNN 3：帮我找最像的 3 个人。
## @v：去我们定义的 v 向量字段找。
## $B：对比的“标准”是什么？就是后面 PARAMS 里定义的变量B
## AS score：把算出来的“距离”起个名字叫 score
## PARAMS的格式：PARAMS {Count} {Name1} {Value1} {Name2} {Value2} ...
## Count表示：总元素个数 (Key数量 + Value数量)，比如这里的Count是2，一个是 B，另一个是我们传的向量
## DIALECT 2：必须带上。向量搜索是 RediSearch 的高级特性，需要方言 2 以上才能解析这种特殊语法。
> FT.SEARCH idx:emp_v "*=>[KNN 3 @v $B AS score]" 
    PARAMS 2 B "\x00\x00\x80\x3f\x00\x00\x00\x00" 
    SORTBY score ASC 
    DIALECT 2    
3
emp:1
score
0.0100000007078
$
{"name":"张三","vec":[1.0,0.1]}
emp:3
score
0.519999980927
$
{"name":"王五","vec":[0.6,0.6]}
emp:2
score
1.80999994278
$
{"name":"李四","vec":[0.1,1.0]}

    
# 我想找一个“全能型人才”
## 我们设置目标向量为 [0.5, 0.5]。
## 对应的十六进制是：\x00\x00\x00\x3f\x00\x00\x00\x3f。
> FT.SEARCH idx:emp_v "*=>[KNN 3 @v $B AS score]" \
    PARAMS 2 B "\x00\x00\x00\x3f\x00\x00\x00\x3f" \ 
    SORTBY score ASC \
    RETURN 2 name score \
    DIALECT 2   
3
emp:3
score
0.0200000088662
name
王五
emp:1
score
0.410000026226
name
张三
emp:2
score
0.410000026226
name
李四
```

如何自己生成二进制向量？

```python
import struct
vec = [0.9, 0.2]
print('"' + "".join([f'\\x{b:02x}' for b in struct.pack(f'<{len(vec)}f', *vec)]) + '"')
```

<br>



### 性能优化黄金参数

在执行 FT.SEARCH 时，记得带上这些参数以节省带宽和 CPU：

* `NOCONTENT`: 只返回文档数量 和 文档ID，不返回 JSON 内容（当你只需要计数时极快）
* `RETURN`: 只返回指定的字段，不返回整个大 JSON。
* `LIMIT`: 分页是必须的，默认只返回前 10 条。

```bash
# 只返回文档数量 和 文档ID
> FT.SEARCH idx:emp "@age:[20 40]" NOCONTENT 
1) (integer) 2
2) "emp:1"
3) "emp:2"

# 只返回名字和年龄
> FT.SEARCH idx:emp "@age:[20 40]" RETURN 2 name age
1) (integer) 2
2) "emp:1"
3) 1) "name"
   2) "Owlias"
   3) "age"
   4) "30"
4) "emp:2"
5) 1) "name"
   2) "lisi"
   3) "age"
   4) "24"

# 只返回前 10 条
> FT.SEARCH idx:emp "*" LIMIT 0 10 RETURN 1 name
2
emp:1
name
zhangsan
emp:2
name
lisi
# LIMIT 0 0：只返回结果总数（total_results），不返回任何实际数据。
> FT.SEARCH idx:emp "*" LIMIT 0 0
2
```

<br>

### 解释查询语句

* **FT.EXPLAIN**：解释查询语句，它不执行查询，而是返回 RediSearch 是如何解析你的查询语法的（类似于 SQL 的 EXPLAIN）。
* **FT.EXPLAINCLI**: 在命令行中以更易读的树状结构展示查询解析路径。

```bash
> FT.EXPLAINCLI idx:emp "@name:Owl* | @tags:{developer}"
1) @name:UNION {
2)   @name:PREFIX{Owl*}
3)   @name:TAG:@tags {
4)     @name:developer
5)   }
6) }
7) 
```

<br>

### 常用的精确查询的指令

在 RediSearch 中，所谓的“精确过滤”指的是跳过全文检索的分词权重和评分（Scoring），直接判断文档是否满足特定条件的查询。通常，精确过滤（尤其是基于 TAG 和 NUMERIC 的过滤）通常比全文检索（TEXT）要高效得多。

在 RediSearch 中，精确匹配主要通过 FT.SEARCH 配合特定的过滤语法来实现，或者使用专门的 FILTER 参数。

```bash
# TAG 类型的精确过滤（最常用，注意 TAG 默认是大小写敏感的）
## 单值匹配
> FT.SEARCH idx "@status:{active}"
## 多值匹配 (IN)
> FT.SEARCH idx "@status:{active | pending}"

# NUMERIC 类型的范围过滤
## 虽然是范围，但你可以通过将上下限设为相同来实现“等于”，本质上是一个二分查找
> FT.SEARCH idx "@age:[25 25]"

# TEXT 类型的精确短语匹配
## 虽然 TEXT 会分词，但你可以强制要求单词必须以特定顺序相邻出现。（使用双引号包裹）
> FT.SEARCH idx '@name:"John Doe"'

# 使用 FILTER 参数（SQL 风格）
## 除了在查询字符串里写，你还可以使用 FILTER 参数。这在需要动态拼接数值条件时非常方便。
## 它独立于查询字符串。即使查询部分是 *（匹配所有），它也会执行强制过滤。
> FT.SEARCH idx:emp "*" FILTER age 20 30

# 布尔逻辑过滤 (Boolean Operators)
## 你可以通过逻辑运算符将多个精确条件组合起来：
> FT.SEARCH idx "@status:{active} @age:[20 30]"
> FT.SEARCH idx "@category:{electronics} | @category:{appliances}"
> FT.SEARCH idx "@status:{active} -@tags:{blocked}"

# 聚合阶段的精确过滤 (FT.AGGREGATE)
## 在执行聚合统计时，你可以使用 FILTER 步骤来剔除不需要的数据行。
## 这里的 FILTER 使用的是类似于编程语言的表达式（==, !=, >, <），这比 FT.SEARCH 的语法更接近 SQL。
> FT.AGGREGATE idx:emp "@age:[20 50]"
   FILTER "@status == 'active'"
   GROUPBY 1 @dept REDUCE COUNT 0 AS num
```

另外需要注意，有一些查询看起来像过滤，但其实非常重：

* 模糊匹配 (`%word%`)：这是最慢的，因为 Redis 必须计算编辑距离，遍历大量相似的词条。
* 前缀匹配 (`word\*`)： 虽然比模糊匹配快，但它需要扫描所有以该前缀开头的索引项。如果前缀太短（比如 `a*`），性能会急剧下降。
* 通配符 (`\*`)： 在全文检索中使用通配符会导致全索引扫描。

在实际开发中，为了追求极致性能，建议遵循以下原则：

* **能用 TAG 就不用 TEXT**： 例如：订单号、用户状态、分类、性别。这些永远不应该分词。
* **先过滤后搜索**： 在查询时，把精确过滤条件放在前面。RediSearch 会先通过精确条件缩小结果集，再对剩下的小规模数据进行复杂的全文搜索。例如一个比较好的例子：`@status:{active} @description:程序员`
* **轻易不要使用 WITHSCORES**： 如果你不需要对结果进行 “匹配度排行”，请不要手动去解析分值。精确过滤天然不带分值，这反而节省了计算资源。

<br>



## 聚合查询指令

如果你想知道 “公司里 20 岁以上的员工有多少个，平均年龄是多少”，你不需要把数据取回 Java 内存。 聚合命令 FT.AGGREGATE 可以在 Redis 内部就可以直接完成统计：

```bash
> FT.SEARCH idx:emp "@name:*li*"
1) (integer) 2
2) "emp:1"
3) 1) "$"
   2) "{\"name\":\"Owlias\",\"age\":30,\"tags\":[\"admin\",\"developer\"]}"
4) "emp:2"
5) 1) "$"
   2) "{\"name\":\"lisi\",\"age\":24}"
   

# GROUPBY 后面跟着的数字代表分组字段的数量，0意味着“不分组”，也就是把所有筛选出来的结果看作一个整体。
# 如果要按部门分组：你会写 GROUPBY 1 @dept
## REDUCE：告诉 Redis 开始执行某种算法（减少/聚合数据）
### COUNT：算法名称，统计条数。
### AVG：算法名称，计算平均值。1 表示这个算法需要 1 个参数，后面的 age 就是那个参数，即对age字段求平均值。
###### 对应的类似SQL：######
###### SELECT COUNT(*) as total_num, AVG(age) as avg_age FROM idx:emp 
###### WHERE age >= 20 AND age <= 100;
> FT.AGGREGATE idx:emp "@age:[20 +inf]" 
  GROUPBY 0  
  REDUCE COUNT 0 AS total_num 
  REDUCE AVG 1 age AS avg_age
1) (integer) 1
2) 1) "total_num"
   2) "2"
   3) "avg_age"
   4) "27"
   
   
# 每个标签（Tag）下的平均年龄：
# SELECT 
#    AVG(age) as avg_age_per_tag 
# FROM 
#    idx:emp 
# GROUP BY 
#    tags 
# ORDER BY 
#    avg_age_per_tag DESC
> FT.AGGREGATE idx:emp "*" 
   GROUPBY 1 @tags 
   REDUCE AVG 1 age AS avg_age_per_tag 
   SORTBY 2 @avg_age_per_tag DESC
1) (integer) 2
2) 1) "tags"
   2) "admin"  # 对应 Owlias
   3) "avg_age_per_tag"
   4) "30"
3) 1) "tags"
   2) (nil)    # 对应 lisi
   3) "avg_age_per_tag"
   4) "24"
   
  
# 限制返回结果的数量（分页）
# 在 SQL 中，我们经常在最后加一个 LIMIT 10。
# 在 FT.AGGREGATE 中，对应的语法是 LIMIT 0 10
# 0: 偏移量（Offset）
# 10: 返回的数量
> FT.AGGREGATE idx:emp "*" 
   GROUPBY 1 @tags 
   REDUCE AVG 1 age AS avg_age_per_tag 
   SORTBY 2 @avg_age_per_tag DESC
   LIMIT 0 10
   

# 直方图：统计不同年龄段的员工分布
## APPLY: 类似于 SQL 的计算列。这里把年龄按 10 岁一组（30-39岁都归为30）。
## LOAD: 强制加载没有在 Schema 中定义为可搜索但存在于 JSON 中的字段。
> FT.AGGREGATE idx:emp "*" 
   LOAD 1 age 
   APPLY "@age - (@age % 10)" AS age_bucket 
   GROUPBY 1 @age_bucket 
   REDUCE COUNT 0 AS count 
   SORTBY 2 @age_bucket ASC
   
   
# 提取唯一值：获取公司所有员工使用过的所有标签列表。
> FT.AGGREGATE idx:emp "*" 
   GROUPBY 1 @tags 
   REDUCE COUNT 0 AS _count
```

上述聚合指令中参数前面要写数字0、1，这是 RediSearch 协议的设计，为了让解析器能快速知道后面跟着多少个参数。

<br>



## 索引管理指令

### 索引的创建

```bash
# 对传统 Hash 数据建索引
> FT.CREATE idx:user 
    ON HASH 
    PREFIX 1 user:            # 只有以 user: 开头的 Key 会被索引。1 代表后面跟了 1 个前缀。
    SCHEMA 
        name TEXT SORTABLE    # 名字可以搜索，也可以排序。
        age NUMERIC 
        location GEO 
        status TAG
        
        
# 对 JSON 数据建索引（最推荐）
## 这是最常用的方式，结合了 RedisJSON 的灵活性。
> FT.CREATE idx:order 
    ON JSON 
    PREFIX 1 order: 
    SCHEMA 
        $.order_id AS id TAG       # AS id，给 JSONPath 路径起个别名，方便后面 FT.SEARCH 调用
        $.customer.email AS email TEXT      # 可以使用 JSONPath 提取嵌套字段
        $.items[*].price AS price NUMERIC   # 提取数组中所有商品的价格
        $.status AS status TAG
        
        
# AI场景下的向量搜索索引
## 如果你要处理语义搜索、以图搜图，这是必经之路。
> FT.CREATE idx:docs 
    ON JSON 
    PREFIX 1 doc: 
    SCHEMA 
        $.content AS content TEXT 
        $.vec AS vector VECTOR HNSW 6   # 使用 HNSW 算法（适合高并发搜索）后面跟着 6 个参数。
            TYPE FLOAT32 
            DIM 768                     # 向量维度（需匹配你的 Embedding 模型）
            DISTANCE_METRIC COSINE      # 使用余弦相似度度量
            INITIAL_CAP 1000
            

# 多前缀与权重索引
## 如果你一个索引想覆盖多类 Key，或者想微调搜索体验：
> FT.CREATE idx:all_content 
    ON JSON 
    PREFIX 2 post: comment:             # 一个索引同时监听帖子和评论。
    STOPWORDS 2 "the" "a"               # 自定义忽略词（不进入索引，节省空间）
    SCHEMA 
        $.text AS body TEXT WEIGHT 2.0  # 搜索时，body字段匹配中的分值权重是默认的2倍
        $.author AS author TAG
        
        
# 使用 LANGUAGE 参数指定全局默认语言
## 如果不指定，RediSearch 默认使用英文分词器，这在处理中文时会将 “程序员”
## 拆分为“程”、“序”、“员”三个独立的单字索引，导致你搜“程序”时匹配度极差。
## 通过指定中文，RediSearch 会启用 Jieba分词 或类似的中文分词算法。
### 不加 chinese："程序员" --> 索引为 ["程", "序", "员"]。
### 加了 chinese："程序员" --> 索引为 ["程序员", "程序", "员"]（取决于词库）
### 当你执行 FT.SEARCH 时，RediSearch 会自动沿用索引定义的语言对你的搜索词进行分词。
### 如果你的索引定义了 LANGUAGE chinese，搜索 @name:程序员 时，搜索词也会被分词。
> FT.CREATE idx:emp 
    ON JSON 
    PREFIX 1 emp: 
    LANGUAGE chinese 
    SCHEMA 
        $.name AS name TEXT 
        $.desc AS desc TEXT
  
  
# 即使索引定义了默认语言，你依然可以在查询时临时指定语言
## 例如你在中文索引里存了少量日文：
> FT.SEARCH idx:emp "@name:寿司" LANGUAGE japanese

# 我们可以使用 FT.EXPLAIN 来观察 RediSearch 是如何理解你的中文查询的
redis-cli -c -h 192.168.1.224 -p 7001 --raw
> FT.EXPLAIN idx:emp "程序员"
UNION {
  程序员
  +程序员(expanded)
}

# 新版的 Redis Stack 官方发行版默认基本都带了中文分词器
> FT.EXPLAIN idx:emp "程序员" LANGUAGE chinese
UNION {
  程序员
  INTERSECT {
    程序员(expanded)
  }
}
```

核心参数：

* `ON JSON/HASH`：表示数据来源，必选，默认是 HASH
* `PREFIX`：表示监听哪些 Key，建议填写，不写则监听所有 Key（性能损耗大）
* `LANGUAGE`：表示默认的语言，非必选，影响分词逻辑，中文通常用 `chinese`
* `FILTER`：过滤表达式，非必选，例如只索引 "age > 18" 的 Key
* `NOOFFSETS`：表示不记录词的位置（无法做短语匹配），非必选，可以节省空间
* `TEMPORARY`：表示临时索引，非必选，超过指定秒数无查询则自动销毁

<br>



### 索引的删除

指令为 FT.DROPINDEX idx_name \[DD\]。默认只删除索引，保留原始数据。加上 `DD` (Delete Documents) 会 **连带删除** 所有被索引的原始 JSON 或 Hash 数据。

```bash
# 删除名称为 idx:user 的索引（不删除原始文档数据，雷达坏了，但抽屉里的东西还在）
## 注意如果是指令中的操作对象，不能是别名，而只应该是索引的真实名称，别名只用在蓝绿发布之中！
> FT.DROPINDEX idx:user

# 删除名称为 idx:order 的索引（连带被索引的原始文档数据也删除，雷达和抽屉全都拆了）
> FT.DROPINDEX idx:order DD
```

<br>



### 索引的别名及蓝绿发布

蓝绿发布是一种 “全量瞬切发布”，<span style='color:blue'>蓝色</span>代表用户正在访问的稳定运行的真实索引版本，<span style='color:green'>绿色</span>代表测试完成待发布的新索引版本，别名在这里充当了指针的角色，它总是指向实际正在用的索引版本。 在实际的生产中，你要要修改 Schema，直接删了重建会让业务中断，是不妥当的。正确做法是：

* 创建版本1: FT.CREATE idx:user_v1 ...
* 设置别名（alias）: `FT.ALIASADD idx:user idx:user_v1`
* 代码中永远调用: FT.SEARCH idx:user ...
* 需要改 Schema 时:
  * 创建新版：FT.CREATE idx:user_v2 ...（此时后台会自动开始构建索引）
  * 等到  FT.INFO 显示构建完成后，秒级切换：`FT.ALIASUPDATE idx:user idx:user_v2`
  * 最后删掉旧的：`FT.DROPINDEX idx:user_v1`

```bash
# 如果觉得没别名不满意想要换掉，还可以将别名删除
> FT.ALIASDEL <alias_name>


# 彻底清理和删除索引和别名
# 首先，通过 FT.INFO <alias_name> 确认它当前指向的真实索引名称（在返回结果的 index_name 字段）
> FT.INFO <alias_name>

# 然后，先删除别名，确保业务流量不再进入该索引。
> FT.ALIASDEL <alias_name>

# 最后删除真实索引
# 当真实索引被删除时，指向它的所有别名会自动失效（变为悬空指针），后续需要手动清理别名或重新指向。
> FT.DROPINDEX <real_index_name>
```

<br>



### 索引的更改

索引的修改涉及的指令是 FT.ALTER。 在使用 FT.ALTER 之前，你得了解它不能做什么，否则会浪费大量的时间：

* 它不能删除字：一旦字段进入 Schema，就无法通过 ALTER 移除。
* 不能修改字段类型：如果你想把一个 TAG 字段改为 TEXT，FT.ALTER 帮不了你，必须使用**蓝绿发布**（重建索引）。
* 不能修改字段名称：AS 后面的别名是固定的。
* 不能修改现有属性：例如，你不能给一个现有的 TEXT 字段追加 SORTABLE 属性。

它最常见的用法就是添加新字段。当你发现现有的 JSON 数据中多了一个维度，或者之前漏掉了某个字段的索引，可以使用 `SCHEMA ADD`。

```bash
# 执行此命令后，RediSearch 会开始在后台扫描现有的 JSON 文档。
# 对于新存入的数据，新字段会立即被索引；对于存量数据，RediSearch 会在后台异步完成补全，
# 期间 FT.INFO 会显示索引正在更新。
> FT.ALTER idx:user SCHEMA ADD 
$.phone AS phone TAG 
$.salary AS salary NUMERIC
```

<br>



### 索引的监控与状态查看

```bash
# 查看索引详情
> FT.INFO idx:emp
```

返回字段定义、文档总数、内存消耗、索引失败计数、扫描速度等。这是排查“为什么搜不到”的第一工具。你可以重点观察这几个指标：

* num_docs: 索引里到底存了多少个 JSON 文档，比如4个。
* num_records：代表索引项的总条目数，比如16个。你可能奇怪为什么 num_docs 是 4，但 num_records 是 16 呢？这是因为这里的 1个文档里有 4 个索引字段（name, age, tags, location）。如果 4 个文档都填满了这些字段，4 x 4 = 16，这证明你的字段利用率达到了 100%。
* inverted_sz_mb：倒排索引大小（影响 TEXT 搜索速度）。
* doc_table_size_mb：文档表大小（这是最大的开销项之一，存储了内部 DocID 到 Redis Key 的映射）。
* total_index_memory_sz_mb：索引内存占用多少MB。
* vector_index_sz_mb：向量 HNSW 或 Flat 算法占用的内存，如果没有定义 VECTOR 类型的字段则为0。
* percent_indexed：1 代表 100%。存量数据已经全部处理完毕，索引已是最新状态。
* hash_indexing_failures: 是否有因为格式不对导致索引失败的文档。

```bash
# 在集群模式下，执行此命令只会返回当前节点上存在的索引。
# 不过通常情况下，索引定义会在集群内广播同步。
FT._LIST

# 查看 RediSearch 的全局配置信息：
> CONFIG GET search-*
```

<br>



## 自定义字典

RediSearch 允许你干预分词逻辑，这在处理特定行业的专有名词时很有用。



### 字典核词条

RediSearch 有内置的分词规则（如拼写检查），但它可能不认识你公司的产品名或专业术语。DICT 允许你把这些词保护起来，避免被错误地拆分或纠错。

```bash
# 添加词条
> FT.DICTADD my_terms Owlias 程序员 极客

# 在搜索中使用词典（拼写检查）： 当你开启拼写检查（Spellcheck）时，可以引用这个词典：
## 告诉 Redis：如果用户输错了，请参考 my_terms 词典来纠错
> FT.SPELLCHECK idx:emp "Owlis" TERMS INCLUDE my_terms

# 查看词典内容
> FT.DICTDUMP my_terms

# 删除词条
> FT.DICTDEL my_terms Owlias
```

<br>



### 同义词

除了字典之外，`FT.SYN` (同义词) 也可以提升搜索体验，主要作用是建立词与词之间的等价关系。这是提升“搜索体验”最直观的方法——用户搜 A，你把包含 B 的结果也给他。常用在缩写、外号、近义词等场景。

```bash
# 为索引 idx:emp 添加一组同义词，ID 为 group1
## 这是一组对等关系。搜其中任何一个，都会命中包含其他三个词的文档。
> FT.SYNUPDATE idx:emp group1 手机 移动电话 智能手机 iPhone

# 如果文档 A 只有 “手机” 二字，此时也会被搜出来。
> FT.SEARCH idx:emp "移动电话"

# 目前 RediSearch 不支持通过一条命令清空所有同义词表。
# 为什么没有 FT.SYNDEL？ 因为同义词在 RediSearch 内部是映射到倒排索引的查询扩展逻辑中的。
# 动态删除一个词组涉及到复杂的索引树重新计算，因此官方更倾向于让你通过 UPDATE 覆盖来管理。
## 如果你需要大规模调整同义词逻辑，通常建议：
## 使用别名进行索引重建（蓝绿发布）：在新的 v2 索引中不配置旧的同义词，然后切换别名。
## 维护外部映射表：在你的业务系统中维护一套同义词配置。
## 当配置变化时，自动调用 FT.SYNUPDATE 刷新 Redis 里的 Group ID。
### 删除/修改某个词组：
> FT.SYNUPDATE <index_name> <existing_group_id> <new_words...>
```

<br>



### DICT 与 SYN 的本质区别

* DICT (词典)：纠错/分词保护，“这个词是正确的，别把它改了或拆了。”
* SYN (同义词)：查询扩展 (Expansion)，“用户搜这个词，其实他也在搜另外那几个词。”

<br>







