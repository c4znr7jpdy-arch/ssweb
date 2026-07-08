const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/auth');

// GET /api/rank - Get leaderboard
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

// GET /api/contributions/records - Get contribution records
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

// POST /api/admin/contributions - Add contribution record (admin)
router.post('/', requireAuth, (req, res) => {
  const { member_id, points, type, reason, event_id } = req.body;
  if (!member_id || !points) return res.status(400).json({ error: '成员和分值必填' });

  const result = db.prepare(`
    INSERT INTO contributions (member_id, points, type, reason, event_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(member_id, points, type || null, reason || null, event_id || null);

  res.status(201).json({ id: result.lastInsertRowid });
});

// DELETE /api/admin/contributions/:id - Delete contribution record (admin)
router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM contributions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
