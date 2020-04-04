title: '自动化测试框架 selenium-java 简介和使用 '
author: kinglyjn
tags:
  - selenium
categories:
  - framework
  - selenium
date: 2019-03-26 16:40:00
---
## 简介

### 什么是Selenium?

* 一套软件工具，用来支持不同的自动化测试框架
* 跨平台：linux、windows、mac，支持多种编程语言
* 核心功能就是可以在多个浏览器上进行自动化测试
* 目前已经被google , 百度， 腾讯等公司广泛使用
* 能够实现类似商业工具的大部分功能，并且还实现了商业工具不能支持的功能

<!--more-->

### Selenium的发展历史

2004年在ThoughtWorks 公司， 一个叫做Jason Huggins为了减少手工测试的工作， 自己写了一套Javascript的库， 这套库可以进行页面交互， 并且可以重复的在不同浏览器上进行重复的测试操作。这套库后来变为了Selenium Core. 为Selenium Remote Control (RC) 和Selenium IDE 提供了坚实的核心基础能力。Selenium 的作用是划时代的，因为他允许你使用多种语言来控制浏览器。
浏览器的对JS的安全限制也对Selenium的发展带来了困扰，并且Web程序也越来越大，特性也越来越多，都对selenium的发展来说带来了不少困难。2006年Google 的工程师Simon Stewart开启了一个叫做WebDriver的项目， 此项目可以直接让测试工具使用浏览器和操作系统本身提供的方法， 借此来绕过JS环境的沙盒效应， WebDriver项目目标就是为了解决Selenium的痛处。
2008年 Selenium 和 WebDriver 这两个项目进行了合并， Selenium 2.0 出现了，也就是大家说的WebDriver。

### Selenium2的特点

Selenium 2，又名 WebDriver，它的主要新功能是集成了 Selenium 1.0 以及 WebDriver（WebDriver 曾经是 Selenium 的竞争对手）。也就是说 Selenium 2 是 Selenium 和 WebDriver 两个项目的合并，即 Selenium 2 兼容 Selenium，它既支持 Selenium API 也支持 WebDriver API。 WebDriver是一个用来进行复杂重复的web自动化测试的工具。意在提供一种比Selenium1.0更简单易学，有利于维护的API。它没有和任何测试框架进行绑定，所以他可以很好的在单元测试和main方法中调用。一旦创建好一个Selenium工程，你马上会发现WebDriver和其他类库一样：它是完全独立的，你可以直接使用而不需要考虑其他配置，这个Selenium RC是截然相反的。

### Selenium2相比Selenium1的优点

Selenium1.0不能处理以下事件：
1. 本机键盘和鼠标事件 
2. 同源策略XSS/HTTP（S）
3. 弹出框，对话框（基本身份认证，自签名的证书和文件上传/下载）

Webdriver的优点：
* 当这两个框架被合并后，一个框架的缺陷被另一个框架所弥补。WebDriver对浏览器的支持需要对应框架开发工程师做对应的开发；同样Selenium必须操作真实浏览器，但是WebDriver可以HTML unit Driver来模拟浏览器，在内存中执行用例，更加的轻便。Selenium1.0解决了自动化测试中的一些常见问题，WebDriver更好的解决了沙箱限制。WebDriver不支持并行，但是Selenium Grid解决了这个问题。

<br>


## Selenium的使用（以java为例）

1) maven 依赖

``` xml
<dependency>
  <groupId>org.seleniumhq.selenium</groupId>
  <artifactId>selenium-java</artifactId>
  <version>3.14.0</version>
</dependency>
```

2) 基本使用

``` java
public static void main(String[] args) {
	// 设置chrome驱动器程序，下载位置 http://chromedriver.storage.googleapis.com/index.html
	// 注意需要设置为可执行权限	
	System.setProperty("webdriver.chrome.driver", "lib/chromedriver");
    
	ChromeDriver driver = new ChromeDriver();
	driver.get("http://www.baidu.com");
	WebElement loginLink = driver.findElement(By.partialLinkText("登"));
	loginLink.click();

	//绝对路径 以 "/" 开头， 让xpath 从文档的根节点开始解析
	//相对路径 以"//" 开头， 让xpath 从文档的任何元素节点开始解析
	//  //img[starts-with(@alt,'div1')] //查找图片alt属性开始位置包含'div1'关键字的元素
	//  //img[contains(@alt,'g1')] //查找图片alt属性包含'g1'关键字的元素
	//  //*[text()='百度搜索']  //查找所有文本为"百度搜索" 的元素
	WebElement button = driver.findElement(By.xpath("/html/body/div/input[@value='查询']"));
	//WebElement button = driver.findElement(By.xpath("//input[@value='查询']"));
	//WebElement button = driver.findElement(By.xpath("//input[2]")); //查找第二个div标签中的"查询"按钮
	button.isEnabled(); // 判断按钮是否enable
	button.click();

	//文本框
	WebElement textinput = driver.findElement(By.id("usernameid"));
	textinput.sendKeys("这是输入的关键字");
	textinput.clear(); //清空输入框
	textinput.getAttribute("value"); //获取输入框的内容

	// 下拉列表
	Select select = new Select(driver.findElement(By.id("proAddItem_kind")));
	select.selectByIndex(2); // index从0开始的
	select.selectByValue("18");
	select.selectByVisibleText("种类AA");
	// 获取所有的选项
	List<WebElement> options = select.getOptions();
	for (WebElement webElement : options) {
	    System.out.println(webElement.getText());    
	}

	// 单选按钮（多选框和单选框类似）
	WebElement apple = driver.findElement(By.xpath("//input[@type='radio'][@value='Apple']"));
	apple.click(); //选择某个单选框
	apple.isSelected(); //判断某个单选框是否已经被选择
	apple.getAttribute("value"); //获取元素属性

	driver.close();
}
```

<br>


## 元素的定位

1) 常见的定位方法

``` default
定位方法                Java语言实现实例
---------------------------------------------------------------------------
id 定位                driver.findElement(By.id(“id的值”))；
name定位               driver.findElement(By.name(“name的值”))；
链接的全部文字定位        driver.findElement(By.linkText(“链接的全部文字”))；
链接的部分文字定位        driver.findElement(By.partialLinkText(“链接的部分文字”))；
css 方式定位            driver.findElement(By.cssSelector(“css表达式”))；
xpath 方式定位          driver.findElement(By.xpath(“xpath表达式”))；
Class 名称定位          driver.findElement(By.className(“class属性”))；
TagName 标签名称定位     driver.findElement(By.tagName(“标签名称”))；
Jquery方式             ((JavascriptExecutor) driver).executeScript(“return jQuery.find(“jquery表达式”)”)
```

在使用selenium webdriver进行元素定位时,通常使用findElement或findElements方法结合By类返回元素句柄来定位元素
findElement() 方法返回一个元素, 如果没有找到,会抛出一个异常 NoElementFindException()
findElements()方法返回多个元素, 如果没有找到,会返回空数组, 不会抛出异常

2) 选择定位方法的策略

策略是， 选择简单，稳定的定位方法。

1. 当页面元素有id属性的时候，尽量使用id来定位。没有的话，再选择其他定位方法
2. cssSelector 执行速度快，推荐使用
3. 定位超链接的时候，可以考虑linkText或partialLinkText：是要注意的是 ，文本经常发生改变，所以不推荐用
3. xpath 功能最强悍。当时执行速度慢，因为需要查找整个DOM,所以尽量少用。实在没有办法的时候，才使用xpath 

<br>

## 操作浏览器

``` java
public static void main(String[] args) throws Exception {
	// 设置chrome驱动器程序，下载位置 http://chromedriver.storage.googleapis.com/index.html
	System.setProperty("webdriver.chrome.driver", "lib/chromedriver");
	ChromeDriver driver = new ChromeDriver();

	// 最大化、刷新、前进、后退、退出
	driver.get("http://www.baidu.com");
	Thread.sleep(3000);
	driver.manage().window().maximize();
	driver.navigate().refresh(); 
	driver.navigate().back(); 
	driver.navigate().forward();
	//driver.quit(); 
	
	// 截图
	//File srcFile = ((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE);
	//FileUtils.copyFile(srcFile, new File("1.png"));
	
	// 鼠标模拟
	Actions actions = new Actions(driver);
	actions.contextClick(driver.findElement(By.id("kw"))).perform();

	// 杀掉浏览器进程
	WindowsUtils.tryToKillByName("chrome");
	
	driver.close();
}
```
<br>

## 操作对话框

``` java
public static void main(String[] args) throws Exception {
    // 设置chrome驱动器程序，下载位置 http://chromedriver.storage.googleapis.com/index.html
    System.setProperty("webdriver.chrome.driver", "lib/chromedriver");
    ChromeDriver driver = new ChromeDriver();

    // alert (prompt、confirm 类似)
    driver.get("http://www.baidu.com");
    WebElement alertButton = driver.findElement(By.xpath("//input[@value='alert']"));
    alertButton.click();
    Alert javascriptAlert = driver.switchTo().alert();
    System.out.println(javascriptAlert.getText());
    javascriptAlert.accept();
	
    driver.close();
}
```
<br>

## 智能等待页面加载完成

我们经常会碰到用selenium操作页面上某个元素的时候，需要等待页面加载完成后，才能操作。  否则页面上的元素不存在，会抛出异常。或者碰到AJAX异步加载，我们需要等待元素加载完成后，才能操作。selenium中提供了非常简单，智能的方法，来判断元素是否存在。

``` java
public static void main(String[] args) throws Exception {
    // 设置chrome驱动器程序，下载位置 http://chromedriver.storage.googleapis.com/index.html
    System.setProperty("webdriver.chrome.driver", "lib/chromedriver");
    ChromeDriver driver = new ChromeDriver();

    driver.get("file:////Users/zhangqingli/Desktop/aaa.html");
    //总共等待10秒， 如果10秒后，元素还不存在，就会抛出异常  org.openqa.selenium.NoSuchElementException
    driver.manage().timeouts().implicitlyWait(10, TimeUnit.SECONDS);
    WebElement element = driver.findElement(By.cssSelector(".red_box")); 
    ((JavascriptExecutor)driver).executeScript("arguments[0].style.border = \"5px solid yellow\"",element);  
    driver.close();
}
```

显示等待：

``` default
titleIs(String)                  标题是不是“xxxx”
titleContains(String)	         标题是不是包含“XXX”
presenceOfElementLocated(By)	 判断该元素是否被加载在DOM中，并不代表该元素一定可见 
visibilityOfElementLocated(By)	 判断元素是否可见（非隐藏，并且元素的宽和高都不等以0）
visibilityOf(WebElement)	     判断元素(定位后)是否可见
presenceOfAllElementsLocatedBy(By)	         只要存在一个就是true
textToBePresentInElementLocated(By, String)	 元素中的text是否包含预期的字符串
textToBePresentInElementValue(By, String)	 元素的value属性中是否包含预期的字符串
frameToBeAvailableAndSwitchToIt(By)	         判断该表单是否可以切过去，可以就切过去并返回true，否则返回false
invisibilityOfElementLocated(By)	         判断某个元素是否不存在于DOM树或不可见
elementToBeClickable(By)	                 判断元素是否可见并且是可以点击的
stalenessOf(WebElement)	                     等到一个元素从DOM树中移除
elementToBeSelected(WebElement)	             判断某个元素是否被选中，一般用在下拉列表
elementSelectionStateToBe(By, boolean)	     判断某个元素的选中状态是否符合预期
elementSelectionStateToBe(WebElement, boolean)	  与上一个方法一样，只是该方法参数为定位后的元素，
                                                  上一个方法接收的参数为定位，判断某个元素(已定位)的选中状态是否符合预期
alertIsPresent()	                         判断页面中是否存在alert
textToBePresentInElement(By locator)         在页面元素中是否包含特定的文本
```
如果超过设定的最大显式等待时间阈值，则测试程序会抛出异常。


隐式等待：

``` java
driver.manage().timeouts().implicitlyWait(10, TimeUnit.SECONDS);
```
隐式等待是通过一定的时长等待页面上某个元素加载完成。如果超过了设置的时长元素还没有被加载出来，则抛出NoSuchElementException异常。
代码中设置等待时间为10秒。首先这个10秒并非是一个固定的等待时间，它并不会影响脚本的执行速度。其次，它并不针对页面上的某一元素进行等待。当脚本执行到某个元素定位时，如果元素可以定位，则继续执行；如果元素定位不到，则它将会以轮询的方式不断地判断元素是否被定位到。假设，第5秒等位到元素，就继续执行；但是如果超出设置的这个10秒，那就直接抛出异常。
<br>

## 处理Iframe中的元素

有时候我们定位元素的时候，发现怎么都定位不了。 这时候你需要查一查你要定位的元素是否在iframe里面

``` java
// 在 主窗口的时候
driver.findElement(By.id("maininput")).sendKeys("main input");
      
driver.switchTo().frame("frameA");
driver.findElement(By.id("iframeinput")).sendKeys("iframe input");

// 回到主窗口
driver.switchTo().defaultContent();
driver.findElement(By.id("maininput")).sendKeys("main input");
```
<br>

## 示例实战

``` java
package bigdata.resource_manage;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.Select;
import org.openqa.selenium.support.ui.WebDriverWait;
import bigdata.commons.BigdataHelper;
import commons.ChromeDriverHelper;

public class ResourceManageOperationFlow {
    private static final String CONFIG_FILE_NAME = "mdata/bigdata/prod_fq_uc_datasource_table.list";
    private static final String DATABASE_VISIBLE_TEXT = "分期用户中心";
    private static final String BUZ_TYPE_VISIBLE_TEXT = "FQ";
    
    public static void main(String[] args) throws Exception {
        BigdataHelper.login();
        
        BufferedReader br = new BufferedReader(new InputStreamReader(new FileInputStream(new File(CONFIG_FILE_NAME))));
        String line = "";
        while ((line=br.readLine()) != null) {
            // 获取 当前表名、当前增量字段名、当前切分字段名
            String[] splits = line.split("\t");
            if (splits.length != 3) {
                continue;
            }
            String tableName = splits[0];
            String checkColumn = splits[1];
            String splitBy = splits[2];

            // 在分期平台添加和同步mysql相应库的表
            addAndSyncMysqlTableOnBigdataPlatform(DATABASE_VISIBLE_TEXT, BUZ_TYPE_VISIBLE_TEXT, tableName, checkColumn, splitBy);
        }
        
        br.close();
    }
    
    public static void addAndSyncMysqlTableOnBigdataPlatform(String databaseVisibleText, String buzTypeVisibleText, 
            String tableName, String checkColumn, String splitBy) throws Exception {
        //
        Thread.sleep(2000);

        // 点击 导航菜单-配置管理
        ChromeDriver driver = ChromeDriverHelper.getDriver();
        WebElement pzglEle = driver.findElement(By.xpath("//*[@id=\"rrapp\"]/aside/section/ul/li[7]/a"));
        pzglEle.click();
        // 点击 导航菜单-配置管理-数据源表
        WebElement sjybEle = new WebDriverWait(driver,20).until(ExpectedConditions.elementToBeClickable(By.xpath("//*[@id=\"rrapp\"]/aside/section/ul/li[7]/ul/li[3]/a")));
        sjybEle.click();
        // 切换页面
        driver.switchTo().frame(0); // 切换到iframe[0]
        
        // 点击 导航菜单-配置管理-数据源表-iframe::新增 
        WebElement xzEle = new WebDriverWait(driver, 20).until(ExpectedConditions.elementToBeClickable(By.xpath("//*[@id=\"rrapp\"]/div[1]/div[1]/a[2]")));
        xzEle.click();
        
        // 切换页面
        driver.switchTo().defaultContent(); // 切回到主干页
        driver.switchTo().frame(0); // 切换到iframe[0]
        
        // 选择 导航菜单-配置管理-数据源表-新增::数据源下拉列表
        By datasourceSelectBy = By.xpath("//*[@id=\"rrapp\"]/div[2]/form/div[1]/div[2]/select");
        Select datasourceSelect = new Select(driver.findElement(datasourceSelectBy));
        datasourceSelect.selectByVisibleText(databaseVisibleText);
        Thread.sleep(3000);
        
        // 选择 导航菜单-配置管理-数据源表-新增::业务类型下拉列表
        By ywlxBy = By.xpath("//*[@id=\"rrapp\"]/div[2]/form/div[2]/div[2]/select");
        Select ywlxSelect = new Select(driver.findElement(ywlxBy));
        ywlxSelect.selectByVisibleText(buzTypeVisibleText);
        Thread.sleep(2000);
        
        // 选择 导航菜单-配置管理-数据源表-新增::表名下拉列表
        new WebDriverWait(driver, 20).until(ExpectedConditions.presenceOfElementLocated(By.xpath("//*[@id=\"rrapp\"]/div[2]/form/div[3]/div[2]/select/option[1]")));
        Select tablenameSelect = new Select(driver.findElement(By.xpath("//*[@id=\"rrapp\"]/div[2]/form/div[3]/div[2]/select")));
        tablenameSelect.selectByValue(tableName);
        Thread.sleep(1000);
        
        // 选择 导航菜单-配置管理-数据源表-新增::增量字段下拉列表
        if (!"-".equals(checkColumn)) {
            new WebDriverWait(driver, 20).until(ExpectedConditions.presenceOfElementLocated(By.xpath("//*[@id=\"rrapp\"]/div[2]/form/div[4]/div[2]/select/option[@value='"+ checkColumn +"']")));
            Select zlzdSelect = new Select(driver.findElement(By.xpath("//*[@id=\"rrapp\"]/div[2]/form/div[4]/div[2]/select")));
            zlzdSelect.selectByValue(checkColumn);
            Thread.sleep(1000);
        }
        
        // 选择 导航菜单-配置管理-数据源表-新增::SPLIT_BY下拉列表
        if (!"-".equals(splitBy)) {
            new WebDriverWait(driver, 20).until(ExpectedConditions.presenceOfElementLocated(By.xpath("//*[@id=\"rrapp\"]/div[2]/form/div[5]/div[2]/select/option[@value='"+ splitBy +"']")));
            Select splitBySelect = new Select(driver.findElement(By.xpath("//*[@id=\"rrapp\"]/div[2]/form/div[5]/div[2]/select")));
            splitBySelect.selectByValue(splitBy);
            Thread.sleep(1000);
        }
        
        // 点击 导航菜单-配置管理-数据源表-新增::查看字段按钮
        By ckzdButtonBy = By.xpath("//*[@id=\"rrapp\"]/div[2]/form/div[6]/input[3]");
        WebElement ckzdButton = new WebDriverWait(driver, 3).until(ExpectedConditions.presenceOfElementLocated(ckzdButtonBy));
        ckzdButton.click();
        Thread.sleep(3000);
        
        // 点击 导航菜单-配置管理-数据源表-新增::全选复选框
        WebElement checkboxes = new WebDriverWait(driver, 20).until(ExpectedConditions.presenceOfElementLocated(By.xpath("//*[@id=\"cb_columnsGrid\"]")));
        checkboxes.click();
        
        // 点击 导航菜单-配置管理-数据源表-新增::确定按钮
        WebElement submitButton = new WebDriverWait(driver, 20).until(ExpectedConditions.elementToBeClickable(By.xpath("//*[@id=\"rrapp\"]/div[2]/form/div[6]/input[1]")));
        submitButton.click();
        Thread.sleep(1000);
        
        // 切换页面
        driver.switchTo().defaultContent(); // 切回到主干页
        
        // 点击 导航菜单-配置管理-数据源表-新增::弹出div确定按钮 //*[@id="layui-layer4"]/div[3]/a
        WebElement confirmBoxButton = new WebDriverWait(driver, 20).until(ExpectedConditions.presenceOfElementLocated(By.xpath("//*[@type='dialog']/div[3]/a")));
        confirmBoxButton.click();
        Thread.sleep(3000);
        
        // 切换页面
        driver.switchTo().frame(0); // 切换到iframe[0]
        Thread.sleep(1000);
        
        // 点击 导航菜单-配置管理-数据源表::新建表项的复选框
        WebElement tbodyEle = new WebDriverWait(driver, 20).until(ExpectedConditions.presenceOfElementLocated(By.xpath("//tbody")));
        List<WebElement> trEles = tbodyEle.findElements(By.xpath("tr[@role='row']")); // 根据父节点获取下面的子节点，注意xpath的写法（前面不加双斜杠）
        WebElement targetTr = null;
        for (WebElement trEle : trEles) {
            WebElement tableNameTd = trEle.findElement(By.xpath("td[5]")); //注意xpath的index从1开始计
            //String html = tableNameTd.getAttribute("outerHTML"); // 获取节点的outerHTML代码（一般调试用）
            String currentTableName = tableNameTd.getText();
            currentTableName = currentTableName==null ? "" : currentTableName.trim();
            if (currentTableName.equals(tableName)) {
                targetTr = trEle;
                break;
            }
        }
        WebElement targetCheckbox = targetTr.findElement(By.xpath("td[2]/input[@type='checkbox']"));
        targetCheckbox.click();
        Thread.sleep(1000);
        
        // 点击 导航菜单-配置管理-数据源表::一键同步
        WebElement yjtbButton = driver.findElement(By.xpath("//*[@id=\"rrapp\"]/div[1]/div[1]/a[5]"));
        yjtbButton.click();
        Thread.sleep(1000);
        
        // 切换页面
        driver.switchTo().defaultContent();
        
        // 点击确定弹出框1
        WebElement yjtbConfirmButton1 = driver.findElement(By.xpath("//*[@type='dialog']/div[3]/a[1]"));
        yjtbConfirmButton1.click();
        Thread.sleep(1000);
        
        // 点击确定弹出框2
        WebElement yjtbConfirmButton2 = driver.findElement(By.xpath("//*[@type='dialog']/div[3]/a"));
        yjtbConfirmButton2.click();
        Thread.sleep(1000);
    }
}
```