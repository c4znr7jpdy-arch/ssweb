const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/auth');

// POST /api/admin/members - Add member
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

// PUT /api/admin/members/:id - Update member
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

// DELETE /api/admin/members/:id - Delete member
router.delete('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '成员不存在' });

  db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
