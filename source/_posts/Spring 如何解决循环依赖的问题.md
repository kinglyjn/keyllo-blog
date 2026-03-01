title: Spring 如何解决循环依赖的问题

author: kinglyjn

tags:

  - spring

categories:

  - java
  - springx

date: 2025-05-18 11:20:43

---



## Spring 解决循环依赖的思路 

循环依赖之所以能解决，核心在于：`实例化（Create）` 与 `初始化（Populate）` 是两个分开的阶段。Spring 的做法是：只要 new 出了对象，就先不管属性有没有填好，直接把这个 “半成品” 的引用（或者获取引用的工厂）暴露出去。这样，当 B 需要 A 时，拿到的虽然是空壳，但地址是正确的。为了在不同阶段管理这些 Bean，Spring 准备了三个 Map：

<!--more-->



<img src="/images/image-20260301135033158.png" style="width:90%">



{% raw %}
<div id="cycle-v1-4" style="margin: 20px 0; font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; border: 1px solid #d1d5da; border-radius: 12px; background: #fff; color: #24292e; max-width: 100%; overflow: hidden; margin-bottom:50px">


    <div style="background: #0366d6; color: white; padding: 12px 20px; height: 50px; display: flex; flex-direction: column; justify-content: center;">
        <span style="display:block; margin: 0; font-size: 16px; line-height: 1.2;">Spring 三级缓存解决循环依赖演示</span>
        <p style="margin: 2px 0 0; font-size: 11px; opacity: 0.8;">场景：Bean A ↔ Bean B 相互依赖</p>
    </div>
    
    <div style="display: flex; flex-direction: column;">
        
        <div style="display: flex; gap: 8px; padding: 15px 10px; background: #f6f8fa; border-bottom: 1px solid #eee;">
            <div id="v4-c1" style="flex: 1; border: 1px dashed #28a745; border-radius: 6px; padding: 8px 4px; position: relative; min-width: 0;">
                <span style="position: absolute; top: -8px; left: 5px; background: #f6f8fa; padding: 0 3px; font-size: 9px; font-weight: bold; color: #28a745; white-space: nowrap;">1级: 成品</span>
                <div class="list" style="min-height: 30px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center; justify-content: center; font-size: 11px;"></div>
            </div>
            <div id="v4-c2" style="flex: 1; border: 1px dashed #0366d6; border-radius: 6px; padding: 8px 4px; position: relative; min-width: 0;">
                <span style="position: absolute; top: -8px; left: 5px; background: #f6f8fa; padding: 0 3px; font-size: 9px; font-weight: bold; color: #0366d6; white-space: nowrap;">2级: 半成品</span>
                <div class="list" style="min-height: 30px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center; justify-content: center; font-size: 11px;"></div>
            </div>
            <div id="v4-c3" style="flex: 1; border: 1px dashed #6f42c1; border-radius: 6px; padding: 8px 4px; position: relative; min-width: 0;">
                <span style="position: absolute; top: -8px; left: 5px; background: #f6f8fa; padding: 0 3px; font-size: 9px; font-weight: bold; color: #6f42c1; white-space: nowrap;">3级: 工厂</span>
                <div class="list" style="min-height: 30px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center; justify-content: center; font-size: 11px;"></div>
            </div>
        </div>
    
        <div id="v4-stage" style="height: 160px; position: relative; background: #fff; overflow: hidden; border-bottom: 1px solid #f0f0f0;">
            </div>
    
        <div style="padding: 12px 20px; min-height: 85px; max-height: 85px; overflow-y: auto; background: #fff; border-bottom: 1px solid #eee;">
            <div id="v4-desc" style="font-size: 13px; line-height: 1.5; color: #444;">
                点击“下一步”开启流程。
            </div>
        </div>
    
        <div style="padding: 10px 20px; background: #fcfcfc; display: flex; justify-content: space-between; align-items: center;">
            <div id="v4-step-info" style="font-size: 11px; font-family: monospace; color: #0366d6; font-weight: bold;">STEP: 0 / 7</div>
            <div style="display: flex; gap: 8px;">
                <button onclick="resetV4()" style="padding: 5px 12px; border: 1px solid #d1d5da; border-radius: 6px; background: #fff; cursor: pointer; font-size: 13px;">重置</button>
                <button id="v4-next-btn" onclick="nextV4()" style="padding: 5px 18px; border: none; border-radius: 6px; background: #2ea44f; color: #fff; cursor: pointer; font-weight: bold; font-size: 13px;">下一步</button>
            </div>
        </div>
    </div>
</div>

<script>
(function() {
    let currentStep = 0;
    const beans = {
        A: { name: 'Bean A', color: '#28a745', top: 25 },
        B: { name: 'Bean B', color: '#0366d6', top: 95 }
    };

    const steps = [
        {
            text: "<b>1. getBean(A):</b> 实例化 A。A 现在只是个内存引用（空壳）。将 A 的工厂‘合同’挂入<b>三级缓存</b>，允许别人提前引用。",
            action: () => {
                createBean('A');
                updateCache(3, 'add', 'A-Factory');
            }
        },
        {
            text: "<b>2. A 注入 B:</b> A 填充属性时发现依赖 B。于是主线程去触发 <b>getBean(B)</b>。",
            action: () => {
                drawLink('A', 'B', '查找 B...');
            }
        },
        {
            text: "<b>3. 实例化 B:</b> 同样把 B 的工厂注入<b>三级缓存</b>。此时 A 和 B 的‘合同’都在三级缓存里。",
            action: () => {
                createBean('B');
                updateCache(3, 'add', 'B-Factory');
            }
        },
        {
            text: "<b>4. B 注入 A (核心):</b> B 寻找 A。一级二级都没有，但在<b>三级缓存</b>找到 A-Factory。执行它拿到 A 的引用，A 升级到<b>二级缓存</b>。",
            action: () => {
                updateCache(3, 'remove', 'A-Factory');
                updateCache(2, 'add', 'A-Semi');
                drawLink('B', 'A', '从3级缓存提取 A');
            }
        },
        {
            text: "<b>5. B 初始化完成:</b> B 拿到了 A 的引用，完成属性填充和初始化。B 进入<b>一级缓存</b>（成品）。",
            action: () => {
                updateCache(3, 'remove', 'B-Factory');
                updateCache(1, 'add', 'Bean B');
                setReady('B');
            }
        },
        {
            text: "<b>6. A 完成注入:</b> 回到 A 的流程，A 去一级缓存拿到了完整的 B。注入成功！",
            action: () => {
                clearStageLinks();
                drawLink('A', 'B', '注入 B 成功!', '#28a745');
            }
        },
        {
            text: "<b>7. 流程结束:</b> A 完成初始化，从二级缓存移除，正式进入<b>一级缓存</b>。循环依赖完美化解！",
            action: () => {
                updateCache(2, 'remove', 'A-Semi');
                updateCache(1, 'add', 'Bean A');
                setReady('A');
            }
        }
    ];
    
    window.nextV4 = function() {
        if (currentStep < steps.length) {
            steps[currentStep].action();
            document.getElementById('v4-desc').innerHTML = steps[currentStep].text;
            currentStep++;
            document.getElementById('v4-step-info').innerText = `STEP: ${currentStep} / 7`;
            if(currentStep === steps.length) document.getElementById('v4-next-btn').disabled = true;
        }
    };
    
    window.resetV4 = function() {
        currentStep = 0;
        document.getElementById('v4-stage').innerHTML = '';
        ['1','2','3'].forEach(i => document.getElementById(`v4-c${i}`).querySelector('.list').innerHTML = '');
        document.getElementById('v4-desc').innerHTML = '点击“下一步”开启流程。';
        document.getElementById('v4-step-info').innerText = `STEP: 0 / 7`;
        document.getElementById('v4-next-btn').disabled = false;
    };
    
    function createBean(id) {
        const stage = document.getElementById('v4-stage');
        const div = document.createElement('div');
        div.id = `v4-bean-${id}`;
        div.style = `position: absolute; width: 70px; height: 35px; border: 2px solid ${beans[id].color}; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; top: ${beans[id].top}px; left: 15px; background: white; z-index: 10; transition: all 0.3s;`;
        div.innerText = beans[id].name;
        stage.appendChild(div);
    }
    
    function drawLink(from, to, msg, color = '#f66a0a') {
        const stage = document.getElementById('v4-stage');
        const link = document.createElement('div');
        link.className = 'stage-link';
        link.style = `position: absolute; left: 88px; top: ${beans[from].top + 18}px; height: 2px; background: ${color}; width: 80px; z-index: 5;`;
        
        const txt = document.createElement('div');
        txt.className = 'stage-link';
        txt.style = `position: absolute; left: 95px; top: ${beans[from].top - 2}px; font-size: 10px; color: ${color}; white-space: nowrap; font-weight: bold;`;
        txt.innerText = msg;
        
        stage.appendChild(link);
        stage.appendChild(txt);
    }
    
    function clearStageLinks() {
        const links = document.querySelectorAll('.stage-link');
        links.forEach(l => l.remove());
    }
    
    function updateCache(level, op, val) {
        const list = document.getElementById(`v4-c${level}`).querySelector('.list');
        if (op === 'add') {
            const span = document.createElement('span');
            span.id = `v4-cache-${val}`;
            span.style = `padding: 1px 4px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 3px; font-size: 10px; white-space: nowrap;`;
            span.innerText = val;
            list.appendChild(span);
        } else {
            const item = document.getElementById(`v4-cache-${val}`);
            if(item) item.remove();
        }
    }
    
    function setReady(id) {
        const el = document.getElementById(`v4-bean-${id}`);
        if(el) {
            el.style.background = beans[id].color;
            el.style.color = 'white';
        }
    }
})();
</script>
{% endraw %}



Spring 寻找 Bean 的逻辑就像是在不同等级的仓库里翻找：

- 一级缓存：先看有没有成品。
- 二级缓存：没有成品，看有没有半成品（已经暴露出来的引用）。
- 三级缓存：还没有，看有没有生产图纸（工厂）。如果有，赶紧现场生产一个半成品，并把它提拔到二级缓存。

<br>



**为什么非要 “三级” ？（二级为何不够）**

三级缓存主要是为了处理 AOP（面向切面编程）。如果没有 AOP，二级缓存确实够了，new 出 A 丢进二级缓存，B 进来直接拿走，OK。如果有 AOP，A 最终交给用户的使用应该是代理对象（Proxy），而不是原始对象（Raw）。Spring 的设计初衷是：希望 Bean 在初始化之后才做 AOP，如果每个 Bean 一出生就做 AOP，性能会极差，而且很多初始化逻辑还没跑，AOP 可能会报错。

三级缓存里存的是 ObjectFactory，它的逻辑是：如果没人急着要我，我就按原计划在最后一步做 AOP；如果有人（比如 B）现在就要我，那我就提前把 AOP 做了。具体过程是：

1. **A 实例化**：把一个 “工厂 Lambda” 丢进三级缓存。这个工厂还没运行，只是个承诺。
2. **B 注入 A**：B 去问容器要 A。
3. **触发工厂**：容器发现三级缓存有 A 的工厂，于是问工厂：“现在 B 就要 A，你看看 A 需不需要做 AOP？”
4. **提前拦截**：工厂根据配置，提前为 A 生成了代理对象 A_Proxy。
5. **转移到二级**：这个 A_Proxy 被塞进二级缓存。
6. **B 成功拿到 A_Proxy**：B 注入的是正确的代理对象。
7. **A 慢慢初始化**：A 继续走它的流水线，最后它会发现自己的代理对象已经提前生成并存在二级缓存里了，于是 A 就不再重复做 AOP 了。

所以，三级缓存的本质是：

* `一级缓存`：存最终成品。
* `二级缓存`：存提前生成的代理或被提前引用的原始对象。它保证了不管多少Bean找 A，拿到的都是同一个代理对象。
* `三级缓存`：存判断逻辑。它是分水岭，决定了 AOP 是按原计划进行（最后一步），还是因为循环依赖而提前进行。

<br>



## 具体的代码是怎样的？

下面是 spring 三级缓存的大致逻辑（Spring 使用的是 ReentrantLock），这里使用了双重检查锁的机制，保证在多线程的环境下，对象的创建也是安全的。


```java
// DefaultSingletonBeanRegistry
// |----FactoryBeanRegistrySupport
// |--------AbstractBeanFactory
// |------------AbstractAutowireCapableBeanFactory
// |----------------DefaultListableBeanFactory
//
public Object getSingleton(String beanName) {
    // 1. 一级缓存
    Object bean = singletonObjects.get(beanName);
    if (bean == null && isSingletonCurrentlyInCreation(beanName)) {
        // 2. 二级缓存
        bean = earlySingletonObjects.get(beanName);
        if (bean == null) {
            // 3. 加锁并触发三级缓存
            synchronized (singletonObjects) {
                bean = singletonObjects.get(beanName);
                if (bean == null) {
                    bean = earlySingletonObjects.get(beanName);
                    if (bean == null) {
                        ObjectFactory<?> factory = singletonFactories.get(beanName);
                        if (factory != null) {
                            bean = factory.getObject();
                            earlySingletonObjects.put(beanName, bean);
                            singletonFactories.remove(beanName);
                        }
                    }
                }
            }
        }
    }
    return bean;
}
```

<br>



## 手搓一个出来

在之前的介绍中，我们已经在 [《Spring IoC 和 DI 的简单实现》](/2025/05/16/Spring%20IoC%20和%20DI%20的简单实现/#手搓一个-Sping-容器出来) 介绍了如何手搓一个简单的Sping 容器。我们将在此基础上加入 ”解决循环依赖“ 的逻辑。在此过程中，我尽量保持与 Spring 类的设计与组织额的一致性。主要改动点包括：

1. 引入 ObjectFactory 接口：用于三级缓存的回调。
2. 增强 AbstractBeanFactory：实现三级缓存 Map 管理和 getSingleton 双重检查锁。
3. 重构 AbstractAutowireCapableBeanFactory：在实例化后立即暴露三级缓存，并完善 applyPropertyValues  以支持 Bean 之间的互相引用。

<br>

 核心回调接口：ObjectFactory

```java
/**
 * @author KJ
 * @description 函数式接口：用于三级缓存存放 Lambda 表达式（即工厂）
 */
@FunctionalInterface
public interface ObjectFactory<T> {
    T getObject() throws Exception;
}
```

单例注册基类：DefaultSingletonBeanRegistry，这是 Spring 源码中三级缓存最核心的所在地。

```java
/**
 * @author KJ
 * @description 单例 Bean 注册器
 */
public class DefaultSingletonBeanRegistry {

    /** 一级缓存：成品单例对象 */
    private final Map<String, Object> singletonObjects = new ConcurrentHashMap<>(256);

    /** 二级缓存：提前暴露的半成品单例对象（尚未填充属性） */
    private final Map<String, Object> earlySingletonObjects = new HashMap<>(16);

    /** 三级缓存：存放 Bean 工厂（用于解决循环依赖及 AOP） */
    private final Map<String, ObjectFactory<?>> singletonFactories = new HashMap<>(16);

    /** 记录当前正在创建中的 Bean，用来判断循环依赖 */
    private final Set<String> singletonsCurrentlyInCreation = Collections.newSetFromMap(new ConcurrentHashMap<>(16));


    /**
     * 对应源码 getSingleton(String beanName, boolean allowEarlyReference)
     */
    protected Object getSingleton(String beanName, boolean allowEarlyReference) throws Exception {
        Object singletonObject = this.singletonObjects.get(beanName);

        // 如果一级缓存没有，且正在创建中
        if (singletonObject == null && isSingletonCurrentlyInCreation(beanName)) {
            singletonObject = this.earlySingletonObjects.get(beanName);

            if (singletonObject == null && allowEarlyReference) {
                // 此时发生循环依赖，尝试从三级缓存提取
                synchronized (this.singletonObjects) {
                    singletonObject = this.earlySingletonObjects.get(beanName);
                    if (singletonObject == null) {
                        ObjectFactory<?> singletonFactory = this.singletonFactories.get(beanName);
                        if (singletonFactory != null) {
                            singletonObject = singletonFactory.getObject();
                            // 晋升到二级缓存
                            this.earlySingletonObjects.put(beanName, singletonObject);
                            this.singletonFactories.remove(beanName);
                        }
                    }
                }
            }
        }
        return singletonObject;
    }

    public void addSingleton(String beanName, Object singletonObject) {
        synchronized (this.singletonObjects) {
            this.singletonObjects.put(beanName, singletonObject);
            this.earlySingletonObjects.remove(beanName);
            this.singletonFactories.remove(beanName);
        }
    }

    protected void addSingletonFactory(String beanName, ObjectFactory<?> singletonFactory) {
        synchronized (this.singletonObjects) {
            if (!this.singletonObjects.containsKey(beanName)) {
                this.singletonFactories.put(beanName, singletonFactory);
                this.earlySingletonObjects.remove(beanName);
            }
        }
    }

    protected boolean isSingletonCurrentlyInCreation(String beanName) {
        return this.singletonsCurrentlyInCreation.contains(beanName);
    }

    protected void beforeSingletonCreation(String beanName) {
        this.singletonsCurrentlyInCreation.add(beanName);
    }

    protected void afterSingletonCreation(String beanName) {
        this.singletonsCurrentlyInCreation.remove(beanName);
    }
}
```

抽象工厂：AbstractBeanFactory，它继承自 DefaultSingletonBeanRegistry，负责定义 getBean 的骨架。

```java
/**
 * @author KJ
 * @description 抽象bean工厂：在此实现单例控制
 */
public abstract class AbstractBeanFactory extends DefaultSingletonBeanRegistry implements BeanFactory {

    @Override
    public Object getBean(String name) throws Exception {
        // 1. 尝试从三级缓存中获取单例
        Object bean = getSingleton(name, true);
        if (bean != null) {
            return bean;
        }

        // 2. 缓存没有，获取 Bean 画像
        BeanDefinition beanDefinition = getBeanDefinition(name);
        if (beanDefinition == null) {
            throw new Exception("No bean named " + name + " is defined");
        }

        // 3. 准备创建 Bean
        beforeSingletonCreation(name);
        try {
            return createBean(name, beanDefinition);
        } finally {
            afterSingletonCreation(name);
        }
    }

    protected abstract BeanDefinition getBeanDefinition(String beanName);
    protected abstract Object createBean(String beanName, BeanDefinition beanDefinition) throws Exception;
}
```

自动装配工厂：AbstractAutowireCapableBeanFactory，它负责提前暴露。

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
            // 阶段 1：实例化 (反射 new)
            bean = createBeanInstance(beanDefinition);

            // 严谨点：在实例化后、属性填充前，提前暴露引用
            addSingletonFactory(beanName, () -> bean);

            // 阶段 2：属性填充 (可能触发递归 getBean)
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

    protected void applyPropertyValues(String beanName, Object bean, BeanDefinition beanDefinition) throws Exception {
        try {
            for (PropertyValue pv : beanDefinition.getPropertyValues()) {
                String name = pv.getName();
                Object value = pv.getValue();

                // 如果是引用类型，需要递归解析 Bean
                if (value instanceof BeanReference) {
                    BeanReference beanReference = (BeanReference) value;
                    value = getBean(beanReference.getBeanName());
                }

                String setterName = "set" + name.substring(0, 1).toUpperCase() + name.substring(1);
                Method[] methods = bean.getClass().getMethods();
                for (Method m : methods) {
                    if (m.getName().equals(setterName)) {
                        m.setAccessible(true);
                        m.invoke(bean, value);
                        break;
                    }
                }
            }
        } catch (Exception e) {
            throw new Exception("Error setting property values for bean: " + beanName, e);
        }
    }
}
```

辅助类：BeanReference

```java
/**
 * @author KJ
 * @description 表示对另一个 Bean 的引用，即 <property name="user" ref="userBean"/>
 */
public class BeanReference {
    private final String beanName;

    public BeanReference(String beanName) {
        this.beanName = beanName;
    }

    public String getBeanName() {
        return beanName;
    }
}
```

调整 XmlBeanDefinitionReader 的解析逻辑，让它能识别 ref 属性并生成 BeanReference。

我们需要升级解析逻辑，让它能识别 `ref` 属性并生成 `BeanReference`。

```java
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
                String ref = propEle.getAttribute("ref"); // 👈 新增：获取 ref 属性
                if (ref != null && !ref.isEmpty()) {
                    // 如果有 ref，存入 BeanReference 对象
                    beanDefinition.addPropertyValue(new PropertyValue(name, new BeanReference(ref)));
                } else {
                    // 如果是普通 value，存入字符串
                    beanDefinition.addPropertyValue(new PropertyValue(name, value));
                }
            }

            // 4. 注册到工厂
            registry.registerBeanDefinition(id, beanDefinition);
        }
    }
}
```

<br>



## 测试单元

```java
@Data
public class A {
    private B b;
    private String name;

    @Override
    public String toString() {
        return "A{name=" + name + "}";
    }
}

@Data
public class B {
    private A a;
    private String name;

    @Override
    public String toString() {
        return "B{name=" + name + "}";
    }
}
```

```xml
<bean id="beanA" class="com.demo.entity.A">
    <property name="name" value="IamA"/>
    <property name="b" ref="beanB"/>
</bean>

<bean id="beanB" class="com.demo.entity.B">
    <property name="name" value="IamB"/>
    <property name="a" ref="beanA"/>
</bean>
```

```java
@Test
public void test01() throws Exception {
    ApplicationContext context = new ClassPathXmlApplicationContext("bean-circle-di.xml");
    A beanA = (A) context.getBean("beanA");
    B beanB = (B) context.getBean("beanB");
    System.out.println(beanA + " " + beanA.getB().getName());
    System.out.println(beanB + " " + beanB.getA().getName());
}
```

测试结果：

```
A{name=IamA} IamB
B{name=IamB} IamA
```

大功告成！

