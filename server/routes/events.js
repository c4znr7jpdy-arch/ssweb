const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/auth');

// GET /api/events - Get events list
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

// GET /api/events/:id - Get event detail
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

// POST /api/admin/events - Add event (admin)
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

// PUT /api/admin/events/:id - Update event (admin)
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

// DELETE /api/admin/events/:id - Delete event (admin)
router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM event_members WHERE event_id = ?').run(req.params.id);
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
