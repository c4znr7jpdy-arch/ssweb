const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/auth');
const fs = require('fs/promises');
const path = require('path');
const { normalizeMediaUrl } = require('../utils/media-url');

const publicDir = path.join(__dirname, '..', '..', 'public');

// POST /api/admin/members - Add member
router.post('/', requireAuth, (req, res) => {
  const { nickname, role, avatar, cover, tags, signature, join_date, sort_order } = req.body;
  if (!nickname || !role) return res.status(400).json({ error: '昵称和职位必填' });

  const normalizedAvatar = normalizeMediaUrl(avatar);
  const normalizedCover = normalizeMediaUrl(cover);
  if (normalizedAvatar === undefined || normalizedCover === undefined) {
    return res.status(400).json({ error: '头像和封面仅支持站内路径或 HTTP/HTTPS 地址' });
  }

  const result = db.prepare(`
    INSERT INTO members (nickname, role, avatar, cover, tags, signature, join_date, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(nickname, role, normalizedAvatar, normalizedCover, tags || null, signature || null, join_date || null, sort_order || 0);

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(member);
});

// PUT /api/admin/members/:id - Update member
router.put('/:id', requireAuth, (req, res) => {
  const { nickname, role, avatar, cover, tags, signature, join_date, sort_order, status } = req.body;
  const existing = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '成员不存在' });

  const normalizedAvatar = avatar !== undefined ? normalizeMediaUrl(avatar) : existing.avatar;
  const normalizedCover = cover !== undefined ? normalizeMediaUrl(cover) : existing.cover;
  if (normalizedAvatar === undefined || normalizedCover === undefined) {
    return res.status(400).json({ error: '头像和封面仅支持站内路径或 HTTP/HTTPS 地址' });
  }

  db.prepare(`
    UPDATE members SET nickname=?, role=?, avatar=?, cover=?, tags=?, signature=?, join_date=?, sort_order=?, status=?
    WHERE id=?
  `).run(
    nickname || existing.nickname,
    role || existing.role,
    normalizedAvatar,
    normalizedCover,
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

// DELETE /api/admin/members/:id - Delete member
router.delete('/:id', requireAuth, async (req, res) => {
  const existing = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '成员不存在' });

  const photos = db.prepare('SELECT url FROM album_photos WHERE member_id = ?').all(req.params.id);
  const removeMember = db.transaction((memberId) => {
    db.prepare('DELETE FROM event_members WHERE member_id = ?').run(memberId);
    db.prepare('DELETE FROM contributions WHERE member_id = ?').run(memberId);
    db.prepare('DELETE FROM album_photos WHERE member_id = ?').run(memberId);
    db.prepare('DELETE FROM members WHERE id = ?').run(memberId);
  });

  removeMember(req.params.id);

  await Promise.all(photos.map(photo => {
    const relativePath = String(photo.url || '').replace(/^\/+/, '');
    if (!relativePath) return Promise.resolve();
    return fs.unlink(path.join(publicDir, relativePath)).catch(() => {});
  }));
  res.json({ success: true });
});

module.exports = router;
