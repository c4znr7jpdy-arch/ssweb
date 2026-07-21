# 燕云百业成员相册模块

## 页面

- `/album-upload.html`：上传页面
- `/album.html?memberId=2`：成员相册页面
- `/api/albums/upload`：上传接口
- `/api/albums?memberId=2`：相册列表接口

## 安装依赖

```bash
npm i express multer sharp nanoid
```

## 启动

```bash
node server-album.js
```

然后访问：

```text
http://localhost:3000/album-upload.html
http://localhost:3000/album.html?memberId=2
```

## 上传限制

前端限制：
- 仅允许 JPG / PNG / WEBP
- 单张不能超过 10M

后端限制：
- multer 再次限制 10M
- sharp 自动转成 WEBP
- 压缩目标为 1M 以下

## 生产建议

当前示例使用 `data/albums.json` 保存图片信息，正式项目建议改为 SQLite：

```sql
CREATE TABLE album_photos (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  nickname TEXT,
  title TEXT,
  category TEXT,
  description TEXT,
  url TEXT NOT NULL,
  original_size INTEGER,
  compressed_size INTEGER,
  quality INTEGER,
  max_side INTEGER,
  created_at TEXT NOT NULL
);
```

## 和成员详情页打通

成员详情页的「成员相册」按钮建议改成：

```html
<a class="btn btn-primary" href="/album.html?memberId=2">成员相册</a>
```

上传页默认成员 ID 可以从地址栏带入，例如：

```text
/album-upload.html?memberId=2&nickname=有歌旧酒
```
