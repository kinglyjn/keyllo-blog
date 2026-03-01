title: Git常用指令
author: kinglyjn
tags:

  - git

categories:
  - ops
  - ci_di

date: 2018-09-21 12:51:19

---



### 获取帮助

``` bash
git help -a
git help config
git config -h
git config --list --show-origin
```

注：[Git简明指南](http://rogerdudler.github.io/git-guide/index.zh.html)

<br>



<!--more-->



### 设置命令别名

``` bash
git config --global alias.st status
git config --global alias.lg "log --color --pretty=format:'%Cred%h%Creset - %C(yellow)%d%Creset %s %Cgreen(%ar) %C(blue)<%an>%Creset' --abbrev-commit  --graph --all"
```

<br>



### 远程仓库相关

```bash
# 配置生效顺序 repository config > system config > global config
git config --global user.name "Your Name"
git config --global user.email "email@example.com"
git config --local user.name

git remote add origin git@gitee.com:aacode/demo.git
git clone git@gitee.com:aacode/demo.git
git remote -v
git remote show origin
git remote rename origin keyllo   # 修改一个远程仓库的简写名，注意这同样也会修改你所有远程跟踪的分支名字，那些过去引用 origin/master 的现在会引用 keyllo/master
git remote remove paul  # 一旦你使用这种方式删除了一个远程仓库，那么所有和这个远程仓库相关的远程跟踪分支以及配置信息也会一起被删除

git fetch origin develop:develop  # 查找“origin”是哪一个服务器，从中抓取本地没有的数据（fetch之后指针和代码等数据都已经被拉去下来，只需要 merge origin/develop 或者触发 checkout develop 就可以检出看到），并且更新本地数据库，移动 origin/master 指针到更新之后的位置
git pull origin develop:develop   # pull = fetch + 【git merge origin/develop】
git pull origin develop           # 从服务器上抓取数据并自动尝试合并到<当前>所在的分支 
git push origin develop
git push origin --delete hotfix   # 删除远程分支
```

<br>



### 查看日志和状态

```bash
git status -s

git log -p -2
git log --pretty=oneline --graph --author 张三  # 查看作者张三（实际修改代码的人，注意不是提交者 --committer）的全部提交     
git log --pretty=fuller --stat branch_xxx      # 只查看branch_xxx分支的提交记录（附带统计信息）
git log --pretty=format:"%h %an %ar %s" --graph --all
git log --after="2020-11-16" --before="2020-11-17"
git log -S "<增加或减少的代码关键字>"
git log --grep="<提交内容关键字>"   # 你可以指定多个 --author 和 --grep 搜索条件，这样会只输出 任意 匹配 --author 模式和 --grep 模式的提交。然而，如果你添加了 --all-match 选项， 则只会输出 所有 匹配 --grep 模式的提交。

git log -g
git reflog                        # 可以查看所有分支的所有操作记录（包括已经被删除的 commit 记录和 reset 的操作）
git fsck --full                   # 如果删除了 .git/logs/，那么这时候 reflog或log -g 日志都没有了，使用该命令会显示出所有没有被其他对象指向的对象，根据“dangling commit”关键字可以看到你丢失的提交

git show-branch master dev        # 查看我们关注分支的最后一次提交之间的关系
git ls-remote                     # 查看远程是所有分支和标签
```

<br>



### 工作/暂存/仓库

```bash
# 有些时候，你想添加一个文件到Git，但发现添加不了，原因是这个文件被.gitignore忽略了，如果你确实想添加该文件，可以用-f强制添加到Git
git add .
git add -f App.class

git commit -m 'xxx'
git commit --amend -m '<重新提交，该提交信息会覆盖上次的提交信息，提交的hash码会改变>'

git push origin master
git push origin -f master
```

<br>



### 重置和撤销

```bash
# 重置和撤销
git restore -W <file>              # 重置本次工作区修改
git restore -S <file>              # 将本次修改移出暂存区
git restore -s HEAD^ <file>        # 重置暂存区到上一个版本

git reset --soft HEAD <file>       # 使 "- A - B - C (HEAD, master)"  变成  "- A - B (HEAD, master)"，C提交点还存在，但是没有任何指针指向它（可以使用git reflog找回那个丢失的提交点）。这个操作不会影响暂存区和工作区的内容
git reset --mixed HEAD <file>      # 与 soft 有相同的效果，只不过这个操作只会影响仓库区和暂存区，而不影响工作区内容，是一个安全操作，并且这是reset的默认设置
git reset --hard HEAD              # 这是个危险的命令，彻底回退到某个版本，本地的源码也会变为上一个版本的内容，撤销的commit中所包含的更改被冲掉。注意soft和mixed reset能对单个文件进行reset，而hard只能对整个版本进行回退
```

<br>



### 删除内容

```bash
# 删除
git rm <file>                      // 删除暂存区和工作区
git rm --cached <file>             // 只删除暂存区对应文件（工作区该文件仍保留，对于不小心将target等不相关文件提交很有用）
```

<br>



### 分支操作

```bash
git branch <bname>                 # 从当前分支拉一个新分支
git branch <bname> ab1afef         # 从指定版本提交来一个新分支
git branch -d <bname>              # 删除一个分支 
git branch -D <bname>              # 强制删除一个分支
git branch -a                      # 查看所有分支
git branch -vv                     # 查看当前分支，并展示最后一次提交的hash，以及每个分支正在跟踪哪个远程分支与本地分支是否是领先、落后。需要重点注意的一点是这些数字的值来自于你从每个服务器上最后一次抓取的数据。 这个命令并没有连接服务器，它只会告诉你关于本地缓存的服务器数据。可以使用 git fetch --all; git branch -vv 获取最新信息
git branch --no-merged             # 展示尚未合并到当前分支的分支，在当前分支尝试使用 git branch -d 命令删除这些分支的时候，会因为尚未合并到当前分支而失败
git branch -u origin/xx            # 设置本地分支追踪的远程分支名称
git checkout <bname>               # 检出一个分支
git checkout -b <bname> origin/xx  # 从远程上游分支拉取代码到本地新分支
git merge <bname>                  # 在一个分支合并另一个分支
```

<br>



### 贮藏现场

```bash
# 修复bug时，我们会通过创建新的bug分支（eg.issue-101）进行修复，然后合并，最后删除；
# 当手头工作没有完成时，先把工作现场 git stash 一下，然后去修复bug，修复后，再在相应的分支上git stash pop，回到工作现场。
git stash                          # 储存工作现场
git stash list                     # 查看现有的工作现场列表
git stash pop <stash@{0}>          # 恢复并删除工作现场
git stash apply <stash@{0}>        # 恢复而不删除工作现场
git stash drop <stash@{0}>         # 删除工作现场
```

<br>



### 变基

```bash
#                C4
#               /
# C0 <- C1 <- C2 <- C3 
# 我们知道，整合分支最容易的方法是 merge 命令。 它会把两个分支的最新快照（C3 和 C4）以及二者最近的共同祖先（C2）进行三方合并，合并的结果是生成一个新的快照（并提交）
# 其实，还有一种方法：你可以提取在 C4 中引入的补丁和修改，然后在 C3 的基础上应用一次。 在 Git 中，这种操作就叫做 变基（rebase）。它的原理是首先找到这两个分支（即当前分支 develop、变基操作的目标基底分支 master） 的最近共同祖先 C2，然后对比当前分支相对于该祖先的历次提交，提取相应的修改并存为临时文件（.git/rebase-apply）， 然后将当前分支指向目标基底 C3, 最后以此将之前另存为临时文件的修改依序应用。
# 一般我们这样做的目的是为了确保在向远程分支推送时能保持提交历史的整洁。例如向某个其他人维护的项目贡献代码时。 在这种情况下，你首先在自己的分支里进行开发，当开发完成时你需要先将你的代码变基到 origin/master 上，然后再向主项目提交修改。 这样的话，该项目的维护者就不再需要进行整合工作，只需要快进合并便可。
# 请注意，无论是通过变基，还是通过三方合并，整合的最终结果所指向的快照始终是一样的，只不过提交历史不同罢了。 变基是将一系列提交按照原有次序依次应用到另一分支上，而合并是把最终结果合在一起。
# 变基的风险：“如果提交存在于你的仓库之外，而别人可能基于这些提交进行开发，那么不要执行变基”，只要遵循这条金科玉律，就不会出差错。
git checkout develop
git rebase master                  # 在本分支重放master（效果相当git merge master，可能需要处理冲突），执行后本分支相当于【当前master + 本分支修改内容】
git rebase --continue              # 如果rebase master的过程中出现代码冲突，先在develop分支解决冲突，并标记冲突已解决，然后继续执行该语句进行变基
git checkout master
git merge develop                  # 在master分支快进合并develop，最终达到的效果是 develop分支看起来像直接基于master修改一样
```

<br>



### 标签

```bash
# 标签操作
git tag                            # 列出所有标签
git show-ref --tags                # 列出标签及其关联的提交版本
git tag --list "v1.8.5*"           # 列出感兴趣的标签
git tag -a v1.0 -m "这是初始化版本"  # 给当前版本打一个附注标签（Git支持两种标签，轻量标签lightweight 与 附注标签annotated。轻量标签很像一个不会改变的分支，它只是某个特定提交的引用。而附注标签是存储在Git数据库中的一个完整对象，通常会建议创建附注标签）
git tag -a v1.1 9fceb02            # 对历史提交版本打附注标签
git push origin v1.0               # 推送本地v1.0标签到远程，相当于 git push origin refs/tags/v1.0:refs/tags/v1.0
git push origin --tags             # 推送本地所有版本到远程
git tag -d v1.0                    # 删除标签
git push origin :refs/tags/v1.0    # 删除远程标签
git checkout v1.0                  # 查看某个标签所指向的文件版本，这会使你的仓库处于分离头指针（detached HEAD）状态，即如果在v1.0做了任何修改并提交，该提交并不会有任何指针的指向，下次切回到该标签，该标签的内容还是原来打标签时候的内容，因此，如果你需要进行更改，比如你要修复旧版本中的错误，那么通常需要创建一个新分支：git checkout -b version2 v2.0.0。如果在这之后又进行了一次提交，version2 分支就会因为这个改动向前移动， 此时它就会和 v2.0.0 标签稍微有些不同，这时就要当心了。
git ls-remote                      # 查看远程是所有分支和标签
```

<br>



### 搭建内部git服务器

```bash
# a. 搭建内部git服务器非常简单，通常只需要一下几步即可（强烈推荐用Ubuntu或Debian，这样，通过几条简单的apt命令就可以完成安装）：
# 1. 安装git
$ sudo apt-get install git
$ sudo add-apt-repository ppa:git-core/ppa  # 版本更新
$ sudo apt-get update
$ sudo apt-get install -y git

# 2. 创建git用户来运行git服务
$ sudo adduser git

# 3. 创建证书登录，收集所有需要登录的用户的公钥，就是他们自己的id_rsa.pub文件，把所有公钥导入到/home/git/.ssh/authorized_keys文件里，一行一个
$ cat id_rsa.pub >> ~/.ssh/authorized_keys

# 4. 初始化git仓库（假定是在~/gitrepors文件夹中创建sample.git裸仓库），然后把owner改为git创建裸仓库，裸仓库没有工作区，因为服务器上的Git仓库纯粹是为了共享，所以不让用户直接登录到服务器上去改工作区，并且服务器上的Git仓库通常都以.git结尾
$ sudo chown -R git:git sample.git

# 5. 禁用shell登录
# 出于安全考虑，第二步创建的git用户不允许登录shell，这可以通过编辑/etc/passwd文件完成。找到类似下面的一行：
git:x:1001:1001:,,,:/home/git:/bin/bash
# 更改为：
git:x:1001:1001:,,,:/home/git:/usr/bin/git-shell
# 这样，git用户可以正常通过ssh使用git，但无法登录shell，因为我们为git用户指定的git-shell每次一登录就自动退出   

# 6. 克隆远程仓库
$ git clone git@172.16.127.128:~/gitrepors/sample.git
# 剩下的推送就简单了

# b. 如果团队很小，把每个人的公钥收集起来放到服务器的~/.ssh/authorized_keys文件里就是可行的; 如果团队有几百号人，就没法这么玩了，这时，可以用Gitosis来管理公钥。

# c. 要像SVN那样变态地控制权限，用Gitolite。
```

<br>

​	

>  [参考文档](https://git-scm.com/book/zh/v2)





