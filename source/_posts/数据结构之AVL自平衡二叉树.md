title: 数据结构之AVL自平衡二叉树

author: kinglyjn

katex: true

tags:

  - structure
  - tree
  - algo

categories:

  - data
  - structure

date: 2021-03-20 10:11:43

---



## AVL的起源

**AVL** 并不是一个缩写词，而是取自它的两位前苏联发明者：G.M. Adelson-Velsky 和 E.M. Landis。他们在 1962 年的论文中首次提出了这种结构。这是历史上第一种自平衡二叉搜索树。在那个内存以 KB 计算的年代，如何高效利用存储空间和计算周期是生死攸关的大事。

<br>

<!--more-->



**要解决的核心问题：防止二叉树“降级”**

我们在之前的二叉树中已经看到了：当插入数据趋于有序（如 1, 2, 3, 4）时，树会不可避免地退化成一个链表。这种普通 BST 的性能完全取决于输入数据的运气。AVL 的使命就是无论你按什么顺序输入，它都要通过 “强力整形”，即所谓的 `旋转`，确保查找的时间复杂度死死锁定在 **$O(\log n)$**。

<br>



**核心原理：极度均衡的平衡因子**

AVL 树的灵魂在于它对 “平衡” 的严苛定义。

<span style="color:blue;">① 平衡因子（Balance Factor, BF）</span>

每一个节点现在多了一个属性，叫做平衡因子：$BF = \text{Height(Left Subtree)} - \text{Height(Right Subtree)}$

**AVL 的铁律**：每一个节点的 $|BF|$ 必须 $\le 1$。也就是说，左子树和右子树的高度差，最多只能是 1。一旦变成 2，树就会立刻触发 “警报”，开始自我调整。

<span style="color:blue;">② 四种失衡场景与四大招式</span>

为了维持这个 $BF \le 1$ 的铁律，AVL 总结出了四种 “长歪” 的情况，并对应了四种手术方案：

<img src="/images/image-20260222193830600.png" style="width;70%">

<br>



**AVL的优缺点**

AVL 树就像一个有强迫症的整理控。它的最大优点是其构建的二叉树极度平衡，查找速度是所有BST中最快的。这种为了维持这种 “绝对平衡”，每次插入或删除节点时，都可能引发从下往上的一连串旋转，导致 `写入性能` 略有下降。这就是为什么后来出现了 “红黑树” 的原因，红黑树放宽了平衡的要求，在树的均衡和写入效率之间寻找到了最佳的平衡。

<br>



## 旋转的过程

想象三个节点：**10 → 20 → 30**（连成了一条向右下的直线）。

* 失衡感：10 觉得右边太沉了。
* 动作：我们抓住 20，把它往上提。
* 发生的位移：20 升官变成了新的最高领导；10 降级变成了 20 的左孩子；30 没动依然是 20 的右孩子，只是跟着 20 一起往上挪了一位。

结果原本 3 层的 “长棍子”，变成了以 20 为中心的 “人字形” 结构。

旋转里最容易让人糊涂的是：如果被提拔的那个孩子，原本就有自己的孩子怎么办？比如 20 原本有一个左孩子 15。现在 20 要晋升取代 10 的位置 15 该往哪放？解决方式如下：

* 20 要变成 10 的新领导，它的左手必须腾出来拉住 10。
* 20 就把 15 这个包袱甩给了 10。

为什么能甩呢？这是因为 15 本来就在 20 的左边（比 20 小），且在 10 的右边（比 10 大）。所以把它挂在 10 的右边，完美符合 “左小右大 ” 的规则。这就是代码里 `x.right = y.left` 的含义：原来父节点下台前，接手了新的父节点腾出手时丢下的子节点。你可以把旋转的过程总结成下面的四个字：

* **提**：把重的那个孩子往上提。
* **降**：把原来的父节点往下拉。
* **甩**：把多出来的子树像包袱一样甩给降级的父节点。
* **平**：原本倾斜的天平，瞬间就拉平了。

<br>



{% raw %}
<div id="avl-slow-motion" style="max-width: 800px; margin: 20px 0 50px 0; font-family: -apple-system, sans-serif; border: 1px solid #e1e1e1; border-radius: 16px; padding: 25px; background: #fff; text-align: center; box-sizing: border-box;">



    <div style="margin-bottom: 20px;">
        <span style="margin: 0; color: #1d1d1f; font-weight: 700;">AVL 左旋和右旋过程演示</span>
        <p style="font-size: 13px; color: #86868b;">观察节点如何通过“降级”与“提拔”重新分配高度</p>
    </div>
    
    <div style="background: #ffffff; border: 1px solid #f0f0f0; border-radius: 12px; height: 360px; position: relative; overflow: hidden; display: flex; justify-content: center; align-items: center; box-shadow: inset 0 2px 8px rgba(0,0,0,0.02);">
        <svg id="slow-svg" width="100%" height="100%" viewBox="0 0 500 360">
            <g id="slow-lines"></g>
            <g id="slow-nodes"></g>
        </svg>
    </div>
    
    <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 15px;">
        <div id="slow-log" style="font-size: 14px; color: #007aff; background: #f8f9ff; padding: 15px; border-radius: 10px; min-height: 50px; display: flex; align-items: center; justify-content: center; border: 1px solid #e0e8ff; line-height: 1.5;">
            准备就绪。点击下方按钮开始构建。
        </div>
        <div style="display: flex; gap: 10px; justify-content: center;">
            <button id="slow-next" style="background: #007aff; color: #fff; border: none; padding: 12px 30px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s;">
                执行下一步
            </button>
            <button id="slow-reset" style="background: #f2f2f7; color: #1d1d1f; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer;">
                重置
            </button>
        </div>
    </div>
    
    <script>
    (function() {
        const svgNodes = document.getElementById('slow-nodes');
        const svgLines = document.getElementById('slow-lines');
        const log = document.getElementById('slow-log');
        const nextBtn = document.getElementById('slow-next');
        const resetBtn = document.getElementById('slow-reset');
    
        let step = 0;
        const sequence = [
            { v: 30, msg: "1. 插入 30：作为初始根节点。", nodes: {30:[250,60]} },
            { v: 40, msg: "2. 插入 40：正常挂载到右侧。目前平衡。", nodes: {30:[250,60], 40:[330,130]}, lines: [[30,40]] },
            { v: 50, msg: "3. 插入 50：RR 型失衡！根节点 30 的 BF 变为 -2。准备执行【左旋】。", nodes: {30:[250,60], 40:[330,130], 50:[410,200]}, lines: [[30,40],[40,50]] },
            { v: 'rotate1', msg: "4. 左旋完成：40 晋升为新根，30 被拉向左侧。<br>注意 30 和 40 的位置调换过程。", nodes: {40:[250,60], 30:[170,130], 50:[330,130]}, lines: [[40,30],[40,50]] },
            { v: 20, msg: "5. 插入 20：挂载在左侧底部。", nodes: {40:[250,60], 30:[170,130], 50:[330,130], 20:[90,200]}, lines: [[40,30],[40,50],[30,20]] },
            { v: 10, msg: "6. 插入 10：LL 型失衡！30 的左边太重。准备执行【右旋】。", nodes: {40:[250,60], 30:[170,130], 50:[330,130], 20:[90,200], 10:[30,270]}, lines: [[40,30],[40,50],[30,20],[20,10]] },
            { v: 'rotate2', msg: "7. 右旋完成：20 晋升，30 下沉。<br>树再次恢复完美的平衡状态。", nodes: {40:[250,60], 20:[150,130], 50:[350,130], 10:[100,200], 30:[200,200]}, lines: [[40,20],[40,50],[20,10],[20,30]] }
        ];
    
        function render() {
            const data = sequence[step];
            log.innerHTML = data.msg;
            
            // 节点处理
            Object.entries(data.nodes).forEach(([val, pos]) => {
                let g = document.getElementById('snode-'+val);
                if (!g) {
                    g = document.createElementNS("http://www.w3.org/2000/svg", "g");
                    g.id = 'snode-'+val;
                    g.innerHTML = `<circle r="20" fill="#fff" stroke="#007aff" stroke-width="2.5" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1))" /><text fill="#1d1d1f" text-anchor="middle" dominant-baseline="central" font-weight="bold" font-size="13px">${val}</text>`;
                    g.style.transition = "all 1.5s cubic-bezier(0.6, -0.2, 0.2, 1.2)";
                    svgNodes.appendChild(g);
                }
                g.style.transform = `translate(${pos[0]}px, ${pos[1]}px)`;
                
                // 旋转高亮
                if(data.v.toString().includes('rotate')) {
                    g.querySelector('circle').setAttribute('stroke', '#34c759');
                    setTimeout(() => g.querySelector('circle').setAttribute('stroke', '#007aff'), 1500);
                }
            });
    
            // 连线处理
            svgLines.innerHTML = '';
            (data.lines || []).forEach(pair => {
                const p1 = data.nodes[pair[0]];
                const p2 = data.nodes[pair[1]];
                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute("x1", p1[0]); line.setAttribute("y1", p1[1]);
                line.setAttribute("x2", p2[0]); line.setAttribute("y2", p2[1]);
                line.setAttribute("stroke", "#eee"); line.setAttribute("stroke-width", "2.5");
                line.style.transition = "all 1.5s ease";
                svgLines.appendChild(line);
            });
        }
    
        nextBtn.onclick = () => { if(step < sequence.length-1) { step++; render(); } };
        resetBtn.onclick = () => {
            // 1. 增加一个淡出效果
            svgNodes.style.transition = "opacity 0.5s ease";
            svgLines.style.transition = "opacity 0.5s ease";
            svgNodes.style.opacity = "0";
            svgLines.style.opacity = "0";
    
            // 2. 等待动画结束再清空
            setTimeout(() => {
                step = 0;           // 重置步骤计数
                svgNodes.innerHTML = ''; // 清空所有 DOM 节点
                svgLines.innerHTML = ''; // 清空所有连线
                svgNodes.style.opacity = "1"; // 恢复透明度
                svgLines.style.opacity = "1";
    
                // 3. 恢复初始渲染
                render(); 
            }, 500);
    
            log.innerHTML = "♻️ 状态已重置，准备重新构建。";
        };
        render();
    })();
    </script>
</div>
{% endraw %}



代码实现：

```java
/**
 * 左旋转 (RR 型失衡使用)
 */
private TreeNode leftRotate(TreeNode x) {
    // 拿到句柄
    TreeNode y = x.right;
    TreeNode temp = y.left;

    // 执行旋转：y 提拔、x 下沉
    y.left = x;
    x.right = temp;

    // 更新高度：先更新底层x、再更新高层y
    updateHeight(x);
    updateHeight(y);

    // 返回高层y作为当前根节点
    return y;
}

/**
 * 右旋转 (LL 型失衡使用)
 */
private TreeNode rightRotate(TreeNode y) {
    // 拿到句柄
    TreeNode x = y.left;
    TreeNode temp = x.right; // 暂存x的右子树（过继子）

    // 执行旋转：x 提拔、y 下沉
    x.right = y;
    y.left = temp;

    // 更新高度：先更新底层y、再更新高层x
    updateHeight(y);
    updateHeight(x);

    // 返回高层x作为当前根节点
    return x;
}
```

<br>



## 完整的代码实现

AVL 树的生成过程交互演示：

{% raw %}
<div id="avl-surgical-v6" style="display: flex; flex-direction: column; width: 100%; max-width: 800px; height: 600px; margin: 15px 0 40px 0; background: #fff; border: 1px solid #e1e1e1; border-radius: 10px; overflow: hidden; font-family: -apple-system, sans-serif; ">


    <div style="padding: 15px; background: #f9f9fb; border-bottom: 1px solid #eee;">
        <div style="display: flex; gap: 8px; margin-bottom: 10px;">
            <input id="v-in" type="number" placeholder="输入数值" style="width:30px;flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px; outline: none;">
            <button id="ins-btn" onclick="doIns()" style="background: #1d1d1f; color: #fff; border: none; padding: 0 20px; border-radius: 8px; font-weight: 600; cursor: pointer;">插入</button>
            <button onclick="resetAll()" style="background: #fff; color: #ff3b30; border: 1px solid #ff3b30; padding: 0 15px; border-radius: 8px; font-weight: 600; cursor: pointer;">重置</button>
        </div>
        
        <div id="log-panel" style="padding: 12px; background: #fff; border-radius: 8px; border: 1px solid #f0f0f0; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; flex-direction: column;">
                <span id="bf-status" style="font-size: 10px; font-weight: 800; color: #34c759; margin-bottom: 2px;">● 系统就绪</span>
                <span id="msg" style="font-size: 13px; color: #424245; line-height: 1.2;">请输入数值开始构建 AVL 树</span>
            </div>
            <button id="act-btn" onclick="goRot()" style="display: none; background: #ff9500; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; animation: pulse 1s infinite;">确认旋转</button>
        </div>
    </div>
    
    <div style="flex: 1; position: relative; overflow: hidden; background: #fff;">
        <svg id="svg" style="width: 100%; height: 100%;" viewBox="0 0 400 500">
            <g id="ls-g"></g>
            <g id="ns-g"></g>
        </svg>
    </div>
</div>

<style>
    @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
    .node-target circle { stroke: #ff3b30 !important; stroke-width: 3px !important; stroke-dasharray: 4; fill: #fff1f0 !important; }
    .anim { transition: all 0.7s cubic-bezier(0.34, 1.56, 0.64, 1); }
</style>

<script>
(function() {
    let tree = null, resolver = null;
    const nsG = document.getElementById('ns-g'), lsG = document.getElementById('ls-g');
    const msg = document.getElementById('msg'), bfStatus = document.getElementById('bf-status'), actBtn = document.getElementById('act-btn');

    class Node {
        constructor(v) { this.v = v; this.h = 1; this.l = this.r = null; this.x = 200; this.y = 40; }
    }
    
    // 核心插入函数：修复了递归返回丢失的问题
    async function insert(n, v) {
        if (!n) {
            updateLog(`创建新节点 ${v}`, "#34c759");
            return new Node(v);
        }
        
        // 1. 标准 BST 插入
        if (v < n.v) {
            updateLog(`向 ${n.v} 的左侧寻找...`);
            n.l = await insert(n.l, v);
        } else if (v > n.v) {
            updateLog(`向 ${n.v} 的右侧寻找...`);
            n.r = await insert(n.r, v);
        } else return n; // 不允许重复值
    
        // 2. 更新高度
        n.h = 1 + Math.max(h(n.l), h(n.r));
        let bf = getBF(n);
    
        // 3. 平衡检查与旋转预演
        if (bf > 1 || bf < -1) {
            draw(); // 先绘制出插入后的不平衡形态
            let type = "";
            if (bf > 1 && v < n.l.v) type = "LL (左偏失衡)";
            else if (bf < -1 && v > n.r.v) type = "RR (右偏失衡)";
            else if (bf > 1 && v > n.l.v) type = "LR (折线失衡)";
            else if (bf < -1 && v < n.r.v) type = "RL (折线失衡)";
    
            await pause(n, bf, type);
            
            // 执行具体的旋转
            if (bf > 1 && v < n.l.v) return rotR(n);
            if (bf < -1 && v > n.r.v) return rotL(n);
            if (bf > 1 && v > n.l.v) {
                updateLog("LR 第一步：左旋子节点");
                n.l = rotL(n.l); draw(); 
                await pause(n, bf, "LR 第二步：右旋根节点");
                return rotR(n);
            }
            if (bf < -1 && v < n.r.v) {
                updateLog("RL 第一步：右旋子节点");
                n.r = rotR(n.r); draw(); 
                await pause(n, bf, "RL 第二步：左旋根节点");
                return rotL(n);
            }
        }
        return n;
    }
    
    const h = n => n ? n.h : 0;
    const getBF = n => n ? h(n.l) - h(n.r) : 0;
    
    const rotR = y => { 
        let x = y.l, T = x.r; x.r = y; y.l = T; 
        y.h = Math.max(h(y.l), h(y.r))+1; 
        x.h = Math.max(h(x.l), h(x.r))+1; 
        updateLog("右旋完成"); return x; 
    };
    
    const rotL = x => { 
        let y = x.r, T = y.l; y.l = x; x.r = T; 
        x.h = Math.max(h(x.l), h(x.r))+1; 
        y.h = Math.max(h(y.l), h(y.r))+1; 
        updateLog("左旋完成"); return y; 
    };
    
    function updateLog(t, color = "#86868b") {
        msg.innerText = t;
        bfStatus.style.color = color;
    }
    
    function pause(n, bf, type) {
        return new Promise(res => {
            bfStatus.innerText = "● " + type;
            bfStatus.style.color = "#ff3b30";
            msg.innerText = `节点 ${n.v} 发生失衡 (BF=${bf})`;
            actBtn.style.display = "block";
            const g = document.getElementById('g-'+n.v);
            if(g) g.classList.add('node-target');
            resolver = () => {
                if(g) g.classList.remove('node-target');
                actBtn.style.display = "none";
                res();
            };
        });
    }
    
    window.goRot = () => resolver && resolver();
    
    function updatePos(n, x, y, level, range) {
        if (!n) return;
        n.x = x; n.y = y;
        updatePos(n.l, x - range/2, y + 65, level + 1, range/2);
        updatePos(n.r, x + range/2, y + 65, level + 1, range/2);
    }
    
    function draw() {
        updatePos(tree, 200, 40, 1, 160);
        let nodes = [], lines = [];
        (function walk(n) {
            if(!n) return; nodes.push(n);
            if(n.l){ lines.push({f:n, t:n.l}); walk(n.l); }
            if(n.r){ lines.push({f:n, t:n.r}); walk(n.r); }
        })(tree);
    
        lsG.innerHTML = lines.map(l => `<line class="anim" x1="${l.f.x}" y1="${l.f.y}" x2="${l.t.x}" y2="${l.t.y}" stroke="#ddd" stroke-width="2"></line>`).join('');
        nodes.forEach(n => {
            let g = document.getElementById('g-' + n.v);
            if (!g) {
                g = document.createElementNS("http://www.w3.org/2000/svg", "g");
                g.id = 'g-' + n.v; g.classList.add('anim');
                g.innerHTML = `<circle r="16" fill="#fff" stroke="#1d1d1f" stroke-width="2"></circle><text dy=".35em" text-anchor="middle" font-size="10" font-weight="bold">${n.v}</text>`;
                nsG.appendChild(g);
            }
            g.style.transform = `translate(${n.x}px, ${n.y}px)`;
        });
    }
    
    window.doIns = async () => {
        const input = document.getElementById('v-in');
        const v = parseInt(input.value);
        if (isNaN(v)) return;
        input.value = '';
        tree = await insert(tree, v);
        draw();
        bfStatus.innerText = "● NORMAL";
        bfStatus.style.color = "#34c759";
        msg.innerText = `节点 ${v} 插入成功`;
    };
    
    window.resetAll = () => {
        tree = null;
        nsG.innerHTML = "";
        lsG.innerHTML = "";
        actBtn.style.display = "none";
        updateLog("请输入数值开始");
        bfStatus.innerText = "● 系统就绪";
        bfStatus.style.color = "#34c759";
    };
})();
</script>
{% endraw %}



下面是一个完整的 ALV 插入、查找、遍历的示例：

```java
/**
 * @author KJ
 */
public class MyAVL {

    private TreeNode root;
    public static class TreeNode {
        int value;
        int height;
        TreeNode left;
        TreeNode right;

        public TreeNode(int value) {
            this.value = value;
            this.height = 1;
        }
    }

    private void updateHeight(TreeNode node) {
        if (node != null) {
            node.height = Math.max(getHeight(node.left), getHeight(node.right)) + 1;
        }
    }

    private int getHeight(TreeNode node) {
        return node == null ? 0 : node.height;
    }

    private int getBalanceFactor(TreeNode node) {
        return node == null ? 0 : getHeight(node.left) - getHeight(node.right);
    }

    /**
     * 右旋转 (LL 型失衡使用)
     */
    private TreeNode rightRotate(TreeNode y) {
        // 拿到句柄
        TreeNode x = y.left;
        TreeNode temp = x.right; // 暂存x的右子树（过继子）

        // 执行旋转：x 提拔、y 下沉
        x.right = y;
        y.left = temp;

        // 更新高度：先更新底层y、再更新高层x
        updateHeight(y);
        updateHeight(x);

        // 返回高层x作为当前根节点
        return x;
    }

    /**
     * 左旋转 (RR 型失衡使用)
     */
    private TreeNode leftRotate(TreeNode x) {
        // 拿到句柄
        TreeNode y = x.right;
        TreeNode temp = y.left;

        // 执行旋转：y 提拔、x 下沉
        y.left = x;
        x.right = temp;

        // 更新高度：先更新底层x、再更新高层y
        updateHeight(x);
        updateHeight(y);

        // 返回高层y作为当前根节点
        return y;
    }


    /**
     * 插入
     */
    public void insert(int value) {
        this.root = insert(this.root, value);
    }

    private TreeNode insert(TreeNode curRoot, int value) {
        // 1. 标准 BST 插入逻辑
        if (curRoot == null) {
            return new TreeNode(value);
        }
        if (value < curRoot.value) {
            curRoot.left = insert(curRoot.left, value);
        } else if (value > curRoot.value) {
            curRoot.right = insert(curRoot.right, value);
        } else {
            // node.data = newData; // 如果节点存有数据
            return curRoot; // 不允许重复值
        }

        // 2. 更新高度
        updateHeight(curRoot);

        // 3. 计算平衡因子，检查是否失衡
        int balance = getBalanceFactor(curRoot);

        // 4. 处理四种失衡的情况
        // 4.1 LL => 执行右旋
        if (balance > 1 && value < curRoot.left.value) {
            return rightRotate(curRoot);
        }
        // 4.2 RR => 执行左旋
        if (balance < -1 && value > curRoot.right.value) {
            return leftRotate(curRoot);
        }
        // 4.3 LR => 先局部左旋，再整体右旋
        if (balance > 1 && value > curRoot.left.value) {
            curRoot.left = leftRotate(curRoot.left);
            return rightRotate(curRoot);
        }
        // 4.4 RL => 先局部右旋，再整体左旋
        if (balance < -1 && value < curRoot.right.value) {
            curRoot.right = rightRotate(curRoot.right);
            return leftRotate(curRoot);
        }
        return curRoot;
    }


    /**
     * 查找
     */
    public boolean search(int value) {
        TreeNode curRoot = this.root;
        while (curRoot != null) {
            if (value == curRoot.value) return true;
            curRoot = value < curRoot.value ? curRoot.left : curRoot.right;
        }
        return false;
    }

    /**
     * 中序遍历打印树结构
     */
    public void printTree() {
        printTree(root, 0);
    }

    private void printTree(TreeNode node, int level) {
        if (node == null) {
            return;
        }

        printTree(node.right, level + 1);
        if (level == 0) {
            System.out.println(node.value + "[" + node.height + "]");
        } else {
            String subPrefix = "|    ".repeat(level - 1);
            System.out.println(subPrefix + "|---" + node.value + "[" + node.height + "]");
        }
        printTree(node.left, level + 1);
    }

    public static void main(String[] args) {
        MyAVL avl = new MyAVL();

        // 故意按顺序插入，看它是否能通过旋转保持平衡
        int[] values = {10, 20, 30, 40, 50, 25}; 
        for (int value : values) {
            avl.insert(value);
        }

        avl.displayTree();
        System.out.println(avl.search(25));
        System.out.println(avl.search(90));
    }
}
```

测试结果：

```
|    |---50[1]
|---40[2]
30[3]
|    |---25[1]
|---20[2]
|    |---10[1]
true
false
```

