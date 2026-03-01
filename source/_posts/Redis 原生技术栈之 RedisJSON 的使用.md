title: Redis 原生技术栈之 RedisJSON 的使用

author: kinglyjn

mathjax: true

tags:

  - RedisJSON

  - redis

categories:

  - db_cache

  - redis

date: 2023-02-07 12:21:56

---



## 从宏观上看 RedisJSON 的功能

从宏观角度来看，RedisJSON 的核心价值在于：它将 Redis 从一个 “扁平的键值对缓存” 变成了一个 “层次化的文档数据库（如 MongoDB）”，同时保持了 Redis 标志性的内存级高并发性能。

<br>

<!--more-->

在没有 RedisJSON 之前，我们只能把 JSON 当作普通的字符串（String）存进去。如果你只想改 JSON 里的一个字段，你需要把整个几百 KB 的字符串取出来（GET），解析成对象，修改，再序列化写回（SET）。这不仅浪费带宽，还存在并发冲突。RedisJSON 实现了 “原地更新。你可以直接命令 Redis 修改 JSON 树中的某个叶子节点，而无需移动整个文档。

<br>



### 主要功能点

* **分层存储**：支持复杂的嵌套结构（对象、数组、数值、布尔、Null）。
* **JSONPath 支持**：使用标准的 JSONPath 语法（如 `$.store.book[0].author`）精准定位数据。
* **高性能更新**：支持原子化的数值增加（`JSON.NUMINCRBY`）、数组追加（`JSON.ARRAPPEND`）等。
* **二进制存储**：内部使用高效的树状结构（类似于递归的内存映射），比存储纯文本 JSON 节省内存且解析极快。

<br>



### 数据流转模型

RedisJSON 在整个应用架构中的位置，可以参考这个逻辑模型：

1. **输入层**：你的应用发送标准的 JSON 字符串。
2. **解析层**：RedisJSON 模块将其解析为内存中的 **可导航树（Navigable Tree）**。
3. **索引层**：如果配置了 RediSearch，每当 `JSON.SET` 发生变化，RediSearch 会实时更新对应的索引。
4. **查询层**：你可以通过 Key 获取全文，也可以通过 JSONPath 进行局部提取。

RedisJSON 单独使用时，它是一个极速的 Key-Value 文档库。 但它的真正威力在于与其他模块的联动：

* **与 RediSearch 联动**：你可以搜索 “所有 age > 25 且 bio 中包含 'Linux' 的用户 JSON 文档”。
* **与 Redis 时序/概率模块联动**：JSON 可以作为元数据中心，关联存储其他模块的数据 ID。

<br>



## 核心常用的指令大类

RedisJSON 的操作非常直观，基本都以 `JSON.` 开头：

**基础增删改查**

- JSON.SET：存入或更新。`$` 代表根路径。
- JSON.GET  [paths...]：检索文档。可以只取你需要的字段，减少网络开销。
- JSON.DEL  [path]：删除整个文档或文档中的某个部分。



**数值与字符串操作**

* JSON.NUMINCRBY \<key\> \<path\> \<value\> ：直接对 JSON 里的数字做加减法。
* JSON.STRAPPEND \<key\> \<path\> \<value\> ：在 JSON 字符串字段后追加内容。



**数组管理 (非常强大)**

* JSON.ARRAPPEND：在数组末尾添加元素。
* JSON.ARRINSERT：在指定位置插入元素。
* JSON.ARRLEN：获取数组长度。
* JSON.ARRTRIM：截断数组（常用于保留最近的 N 条记录）。



下面是一些基础指令示例：

```bash
# 覆盖存入
> json.set emp:101 $ '{"name":"Owlias", "age":30, "skills":["Linux", "Redis", "C++"], "access":{"level":5, "tags":["admin"]}}'

> type emp:101
ReJSON-RL


# 删除
> json.del emp:101
> json.del emp:101 $.name
> json.del emp:101 "$['name', 'age']"
> json.del emp:101 $.name $.age $.address.zipcode

# 删除索引为 0 和 2 的元素
> json.del emp:101 "$.skills[0,2]"
# 删除索引为 0 到 2 的元素（删除元素不包括索引2的数据）
json.del emp:101 "$.skills[0:2]"


# 只读取技能列表中的前两个
> json.get emp:101 $.skills[0:2]
# 只读取 name age 字段
> json.get emp:101 $.name $.age
# 一次性读取多个文档
> json.mget emp:101 emp:102 name


# 原子incrby
> json.numincrby emp:101 $.age 1


# 数组操作
> json.arrappend emp:101 $.skills '"redis"' 'math'
> json.arrinsert emp:101 $.skills 1 '"english"'   # 在位置1插入
> json.arrlen emp:101 $.skills

# 数组截取
> json.arrtrim emp:101 $.skills 1 3    # 只保留索引为1~3的元素
> json.arrtrim emp:101 $.skills -3 -1  # 只保留倒数第1个（最后一个）到倒数第3个

# 数组批量追加
# 假设 JSON 结构如下，包含多个项目的任务列表
{
  "project_A": {"tasks": ["task1"]},
  "project_B": {"tasks": ["task2"]}
}
# 使用通配符定位所有项目的 tasks 数组，并追加 "new_task"
# 执行后，project_A 和 project_B 的任务列表都会多出一个 "new_task"。
> json.arrappend project:101 $..tasks '"new_tesk"'


# 字符串
> json.strappend emp:101 $.name '" System"'
> json.strlen emp:101 $.name
```

<br>



## JSONPath 的高级语法

在 Redis 里，JSONPath 不仅仅是 “定位”，它相当于 **数据在内存里的 SQL 视图**。你不再需要下载整个 JSON 到应用服务器去处理。RedisJSON 遵循的是 **JSONPath 核心规范**。以下是针对生产环境最实用的高级语法。



### 结构定位符

也即 Structure Anchors。在编写路径时，首先要明确从哪里开始找。

* **`$`**：Root。文档的根节点。
* **`..`**：Deep Scan。递归搜索。无论层级多深，只要名字匹配就抓出来。例如：`JSON.GET user:1 $..id`  表示提取文档中所有位置的 id 字段。
* **`*`**：Wildcard。匹配当前层级的所有元素。例如：`JSON.GET store $.books[*].author` 表示提取所有书的作者。

<br>



### 过滤器表达式

也即 Filter Expressions。过滤器表达式`[?(@...)]` 是 JSONPath 最强大的地方，允许你在 Redis 内存中直接进行逻辑筛选。

* **`@`**：代表当前正在处理的节点。
* **常用运算符**：`==`, `!=`, `<`, `<=`, `>`, `>=`, `&&`, `||`, `!`。在没有括号的情况下，逻辑运算符的优先级通常遵循编程语言的标准（为了避免逻辑歧义并提高可读性，生产环境强烈建议在复杂逻辑中使用括号）：
  * **`!`**：非。最高优先级。
  * **`&&`**：且。中等优先级。
  * **`||`**：或。最低优先级。
* **短路求值**：RedisJSON 的求值引擎通常支持短路逻辑。如果 `&&` 左边为假，右边将不再计算。因此，请将最容易过滤掉大量数据（过滤率高）且计算开销小的条件放在左侧。
* **类型匹配**：过滤器对类型很敏感。例如 `@.stock > "0"` (字符串) 可能会导致比较失败或非预期结果。实际使用时，必须确保比较的值类型一致。
* **空字段处理**：如果某个文档缺失了某个字段（如有的 item 没写 price），该表达式对该节点会直接返回 false，并不会报错导致整个查询挂掉。

用法举例：

```bash
# 假设有一个订单 JSON：
{
  "orders": [
    {"id": 1, "price": 50, "status": "shipped"},
    {"id": 2, "price": 120, "status": "pending"},
    {"id": 3, "price": 200, "status": "pending"}
  ]
}

# 筛选价格大于 100 的订单 ID
> json.get batch:order:101 "$.orders[?(@.price > 100)].id"
"[2,3]"

# 筛选状态为 pending 且价格小于 150 的整个对象
> json.get batch:order:101 "$.orders[?(@.status == 'pending' && @.price < 150)]"
"[{\"id\":2,\"price\":120,\"status\":\"pending\"}]"



# 如果判断逻辑比较杂呢？
# 比如我们有一个名为 products 的 JSON Key，存储了库存信息：
{
  "items": [
    {"id": 1, "type": "phone", "price": 5000, "stock": 10, "on_sale": true},
    {"id": 2, "type": "laptop", "price": 8000, "stock": 0, "on_sale": false},
    {"id": 3, "type": "phone", "price": 1200, "stock": 50, "on_sale": false},
    {"id": 4, "type": "tablet", "price": 3000, "stock": 5, "on_sale": true}
  ]
}

# 找出（类型是 phone 且价格小于 2000）或者（类型是 tablet）的所有商品。
> json.get products "$..items[?((@.type == 'phone' && @.price < 2000) || @.type == 'tablet')]"

# 找出所有不在打折（on_sale 为 false）且有库存的商品。这里注意 "!" 的位置
> json.get products "$..items[?(!@.on_sale && @.stock > 0)]"

# 找出（价格在 3000 到 6000 之间）且（要么正在打折，要么库存大于 20）的产品
> json.get products "$..items[?(@.price >= 3000 && @.price <= 6000 && (@.on_sale == true || @.stock > 20))]"
```

在 RedisJSON 的过滤器中，有两个非常有用的 “增强型” 判断：

* **`in` (包含于列表)**： `JSON.GET products "$..items[?(@.type in ['phone', 'tablet'])]"`
* **`=~` (正则匹配)**： `JSON.GET products "$..items[?(@.type =~ '(?i)lap.*')]"`（匹配以 lap 开头且忽略大小写的类型）

<br>



### 切片与多选

也即 Slicing & Multiple Selection。处理数组时，你不需要总是把整个数组取回。

* **多项选择 `[,]`**： 比如 `JSON.GET mykey "$.orders[0,2]"`  表示只取第 1 个和第 3 个订单。
* **数组切片 `[start:end:step]`**：
  *  `JSON.GET mykey "$.orders[1:3]"`  表示取索引 1 到 2 的元素。
  *  `JSON.GET mykey "$.orders[-2:]"`  表示取最后两个元素。

<br>



### 字段探测与存在性检查

在不确定字段是否存在时，可以使用以下技巧：

* **检查是否拥有某个属性**： `JSON.GET mykey "$.orders[?(@.discount)]"`  表示只返回那些带有折扣 discount 字段的订单。
* **正则表达式匹配 (Regex)**： 虽然 RedisJSON 核心路径语法对正则支持有限，但通常通过 `REJSON` 模块与 `RediSearch` 联动来实现复杂的字符串过滤。

<br>



### 高级更新

JSONPath 不仅能读，还能精准改。比如下面的例子：

```bash
# 给所有 pending 状态的订单增加 10 元手续费。
> json.numincrby batch:order:101 "$.orders[?(@.status == 'pending')].price" 10
"[130,210]"
```

<br>



### 需要注意的事项

JSONPath 固然非常强大，但是实际的应用中也要进行合理的运用。比如：

* **递归扫描 (`..`) 的代价**：在超大 JSON 文档（如几万行）中使用 `..` 会触发深度优先遍历。在生产环境中，尽量使用明确路径。
* **过滤器性能**：过滤器 `[?()]` 会在 Redis 主线程中进行谓词计算。如果一个数组有数千个元素，且过滤表达式涉及复杂的字符串匹配，可能会导致 `slowlog` 记录。
* **空返回**：如果 JSONPath 匹配不到任何结果，Redis 会返回 `[]`（空数组），而不是 `nil`，在编程调用时需注意判断。

<br>







