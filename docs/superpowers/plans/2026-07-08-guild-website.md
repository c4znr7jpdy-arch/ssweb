# 燕云百业网站实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建燕云十六声百业内部展示网站，包含主页、成员页、贡献榜、活动日历、装备工具和管理后台。

**Architecture:** Node.js + Express 后端提供 REST API，SQLite 存储数据，纯 HTML/CSS/JS 前端页面通过 API 加载数据。Express 同时托管静态文件和 API 路由。

**Tech Stack:** Node.js, Express, better-sqlite3, express-session, HTML/CSS/JS

---

### Task 1: 项目初始化与后端基础

**Files:**
- Create: `package.json`
- Create: `server/index.js`
- Create: `server/db.js`
- Create: `.gitignore`
- Create: `public/css/style.css`
- Create: `public/index.html`

- [ ] **Step 1: 初始化 npm 项目**

```bash
cd e:/web
npm init -y
npm install express better-sqlite3 express-session
```

- [ ] **Step 2: 创建 .gitignore**

```gitignore
node_modules/
data/*.db
.env
.superpowers/
```

- [ ] **Step 3: 创建数据库初始化模块**

创建 `server/db.js`：

```javascript
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'guild.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT NOT NULL,
    role TEXT NOT NULL,
    avatar TEXT,
    cover TEXT,
    tags TEXT,
    signature TEXT,
    join_date TEXT,
    status TEXT DEFAULT 'active',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    event_date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    location TEXT,
    leader TEXT,
    description TEXT,
    status TEXT DEFAULT 'upcoming',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS event_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    FOREIGN KEY(event_id) REFERENCES events(id),
    FOREIGN KEY(member_id) REFERENCES members(id)
  );

  CREATE TABLE IF NOT EXISTS contributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    points INTEGER NOT NULL,
    type TEXT,
    reason TEXT,
    event_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(member_id) REFERENCES members(id),
    FOREIGN KEY(event_id) REFERENCES events(id)
  );
`);

module.exports = db;
```

- [ ] **Step 4: 创建 Express 入口**

创建 `server/index.js`：

```javascript
const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'guild-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// 静态文件
app.use(express.static(path.join(__dirname, '..', 'public')));

// API 路由（后续 Task 中添加）
// app.use('/api/members', require('./routes/members'));
// app.use('/api/events', require('./routes/events'));
// app.use('/api/contributions', require('./routes/contributions'));
// app.use('/api/admin', require('./routes/auth'));

// 所有其他路由返回 index.html（SPA fallback）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

- [ ] **Step 5: 创建全局样式**

创建 `public/css/style.css`：

```css
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&family=Noto+Sans+SC:wght@300;400;500&display=swap');

:root {
  --bg: #050505;
  --panel: rgba(18, 16, 13, 0.86);
  --panel-light: rgba(34, 29, 22, 0.92);
  --gold: #c9a96e;
  --gold-soft: rgba(201, 169, 110, 0.24);
  --text: #f2eadc;
  --muted: #9c927f;
  --red: #6e1e1e;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html { scroll-behavior: smooth; }

body {
  font-family: 'Noto Sans SC', sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
}

h1, h2, h3 {
  font-family: 'Noto Serif SC', serif;
  color: var(--gold);
}

/* 导航栏 */
.nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 40px;
  background: linear-gradient(180deg, rgba(5,5,4,0.9) 0%, transparent 100%);
}

.nav-logo {
  font-family: 'Noto Serif SC', serif;
  font-size: 24px; font-weight: 700; color: var(--gold);
  letter-spacing: 8px; text-shadow: 0 0 30px rgba(201,169,110,0.3);
  text-decoration: none;
}

.nav-links { display: flex; gap: 32px; }

.nav-links a {
  color: rgba(255,255,255,0.5); text-decoration: none; font-size: 14px;
  letter-spacing: 3px; transition: color 0.3s;
}

.nav-links a:hover, .nav-links a.active { color: var(--gold); }

/* 卡片通用 */
.card {
  background: var(--panel);
  border: 1px solid rgba(201, 169, 110, 0.16);
  border-radius: 18px;
  backdrop-filter: blur(12px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
  transition: transform 0.3s, border-color 0.3s, box-shadow 0.3s;
}

.card:hover {
  transform: translateY(-4px);
  border-color: rgba(201, 169, 110, 0.45);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
}

/* 按钮 */
.btn {
  padding: 10px 24px; border-radius: 8px; border: none;
  font-size: 14px; font-weight: 500; cursor: pointer;
  transition: all 0.3s; letter-spacing: 2px;
}

.btn-primary {
  background: var(--gold); color: var(--bg);
}

.btn-primary:hover {
  background: #d4b87a;
  box-shadow: 0 4px 20px rgba(201,169,110,0.3);
}

.btn-ghost {
  background: transparent; color: var(--gold);
  border: 1px solid rgba(201,169,110,0.3);
}

.btn-ghost:hover {
  background: rgba(201,169,110,0.1);
  border-color: var(--gold);
}

/* 响应式 */
@media (max-width: 768px) {
  .nav { padding: 15px 20px; }
  .nav-links { display: none; }
}
```

- [ ] **Step 6: 创建主页骨架**

创建 `public/index.html`：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>燕云百业</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <nav class="nav">
    <a href="/" class="nav-logo">燕云百业</a>
    <div class="nav-links">
      <a href="/" class="active">主页</a>
      <a href="/members.html">成员</a>
      <a href="/calendar.html">活动日历</a>
      <a href="/rank.html">贡献榜</a>
      <a href="/tools/yysls/" target="_blank">装备工具</a>
    </div>
  </nav>
  <script src="/js/main.js"></script>
</body>
</html>
```

- [ ] **Step 7: 创建 package.json scripts 并测试启动**

在 `package.json` 中添加：

```json
{
  "scripts": {
    "start": "node server/index.js",
    "dev": "node server/index.js"
  }
}
```

运行测试：

```bash
cd e:/web
node server/index.js &
curl -s http://localhost:3000 | head -5
kill %1
```

Expected: 返回 index.html 内容

- [ ] **Step 8: 提交**

```bash
git init
git add .
git commit -m "feat: project init with Express + SQLite backend"
```

---

### Task 2: 成员 API 路由

**Files:**
- Create: `server/routes/members.js`

- [ ] **Step 1: 创建成员路由**

创建 `server/routes/members.js`：

```javascript
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/members - 获取所有成员
router.get('/', (req, res) => {
  const { role } = req.query;
  let sql = 'SELECT * FROM members WHERE status = ?';
  const params = ['active'];

  if (role) {
    sql += ' AND role = ?';
    params.push(role);
  }

  sql += ' ORDER BY sort_order ASC, id ASC';
  const members = db.prepare(sql).all(...params);
  res.json(members);
});

// GET /api/members/:id - 获取成员详情
router.get('/:id', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: '成员不存在' });
  res.json(member);
});

module.exports = router;
```

- [ ] **Step 2: 创建管理员路由（成员部分）**

创建 `server/routes/admin-members.js`：

```javascript
const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/auth');

// POST /api/admin/members - 添加成员
router.post('/', requireAuth, (req, res) => {
  const { nickname, role, avatar, cover, tags, signature, join_date, sort_order } = req.body;
  if (!nickname || !role) return res.status(400).json({ error: '昵称和职位必填' });

  const result = db.prepare(`
    INSERT INTO members (nickname, role, avatar, cover, tags, signature, join_date, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(nickname, role, avatar || null, cover || null, tags || null, signature || null, join_date || null, sort_order || 0);

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(member);
});

// PUT /api/admin/members/:id - 更新成员
router.put('/:id', requireAuth, (req, res) => {
  const { nickname, role, avatar, cover, tags, signature, join_date, sort_order, status } = req.body;
  const existing = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '成员不存在' });

  db.prepare(`
    UPDATE members SET nickname=?, role=?, avatar=?, cover=?, tags=?, signature=?, join_date=?, sort_order=?, status=?
    WHERE id=?
  `).run(
    nickname || existing.nickname,
    role || existing.role,
    avatar !== undefined ? avatar : existing.avatar,
    cover !== undefined ? cover : existing.cover,
    tags !== undefined ? tags : existing.tags,
    signature !== undefined ? signature : existing.signature,
    join_date !== undefined ? join_date : existing.join_date,
    sort_order !== undefined ? sort_order : existing.sort_order,
    status || existing.status,
    req.params.id
  );

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  res.json(member);
});

// DELETE /api/admin/members/:id - 删除成员
router.delete('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '成员不存在' });

  db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
```

- [ ] **Step 3: 创建鉴权中间件**

创建 `server/middleware/auth.js`：

```javascript
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.status(401).json({ error: '未授权，请先登录管理后台' });
}

module.exports = requireAuth;
```

- [ ] **Step 4: 更新 server/index.js 启用路由**

取消注释并更新路由引入：

```javascript
app.use('/api/members', require('./routes/members'));
app.use('/api/admin/members', require('./routes/admin-members'));
```

- [ ] **Step 5: 测试 API**

```bash
cd e:/web
node server/index.js &
curl -s http://localhost:3000/api/members
kill %1
```

Expected: `[]` （空数组，还没有数据）

- [ ] **Step 6: 提交**

```bash
git add server/routes/members.js server/routes/admin-members.js server/middleware/auth.js
git commit -m "feat: add members API routes"
```

---

### Task 3: 主页 - 斜向分割画廊

**Files:**
- Create: `public/js/main.js`
- Modify: `public/index.html`

- [ ] **Step 1: 完善 index.html 主页结构**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>燕云百业</title>
  <link rel="stylesheet" href="/css/style.css">
  <style>
    html, body { overflow: hidden; height: 100%; }

    .gallery {
      width: calc(100vw + 12vw);
      height: 100vh;
      margin-left: -6vw;
      display: flex;
      overflow: hidden;
      background: var(--bg);
    }

    .panel {
      position: relative;
      height: 100vh;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      transform: skewX(-5deg);
      transform-origin: center;
      margin-left: -1.15vw;
      transition: flex 650ms cubic-bezier(.2,.9,.2,1), filter 650ms cubic-bezier(.2,.9,.2,1);
      filter: brightness(.82) saturate(.9);
      will-change: flex, filter;
      cursor: pointer;
    }

    .panel:first-child { margin-left: 0; }

    .panel::before {
      content: "";
      position: absolute; inset: 0 -4vw;
      background-image: var(--img);
      background-size: cover; background-position: center;
      transform: skewX(5deg) scale(1.08);
      transform-origin: center;
      transition: transform 650ms cubic-bezier(.2,.9,.2,1);
      will-change: transform;
    }

    .panel::after {
      content: "";
      position: absolute; inset: 0;
      background:
        linear-gradient(90deg, rgba(0,0,0,.35), transparent 22%, transparent 78%, rgba(0,0,0,.25)),
        linear-gradient(180deg, rgba(0,0,0,.12), transparent 30%, rgba(0,0,0,.22));
      opacity: .85;
      transition: opacity 650ms cubic-bezier(.2,.9,.2,1);
      pointer-events: none;
    }

    .gallery:hover .panel { flex: .82; filter: brightness(.45) saturate(.5); }
    .gallery .panel:hover { flex: 2.35; filter: brightness(1.05) saturate(1.1); z-index: 5; }
    .gallery .panel:hover::before { transform: skewX(5deg) scale(1.18); }
    .gallery .panel:hover::after { opacity: .28; }

    .panel-content {
      position: absolute; inset: 0; z-index: 10;
      display: flex; flex-direction: column; justify-content: flex-end;
      padding: 40px 50px;
      pointer-events: none;
    }

    .panel-tag {
      font-size: 11px; letter-spacing: 4px; color: var(--gold);
      text-transform: uppercase; margin-bottom: 12px;
      opacity: 0; transform: translateY(10px);
      transition: all 400ms ease 100ms;
    }
    .panel:hover .panel-tag { opacity: 1; transform: translateY(0); }

    .panel-title {
      font-family: 'Noto Serif SC', serif;
      font-size: 32px; font-weight: 700; color: #fff;
      letter-spacing: 6px; line-height: 1.4;
      text-shadow: 0 2px 20px rgba(0,0,0,0.5);
      opacity: 0; transform: translateY(20px);
      transition: all 450ms ease 150ms;
    }
    .panel:hover .panel-title { opacity: 1; transform: translateY(0); }

    .panel-desc {
      font-size: 13px; color: rgba(255,255,255,0.6);
      letter-spacing: 2px; margin-top: 12px; line-height: 1.8;
      max-width: 320px;
      opacity: 0; transform: translateY(15px);
      transition: all 450ms ease 200ms;
    }
    .panel:hover .panel-desc { opacity: 1; transform: translateY(0); }

    .panel-line {
      width: 40px; height: 1px; background: var(--gold); margin: 16px 0;
      opacity: 0; transform: scaleX(0); transform-origin: left;
      transition: all 400ms ease 250ms;
    }
    .panel:hover .panel-line { opacity: 1; transform: scaleX(1); }

    .footer-hint {
      position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
      color: rgba(255,255,255,0.25); font-size: 12px; letter-spacing: 4px;
      z-index: 100;
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse { 0%,100% { opacity: .25; } 50% { opacity: .5; } }

    @media (max-width: 768px) {
      .gallery { width: calc(100vw + 18vw); margin-left: -9vw; }
      .panel { margin-left: -2.4vw; }
      .gallery:hover .panel { flex: .92; }
      .gallery .panel:hover { flex: 1.9; }
      .panel-title { font-size: 22px; }
    }
  </style>
</head>
<body>
  <nav class="nav">
    <a href="/" class="nav-logo">燕云百业</a>
    <div class="nav-links">
      <a href="/" class="active">主页</a>
      <a href="/members.html">成员</a>
      <a href="/calendar.html">活动日历</a>
      <a href="/rank.html">贡献榜</a>
      <a href="/tools/yysls/" target="_blank">装备工具</a>
    </div>
  </nav>

  <main class="gallery" id="gallery"></main>

  <div class="footer-hint">HOVER TO EXPLORE</div>

  <script src="/js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 main.js 动态加载成员面板**

创建 `public/js/main.js`：

```javascript
(async () => {
  const gallery = document.getElementById('gallery');

  // 占位图片（后续替换为真实成员图片）
  const fallbackImages = [
    'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1200&q=90',
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=90',
    'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1200&q=90',
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=90',
    'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=90'
  ];

  try {
    const res = await fetch('/api/members');
    const members = await res.json();

    if (members.length === 0) {
      // 没有成员数据时显示占位面板
      const titles = ['燕云百业', '成员风采', '活动日历', '贡献榜', '游戏攻略'];
      const descs = [
        '同袍共赴山河远，一剑曾挡百万师',
        '江湖路远，幸得同行',
        '排兵布阵，共赴盛宴',
        '论功行赏，英雄留名',
        '独门秘籍，倾囊相授'
      ];
      const tags = ['OUR GUILD', 'MEMBERS', 'CALENDAR', 'RANKINGS', 'FEATURES'];

      for (let i = 0; i < 5; i++) {
        gallery.innerHTML += `
          <section class="panel" style="--img: url('${fallbackImages[i]}')">
            <div class="panel-content">
              <div class="panel-tag">${tags[i]}</div>
              <div class="panel-title">${titles[i]}</div>
              <div class="panel-line"></div>
              <div class="panel-desc">${descs[i]}</div>
            </div>
          </section>`;
      }
    } else {
      // 有成员数据时显示成员面板
      members.slice(0, 8).forEach((m, i) => {
        const img = m.cover || m.avatar || fallbackImages[i % fallbackImages.length];
        gallery.innerHTML += `
          <section class="panel" style="--img: url('${img}')" onclick="location.href='/member.html?id=${m.id}'">
            <div class="panel-content">
              <div class="panel-tag">${m.role}</div>
              <div class="panel-title">${m.nickname}</div>
              <div class="panel-line"></div>
              <div class="panel-desc">${m.signature || ''}</div>
            </div>
          </section>`;
      });
    }
  } catch (e) {
    console.error('加载成员失败:', e);
  }
})();
```

- [ ] **Step 3: 测试主页**

```bash
cd e:/web
node server/index.js &
# 浏览器打开 http://localhost:3000 查看主页
kill %1
```

Expected: 显示斜向分割画廊，5 个占位面板，hover 有展开效果

- [ ] **Step 4: 提交**

```bash
git add public/index.html public/js/main.js
git commit -m "feat: homepage with diagonal split gallery"
```

---

### Task 4: 成员列表页

**Files:**
- Create: `public/members.html`
- Create: `public/js/members.js`

- [ ] **Step 1: 创建 members.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>百业成员 - 燕云百业</title>
  <link rel="stylesheet" href="/css/style.css">
  <style>
    .page-header {
      text-align: center;
      padding: 120px 20px 40px;
    }
    .page-header h1 {
      font-size: 36px;
      letter-spacing: 8px;
      margin-bottom: 12px;
    }
    .page-header .subtitle {
      color: var(--muted);
      font-size: 14px;
      letter-spacing: 4px;
    }

    .filter-bar {
      display: flex; justify-content: center; gap: 12px;
      padding: 20px; flex-wrap: wrap;
    }
    .filter-btn {
      background: transparent; border: 1px solid rgba(201,169,110,0.2);
      color: var(--muted); padding: 8px 20px; border-radius: 30px;
      cursor: pointer; font-size: 13px; letter-spacing: 2px;
      transition: all 0.3s;
    }
    .filter-btn:hover, .filter-btn.active {
      background: var(--gold); color: var(--bg); border-color: var(--gold);
    }

    .members-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 24px;
      padding: 20px 40px 60px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .member-card {
      background: var(--panel);
      border: 1px solid rgba(201,169,110,0.16);
      border-radius: 18px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.3s;
    }
    .member-card:hover {
      transform: translateY(-4px);
      border-color: rgba(201,169,110,0.45);
      box-shadow: 0 24px 70px rgba(0,0,0,0.55);
    }

    .member-avatar {
      width: 100%; height: 300px;
      object-fit: cover;
      display: block;
    }

    .member-info {
      padding: 20px;
    }
    .member-name {
      font-family: 'Noto Serif SC', serif;
      font-size: 20px; color: #fff;
      letter-spacing: 4px; margin-bottom: 8px;
    }
    .member-role {
      font-size: 12px; color: var(--gold);
      letter-spacing: 2px; margin-bottom: 10px;
    }
    .member-tags {
      display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;
    }
    .member-tag {
      font-size: 11px; color: var(--muted);
      background: rgba(201,169,110,0.1);
      padding: 3px 10px; border-radius: 12px;
    }
    .member-signature {
      font-size: 13px; color: rgba(255,255,255,0.5);
      font-style: italic;
    }
  </style>
</head>
<body>
  <nav class="nav">
    <a href="/" class="nav-logo">燕云百业</a>
    <div class="nav-links">
      <a href="/">主页</a>
      <a href="/members.html" class="active">成员</a>
      <a href="/calendar.html">活动日历</a>
      <a href="/rank.html">贡献榜</a>
      <a href="/tools/yysls/" target="_blank">装备工具</a>
    </div>
  </nav>

  <div class="page-header">
    <h1>百业成员</h1>
    <div class="subtitle">江湖同路，皆为此间人</div>
  </div>

  <div class="filter-bar" id="filterBar">
    <button class="filter-btn active" data-role="">全部</button>
    <button class="filter-btn" data-role="社主">社主</button>
    <button class="filter-btn" data-role="副社">副社</button>
    <button class="filter-btn" data-role="管理">管理</button>
    <button class="filter-btn" data-role="核心成员">核心成员</button>
    <button class="filter-btn" data-role="普通成员">普通成员</button>
  </div>

  <div class="members-grid" id="membersGrid"></div>

  <script src="/js/members.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 members.js**

创建 `public/js/members.js`：

```javascript
let allMembers = [];
let currentRole = '';

const grid = document.getElementById('membersGrid');
const filterBar = document.getElementById('filterBar');

async function loadMembers() {
  const res = await fetch('/api/members');
  allMembers = await res.json();
  renderMembers();
}

function renderMembers() {
  const filtered = currentRole
    ? allMembers.filter(m => m.role === currentRole)
    : allMembers;

  grid.innerHTML = filtered.map(m => `
    <div class="member-card" onclick="location.href='/member.html?id=${m.id}'">
      <img class="member-avatar" src="${m.avatar || '/images/members/default.jpg'}" alt="${m.nickname}">
      <div class="member-info">
        <div class="member-name">${m.nickname}</div>
        <div class="member-role">${m.role}</div>
        ${m.tags ? `<div class="member-tags">${m.tags.split(',').map(t => `<span class="member-tag">${t.trim()}</span>`).join('')}</div>` : ''}
        ${m.signature ? `<div class="member-signature">${m.signature}</div>` : ''}
      </div>
    </div>
  `).join('');
}

filterBar.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentRole = btn.dataset.role;
  renderMembers();
});

loadMembers();
```

- [ ] **Step 3: 测试成员列表页**

```bash
cd e:/web
node server/index.js &
# 浏览器打开 http://localhost:3000/members.html
kill %1
```

Expected: 显示空的成员网格（还没有数据），筛选栏可点击

- [ ] **Step 4: 提交**

```bash
git add public/members.html public/js/members.js
git commit -m "feat: members list page with role filter"
```

---

### Task 5: 成员详情页（滑入动画 + 打字机效果）

**Files:**
- Create: `public/member.html`
- Create: `public/js/member.js`

- [ ] **Step 1: 创建 member.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>成员详情 - 燕云百业</title>
  <link rel="stylesheet" href="/css/style.css">
  <style>
    html, body { height: 100%; overflow: hidden; }

    .back-btn {
      position: fixed; top: 30px; left: 30px; z-index: 200;
      color: rgba(255,255,255,0.5); text-decoration: none;
      font-size: 24px; transition: color 0.3s;
      display: flex; align-items: center; gap: 8px;
    }
    .back-btn:hover { color: var(--gold); }
    .back-btn span { font-size: 14px; letter-spacing: 2px; }

    .detail-layout {
      display: flex; height: 100vh; width: 100%;
    }

    .detail-left {
      width: 60%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
      position: relative;
    }

    .detail-image {
      max-width: 80%; max-height: 80vh;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 0 80px rgba(201,169,110,0.15);
      transform: translateX(-120%);
      transition: transform 1.2s cubic-bezier(.2,.9,.2,1);
    }

    .detail-image.visible {
      transform: translateX(0);
    }

    .detail-right {
      width: 40%; height: 100%;
      display: flex; flex-direction: column; justify-content: center;
      padding: 60px;
    }

    .typewriter-line {
      margin-bottom: 24px;
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.6s ease;
    }

    .typewriter-line.visible {
      opacity: 1;
      transform: translateY(0);
    }

    .tw-label {
      font-size: 11px; letter-spacing: 4px; color: var(--gold);
      text-transform: uppercase; margin-bottom: 6px;
    }

    .tw-value {
      font-family: 'Noto Serif SC', serif;
      font-size: 28px; color: #fff;
      letter-spacing: 4px;
    }

    .tw-value.signature {
      font-size: 16px; color: rgba(255,255,255,0.6);
      font-style: italic;
      letter-spacing: 2px;
    }

    .cursor {
      display: inline-block;
      width: 2px; height: 1em;
      background: var(--gold);
      margin-left: 4px;
      animation: blink 1s step-end infinite;
      vertical-align: text-bottom;
    }

    @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }

    @media (max-width: 768px) {
      .detail-layout { flex-direction: column; }
      .detail-left { width: 100%; height: 50%; }
      .detail-right { width: 100%; height: 50%; padding: 30px; }
      .tw-value { font-size: 22px; }
    }
  </style>
</head>
<body>
  <a href="/" class="back-btn">
    ← <span>返回</span>
  </a>

  <div class="detail-layout">
    <div class="detail-left">
      <img class="detail-image" id="memberImage" src="" alt="">
    </div>
    <div class="detail-right" id="infoPanel"></div>
  </div>

  <script src="/js/member.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 member.js**

创建 `public/js/member.js`：

```javascript
(async () => {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) { location.href = '/members.html'; return; }

  const img = document.getElementById('memberImage');
  const panel = document.getElementById('infoPanel');

  try {
    const res = await fetch(`/api/members/${id}`);
    if (!res.ok) throw new Error('成员不存在');
    const m = await res.json();

    // 设置图片
    img.src = m.cover || m.avatar || '/images/members/default.jpg';
    img.alt = m.nickname;

    // 构建信息面板
    const lines = [
      { label: 'ID', value: `#${String(m.id).padStart(3, '0')}` },
      { label: '昵称', value: m.nickname },
      { label: '流派', value: m.tags || '未知' },
      { label: '签名', value: m.signature || '这个人很懒，什么都没写', className: 'signature' }
    ];

    panel.innerHTML = lines.map((l, i) => `
      <div class="typewriter-line" style="transition-delay: ${0.3 + i * 0.4}s">
        <div class="tw-label">${l.label}</div>
        <div class="tw-value ${l.className || ''}">${l.value}<span class="cursor"></span></div>
      </div>
    `).join('');

    // 触发图片滑入动画
    requestAnimationFrame(() => {
      setTimeout(() => img.classList.add('visible'), 100);
    });

    // 触发文字逐行显示
    const typewriterLines = panel.querySelectorAll('.typewriter-line');
    typewriterLines.forEach((line, i) => {
      setTimeout(() => line.classList.add('visible'), 400 + i * 400);
    });

  } catch (e) {
    panel.innerHTML = '<p style="color:var(--muted)">成员不存在</p>';
  }
})();
```

- [ ] **Step 3: 测试成员详情页**

先手动插入一条测试数据：

```bash
curl -X POST http://localhost:3000/api/admin/members \
  -H "Content-Type: application/json" \
  -d '{"nickname":"风起燕云","role":"社主","tags":"PVP,活动组织","signature":"一入燕云，皆是江湖"}'
```

注意：需要先登录 session 才能调用 admin 接口。暂时可以绕过测试，或在 Task 8 中完成后测试。

打开 `http://localhost:3000/member.html?id=1` 查看效果。

Expected: 图片从左侧滑入，右侧逐行打字机显示信息

- [ ] **Step 4: 提交**

```bash
git add public/member.html public/js/member.js
git commit -m "feat: member detail page with slide-in and typewriter effect"
```

---

### Task 6: 贡献榜页面与 API

**Files:**
- Create: `public/rank.html`
- Create: `public/js/rank.js`
- Create: `server/routes/contributions.js`

- [ ] **Step 1: 创建贡献路由**

创建 `server/routes/contributions.js`：

```javascript
const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/auth');

// GET /api/rank - 获取排行榜
router.get('/', (req, res) => {
  const { type = 'total' } = req.query;

  let whereClause = '';
  if (type === 'month') {
    whereClause = "WHERE strftime('%Y-%m', c.created_at) = strftime('%Y-%m', 'now')";
  } else if (type === 'week') {
    whereClause = "WHERE c.created_at >= date('now', '-7 days')";
  }

  const rank = db.prepare(`
    SELECT
      m.id, m.nickname, m.role, m.avatar,
      COALESCE(SUM(c.points), 0) AS total_points,
      (SELECT reason FROM contributions WHERE member_id = m.id ORDER BY created_at DESC LIMIT 1) AS last_reason
    FROM members m
    LEFT JOIN contributions c ON c.member_id = m.id ${whereClause}
    WHERE m.status = 'active'
    GROUP BY m.id
    ORDER BY total_points DESC
  `).all();

  res.json(rank);
});

// GET /api/contributions - 获取贡献记录
router.get('/records', (req, res) => {
  const { member_id } = req.query;
  let sql = 'SELECT c.*, m.nickname FROM contributions c JOIN members m ON c.member_id = m.id';
  const params = [];

  if (member_id) {
    sql += ' WHERE c.member_id = ?';
    params.push(member_id);
  }

  sql += ' ORDER BY c.created_at DESC';
  const records = db.prepare(sql).all(...params);
  res.json(records);
});

// POST /api/admin/contributions - 添加贡献记录
router.post('/', requireAuth, (req, res) => {
  const { member_id, points, type, reason, event_id } = req.body;
  if (!member_id || !points) return res.status(400).json({ error: '成员和分值必填' });

  const result = db.prepare(`
    INSERT INTO contributions (member_id, points, type, reason, event_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(member_id, points, type || null, reason || null, event_id || null);

  res.status(201).json({ id: result.lastInsertRowid });
});

// DELETE /api/admin/contributions/:id - 删除贡献记录
router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM contributions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
```

- [ ] **Step 2: 更新 server/index.js 添加贡献路由**

```javascript
app.use('/api/contributions', require('./routes/contributions'));
app.use('/api/rank', require('./routes/contributions'));
```

- [ ] **Step 3: 创建 rank.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>贡献榜 - 燕云百业</title>
  <link rel="stylesheet" href="/css/style.css">
  <style>
    .page-header { text-align: center; padding: 120px 20px 30px; }
    .page-header h1 { font-size: 36px; letter-spacing: 8px; margin-bottom: 12px; }
    .page-header .subtitle { color: var(--muted); font-size: 14px; letter-spacing: 4px; }

    .stats-row {
      display: flex; justify-content: center; gap: 24px;
      padding: 0 40px 30px; flex-wrap: wrap;
    }
    .stat-card {
      background: var(--panel);
      border: 1px solid rgba(201,169,110,0.16);
      border-radius: 12px; padding: 20px 30px;
      text-align: center; min-width: 160px;
    }
    .stat-card .value {
      font-family: 'Noto Serif SC', serif;
      font-size: 28px; color: var(--gold);
    }
    .stat-card .label {
      font-size: 12px; color: var(--muted);
      letter-spacing: 2px; margin-top: 6px;
    }

    .tab-bar {
      display: flex; justify-content: center; gap: 12px;
      padding: 20px; margin-bottom: 20px;
    }
    .tab-btn {
      background: transparent; border: 1px solid rgba(201,169,110,0.2);
      color: var(--muted); padding: 8px 24px; border-radius: 30px;
      cursor: pointer; font-size: 13px; letter-spacing: 2px;
      transition: all 0.3s;
    }
    .tab-btn:hover, .tab-btn.active {
      background: var(--gold); color: var(--bg); border-color: var(--gold);
    }

    .rank-list {
      max-width: 800px; margin: 0 auto;
      padding: 0 20px 60px;
    }

    .rank-item {
      display: flex; align-items: center; gap: 20px;
      background: var(--panel);
      border: 1px solid rgba(201,169,110,0.1);
      border-radius: 12px; padding: 16px 24px;
      margin-bottom: 12px;
      transition: all 0.3s;
    }
    .rank-item:hover {
      border-color: rgba(201,169,110,0.3);
      transform: translateX(4px);
    }

    .rank-num {
      font-family: 'Noto Serif SC', serif;
      font-size: 24px; font-weight: 700;
      min-width: 40px; text-align: center;
    }
    .rank-item:nth-child(1) .rank-num { color: #ffd700; }
    .rank-item:nth-child(2) .rank-num { color: #c0c0c0; }
    .rank-item:nth-child(3) .rank-num { color: #cd7f32; }

    .rank-avatar {
      width: 48px; height: 48px; border-radius: 50%;
      object-fit: cover; border: 2px solid rgba(201,169,110,0.2);
    }

    .rank-info { flex: 1; }
    .rank-name { font-size: 16px; color: #fff; letter-spacing: 2px; }
    .rank-reason { font-size: 12px; color: var(--muted); margin-top: 4px; }

    .rank-points {
      font-family: 'Noto Serif SC', serif;
      font-size: 20px; color: var(--gold);
    }
  </style>
</head>
<body>
  <nav class="nav">
    <a href="/" class="nav-logo">燕云百业</a>
    <div class="nav-links">
      <a href="/">主页</a>
      <a href="/members.html">成员</a>
      <a href="/calendar.html">活动日历</a>
      <a href="/rank.html" class="active">贡献榜</a>
      <a href="/tools/yysls/" target="_blank">装备工具</a>
    </div>
  </nav>

  <div class="page-header">
    <h1>百业贡献榜</h1>
    <div class="subtitle">江湖有名，皆因同行</div>
  </div>

  <div class="stats-row" id="statsRow"></div>

  <div class="tab-bar" id="tabBar">
    <button class="tab-btn active" data-type="total">总榜</button>
    <button class="tab-btn" data-type="month">月榜</button>
    <button class="tab-btn" data-type="week">周榜</button>
  </div>

  <div class="rank-list" id="rankList"></div>

  <script src="/js/rank.js"></script>
</body>
</html>
```

- [ ] **Step 4: 创建 rank.js**

创建 `public/js/rank.js`：

```javascript
let currentType = 'total';

async function loadRank(type) {
  currentType = type;
  const res = await fetch(`/api/rank?type=${type}`);
  const data = await res.json();
  renderStats(data);
  renderList(data);
}

function renderStats(data) {
  const totalPoints = data.reduce((sum, m) => sum + m.total_points, 0);
  const topPlayer = data[0];

  document.getElementById('statsRow').innerHTML = `
    <div class="stat-card">
      <div class="value">${totalPoints}</div>
      <div class="label">总贡献积分</div>
    </div>
    <div class="stat-card">
      <div class="value">${data.filter(m => m.total_points > 0).length}</div>
      <div class="label">活跃成员</div>
    </div>
    <div class="stat-card">
      <div class="value">${topPlayer ? topPlayer.nickname : '--'}</div>
      <div class="label">当前榜首</div>
    </div>
  `;
}

function renderList(data) {
  document.getElementById('rankList').innerHTML = data.map((m, i) => `
    <div class="rank-item">
      <div class="rank-num">${String(i + 1).padStart(2, '0')}</div>
      <img class="rank-avatar" src="${m.avatar || '/images/members/default.jpg'}" alt="${m.nickname}">
      <div class="rank-info">
        <div class="rank-name">${m.nickname} <span style="color:var(--muted);font-size:12px;margin-left:8px">${m.role}</span></div>
        <div class="rank-reason">${m.last_reason ? '最近贡献：' + m.last_reason : ''}</div>
      </div>
      <div class="rank-points">${m.total_points}</div>
    </div>
  `).join('');
}

document.getElementById('tabBar').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadRank(btn.dataset.type);
});

loadRank('total');
```

- [ ] **Step 5: 测试贡献榜**

```bash
cd e:/web
node server/index.js &
# 浏览器打开 http://localhost:3000/rank.html
kill %1
```

Expected: 显示空的排行榜，统计卡片和切换标签正常

- [ ] **Step 6: 提交**

```bash
git add public/rank.html public/js/rank.js server/routes/contributions.js
git commit -m "feat: contribution rank page and API"
```

---

### Task 7: 活动日历页面与 API

**Files:**
- Create: `public/calendar.html`
- Create: `public/js/calendar.js`
- Create: `server/routes/events.js`

- [ ] **Step 1: 创建活动路由**

创建 `server/routes/events.js`：

```javascript
const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/auth');

// GET /api/events - 获取活动列表
router.get('/', (req, res) => {
  const { month } = req.query;
  let sql = 'SELECT * FROM events';
  const params = [];

  if (month) {
    sql += " WHERE strftime('%Y-%m', event_date) = ?";
    params.push(month);
  }

  sql += ' ORDER BY event_date ASC, start_time ASC';
  const events = db.prepare(sql).all(...params);
  res.json(events);
});

// GET /api/events/:id - 获取活动详情
router.get('/:id', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: '活动不存在' });

  const members = db.prepare(`
    SELECT m.id, m.nickname, m.avatar
    FROM event_members em
    JOIN members m ON em.member_id = m.id
    WHERE em.event_id = ?
  `).all(req.params.id);

  res.json({ ...event, members });
});

// POST /api/admin/events - 添加活动
router.post('/', requireAuth, (req, res) => {
  const { title, type, event_date, start_time, end_time, location, leader, description } = req.body;
  if (!title || !type || !event_date) return res.status(400).json({ error: '标题、类型和日期必填' });

  const result = db.prepare(`
    INSERT INTO events (title, type, event_date, start_time, end_time, location, leader, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, type, event_date, start_time || null, end_time || null, location || null, leader || null, description || null);

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(event);
});

// PUT /api/admin/events/:id - 更新活动
router.put('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '活动不存在' });

  const { title, type, event_date, start_time, end_time, location, leader, description, status } = req.body;

  db.prepare(`
    UPDATE events SET title=?, type=?, event_date=?, start_time=?, end_time=?, location=?, leader=?, description=?, status=?
    WHERE id=?
  `).run(
    title || existing.title,
    type || existing.type,
    event_date || existing.event_date,
    start_time !== undefined ? start_time : existing.start_time,
    end_time !== undefined ? end_time : existing.end_time,
    location !== undefined ? location : existing.location,
    leader !== undefined ? leader : existing.leader,
    description !== undefined ? description : existing.description,
    status || existing.status,
    req.params.id
  );

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  res.json(event);
});

// DELETE /api/admin/events/:id - 删除活动
router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM event_members WHERE event_id = ?').run(req.params.id);
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
```

- [ ] **Step 2: 更新 server/index.js 添加活动路由**

```javascript
app.use('/api/events', require('./routes/events'));
```

- [ ] **Step 3: 创建 calendar.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>活动日历 - 燕云百业</title>
  <link rel="stylesheet" href="/css/style.css">
  <style>
    .page-header { text-align: center; padding: 100px 20px 20px; }
    .page-header h1 { font-size: 36px; letter-spacing: 8px; margin-bottom: 8px; }

    .calendar-layout {
      display: flex; gap: 24px;
      max-width: 1200px; margin: 0 auto;
      padding: 0 20px 60px;
    }

    .calendar-left { flex: 2; }
    .calendar-right { flex: 1; min-width: 280px; }

    .month-nav {
      display: flex; align-items: center; justify-content: center;
      gap: 20px; margin-bottom: 20px;
    }
    .month-nav button {
      background: transparent; border: 1px solid rgba(201,169,110,0.3);
      color: var(--gold); width: 36px; height: 36px; border-radius: 50%;
      cursor: pointer; font-size: 18px; transition: all 0.3s;
    }
    .month-nav button:hover { background: var(--gold); color: var(--bg); }
    .month-nav .month-title {
      font-family: 'Noto Serif SC', serif;
      font-size: 20px; color: var(--gold); letter-spacing: 4px;
      min-width: 160px; text-align: center;
    }

    .calendar-grid {
      display: grid; grid-template-columns: repeat(7, 1fr);
      gap: 2px; background: rgba(201,169,110,0.05);
      border-radius: 12px; overflow: hidden;
    }

    .cal-header {
      background: var(--panel); padding: 10px;
      text-align: center; font-size: 12px;
      color: var(--muted); letter-spacing: 2px;
    }

    .cal-day {
      background: var(--panel); min-height: 80px;
      padding: 8px; cursor: pointer;
      transition: all 0.2s; position: relative;
    }
    .cal-day:hover { background: var(--panel-light); }
    .cal-day.today { border: 1px solid var(--gold); }
    .cal-day.other-month { opacity: 0.3; }

    .cal-day-num {
      font-size: 14px; color: var(--text);
      margin-bottom: 4px;
    }

    .event-dots { display: flex; gap: 4px; flex-wrap: wrap; }
    .event-dot {
      width: 8px; height: 8px; border-radius: 50%;
    }
    .event-dot.团建 { background: var(--gold); }
    .event-dot.副本 { background: #4a9eff; }
    .event-dot.PVP { background: #ff4a4a; }
    .event-dot.拍照 { background: #a855f7; }
    .event-dot.教学 { background: #22c55e; }

    .side-title {
      font-family: 'Noto Serif SC', serif;
      font-size: 16px; color: var(--gold);
      letter-spacing: 2px; margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(201,169,110,0.2);
    }

    .event-card {
      background: var(--panel);
      border: 1px solid rgba(201,169,110,0.1);
      border-radius: 10px; padding: 14px;
      margin-bottom: 10px;
      transition: all 0.3s; cursor: pointer;
    }
    .event-card:hover {
      border-color: rgba(201,169,110,0.3);
      transform: translateX(4px);
    }

    .event-card .event-time {
      font-size: 11px; color: var(--gold); letter-spacing: 2px;
    }
    .event-card .event-title {
      font-size: 15px; color: #fff; margin: 6px 0 4px;
    }
    .event-card .event-meta {
      font-size: 12px; color: var(--muted);
    }
    .event-card .event-status {
      display: inline-block; font-size: 11px; padding: 2px 8px;
      border-radius: 10px; margin-top: 6px;
    }
    .event-status.upcoming { background: rgba(201,169,110,0.15); color: var(--gold); }
    .event-status.ended { background: rgba(156,146,127,0.15); color: var(--muted); }

    @media (max-width: 768px) {
      .calendar-layout { flex-direction: column; }
      .calendar-right { min-width: auto; }
    }
  </style>
</head>
<body>
  <nav class="nav">
    <a href="/" class="nav-logo">燕云百业</a>
    <div class="nav-links">
      <a href="/">主页</a>
      <a href="/members.html">成员</a>
      <a href="/calendar.html" class="active">活动日历</a>
      <a href="/rank.html">贡献榜</a>
      <a href="/tools/yysls/" target="_blank">装备工具</a>
    </div>
  </nav>

  <div class="page-header">
    <h1>活动日历</h1>
  </div>

  <div class="calendar-layout">
    <div class="calendar-left">
      <div class="month-nav">
        <button id="prevMonth">‹</button>
        <div class="month-title" id="monthTitle"></div>
        <button id="nextMonth">›</button>
      </div>
      <div class="calendar-grid" id="calendarGrid"></div>
    </div>
    <div class="calendar-right">
      <div class="side-title" id="sideTitle">今日活动</div>
      <div id="eventList"></div>
    </div>
  </div>

  <script src="/js/calendar.js"></script>
</body>
</html>
```

- [ ] **Step 4: 创建 calendar.js**

创建 `public/js/calendar.js`：

```javascript
let currentDate = new Date();
let events = [];

const monthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
const dayNames = ['周日','周一','周二','周三','周四','周五','周六'];

async function loadEvents() {
  const y = currentDate.getFullYear();
  const m = String(currentDate.getMonth() + 1).padStart(2, '0');
  const res = await fetch(`/api/events?month=${y}-${m}`);
  events = await res.json();
  renderCalendar();
  renderDayEvents(new Date());
}

function renderCalendar() {
  const y = currentDate.getFullYear();
  const m = currentDate.getMonth();
  const today = new Date();

  document.getElementById('monthTitle').textContent = `${y}年 ${monthNames[m]}`;

  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daysInPrev = new Date(y, m, 0).getDate();

  let html = ['日','一','二','三','四','五','六'].map(d =>
    `<div class="cal-header">${d}</div>`
  ).join('');

  // 上月补位
  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<div class="cal-day other-month"><div class="cal-day-num">${daysInPrev - i}</div></div>`;
  }

  // 本月日期
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayEvents = events.filter(e => e.event_date === dateStr);
    const isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;

    html += `
      <div class="cal-day ${isToday ? 'today' : ''}" onclick="selectDay('${dateStr}')">
        <div class="cal-day-num">${d}</div>
        <div class="event-dots">
          ${dayEvents.map(e => `<div class="event-dot ${e.type}"></div>`).join('')}
        </div>
      </div>`;
  }

  // 下月补位
  const totalCells = firstDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="cal-day other-month"><div class="cal-day-num">${i}</div></div>`;
  }

  document.getElementById('calendarGrid').innerHTML = html;
}

function renderDayEvents(dateStr) {
  const dayEvents = events.filter(e => e.event_date === dateStr);
  const d = new Date(dateStr);
  const dayOfWeek = dayNames[d.getDay()];
  document.getElementById('sideTitle').textContent = `${d.getMonth() + 1}月${d.getDate()}日 ${dayOfWeek}`;

  if (dayEvents.length === 0) {
    document.getElementById('eventList').innerHTML = '<p style="color:var(--muted);font-size:13px;text-align:center;padding:20px">暂无活动</p>';
    return;
  }

  document.getElementById('eventList').innerHTML = dayEvents.map(e => `
    <div class="event-card">
      <div class="event-time">${e.start_time || '待定'} ${e.end_time ? '- ' + e.end_time : ''}</div>
      <div class="event-title">${e.title}</div>
      <div class="event-meta">${e.leader ? '组织人：' + e.leader : ''} ${e.location ? '· ' + e.location : ''}</div>
      <div class="event-status ${e.status}">${{upcoming:'未开始',ongoing:'进行中',ended:'已结束',cancelled:'已取消'}[e.status] || e.status}</div>
    </div>
  `).join('');
}

window.selectDay = (dateStr) => {
  renderDayEvents(dateStr);
};

document.getElementById('prevMonth').onclick = () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  loadEvents();
};

document.getElementById('nextMonth').onclick = () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  loadEvents();
};

loadEvents();
```

- [ ] **Step 5: 测试活动日历**

```bash
cd e:/web
node server/index.js &
# 浏览器打开 http://localhost:3000/calendar.html
kill %1
```

Expected: 显示月历视图，可切换月份，右侧显示活动列表

- [ ] **Step 6: 提交**

```bash
git add public/calendar.html public/js/calendar.js server/routes/events.js
git commit -m "feat: activity calendar page and API"
```

---

### Task 8: 管理后台

**Files:**
- Create: `public/admin.html`
- Create: `public/js/admin.js`
- Create: `server/routes/auth.js`

- [ ] **Step 1: 创建认证路由**

创建 `server/routes/auth.js`：

```javascript
const express = require('express');
const router = express.Router();

// POST /api/admin/auth - 管理员登录
router.post('/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'guild2026';

  if (password === adminPassword) {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: '密码错误' });
  }
});

// POST /api/admin/auth/logout - 退出登录
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// GET /api/admin/auth/check - 检查登录状态
router.get('/check', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

module.exports = router;
```

- [ ] **Step 2: 更新 server/index.js**

```javascript
app.use('/api/admin/auth', require('./routes/auth'));
app.use('/api/admin/members', require('./routes/admin-members'));
app.use('/api/admin/events', require('./routes/events'));
app.use('/api/admin/contributions', require('./routes/contributions'));
```

- [ ] **Step 3: 创建 admin.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>管理后台 - 燕云百业</title>
  <link rel="stylesheet" href="/css/style.css">
  <style>
    .admin-container { max-width: 1000px; margin: 0 auto; padding: 100px 20px 40px; }

    .login-box {
      max-width: 400px; margin: 100px auto;
      background: var(--panel); border: 1px solid rgba(201,169,110,0.16);
      border-radius: 18px; padding: 40px; text-align: center;
    }
    .login-box h2 { margin-bottom: 24px; letter-spacing: 4px; }
    .login-box input {
      width: 100%; padding: 12px 16px; background: var(--bg);
      border: 1px solid rgba(201,169,110,0.2); border-radius: 8px;
      color: var(--text); font-size: 16px; margin-bottom: 16px;
    }
    .login-box .btn { width: 100%; }

    .admin-tabs {
      display: flex; gap: 12px; margin-bottom: 24px;
      border-bottom: 1px solid rgba(201,169,110,0.1);
      padding-bottom: 12px;
    }
    .admin-tab {
      background: transparent; border: none;
      color: var(--muted); font-size: 14px; letter-spacing: 2px;
      padding: 8px 16px; cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.3s;
    }
    .admin-tab:hover, .admin-tab.active {
      color: var(--gold);
      border-bottom-color: var(--gold);
    }

    .admin-panel { display: none; }
    .admin-panel.active { display: block; }

    .admin-table {
      width: 100%; border-collapse: collapse;
      background: var(--panel); border-radius: 12px;
      overflow: hidden;
    }
    .admin-table th {
      background: rgba(201,169,110,0.1);
      padding: 12px 16px; text-align: left;
      font-size: 12px; color: var(--gold); letter-spacing: 2px;
    }
    .admin-table td {
      padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.05);
      font-size: 13px;
    }
    .admin-table tr:hover td { background: rgba(201,169,110,0.03); }

    .admin-form {
      background: var(--panel); border-radius: 12px;
      padding: 24px; margin-bottom: 24px;
    }
    .form-row {
      display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;
    }
    .form-group { flex: 1; min-width: 200px; }
    .form-group label {
      display: block; font-size: 12px; color: var(--muted);
      letter-spacing: 1px; margin-bottom: 6px;
    }
    .form-group input, .form-group select, .form-group textarea {
      width: 100%; padding: 10px 12px; background: var(--bg);
      border: 1px solid rgba(201,169,110,0.2); border-radius: 6px;
      color: var(--text); font-size: 14px;
    }
    .form-group textarea { min-height: 80px; resize: vertical; }

    .action-btns { display: flex; gap: 8px; }
    .action-btns button {
      background: transparent; border: none;
      color: var(--muted); cursor: pointer; font-size: 16px;
      padding: 4px 8px; border-radius: 4px;
      transition: all 0.2s;
    }
    .action-btns button:hover { color: var(--gold); background: rgba(201,169,110,0.1); }
    .action-btns .delete-btn:hover { color: #ff5252; background: rgba(255,82,82,0.1); }

    .section-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px;
    }
    .section-header h3 {
      font-size: 18px; letter-spacing: 2px;
    }
  </style>
</head>
<body>
  <nav class="nav">
    <a href="/" class="nav-logo">燕云百业</a>
    <div class="nav-links">
      <a href="/">返回首页</a>
    </div>
  </nav>

  <!-- 登录框 -->
  <div class="login-box" id="loginBox">
    <h2>管理后台</h2>
    <input type="password" id="passwordInput" placeholder="请输入管理密码" onkeypress="if(event.key==='Enter')login()">
    <button class="btn btn-primary" onclick="login()">登录</button>
  </div>

  <!-- 管理面板 -->
  <div class="admin-container" id="adminPanel" style="display:none">
    <div class="admin-tabs">
      <button class="admin-tab active" data-tab="members">成员管理</button>
      <button class="admin-tab" data-tab="events">活动管理</button>
      <button class="admin-tab" data-tab="contributions">贡献管理</button>
    </div>

    <!-- 成员管理 -->
    <div class="admin-panel active" id="panel-members">
      <div class="section-header">
        <h3>成员列表</h3>
        <button class="btn btn-primary" onclick="showMemberForm()">+ 添加成员</button>
      </div>
      <div id="memberForm" style="display:none"></div>
      <table class="admin-table">
        <thead><tr><th>ID</th><th>昵称</th><th>职位</th><th>标签</th><th>操作</th></tr></thead>
        <tbody id="memberTableBody"></tbody>
      </table>
    </div>

    <!-- 活动管理 -->
    <div class="admin-panel" id="panel-events">
      <div class="section-header">
        <h3>活动列表</h3>
        <button class="btn btn-primary" onclick="showEventForm()">+ 添加活动</button>
      </div>
      <div id="eventForm" style="display:none"></div>
      <table class="admin-table">
        <thead><tr><th>日期</th><th>标题</th><th>类型</th><th>状态</th><th>操作</th></tr></thead>
        <tbody id="eventTableBody"></tbody>
      </table>
    </div>

    <!-- 贡献管理 -->
    <div class="admin-panel" id="panel-contributions">
      <div class="section-header">
        <h3>贡献记录</h3>
        <button class="btn btn-primary" onclick="showContributionForm()">+ 添加记录</button>
      </div>
      <div id="contributionForm" style="display:none"></div>
      <table class="admin-table">
        <thead><tr><th>成员</th><th>分值</th><th>类型</th><th>原因</th><th>时间</th><th>操作</th></tr></thead>
        <tbody id="contributionTableBody"></tbody>
      </table>
    </div>
  </div>

  <script src="/js/admin.js"></script>
</body>
</html>
```

- [ ] **Step 4: 创建 admin.js**

创建 `public/js/admin.js`：

```javascript
let members = [];

// 登录
async function login() {
  const pwd = document.getElementById('passwordInput').value;
  const res = await fetch('/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pwd })
  });
  if (res.ok) {
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    loadAll();
  } else {
    alert('密码错误');
  }
}

// 检查登录状态
(async () => {
  const res = await fetch('/api/admin/auth/check');
  const { isAdmin } = await res.json();
  if (isAdmin) {
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    loadAll();
  }
})();

// Tab 切换
document.querySelector('.admin-tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.admin-tab');
  if (!tab) return;
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  tab.classList.add('active');
  document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
});

async function loadAll() {
  const [mRes, eRes, cRes] = await Promise.all([
    fetch('/api/members'),
    fetch('/api/events'),
    fetch('/api/contributions/records')
  ]);
  members = await mRes.json();
  const events = await eRes.json();
  const contributions = await cRes.json();
  renderMemberTable(members);
  renderEventTable(events);
  renderContributionTable(contributions, members);
}

function renderMemberTable(list) {
  document.getElementById('memberTableBody').innerHTML = list.map(m => `
    <tr>
      <td>${m.id}</td>
      <td>${m.nickname}</td>
      <td>${m.role}</td>
      <td>${m.tags || '-'}</td>
      <td class="action-btns">
        <button onclick="editMember(${m.id})" title="编辑">✎</button>
        <button class="delete-btn" onclick="deleteMember(${m.id})" title="删除">✕</button>
      </td>
    </tr>
  `).join('');
}

function renderEventTable(list) {
  document.getElementById('eventTableBody').innerHTML = list.map(e => `
    <tr>
      <td>${e.event_date}</td>
      <td>${e.title}</td>
      <td>${e.type}</td>
      <td>${e.status}</td>
      <td class="action-btns">
        <button onclick="editEvent(${e.id})" title="编辑">✎</button>
        <button class="delete-btn" onclick="deleteEvent(${e.id})" title="删除">✕</button>
      </td>
    </tr>
  `).join('');
}

function renderContributionTable(list, memberList) {
  document.getElementById('contributionTableBody').innerHTML = list.map(c => {
    const m = memberList.find(x => x.id === c.member_id);
    return `
      <tr>
        <td>${m ? m.nickname : c.member_id}</td>
        <td style="color:var(--gold)">${c.points}</td>
        <td>${c.type || '-'}</td>
        <td>${c.reason || '-'}</td>
        <td>${c.created_at}</td>
        <td class="action-btns">
          <button class="delete-btn" onclick="deleteContribution(${c.id})" title="删除">✕</button>
        </td>
      </tr>`;
  }).join('');
}

// 成员表单
function showMemberForm(data = null) {
  const f = document.getElementById('memberForm');
  f.style.display = 'block';
  f.innerHTML = `
    <div class="admin-form">
      <div class="form-row">
        <div class="form-group"><label>昵称</label><input id="m-nickname" value="${data?.nickname || ''}"></div>
        <div class="form-group"><label>职位</label><select id="m-role">
          ${['社主','副社','管理','核心成员','普通成员'].map(r => `<option ${data?.role===r?'selected':''}>${r}</option>`).join('')}
        </select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>标签（逗号分隔）</label><input id="m-tags" value="${data?.tags || ''}"></div>
        <div class="form-group"><label>签名</label><input id="m-signature" value="${data?.signature || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>头像URL</label><input id="m-avatar" value="${data?.avatar || ''}"></div>
        <div class="form-group"><label>封面URL</label><input id="m-cover" value="${data?.cover || ''}"></div>
      </div>
      <button class="btn btn-primary" onclick="saveMember(${data?.id || 'null'})">保存</button>
      <button class="btn btn-ghost" onclick="document.getElementById('memberForm').style.display='none'">取消</button>
    </div>`;
}

async function saveMember(id) {
  const body = {
    nickname: document.getElementById('m-nickname').value,
    role: document.getElementById('m-role').value,
    tags: document.getElementById('m-tags').value,
    signature: document.getElementById('m-signature').value,
    avatar: document.getElementById('m-avatar').value,
    cover: document.getElementById('m-cover').value
  };
  const url = id ? `/api/admin/members/${id}` : '/api/admin/members';
  const method = id ? 'PUT' : 'POST';
  await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  document.getElementById('memberForm').style.display = 'none';
  loadAll();
}

function editMember(id) {
  const m = members.find(x => x.id === id);
  if (m) showMemberForm(m);
}

async function deleteMember(id) {
  if (!confirm('确定删除此成员？')) return;
  await fetch(`/api/admin/members/${id}`, { method: 'DELETE' });
  loadAll();
}

// 活动表单
function showEventForm(data = null) {
  const f = document.getElementById('eventForm');
  f.style.display = 'block';
  f.innerHTML = `
    <div class="admin-form">
      <div class="form-row">
        <div class="form-group"><label>标题</label><input id="e-title" value="${data?.title || ''}"></div>
        <div class="form-group"><label>类型</label><select id="e-type">
          ${['团建','副本','PVP','拍照','教学'].map(t => `<option ${data?.type===t?'selected':''}>${t}</option>`).join('')}
        </select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>日期</label><input type="date" id="e-date" value="${data?.event_date || ''}"></div>
        <div class="form-group"><label>开始时间</label><input type="time" id="e-start" value="${data?.start_time || ''}"></div>
        <div class="form-group"><label>结束时间</label><input type="time" id="e-end" value="${data?.end_time || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>组织人</label><input id="e-leader" value="${data?.leader || ''}"></div>
        <div class="form-group"><label>地点</label><input id="e-location" value="${data?.location || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:1"><label>描述</label><textarea id="e-desc">${data?.description || ''}</textarea></div>
      </div>
      <button class="btn btn-primary" onclick="saveEvent(${data?.id || 'null'})">保存</button>
      <button class="btn btn-ghost" onclick="document.getElementById('eventForm').style.display='none'">取消</button>
    </div>`;
}

async function saveEvent(id) {
  const body = {
    title: document.getElementById('e-title').value,
    type: document.getElementById('e-type').value,
    event_date: document.getElementById('e-date').value,
    start_time: document.getElementById('e-start').value,
    end_time: document.getElementById('e-end').value,
    leader: document.getElementById('e-leader').value,
    location: document.getElementById('e-location').value,
    description: document.getElementById('e-desc').value
  };
  const url = id ? `/api/admin/events/${id}` : '/api/admin/events';
  const method = id ? 'PUT' : 'POST';
  await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  document.getElementById('eventForm').style.display = 'none';
  loadAll();
}

async function deleteEvent(id) {
  if (!confirm('确定删除此活动？')) return;
  await fetch(`/api/admin/events/${id}`, { method: 'DELETE' });
  loadAll();
}

// 贡献表单
function showContributionForm() {
  const f = document.getElementById('contributionForm');
  f.style.display = 'block';
  f.innerHTML = `
    <div class="admin-form">
      <div class="form-row">
        <div class="form-group"><label>成员</label><select id="c-member">
          ${members.map(m => `<option value="${m.id}">${m.nickname}</option>`).join('')}
        </select></div>
        <div class="form-group"><label>分值</label><input type="number" id="c-points" value="10"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>类型</label><select id="c-type">
          ${['参加活动','组织活动','新人教学','攻略投稿','百业管理','特殊贡献'].map(t => `<option>${t}</option>`).join('')}
        </select></div>
        <div class="form-group"><label>原因</label><input id="c-reason"></div>
      </div>
      <button class="btn btn-primary" onclick="saveContribution()">保存</button>
      <button class="btn btn-ghost" onclick="document.getElementById('contributionForm').style.display='none'">取消</button>
    </div>`;
}

async function saveContribution() {
  const body = {
    member_id: parseInt(document.getElementById('c-member').value),
    points: parseInt(document.getElementById('c-points').value),
    type: document.getElementById('c-type').value,
    reason: document.getElementById('c-reason').value
  };
  await fetch('/api/admin/contributions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  document.getElementById('contributionForm').style.display = 'none';
  loadAll();
}

async function deleteContribution(id) {
  if (!confirm('确定删除此记录？')) return;
  await fetch(`/api/admin/contributions/${id}`, { method: 'DELETE' });
  loadAll();
}
```

- [ ] **Step 5: 测试管理后台**

```bash
cd e:/web
ADMIN_PASSWORD=test123 node server/index.js &
# 浏览器打开 http://localhost:3000/admin.html
# 输入密码 test123 登录
kill %1
```

Expected: 登录后可管理成员、活动、贡献

- [ ] **Step 6: 提交**

```bash
git add public/admin.html public/js/admin.js server/routes/auth.js
git commit -m "feat: admin backend with auth, CRUD for members/events/contributions"
```

---

### Task 9: 游戏功能页（占位）

**Files:**
- Create: `public/features.html`

- [ ] **Step 1: 创建 features.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>游戏功能 - 燕云百业</title>
  <link rel="stylesheet" href="/css/style.css">
  <style>
    .page-header { text-align: center; padding: 120px 20px 40px; }
    .page-header h1 { font-size: 36px; letter-spacing: 8px; margin-bottom: 12px; }
    .page-header .subtitle { color: var(--muted); font-size: 14px; letter-spacing: 4px; }

    .tools-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 24px; padding: 20px 40px 60px;
      max-width: 1000px; margin: 0 auto;
    }

    .tool-card {
      background: var(--panel); border: 1px solid rgba(201,169,110,0.16);
      border-radius: 18px; padding: 30px; text-align: center;
      transition: all 0.3s; cursor: pointer; text-decoration: none;
    }
    .tool-card:hover {
      transform: translateY(-4px); border-color: rgba(201,169,110,0.45);
      box-shadow: 0 24px 70px rgba(0,0,0,0.55);
    }
    .tool-card .icon { font-size: 48px; margin-bottom: 16px; }
    .tool-card h3 { color: var(--gold); font-size: 18px; letter-spacing: 2px; margin-bottom: 8px; }
    .tool-card p { color: var(--muted); font-size: 13px; line-height: 1.6; }
  </style>
</head>
<body>
  <nav class="nav">
    <a href="/" class="nav-logo">燕云百业</a>
    <div class="nav-links">
      <a href="/">主页</a>
      <a href="/members.html">成员</a>
      <a href="/calendar.html">活动日历</a>
      <a href="/rank.html">贡献榜</a>
      <a href="/tools/yysls/" target="_blank" class="active">装备工具</a>
    </div>
  </nav>

  <div class="page-header">
    <h1>游戏功能</h1>
    <div class="subtitle">百业专属工具箱</div>
  </div>

  <div class="tools-grid">
    <a class="tool-card" href="/tools/yysls/" target="_blank">
      <div class="icon">⚔️</div>
      <h3>装备毕业率管理器</h3>
      <p>管理装备词条、计算毕业率、对比装备收益、培养建议</p>
    </a>
    <div class="tool-card" style="opacity:0.4;cursor:default">
      <div class="icon">📖</div>
      <h3>副本攻略</h3>
      <p>即将上线...</p>
    </div>
    <div class="tool-card" style="opacity:0.4;cursor:default">
      <div class="icon">🗺️</div>
      <h3>地图工具</h3>
      <p>即将上线...</p>
    </div>
  </div>
</body>
</html>
```

- [ ] **Step 2: 提交**

```bash
git add public/features.html
git commit -m "feat: features placeholder page with tools grid"
```

---

### Task 10: 插入测试数据与最终验证

**Files:**
- Modify: `server/index.js`（添加种子数据脚本）

- [ ] **Step 1: 创建种子数据脚本**

创建 `server/seed.js`：

```javascript
const db = require('./db');

const members = [
  { nickname: '风起燕云', role: '社主', tags: 'PVP,活动组织', signature: '一入燕云，皆是江湖', sort_order: 1 },
  { nickname: '听雨', role: '副社', tags: '副本,教学', signature: '听风听雨听江湖', sort_order: 2 },
  { nickname: '长安故梦', role: '管理', tags: 'PVP,拍照', signature: '长安月下，故梦如烟', sort_order: 3 },
  { nickname: '云深不知处', role: '核心成员', tags: '副本,攻略', signature: '云深之处，自有天地', sort_order: 4 },
  { nickname: '半盏清茶', role: '普通成员', tags: '日常,活动', signature: '半盏清茶度流年', sort_order: 5 }
];

const events = [
  { title: '百业团建：汴京集合拍照', type: '团建', event_date: '2026-07-12', start_time: '20:30', leader: '风起燕云', location: '汴京', description: '穿上最好看的衣服，汴京城门集合' },
  { title: '副本教学：英雄本', type: '副本', event_date: '2026-07-14', start_time: '20:00', leader: '听雨', location: '副本入口', description: '带新人过英雄本，老成员优先让位置' },
  { title: 'PVP 3v3 练习赛', type: 'PVP', event_date: '2026-07-16', start_time: '21:00', leader: '长安故梦', description: '提升PVP技术，自由组队' }
];

console.log('插入测试数据...');

const insertMember = db.prepare('INSERT INTO members (nickname, role, tags, signature, sort_order) VALUES (?, ?, ?, ?, ?)');
const insertEvent = db.prepare('INSERT INTO events (title, type, event_date, start_time, leader, location, description) VALUES (?, ?, ?, ?, ?, ?, ?)');
const insertContrib = db.prepare('INSERT INTO contributions (member_id, points, type, reason) VALUES (?, ?, ?, ?)');

const insertAll = db.transaction(() => {
  for (const m of members) {
    insertMember.run(m.nickname, m.role, m.tags, m.signature, m.sort_order);
  }
  for (const e of events) {
    insertEvent.run(e.title, e.type, e.event_date, e.start_time, e.leader, e.location || null, e.description);
  }
  // 添加一些贡献记录
  insertContrib.run(1, 30, '组织活动', '组织百业团建');
  insertContrib.run(1, 15, '百业管理', '日常管理');
  insertContrib.run(2, 20, '新人教学', '带新人过副本');
  insertContrib.run(3, 10, '参加活动', '参加团建');
  insertContrib.run(4, 20, '攻略投稿', '副本攻略');
  insertContrib.run(5, 10, '参加活动', '参加PVP练习');
});

insertAll();
console.log('测试数据插入完成！');
```

- [ ] **Step 2: 运行种子脚本**

```bash
cd e:/web
node server/seed.js
```

Expected: 输出「测试数据插入完成！」

- [ ] **Step 3: 启动服务器并验证所有页面**

```bash
node server/index.js &
```

依次检查：
1. `http://localhost:3000` — 主页显示成员面板
2. `http://localhost:3000/members.html` — 成员列表页
3. `http://localhost:3000/member.html?id=1` — 成员详情页
4. `http://localhost:3000/calendar.html` — 活动日历页
5. `http://localhost:3000/rank.html` — 贡献榜页
6. `http://localhost:3000/features.html` — 游戏功能页
7. `http://localhost:3000/admin.html` — 管理后台
8. `http://localhost:3000/tools/yysls/` — 装备工具

```bash
kill %1
```

- [ ] **Step 4: 提交**

```bash
git add server/seed.js
git commit -m "feat: seed data script with test members, events, contributions"
```

---

### Task 11: 部署配置

**Files:**
- Create: `ecosystem.config.js`（PM2 配置，可选）
- Create: `nginx.conf`（Nginx 反向代理配置参考）

- [ ] **Step 1: 创建 Nginx 配置参考**

创建 `nginx.conf`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 静态文件缓存
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff2)$ {
        root /path/to/e/web/public;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # 装备工具（单独缓存策略）
    location /tools/yysls/ {
        root /path/to/e/web/public;
        expires 1d;
    }

    # API 和页面
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

- [ ] **Step 2: 最终提交**

```bash
git add nginx.conf
git commit -m "feat: nginx config reference for deployment"
```

- [ ] **Step 3: 完成**

所有任务完成。网站可以通过 `npm start` 启动，或用 PM2 守护进程：

```bash
npm start
# 或
pm2 start server/index.js --name guild-website
```
