const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const sharp = require('sharp');
const { nanoid } = require('nanoid');
const fs = require('fs/promises');
const path = require('path');
const db = require('../db');
const config = require('../config');
const { establishSession } = require('../auth/session');
const { createRateLimiter } = require('../middleware/rate-limit');
const { normalizeMediaUrl } = require('../utils/media-url');

const router = express.Router();

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const TARGET_SIZE = 1 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40 * 1000 * 1000;

const UPLOAD_DIR = config.albumUploadDir;

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

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: '登录尝试过于频繁，请稍后再试'
});
const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 8,
  message: '注册尝试过于频繁，请稍后再试'
});
const passwordLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: '修改密码尝试过于频繁，请稍后再试'
});
const uploadLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: '上传过于频繁，请稍后再试'
});

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    mustChangePassword: Boolean(user.passwordChangeRequired)
  };
}

function getCurrentUser(req) {
  if (!req.session || !req.session.userId) return null;
  return db.prepare(`
    SELECT id, username, password_hash AS passwordHash, role,
      password_change_required AS passwordChangeRequired
    FROM users
    WHERE id = ?
  `).get(req.session.userId);
}

function getMyMember(userId) {
  return db.prepare(`
    SELECT
      id,
      user_id AS userId,
      nickname,
      role,
      role AS roleTitle,
      avatar,
      avatar AS avatarUrl,
      cover,
      tags,
      signature,
      signature AS phrase
    FROM members
    WHERE user_id = ?
  `).get(userId);
}

function requireLogin(req, res, next) {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ message: '请先登录' });
    return;
  }
  if (user.passwordChangeRequired) {
    res.status(403).json({
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: '请先设置新密码'
    });
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
  if (user.passwordChangeRequired) {
    res.status(403).json({
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: '请先设置新密码'
    });
    return;
  }
  req.user = user;
  next();
}

function validateUsername(username) {
  return username.length >= 1 && username.length <= 16;
}

function validatePassword(password) {
  return password.length >= 8 && password.length <= 128;
}

function albumFilePath(url) {
  const relative = String(url || '').replace(/^\/uploads\/albums\//, '');
  const resolved = path.resolve(UPLOAD_DIR, relative);
  const root = `${path.resolve(UPLOAD_DIR)}${path.sep}`;
  return resolved.startsWith(root) ? resolved : null;
}

async function compressUnder1MB(buffer) {
  let maxSide = 2200;

  while (maxSide >= 1000) {
    for (let quality = 82; quality >= 42; quality -= 8) {
      const output = await sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'error' })
        .rotate()
        .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
        .webp({ quality, effort: 5 })
        .toBuffer();

      if (output.length <= TARGET_SIZE) {
        return { buffer: output, size: output.length, quality, maxSide };
      }
    }
    maxSide = Math.floor(maxSide * 0.84);
  }

  const output = await sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'error' })
    .rotate()
    .resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 38, effort: 6 })
    .toBuffer();

  return { buffer: output, size: output.length, quality: 38, maxSide: 900 };
}

router.get('/api/auth/me', (req, res) => {
  const user = getCurrentUser(req);
  if (!user) {
    res.json({ user: null, member: null });
    return;
  }

  res.json({
    user: publicUser(user),
    member: getMyMember(user.id) || null
  });
});

router.post('/api/auth/register', registerLimiter, async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '').trim();
    const nickname = String(req.body.nickname || '').trim() || username;
    const inviteCode = String(req.body.inviteCode || '').trim();

    if (!config.registrationInviteCode) {
      res.status(503).json({ message: '注册暂未开放' });
      return;
    }
    if (inviteCode !== config.registrationInviteCode) {
      res.status(403).json({ message: '邀请码无效' });
      return;
    }

    if (!validateUsername(username)) {
      res.status(400).json({ message: '账号需要 1-16 个字符' });
      return;
    }
    if (!validatePassword(password)) {
      res.status(400).json({ message: '密码需要 8-128 个字符' });
      return;
    }
    if (!nickname) {
      res.status(400).json({ message: '昵称不能为空' });
      return;
    }

    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (exists) {
      res.status(409).json({ message: '账号已存在' });
      return;
    }

    const hash = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();

    const transaction = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO users (
          username, password_hash, role, password_change_required, created_at
        ) VALUES (?, ?, 'member', 0, ?)
      `).run(username, hash, now);

      db.prepare(`
        INSERT INTO members (user_id, nickname, role, status, sort_order, created_at)
        VALUES (?, ?, '成员', 'active', 9999, ?)
      `).run(result.lastInsertRowid, nickname, now);

      return result.lastInsertRowid;
    });

    const userId = transaction();
    await establishSession(req, userId);
    res.json({ message: '注册成功', user: { id: userId, username, role: 'member' } });
  } catch (err) {
    console.error('Registration failed:', err.message);
    res.status(500).json({ message: '注册失败，请稍后重试' });
  }
});

router.post('/api/auth/login', loginLimiter, async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '').trim();
  const user = db.prepare(
    `SELECT id, username, password_hash, role,
      password_change_required AS passwordChangeRequired
    FROM users WHERE username = ?`
  ).get(username);

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ message: '账号或密码错误' });
    return;
  }

  await establishSession(req, user.id);
  res.json({
    message: user.passwordChangeRequired ? '请设置新密码' : '登录成功',
    user: publicUser(user),
    mustChangePassword: Boolean(user.passwordChangeRequired)
  });
});

router.post('/api/auth/change-password', passwordLimiter, async (req, res) => {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ message: '请先登录' });
    return;
  }

  const newPassword = String(req.body.newPassword || '').trim();
  const confirmPassword = String(req.body.confirmPassword || '').trim();
  const currentPassword = String(req.body.currentPassword || '').trim();
  if (!user.passwordChangeRequired && !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    res.status(401).json({ message: '当前密码错误' });
    return;
  }
  if (!validatePassword(newPassword)) {
    res.status(400).json({ message: '新密码需要 8-128 个字符' });
    return;
  }
  if (newPassword !== confirmPassword) {
    res.status(400).json({ message: '两次输入的密码不一致' });
    return;
  }
  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    res.status(400).json({ message: '新密码不能与当前密码相同' });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  db.prepare(`
    UPDATE users
    SET password_hash = ?, password_change_required = 0
    WHERE id = ?
  `).run(passwordHash, user.id);

  await establishSession(req, user.id);
  res.json({ message: '密码设置成功' });
});

router.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('yanyun.sid', {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'strict'
    });
    res.json({ message: '已退出登录' });
  });
});

router.put('/api/members/me', requireLogin, (req, res) => {
  const nickname = String(req.body.nickname || '').trim();
  if (!nickname) {
    res.status(400).json({ message: '昵称不能为空' });
    return;
  }
  if (nickname.length > 16) {
    res.status(400).json({ message: '昵称不能超过 16 个字符' });
    return;
  }

  const member = db.prepare('SELECT * FROM members WHERE user_id = ?').get(req.user.id);
  if (!member) {
    res.status(400).json({ message: '当前账号没有成员资料' });
    return;
  }

  const signature = String(req.body.signature ?? req.body.phrase ?? member.signature ?? '').trim();
  const hasAvatar = Object.prototype.hasOwnProperty.call(req.body, 'avatar');
  const avatar = hasAvatar ? normalizeMediaUrl(req.body.avatar) : member.avatar;
  if (hasAvatar && avatar === undefined) {
    res.status(400).json({ message: '头像 URL 无效，仅支持站内路径或 HTTP/HTTPS 地址' });
    return;
  }

  db.prepare(`
    UPDATE members SET nickname = ?, signature = ?, avatar = ?
    WHERE user_id = ?
  `).run(nickname, signature || null, avatar || null, req.user.id);

  res.json({ message: '资料已更新' });
});

router.get('/api/members/:id', (req, res) => {
  const member = db.prepare(`
    SELECT
      m.id,
      m.nickname,
      m.role,
      m.role AS roleTitle,
      m.avatar,
      m.avatar AS avatarUrl,
      m.cover,
      m.tags,
      m.signature,
      m.signature AS phrase,
      m.join_date AS joinDate,
      m.status,
      m.created_at AS createdAt,
      (
        SELECT COUNT(*) FROM album_photos p
        WHERE p.member_id = m.id AND p.status = 'approved'
      ) AS photoCount
    FROM members m
    WHERE m.id = ?
  `).get(Number(req.params.id));

  if (!member) {
    res.status(404).json({ message: '成员不存在' });
    return;
  }

  res.json({ item: member });
});

router.post(
  '/api/albums/upload',
  uploadLimiter,
  requireLogin,
  upload.single('image'),
  async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: '请上传图片' });
      return;
    }

    const myMember = getMyMember(req.user.id);
    if (!myMember) {
      res.status(400).json({ message: '当前账号没有成员资料' });
      return;
    }

    const submittedMemberId = req.body.memberId ? Number(req.body.memberId) : myMember.id;
    if (submittedMemberId !== myMember.id) {
      res.status(403).json({ message: '只能上传到自己的相册' });
      return;
    }
    const memberId = myMember.id;

    const targetMember = myMember;

    const metadata = await sharp(req.file.buffer, {
      limitInputPixels: MAX_IMAGE_PIXELS,
      failOn: 'error'
    }).metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format)) {
      res.status(415).json({ message: '图片格式无效' });
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)
    `).run(
      id, req.user.id, memberId, targetMember.nickname,
      title, category, description, url,
      req.file.originalname, req.file.size, compressed.size, now
    );

    res.json({
      message: '上传成功',
      item: {
        id, memberId, nickname: targetMember.nickname,
        title, category, description, url,
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
    console.error('Album upload failed:', err.message);
    res.status(400).json({ message: '图片无法处理，请检查格式和尺寸' });
  }
});

router.get('/api/albums', (req, res) => {
  const { memberId, category } = req.query;
  const conditions = ["status = 'approved'"];
  const params = [];

  if (memberId) {
    conditions.push('member_id = ?');
    params.push(Number(memberId));
  }
  if (category && category !== '全部') {
    conditions.push('category = ?');
    params.push(String(category));
  }

  const items = db.prepare(`
    SELECT
      id,
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
    WHERE ${conditions.join(' AND ')}
    ORDER BY created_at DESC
  `).all(...params);

  res.json({ items });
});

router.delete('/api/albums/:id', requireLogin, async (req, res) => {
  const photo = db.prepare(
    'SELECT id, user_id AS userId, url FROM album_photos WHERE id = ?'
  ).get(req.params.id);

  if (!photo) {
    res.status(404).json({ message: '图片不存在' });
    return;
  }
  if (req.user.role !== 'admin' && photo.userId !== req.user.id) {
    res.status(403).json({ message: '没有权限删除这张图片' });
    return;
  }

  db.prepare('DELETE FROM album_photos WHERE id = ?').run(req.params.id);

  try {
    const filepath = albumFilePath(photo.url);
    if (filepath) await fs.unlink(filepath);
  } catch {
    // File may already be missing.
  }

  res.json({ message: '已删除' });
});

router.put('/api/admin/users/:id/role', requireAdmin, (req, res) => {
  const role = String(req.body.role || '');
  if (!['member', 'admin'].includes(role)) {
    res.status(400).json({ message: '角色不合法' });
    return;
  }

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, Number(req.params.id));
  res.json({ message: '角色已更新' });
});

router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ message: '图片超过 10M' });
    return;
  }
  res.status(500).json({ message: err.message || '服务器错误' });
});

module.exports = router;
