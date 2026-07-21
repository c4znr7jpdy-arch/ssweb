# 燕云百业：用户系统 + 权限系统 + 成员相册上传

## 功能

- 注册
- 登录
- 退出登录
- 注册后自动进入成员列表
- 普通成员只能上传自己的图片
- 管理员可以上传到任意成员
- 上传图片最大 10M
- 后端自动压缩到 1M 以下
- 相册页面支持大图预览、左右切换、Esc 关闭

## 密码规则

密码必须是：

```text
6位
只允许英文和数字
必须同时包含英文和数字
不要求大小写
不要求特殊字符
```

示例：

```text
abc123
a1b2c3
```

不允许：

```text
123456
abcdef
abc12
abc1234
```

## 安装

```bash
cd yanyun_auth_album_system
npm install
npm start
```

访问：

```text
http://localhost:3000/
http://localhost:3000/register.html
http://localhost:3000/login.html
http://localhost:3000/members.html
http://localhost:3000/album-upload.html
http://localhost:3000/album.html
```

## 默认管理员

```text
账号：admin
密码：abc123
```

## 数据库

使用 SQLite，数据库文件：

```text
data/app.db
```

表：

```text
users
members
album_photos
```

## 上传图片保存位置

```text
public/uploads/albums/{memberId}/xxx.webp
```

## 权限设计

```text
游客：
- 可以看成员列表
- 可以看相册
- 不能上传

普通成员：
- 可以上传自己的相册图片
- 可以删除自己的图片
- 不能上传到别人相册

管理员：
- 可以上传到任何成员相册
- 可以删除所有图片
- 可以修改用户角色
```

## 接入你现有项目

你现有项目如果已经有 `/public` 静态目录，可以把：

```text
public/register.html
public/login.html
public/members.html
public/album.html
public/album-upload.html
public/css/style.css
public/js/*.js
```

合并进去。

然后把 `server.js` 里的 API 部分合并到你的 Express 后端。

## 正式上线建议

现在这版为了简单，注册后直接可以上传图片。正式上线更稳的设计是：

```text
1. 注册后进入成员列表
2. 上传图片需要登录
3. 图片上传后进入 pending 状态
4. 社主后台审核后变成 approved
5. 相册页只展示 approved 图片
6. 后台可删除违规图片
```

当前代码里 `album_photos.status` 已经预留了这个字段，你后续只需要把上传时的状态从 `approved` 改成 `pending`，再做一个审核后台即可。
