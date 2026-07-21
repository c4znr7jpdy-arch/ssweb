/**
 * 燕云百业：简单用户系统 + 权限系统 + 成员相册上传
 *
 * 启动：
 * npm install
 * npm start
 *
 * 访问：
 * http://localhost:3000/register.html
 * http://localhost:3000/login.html
 * http://localhost:3000/members.html
 * http://localhost:3000/album-upload.html
 * http://localhost:3000/album.html
 */

const express = require('express');
const session = require('express-session');
const multer = require('multer');
const sharp = require('sharp');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const { nanoid } = require('nanoid');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'app.db');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads', 'albums');

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const TARGET_SIZE = 1 * 1024 * 1024;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  name: 'yanyun.sid',
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

app.use(express.static(PUBLIC_DIR));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter(req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error('只支持 JPG / PNG / WEBP 图片'));
      return;
    }
    cb(null, true);
  }
});

let db;

async function init() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  db = new Database(DB_FILE);

  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      nickname TEXT NOT NULL,
      phrase TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      role_title TEXT DEFAULT '成员',
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS album_photos (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      nickname TEXT,
      title TEXT,
      category TEXT,
      description TEXT,
      url TEXT NOT NULL,
      original_name TEXT,
      original_size INTEGER,
      compressed_size INTEGER,
      status TEXT NOT NULL DEFAULT 'approved',
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(member_id) REFERENCES members(id)
    );
  `);

  const admin = db.prepare(`SELECT id FROM users WHERE username = ?`).get('admin');
  if (!admin) {
    const hash = await bcrypt.hash('abc123', 10);
    const now = new Date().toISOString();

    const result = db.prepare(`
      INSERT INTO users (username, password_hash, role, created_at)
      VALUES (?, ?, ?, ?)
    `).run('admin', hash, 'admin', now);

    db.prepare(`
      INSERT INTO members (user_id, nickname, phrase, role_title, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(result.lastInsertRowid, '盛世', '以盛世之名，聚同袍之义', '社主', now);

    console.log('默认管理员已创建：admin / abc123');
  }
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    role: user.role
  };
}

function getCurrentUser(req) {
  if (!req.session.userId) return null;
  return db.prepare(`SELECT id, username, role FROM users WHERE id = ?`).get(req.session.userId);
}

function requireLogin(req, res, next) {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ message: '请先登录' });
    return;
  }
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ message: '请先登录' });
    return;
  }
  if (user.role !== 'admin') {
    res.status(403).json({ message: '没有权限' });
    return;
  }
  req.user = user;
  next();
}

function validatePassword(password) {
  // 6位，只允许英文和数字，且必须同时包含英文和数字；不要求大小写，不要求特殊字符。
  return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6}$/.test(password);
}

function validateUsername(username) {
  return /^[A-Za-z0-9_]{3,16}$/.test(username);
}

async function compressUnder1MB(buffer) {
  let maxSide = 2200;

  while (maxSide >= 1000) {
    for (let quality = 82; quality >= 42; quality -= 8) {
      const output = await sharp(buffer)
        .rotate()
        .resize({
          width: maxSide,
          height: maxSide,
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({
          quality,
          effort: 5
        })
        .toBuffer();

      if (output.length <= TARGET_SIZE) {
        return { buffer: output, size: output.length, quality, maxSide };
      }
    }

    maxSide = Math.floor(maxSide * 0.84);
  }

  const output = await sharp(buffer)
    .rotate()
    .resize({
      width: 900,
      height: 900,
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({
      quality: 38,
      effort: 6
    })
    .toBuffer();

  return { buffer: output, size: output.length, quality: 38, maxSide: 900 };
}

/* 当前登录状态 */
app.get('/api/auth/me', (req, res) => {
  const user = getCurrentUser(req);
  if (!user) {
    res.json({ user: null, member: null });
    return;
  }

  const member = db.prepare(`
    SELECT id, nickname, phrase, avatar_url AS avatarUrl, role_title AS roleTitle
    FROM members
    WHERE user_id = ?
  `).get(user.id);

  res.json({
    user: publicUser(user),
    member: member || null
  });
});

/* 注册：注册后自动登录，并自动进入 members 表 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '').trim();
    const nickname = String(req.body.nickname || '').trim() || username;

    if (!validateUsername(username)) {
      res.status(400).json({ message: '账号只能是 3-16 位英文、数字或下划线' });
      return;
    }

    if (!validatePassword(password)) {
      res.status(400).json({ message: '密码必须是 6 位英文和数字混合，例如 abc123' });
      return;
    }

    if (nickname.length > 16) {
      res.status(400).json({ message: '昵称不能超过 16 个字' });
      return;
    }

    const exists = db.prepare(`SELECT id FROM users WHERE username = ?`).get(username);
    if (exists) {
      res.status(409).json({ message: '账号已存在' });
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    const insertUser = db.prepare(`
      INSERT INTO users (username, password_hash, role, created_at)
      VALUES (?, ?, 'member', ?)
    `);

    const insertMember = db.prepare(`
      INSERT INTO members (user_id, nickname, phrase, role_title, created_at)
      VALUES (?, ?, '', '成员', ?)
    `);

    const transaction = db.transaction(() => {
      const result = insertUser.run(username, hash, now);
      insertMember.run(result.lastInsertRowid, nickname, now);
      return result.lastInsertRowid;
    });

    const userId = transaction();

    req.session.userId = userId;

    res.json({
      message: '注册成功',
      user: { id: userId, username, role: 'member' }
    });
  } catch (err) {
    res.status(500).json({ message: err.message || '注册失败' });
  }
});

/* 登录：只校验账号和密码 */
app.post('/api/auth/login', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '').trim();

  const user = db.prepare(`
    SELECT id, username, password_hash, role
    FROM users
    WHERE username = ?
  `).get(username);

  if (!user) {
    res.status(401).json({ message: '账号或密码错误' });
    return;
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    res.status(401).json({ message: '账号或密码错误' });
    return;
  }

  req.session.userId = user.id;

  res.json({
    message: '登录成功',
    user: publicUser(user)
  });
});

/* 退出登录 */
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('yanyun.sid');
    res.json({ message: '已退出登录' });
  });
});

/* 成员列表：注册成功的人都会出现在这里 */
app.get('/api/members', (req, res) => {
  const items = db.prepare(`
    SELECT
      m.id,
      m.user_id AS userId,
      u.username,
      u.role,
      m.nickname,
      m.phrase,
      m.avatar_url AS avatarUrl,
      m.role_title AS roleTitle,
      m.created_at AS createdAt,
      (
        SELECT COUNT(*)
        FROM album_photos p
        WHERE p.member_id = m.id
      ) AS photoCount
    FROM members m
    JOIN users u ON u.id = m.user_id
    ORDER BY m.id ASC
  `).all();

  res.json({ items });
});

/* 当前用户修改自己的成员资料 */
app.put('/api/members/me', requireLogin, (req, res) => {
  const nickname = String(req.body.nickname || '').trim();
  const phrase = String(req.body.phrase || '').trim();

  if (!nickname) {
    res.status(400).json({ message: '昵称不能为空' });
    return;
  }

  if (nickname.length > 16) {
    res.status(400).json({ message: '昵称不能超过 16 个字' });
    return;
  }

  db.prepare(`
    UPDATE members
    SET nickname = ?, phrase = ?
    WHERE user_id = ?
  `).run(nickname, phrase, req.user.id);

  res.json({ message: '资料已更新' });
});

/* 上传图片：必须登录。普通用户只能上传到自己的 member_id */
app.post('/api/albums/upload', requireLogin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: '请上传图片' });
      return;
    }

    const myMember = db.prepare(`
      SELECT id, nickname
      FROM members
      WHERE user_id = ?
    `).get(req.user.id);

    if (!myMember) {
      res.status(400).json({ message: '当前账号没有成员资料' });
      return;
    }

    let memberId = Number(req.body.memberId || myMember.id);

    // 普通成员只能给自己上传；管理员可以给任何成员上传。
    if (req.user.role !== 'admin') {
      memberId = myMember.id;
    }

    const targetMember = db.prepare(`
      SELECT id, nickname
      FROM members
      WHERE id = ?
    `).get(memberId);

    if (!targetMember) {
      res.status(404).json({ message: '成员不存在' });
      return;
    }

    const title = String(req.body.title || req.file.originalname || '未命名图片').trim();
    const category = String(req.body.category || '个人').trim();
    const description = String(req.body.description || '').trim();

    const memberDir = path.join(UPLOAD_DIR, String(memberId));
    await fs.mkdir(memberDir, { recursive: true });

    const compressed = await compressUnder1MB(req.file.buffer);
    const id = nanoid(12);
    const filename = `${Date.now()}-${id}.webp`;
    const filepath = path.join(memberDir, filename);

    await fs.writeFile(filepath, compressed.buffer);

    const url = `/uploads/albums/${memberId}/${filename}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO album_photos (
        id, user_id, member_id, nickname, title, category, description, url,
        original_name, original_size, compressed_size, status, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)
    `).run(
      id,
      req.user.id,
      memberId,
      targetMember.nickname,
      title,
      category,
      description,
      url,
      req.file.originalname,
      req.file.size,
      compressed.size,
      now
    );

    res.json({
      message: '上传成功',
      item: {
        id,
        memberId,
        nickname: targetMember.nickname,
        title,
        category,
        description,
        url,
        originalSize: req.file.size,
        compressedSize: compressed.size,
        createdAt: now
      },
      compressedSize: compressed.size
    });
  } catch (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ message: '图片超过 10M' });
      return;
    }

    res.status(500).json({ message: err.message || '上传失败' });
  }
});

/* 相册列表：公开可看 */
app.get('/api/albums', (req, res) => {
  const { memberId, category } = req.query;

  const where = [`status = 'approved'`];
  const params = [];

  if (memberId) {
    where.push(`member_id = ?`);
    params.push(Number(memberId));
  }

  if (category && category !== '全部') {
    where.push(`category = ?`);
    params.push(String(category));
  }

  const items = db.prepare(`
    SELECT
      id,
      user_id AS userId,
      member_id AS memberId,
      nickname,
      title,
      category,
      description,
      url,
      original_size AS originalSize,
      compressed_size AS compressedSize,
      status,
      created_at AS createdAt
    FROM album_photos
    WHERE ${where.join(' AND ')}
    ORDER BY created_at DESC
  `).all(...params);

  res.json({ items });
});

/* 删除图片：管理员可以删所有；普通用户只能删自己的 */
app.delete('/api/albums/:id', requireLogin, async (req, res) => {
  const photo = db.prepare(`
    SELECT id, user_id AS userId, url
    FROM album_photos
    WHERE id = ?
  `).get(req.params.id);

  if (!photo) {
    res.status(404).json({ message: '图片不存在' });
    return;
  }

  if (req.user.role !== 'admin' && photo.userId !== req.user.id) {
    res.status(403).json({ message: '没有权限删除这张图片' });
    return;
  }

  db.prepare(`DELETE FROM album_photos WHERE id = ?`).run(req.params.id);

  try {
    const filePath = path.join(PUBLIC_DIR, photo.url);
    await fs.unlink(filePath);
  } catch {}

  res.json({ message: '已删除' });
});

/* 管理员改用户角色 */
app.put('/api/admin/users/:id/role', requireAdmin, (req, res) => {
  const role = String(req.body.role || '');
  const allowed = ['member', 'admin'];

  if (!allowed.includes(role)) {
    res.status(400).json({ message: '角色不合法' });
    return;
  }

  db.prepare(`UPDATE users SET role = ? WHERE id = ?`).run(role, Number(req.params.id));
  res.json({ message: '角色已更新' });
});

/* 错误处理：multer 文件过大等 */
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ message: '图片超过 10M' });
    return;
  }

  res.status(500).json({ message: err.message || '服务器错误' });
});

init().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running: http://localhost:${PORT}`);
  });
});
