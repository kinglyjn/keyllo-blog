title: Spring IoC 和 DI 的简单实现

author: kinglyjn

tags:

  - spring

categories:

  - java
  - springx

date: 2025-05-16 12:11:46

---



## 源码跟踪

在这篇文章中，我将着重详细介绍 springframework（这里使用的版本是 6.2.15）的控制反转（IoC）和 依赖注入（DI）的具体实现，并带你真正手搓一个简化的 spring 容器出来。注解形式的 IoC 容器在元数据解析的实现上与 xml 形式有差异，但在容器运行整体流程上二者基本相同，这里仅以 xml 的视角为例进行说明。

<!--more-->



测试 Demo 的构建：

```xml
<!--依赖-->
<dependency>
    <groupId>org.springframework</groupId>
    <artifactId>spring-context</artifactId>
    <version>6.2.15</version>
</dependency>
```

业务类：

```java
@Data
public class User {
    private String id;
    private String name;
}
```

```xml
<bean id="user" class="com.demo.entity.User">
    <property name="id" value="1"/>
    <property name="name" value="Owlias"/>
</bean>
```

测试方法：

```java
/**
 * Spring Framework 核心原理图谱 (基于 Spring 6.x)
 * 核心目标：解耦对象创建(IoC)与对象协作(DI)
 * -------------------------------------------------------------------------
 * 第一阶段：资源抽象与元数据建模
 * 职责：将外部配置（XML/注解/JavaConfig）转化为容器内部的“图纸”。
 * 1. 资源定位：通过 {@link ResourceLoader} 屏蔽物理存储差异，加载资源。
 * 2. 规则解析：使用 {@link BeanDefinitionReader} 解析流，提取类信息、作用域、懒加载标志等。
 * 3. 注册画像：将结果封装为 {@link BeanDefinition}，存入 {@link DefaultListableBeanFactory#beanDefinitionMap}。
 * 注意：此时 Spring 已掌握“如何创建对象”的所有权，完成了控制反转的“配置准备”。
 *
 * -------------------------------------------------------------------------
 * 第二阶段：控制反转 (IoC) 的生命周期触发
 * 职责：按需（getBean）或预加载（preInstantiateSingletons）创建对象实例。
 * 1. 入口触发：用户调用 {@link BeanFactory#getBean(String)}。
 * 2. 实例化（Instantiation）：
 *    - 检查 {@link DefaultSingletonBeanRegistry#singletonObjects} (一级缓存) 是否存在单例。
 *    - 若无，则进入创建流程。通过 {@link InstantiationStrategy}（通常基于反射或 CGLIB）
 * 调用构造函数产生“原始对象” (Raw Instance)。
 *
 * -------------------------------------------------------------------------
 * 第三阶段：依赖注入 (DI) 与对象就绪
 * 职责：填充对象属性，处理对象间的关联关系。
 * 1. 属性填充 (Population)：
 *    - 调用 {@link AbstractAutowireCapableBeanFactory#populateBean}。
 *    - 解析 {@link PropertyValue}，执行 Setter 注入或直接字段注入。
 * 2. 依赖处理：
 *    - 如果属性是引用类型 (ref)，则递归触发另一个 Bean 的 getBean() 流程。
 *    - 三级缓存机制 - 在此阶段解决 Singleton 作用域下的循环依赖问题。
 * 3. 初始化 (Initialization)：
 *    - 执行 Aware 接口回调、{@link BeanPostProcessor} 前置处理、init-method、后置代理等。
 * 至此，Bean 正式从“图纸”变为“完全体”，进入单例池供业务使用。
 */
@Test
void test01() {
    ApplicationContext context = new ClassPathXmlApplicationContext("bean.xml");
    User user = (User) context.getBean("user");
    System.out.println(user);
    System.out.println(user.getName());
}
```



源码跟踪时的关键断点：

{% raw %}
<div style="margin: 20px 0; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; border: 1px solid #e1e4e8; border-radius: 10px; background-color: #ffffff; overflow: hidden;  line-height: 1.4;">

    <div style="background-color: #6db33f; color: white; padding: 12px 20px; font-weight: bold; font-size: 16px; display: flex; justify-content: space-between; align-items: center; font-family: sans-serif;">
        <span>Spring 6 IoC and DI</span>
        <span id="step-counter" style="font-size: 12px; background: rgba(0,0,0,0.15); padding: 2px 10px; border-radius: 20px;">Step 0 / 5</span>
    </div>
    
    <div style="display: flex; flex-direction: row; flex-wrap: wrap; background-color: #fafafa;">
        
        <div style="flex: 1.4; min-width: 300px; background-color: #282c34; padding: 20px; box-sizing: border-box; border-right: 1px solid #ddd;">
            <div style="color: #61afef; font-size: 12px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; font-family: sans-serif;">Internal Method Stack</div>
            <div id="code-box" style="color: #abb2bf; font-size: 13px; white-space: pre; overflow-x: auto; min-height: 220px;">// 准备追踪 ClassPathXmlApplicationContext 启动流程...</div>
        </div>
    
        <div style="flex: 1; min-width: 250px; padding: 20px; box-sizing: border-box; background-color: #ffffff; display: flex; flex-direction: column; text-align: left;">
            <div style="color: #6db33f; font-size: 12px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; font-family: sans-serif;">Class & Implementation</div>
            <div id="detail-title" style="font-size: 16px; font-weight: bold; color: #2c3e50; margin-bottom: 12px; font-family: sans-serif;">等待启动</div>
            <div id="detail-content" style="font-size: 13px; color: #5f6c7a; line-height: 1.6; font-family: sans-serif; min-height: 140px;">
                点击“下一步”开始分析从 new 对象到 Bean 准备就绪的完整底层调用链。
            </div>
        </div>
    </div>
    
    <div style="padding: 15px 20px; background: #ffffff; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 10px;">
        <button onclick="resetSpringDemo()" style="padding: 8px 15px; border-radius: 4px; border: 1px solid #ddd; background: #fff; cursor: pointer; font-size: 13px; color: #666; font-family: sans-serif;">重置</button>
        <button id="spring-prev-btn" onclick="prevSpringStep()" style="padding: 8px 15px; border-radius: 4px; border: 1px solid #ddd; background: #fff; cursor: not-allowed; font-size: 13px; color: #ccc; font-family: sans-serif; min-width: 80px;" disabled>上一步</button>
        <button id="spring-next-btn" onclick="nextSpringStep()" style="padding: 8px 20px; border-radius: 4px; border: none; background: #6db33f; color: white; cursor: pointer; font-size: 13px; font-weight: bold; box-shadow: 0 2px 4px rgba(109,179,63,0.3); font-family: sans-serif; min-width: 80px;">下一步</button>
    </div>
</div>

<script>
(function() {
    const steps = [
        {
            code: `<span style="color: #e5c07b;">AbstractApplicationContext</span>.<span style="color: #61afef;">refresh</span>()\n  └─ <span style="color: #e5c07b;">ConfigurableListableBeanFactory</span> beanFactory = \n       <span style="color: #61afef;">obtainFreshBeanFactory</span>();\n     └─ <span style="color: #61afef;">loadBeanDefinitions</span>(beanFactory);`,
            title: "1. 初始化与资源定位",
            content: "<b>类路径：</b><code>PathMatchingResourcePatternResolver</code><br>当你 new 上下文时，底层会调用 <b>refresh()</b> 方法。它是 Spring 的生命之源。首先启动 <b>ResourceLoader</b> 根据路径加载 XML，将其转化为二进制输入流。",
            btn: "解析源码"
        },
        {
            code: `<span style="color: #e5c07b;">XmlBeanDefinitionReader</span>.<span style="color: #61afef;">doLoadBeanDefinitions</span>()\n  └─ <span style="color: #e5c07b;">DefaultBeanDefinitionDocumentReader</span>.<span style="color: #61afef;">parseBeanDefinitions</span>()\n     └─ <span style="color: #61afef;">processBeanDefinition</span>(ele, delegate);`,
            title: "2. XML 解析为画像",
            content: "<b>核心类：</b><code>BeanDefinitionParserDelegate</code><br>Spring 并不认识 XML。它利用 <b>DOM</b> 解析标签。解析器会提取 <code>id='user'</code> 和 <code>class='User'</code>，封装成一个 <b>GenericBeanDefinition</b> 对象。此时 User 类还没被加载。",
            btn: "注册画像"
        },
        {
            code: `<span style="color: #e5c07b;">DefaultListableBeanFactory</span>.<span style="color: #61afef;">registerBeanDefinition</span>()\n  └─ <span style="color: #e06c75;">this</span>.beanDefinitionMap.<span style="color: #61afef;">put</span>(beanName, bd);\n  └─ <span style="color: #e06c75;">this</span>.beanDefinitionNames.<span style="color: #61afef;">add</span>(beanName);`,
            title: "3. 注册到 Bean 工厂",
            content: "<b>内部组件：</b><code>beanDefinitionMap</code> (ConcurrentHashMap)<br>这是 IoC 容器的核心仓库。Spring 将第一步生成的画像存入 Map。<b>控制反转在此刻完成，</b>容器现在接管了该 Bean 的所有权和生命周期说明。",
            btn: "执行实例化"
        },
        {
            code: `<span style="color: #e5c07b;">AbstractBeanFactory</span>.<span style="color: #61afef;">doGetBean</span>()\n  └─ <span style="color: #61afef;">createBeanInstance</span>(beanName, mbd, args)\n     └─ <span style="color: #61afef;">instantiate</span>(bd, beanName, parent)\n        └─ <span style="color: #7f848e;">// 使用 CglibSubclassingInstantiationStrategy 反射创建实例</span>`,
            title: "4. 实例化对象",
            content: "<b>关键方法：</b><code>instantiateBean</code><br>当调用 getBean 时，Spring 检查单例池若无对象，则触发创建。它通过反射调用 User 的默认构造函数。<b>注意：</b>此时对象已在堆中，但属性全为 null。",
            btn: "注入属性"
        },
        {
            code: `<span style="color: #e5c07b;">AbstractAutowireCapableBeanFactory</span>.<span style="color: #61afef;">populateBean</span>()\n  └─ <span style="color: #61afef;">applyPropertyValues</span>(beanName, mbd, bw, pvs)\n     └─ <span style="color: #e5c07b;">BeanWrapperImpl</span>.<span style="color: #61afef;">setPropertyValue</span>("name", "Owlias");`,
            title: "5. 依赖注入 (DI)",
            content: "<b>核心机制：</b><code>BeanWrapper</code> & <code>TypeConverter</code><br>这是 DI 的真身。Spring 遍历画像中的属性，通过 <b>反射</b> 调用 <code>setName()</code>。如果是 ref 类型，则会递归调用 getBean 触发关联对象的创建。",
            btn: "重新追踪"
        }
    ];

    let current = -1;
    
    function updateUI() {
        const prevBtn = document.getElementById('spring-prev-btn');
        const nextBtn = document.getElementById('spring-next-btn');
        const counter = document.getElementById('step-counter');
        
        if (current === -1) {
            document.getElementById('code-box').innerHTML = `// 准备追踪 ClassPathXmlApplicationContext 启动流程...`;
            document.getElementById('detail-title').innerText = "准备启动";
            document.getElementById('detail-content').innerHTML = "点击“下一步”开始分析从 new 对象到 Bean 准备就绪的完整底层调用链。";
            nextBtn.innerText = "开始";
            counter.innerText = "Step 0 / 5";
            prevBtn.disabled = true;
            prevBtn.style.color = "#ccc";
            prevBtn.style.cursor = "not-allowed";
        } else {
            const s = steps[current];
            document.getElementById('code-box').innerHTML = s.code;
            document.getElementById('detail-title').innerText = s.title;
            document.getElementById('detail-content').innerHTML = s.content;
            nextBtn.innerText = (current === steps.length - 1) ? "重来" : "下一步";
            counter.innerText = `Step ` + (current + 1) + ` / 5`;
            
            prevBtn.disabled = false;
            prevBtn.style.color = "#666";
            prevBtn.style.cursor = "pointer";
        }
    }
    
    window.nextSpringStep = function() {
        if (current >= steps.length - 1) { current = -1; } else { current++; }
        updateUI();
    };
    
    window.prevSpringStep = function() {
        if (current > -1) { current--; updateUI(); }
    };
    
    window.resetSpringDemo = function() {
        current = -1;
        updateUI();
    };
})();
</script>
{% endraw %}

<br>



## 手搓一个 Sping 容器出来

### 第一阶段：资源与元数据

资源加载模块 (Resource)：Spring 的巧妙之处在于它不直接操作 File，而是抽象出了 Resource 接口。这样无论你的 XML 是在类路径、磁盘还是网络，容器的处理逻辑都是一样的。

Resource 接口:

```java
/**
 * @author KJ
 * @description  资源加载接口，所有资源加载的顶层抽象
 */
public interface Resource {
    InputStream getInputStream() throws IOException;
}
```

ClassPathResource 实现类：

```java
/**
 * @author KJ
 * @description 类路径资源加载实现
 */
public class ClassPathResource implements Resource {

    private final String path;
    public ClassPathResource(String path) {
        this.path = path;
    }

    @Override
    public InputStream getInputStream() throws IOException {
        // 使用当前线程的类加载器获取流
        InputStream is = Thread.currentThread().getContextClassLoader().getResourceAsStream(path);
        if (is == null) {
            throw new FileNotFoundException(path + " cannot be opened because it does not exist");
        }
        return is;
    }
}
```

有了资源读取能力，我们需要定义一个类来存储解析出来的 XML 信息。这就是 BeanDefinition：

```java
/**
 * @author KJ
 * @description Bean画像的定义：Bean 的定义信息（这里简单化处理，只包含基本的类名和属性集合）
 */
public class BeanDefinition {
    @Getter
    private String beanClassName;
    @Getter
    private List<PropertyValue> propertyValues = new ArrayList<>();

    public BeanDefinition(String beanClassName) {
        this.beanClassName = beanClassName;
    }

    public void addPropertyValue(PropertyValue pv) {
        this.propertyValues.add(pv);
    }
}
```

“画像” 的属性单元 PropertyValue：

```java
/**
 * @author KJ
 * @description 属性单元：对应 XML 中的 <property name="..." value="..."/>
 */
public class PropertyValue {

    private final String name;
    private final Object value;

    public PropertyValue(String name, Object value) {
        this.name = name;
        this.value = value;
    }

    public String getName() {
        return name;
    }

    public Object getValue() {
        return value;
    }
}
```

有了Bean的 “画像”，我们需要一个能存放 “画像” 的地方。Spring 设计了 BeanDefinitionRegistry 接口，让工厂具备注册画像的能力。

```java
/**
 * @author KJ
 * @description 存放 BeanDefinition 的注册表接口
 */
public interface BeanDefinitionRegistry {
    void registerBeanDefinition(String beanName, BeanDefinition beanDefinition);
}
```

第一阶段的灵魂组件 **BeanDefinitionReader**。在 Spring 中，它的职责是拿着刚刚我们写的 Resource，通过 DOM 解析 XML 标签，把 id 和 class 提取出来，封装成 BeanDefinition，最后塞进工厂的 beanDefinitionMap 里。

```java
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.InputStream;

/**
 * @author KJ
 * @description  负责读取 XML 并注册 BeanDefinition
 */
public class XmlBeanDefinitionReader {

    private final BeanDefinitionRegistry registry;
    public XmlBeanDefinitionReader(BeanDefinitionRegistry registry) {
        this.registry = registry;
    }

    public void loadBeanDefinitions(Resource resource) throws Exception {
        try (InputStream inputStream = resource.getInputStream()) {
            doLoadBeanDefinitions(inputStream);
        }
    }

    protected void doLoadBeanDefinitions(InputStream inputStream) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        DocumentBuilder builder = factory.newDocumentBuilder();
        Document doc = builder.parse(inputStream);
        Element root = doc.getDocumentElement();
        NodeList nodes = root.getChildNodes();

        for (int i = 0; i < nodes.getLength(); i++) {
            if (!(nodes.item(i) instanceof Element)) continue;
            Element ele = (Element) nodes.item(i);
            if (!"bean".equals(ele.getNodeName())) continue;

            // 1. 提取 id 和 class
            String id = ele.getAttribute("id");
            String className = ele.getAttribute("class");

            // 2. 创建画像
            BeanDefinition beanDefinition = new BeanDefinition(className);

            // 3. 提取属性注入 <property name="" value=""/>
            NodeList propNodes = ele.getElementsByTagName("property");
            for (int j = 0; j < propNodes.getLength(); j++) {
                Element propEle = (Element) propNodes.item(j);
                String name = propEle.getAttribute("name");
                String value = propEle.getAttribute("value");
                beanDefinition.addPropertyValue(new PropertyValue(name, value));
            }

            // 4. 注册到工厂
            registry.registerBeanDefinition(id, beanDefinition);
        }
    }
}
```

最后实现一个最简单的工厂 (BeanFactory)：

```java
/**
 * @author KJ
 * @description 实现一个最简单的 BeanFactory 工厂，它需要实现 BeanDefinitionRegistry 接口，这样它才能被 Reader 填充。
 */
public class DefaultListableBeanFactory implements BeanDefinitionRegistry {

    // 这就是所有bean组件注册 “画像” 存储的地方
    private final Map<String, BeanDefinition> beanDefinitionMap = new ConcurrentHashMap<>();

    @Override
    public void registerBeanDefinition(String beanName, BeanDefinition beanDefinition) {
        beanDefinitionMap.put(beanName, beanDefinition);
    }

    public BeanDefinition getBeanDefinition(String beanName) {
        return beanDefinitionMap.get(beanName);
    }
}
```

现在，我们可以真正通过读取 XML 来生成画像了！来，简单测试一下：

```java
@Test
public void test01() throws Exception {
    // 1. 创建工厂 (注册表)
    DefaultListableBeanFactory factory = new DefaultListableBeanFactory();

    // 2. 创建读取器并绑定工厂
    XmlBeanDefinitionReader reader = new XmlBeanDefinitionReader(factory);

    // 3. 加载资源并解析
    Resource resource = new ClassPathResource("bean.xml");
    reader.loadBeanDefinitions(resource);

    // 4. 验证画像是否存入 Map
    BeanDefinition bd = factory.getBeanDefinition("user");
    System.out.println("成功加载 Bean: " + bd.getBeanClassName());
    PropertyValue pv0 = bd.getPropertyValues().get(0);
    System.out.println("属性注入检测: " + pv0.getName() + " = " + pv0.getValue());
    PropertyValue pv1 = bd.getPropertyValues().get(1);
    System.out.println("属性注入检测: " + pv1.getName() + " = " + pv1.getValue());
}
```

测试结果：

```
成功加载 Bean: com.demo.entity.User
属性注入检测: id = 1
属性注入检测: name = Owlias
```

<br>



### 第二阶段：实现控制反转

在第一阶段，我们已经把 “设计图纸”（BeanDefinition）塞进了 beanDefinitionMap。现在我们要打造那台根据图纸生产零件的 “机器”——**getBean 流程**。

按照 Spring 的设计，我们要通过模板模式来组织代码：

* BeanFactory: 顶层接口，定义 getBean 协议。
* AbstractBeanFactory: 抽象类，处理单例缓存逻辑（一级缓存）。
* AbstractAutowireCapableBeanFactory: 负责具体的实例化（反射 new 对象）和初始化。
* DefaultListableBeanFactory：落地实现类，它继承了上面的所有生产能力，并且实现了 BeanDefinitionRegistry。

下面我们来具体实现这一阶段的主要逻辑：

BeanFactory：

```java
/**
 * @author KJ
 * @description 顶层工厂接口
 */
public interface BeanFactory {
    Object getBean(String name) throws Exception;
}
```

AbstractBeanFactory：

```java
/**
 * @author KJ
 * @description 抽象bean工厂：在此我们实现单例控制
 */
public abstract class AbstractBeanFactory implements BeanFactory {

    /** 一级缓存：保存训练好的完整单例对象 */
    private final Map<String, Object> singletonObjects = new ConcurrentHashMap<>(256);

    @Override
    public Object getBean(String name) throws Exception {
        Object bean = singletonObjects.get(name);
        if (bean != null) {
            return bean;
        }

        // 获取该 Bean 的画像
        BeanDefinition beanDefinition = getBeanDefinition(name);
        if (beanDefinition == null) {
            throw new Exception("No bean named " + name + " is defined");
        }
        // 如果单例池没有，就去创建一个
        return createBean(name, beanDefinition);
    }

    /**
     * 方便子类将创建好的单例放入池中
     */
    protected void addSingleton(String beanName, Object singletonObject) {
        singletonObjects.put(beanName, singletonObject);
    }

    protected abstract BeanDefinition getBeanDefinition(String beanName);
    protected abstract Object createBean(String beanName, BeanDefinition beanDefinition) throws Exception;
}
```

AbstractAutowireCapableBeanFactory：

```java
/**
 * @author KJ
 * @description 抽象bean工厂：在此实现通过反射创建对象
 */
public abstract class AbstractAutowireCapableBeanFactory extends AbstractBeanFactory {

    @Override
    protected Object createBean(String beanName, BeanDefinition beanDefinition) throws Exception {
        Object bean;
        try {
            // 1. 实例化阶段：反射创建空对象
            bean = createBeanInstance(beanDefinition);

            // 2. 填充属性阶段 (这是第三阶段的内容，我们先留个坑)
            applyPropertyValues(beanName, bean, beanDefinition);
        } catch (Exception e) {
            throw new RuntimeException("Instantiation of bean failed", e);
        }
        // 放入单例池
        addSingleton(beanName, bean);
        return bean;
    }

    protected Object createBeanInstance(BeanDefinition beanDefinition) throws Exception {
        // 简单实现：通过全类名获取 Class 对象，再通过默认构造函数反射
        Class<?> beanClass = Class.forName(beanDefinition.getBeanClassName());
        return beanClass.getDeclaredConstructor().newInstance();
    }

    protected void applyPropertyValues(String beanName, Object bean, BeanDefinition beanDefinition) {
        // TODO: 遍历 PropertyValues 进行 Setter 注入
    }
}
```

DefaultListableBeanFactory：

```java
/**
 * @author KJ
 * @description 具体干活的bean工厂：它继承了工厂的所有生产能力，并且实现了第一阶段写的 BeanDefinitionRegistry。
 */
public class DefaultListableBeanFactory extends AbstractAutowireCapableBeanFactory implements BeanDefinitionRegistry {

    // 这就是所有bean组件注册 “画像” 存储的地方
    private final Map<String, BeanDefinition> beanDefinitionMap = new ConcurrentHashMap<>();

    @Override
    public void registerBeanDefinition(String beanName, BeanDefinition beanDefinition) {
        beanDefinitionMap.put(beanName, beanDefinition);
    }

    public BeanDefinition getBeanDefinition(String beanName) {
        return beanDefinitionMap.get(beanName);
    }
}
```

通过第二阶段，现在我们就能够搓出一个由工厂创建的真正的 user 了！来，测试：

```java
@Test
public void test03() throws Exception {
    // 1. 创建工厂 (注册表)
    DefaultListableBeanFactory factory = new DefaultListableBeanFactory();

    // 2. 创建读取器并绑定工厂
    XmlBeanDefinitionReader reader = new XmlBeanDefinitionReader(factory);

    // 3. 加载资源并解析
    Resource resource = new ClassPathResource("bean.xml");
    reader.loadBeanDefinitions(resource);

    // 4. 核心：调用 getBean (控制反转)，此时 User 对象的创建权完全交给了 factory
    User user = (User) factory.getBean("user");
    System.out.println(user);
    System.out.println(user.getClass() + "@" + Integer.toHexString(System.identityHashCode(user)));
    user.sayHello();
}
```

测试结果：

```
User(id=null, name=null)
class com.demo.entity.User@6dc17b83
hello world
```

<br>



### 第三阶段：实现依赖注入

在第二阶段，我们已经通过反射 new 出了对象，但它只是一个 “空壳”。现在我们要实现 `applyPropertyValues` 方法，利用反射把配置中的属性值强行灌输给这个空壳，让它变成一个具备业务数据的 “完全体”。

在 Spring 源码中，这个过程是由 `BeanWrapper` 来配合完成的，但在我们的简易版实现中，我们将通过简单的反射对 Setter 方法进行调用。

现在，我们就实现之前 AbstractAutowireCapableBeanFactory#applyPropertyValues 的坑位：

```java
public abstract class AbstractAutowireCapableBeanFactory extends AbstractBeanFactory {

    // ...

    protected void applyPropertyValues(String beanName, Object bean, BeanDefinition beanDefinition) throws Exception {
        try {
            for (PropertyValue pv : beanDefinition.getPropertyValues()) {
                String name = pv.getName();
                Object value = pv.getValue();

                // 核心技巧：根据属性名拼接出 setXxx 方法名
                // 例如 name -> setName
                String setterMethodName = "set" + name.substring(0, 1).toUpperCase() + name.substring(1);

                // 获取该对象的 Class
                Class<?> clazz = bean.getClass();

                // 简单实现：为了演示，假设我们只支持 String 类型的属性注入
                // 在真实的 Spring 中，这里会涉及极其复杂的类型转换 (TypeConverter)
                Method method = clazz.getDeclaredMethod(setterMethodName, value.getClass());

                // 消除访问限制检查 (确保私有 setter 也能调用)
                method.setAccessible(true);

                // 反射调用：targetBean.setName("Owlias")
                method.invoke(bean, value);
            }
        } catch (Exception e) {
            throw new Exception("Error setting property values for bean: " + beanName, e);
        }
    }
}
```

现在再来运行第二阶段的测试单元：

```
User(id=1, name=Owlias)
class com.demo.entity.User@1283bb96
hello world
```

DI 注入，大功告成！

<br>



### 让使用更优雅

你可能注意到咱们的测试单元调用似乎很繁琐，不像spring那样优雅，我们现在就来写一个精简版的 ApplicationContext，让它实现 “一行代码启动容器并自动注入” 的壮举！

在 Spring 源码设计中，BeanFactory 是底层容器，面向 Spring 框架本身；而 ApplicationContext 是高层容器，面向的是开发者。`ApplicationContext` 的核心作用是：把 Resource 加载、BeanDefinition 解析、BeanFactory 注册这几项琐碎的工作包装起来，让你实现 “一行代码启动 Spring 容器”。下面我将遵循 Spring 6 的继承体系，来实现一个最经典的 ClassPathXmlApplicationContext。

顶层接口 ApplicationContext：

```java
/**
 * @author KJ
 * @description 面向开发者的 ApplicationContext
 */
public interface ApplicationContext extends BeanFactory {}
```

抽象基类 AbstractApplicationContext：

```java
/**
 * @author KJ
 * @description 抽象基类：这里实现了 Spring 源码中最著名的 refresh() 方法，它定义了容器启动的完整标准流程。
 */
public abstract class AbstractApplicationContext implements ApplicationContext {
    protected DefaultListableBeanFactory beanFactory;

    @Override
    public Object getBean(String name) throws Exception {
        return beanFactory.getBean(name);
    }

    /**
     * Spring 的灵魂方法：刷新容器
     */
    public void refresh() throws Exception {
        // 1. 创建 BeanFactory。spring 参考 {@link AbstractApplicationContext#obtainFreshBeanFactory}
        refreshBeanFactory();

        // 2. 预实例化单例对象（让单例在容器启动时就创建好，而不是延迟到 getBean）
        // 这一步在完整 Spring 中很复杂，我们简化为直接启动流程
    }

    protected abstract void refreshBeanFactory() throws Exception;
}
```

真正干活的 XML 实现类 ClassPathXmlApplicationContext：

```java
/**
 * @author KJ
 * @description 这是我们最终暴露给用户使用的 ApplicationContext，负责将 Resource、Reader 和 BeanFactory 揉在一起。
 */
public class ClassPathXmlApplicationContext extends AbstractApplicationContext {

    private String configLocation;
    public ClassPathXmlApplicationContext(String configLocation) throws Exception {
        this.configLocation = configLocation;
        // 核心：启动即刷新
        super.refresh();
    }

    @Override
    protected void refreshBeanFactory() throws Exception {
        // 1. 构造底层工厂
        DefaultListableBeanFactory beanFactory = new DefaultListableBeanFactory();

        // 2. 构造解析器并绑定工厂
        XmlBeanDefinitionReader reader = new XmlBeanDefinitionReader(beanFactory);

        // 3. 加载并解析配置文件
        reader.loadBeanDefinitions(new ClassPathResource(configLocation));

        // 4. 将成品工厂赋值给上下文
        this.beanFactory = beanFactory;
    }
}
```

好，现在再来看我们的测试单元，是不是看起来有点像真正的 spring 容器了呢：

```java
@Test
public void testMyApplicationContext() throws Exception {
    // 【一行代码启动】 内部自动执行了：定位 -> 解析 -> 注册画像 -> 实例化准备
    ApplicationContext context = new ClassPathXmlApplicationContext("bean.xml");

    // 【获取 Bean】 触发实例化与依赖注入
    User user = (User) context.getBean("user");

    // 【执行业务】
    user.sayHello();
}
```





