const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/members - Get all active members
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

// GET /api/members/:id - Get member detail
router.get('/:id', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: '成员不存在' });
  res.json(member);
});

module.exports = router;
