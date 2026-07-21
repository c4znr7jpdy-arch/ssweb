# 燕云百业 v2：个人中心 + 成员相册权限

## 这版解决的问题

你提出的规则已经完成：

```text
1. 主页点击成员 → 进入个人详情页
2. 个人详情页有“成员相册”按钮
3. 成员相册只展示该成员上传的图片
4. 非该成员不可从这里上传
5. 上传入口统一改到个人中心
6. 如果当前登录用户就是该成员，相册页才显示“上传图片”
7. 普通用户只能上传到自己的相册
8. 管理员可以代传和删除所有图片
```

## 页面结构

```text
/                         首页
/register.html            注册
/login.html               登录
/members.html             成员列表
/member.html?id=1         成员详情
/album.html?memberId=1    该成员相册，只看该成员图片
/me.html                  个人中心
/me.html?tab=upload       个人中心上传图片
```

## 关键权限

```text
游客：
- 可以看成员列表
- 可以看成员详情
- 可以看成员相册
- 不能上传

普通成员：
- 可以修改自己的昵称和个人短语
- 可以在个人中心上传图片
- 只能上传到自己的 member_id
- 可以删除自己上传的图片

管理员：
- 可以上传到任意 member_id
- 可以删除所有图片
```

## 安装启动

```bash
cd yanyun_auth_album_system_v2
npm install
npm start
```

访问：

```text
http://localhost:3000/
```

默认管理员：

```text
账号：admin
密码：abc123
```

## 密码规则

```text
6位
英文和数字混合
不要求大小写
不需要特殊字符
```

示例：

```text
abc123
a1b2c3
```

## 你现有网站怎么合并

把这些文件合并到你的项目：

```text
public/me.html
public/member.html
public/album.html
public/members.html
public/register.html
public/login.html
public/css/style.css
public/js/auth.js
public/js/members.js
public/js/member.js
public/js/album.js
public/js/me.js
```

后端把 `server.js` 里的 API 合并到你现有 Express 服务。

重点保留这个上传权限逻辑：

```js
if (req.user.role !== 'admin') {
  memberId = myMember.id;
}
```

这句是核心。它保证普通用户即使伪造前端参数，也只能上传到自己的相册。
