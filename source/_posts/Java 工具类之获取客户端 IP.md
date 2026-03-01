title: Java 工具类之获取客户端 IP

author: kinglyjn

tags:

  - java
  - ip
  - utils

categories:

  - java

  - utils

date: 2018-10-11 09:56:01

---



如果你的应用部署在 Nginx 后面，你必须确保 Nginx 配置了头部转发，否则 IpUtils 拿到的永远是 Nginx 所在的内网 IP。

```bash
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

<br>



<!--more-->



核心代码：

```java
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.util.StringUtils;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import java.net.InetAddress;
import java.net.UnknownHostException;

/**
 * IP 工具类
 *
 * @author KJ
 * @description 支持解析多层代理 (Nginx, CDN, SLB) 下的真实客户端 IP
 */

@Slf4j
public class IpUtils {

    private static final String UNKNOWN = "unknown";
    private static final String LOCALHOST_IPV4 = "127.0.0.1";
    private static final String LOCALHOST_IPV6 = "0:0:0:0:0:0:0:1";

    /**
     * 在全局 AOP 或 Controller 中直接获取当前请求的真实 IP
     */
    public static String getIp() {
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes == null) {
            return LOCALHOST_IPV4;
        }
        return getIp(attributes.getRequest());
    }

    /**
     * 获取真实 IP 地址
     */
    public static String getIp(HttpServletRequest request) {
        if (request == null) {
            return UNKNOWN;
        }

        // 核心原理：按优先级从各个 Header 中提取
        // 1. X-Forwarded-For: 最常用的代理协议，格式为 Client, Proxy1, Proxy2...
        String ip = request.getHeader("x-forwarded-for");

        // 2. Proxy-Client-IP: Apache HTTP Server 代理
        if (isInvalid(ip)) {
            ip = request.getHeader("Proxy-Client-IP");
        }

        // 3. WL-Proxy-Client-IP: WebLogic 代理
        if (isInvalid(ip)) {
            ip = request.getHeader("WL-Proxy-Client-IP");
        }

        // 4. HTTP_CLIENT_IP: 部分代理
        if (isInvalid(ip)) {
            ip = request.getHeader("HTTP_CLIENT_IP");
        }

        // 5. X-Real-IP: Nginx 常用配置，只记录最后一个代理传过来的真实 IP
        if (isInvalid(ip)) {
            ip = request.getHeader("X-Real-IP");
        }

        // 6. 最终方案：直接获取连接地址
        if (isInvalid(ip)) {
            ip = request.getRemoteAddr();
            // 如果是本机访问，根据网卡取本机配置的 IP
            if (LOCALHOST_IPV4.equals(ip) || LOCALHOST_IPV6.equals(ip)) {
                try {
                    InetAddress confIp = InetAddress.getLocalHost();
                    ip = confIp.getHostAddress();
                } catch (UnknownHostException e) {
                    log.error("IpUtils error: ", e);
                }
            }
        }

        // 7. 处理多层代理的情况
        // X-Forwarded-For 的值如果是 "192.168.1.1, 10.0.0.1"，第一个才是真实客户端 IP
        if (StringUtils.hasText(ip) && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }

        return ip;
    }

    private static boolean isInvalid(String ip) {
        return !StringUtils.hasText(ip) || UNKNOWN.equalsIgnoreCase(ip);
    }
}
```

<br>