const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const db = require('../db');
const config = require('../config');
const requireAuth = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rate-limit');
const { refreshKdocsRosterSafely } = require('../services/kdocsWebhook');
const {
  MAX_SIGNUP_COUNT,
  signupActivity,
  listSignupOptions,
  listMembers,
  getAdminEventRoster,
  addAdminEventSignup,
  removeAdminEventSignup,
  getEventMemberCount,
  isEventExpired,
  parseChinaEventStart
} = require('../services/raidSignup');

const publicSignupLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 12,
  message: '报名过于频繁，请稍后再试'
});

// GET /api/events - Get events list
router.get('/', (req, res) => {
  const { month } = req.query;
  let sql = `
    SELECT e.*,
      (SELECT COUNT(*) FROM event_members em WHERE em.event_id = e.id) +
      (SELECT COUNT(*) FROM event_guest_signups eg WHERE eg.event_id = e.id) AS member_count
    FROM events e
  `;
  const params = [];

  if (month) {
    sql += " WHERE strftime('%Y-%m', e.event_date) = ?";
    params.push(month);
  }

  sql += ' ORDER BY e.event_date ASC, e.start_time ASC';
  res.json(db.prepare(sql).all(...params));
});

// GET /api/events/signup-options - Active events available for signup
router.get('/signup-options', (req, res) => {
  res.json(listSignupOptions());
});

// POST /api/events/raid-signup - Public signup from the website form
router.post('/raid-signup', publicSignupLimiter, async (req, res) => {
  try {
    const result = signupActivity(req.body);
    const kdocsSync = await refreshKdocsRosterSafely(result.event);
    res.status(result.duplicated ? 200 : 201).json({ ...result, kdocsSync });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || '报名失败' });
  }
});

// GET /api/events/:id - Get event detail and the complete public roster
router.get('/:id', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: '活动不存在' });

  const members = listMembers(req.params.id);
  const memberCount = getEventMemberCount(req.params.id);
  const expired = isEventExpired(event);
  let signupClosedReason = '';
  if (expired) signupClosedReason = '活动已结束或报名已关闭';
  else if (memberCount >= MAX_SIGNUP_COUNT) signupClosedReason = '报名人数已满';

  res.json({
    ...event,
    members,
    member_count: memberCount,
    capacity: MAX_SIGNUP_COUNT,
    remaining: Math.max(0, MAX_SIGNUP_COUNT - memberCount),
    signup_allowed: !expired && memberCount < MAX_SIGNUP_COUNT,
    signup_closed_reason: signupClosedReason
  });
});

// GET /api/admin/events/:id/kdocs-script - Generate an authenticated AirScript for this event.
router.get('/:id/kdocs-script', requireAuth, (req, res) => {
  const event = db.prepare('SELECT id, title FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: '活动不存在' });
  if (!config.kdocsSyncToken) {
    return res.status(503).json({ error: 'KDOCS_SYNC_TOKEN is not configured' });
  }

  const templatePath = path.join(__dirname, '..', '..', 'integrations', 'kdocs-roster-sync.js');
  const script = fs.readFileSync(templatePath, 'utf8')
    .replace('请填写服务器配置的 KDOCS_SYNC_TOKEN', config.kdocsSyncToken.replace(/\\/g, '\\\\').replace(/'/g, "\\'"));

  res.json({ event, script });
});

// GET /api/admin/events/:id/roster - Read the complete roster for admin editing.
router.get('/:id/roster', requireAuth, (req, res) => {
  try {
    res.json(getAdminEventRoster(req.params.id));
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || '读取活动名单失败' });
  }
});

// POST /api/admin/events/:id/roster - Add a registered member or guest, then sync KDocs.
router.post('/:id/roster', requireAuth, async (req, res) => {
  try {
    const result = addAdminEventSignup(req.params.id, req.body.name);
    const kdocsSync = await refreshKdocsRosterSafely(result.event);
    res.status(201).json({ ...result, kdocsSync });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || '添加报名成员失败' });
  }
});

// DELETE /api/admin/events/:id/roster/:source/:signupId - Delete one exact signup, then sync KDocs.
router.delete('/:id/roster/:source/:signupId', requireAuth, async (req, res) => {
  try {
    const result = removeAdminEventSignup(
      req.params.id,
      req.params.source,
      req.params.signupId
    );
    const kdocsSync = await refreshKdocsRosterSafely(result.event);
    res.json({ ...result, kdocsSync });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || '删除报名成员失败' });
  }
});

// POST /api/admin/events - Add event (admin)
router.post('/', requireAuth, (req, res) => {
  const { title, type, event_date, start_time, end_time, location, leader, description } = req.body;
  if (!title || !type || !event_date || !start_time) {
    return res.status(400).json({ error: '标题、类型、活动日期和开始时间必填' });
  }
  if (!parseChinaEventStart({ event_date, start_time })) {
    return res.status(400).json({ error: '活动日期或开始时间格式不正确' });
  }

  const result = db.prepare(`
    INSERT INTO events (title, type, event_date, start_time, end_time, location, leader, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title,
    type,
    event_date,
    start_time || null,
    end_time || null,
    location || null,
    leader || null,
    description || null
  );

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(event);
});

// PUT /api/admin/events/:id - Update event (admin)
router.put('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '活动不存在' });

  const { title, type, event_date, start_time, end_time, location, leader, description, status } = req.body;
  const nextEventDate = event_date || existing.event_date;
  const nextStartTime = start_time !== undefined ? start_time : existing.start_time;
  if (!nextEventDate || !nextStartTime) {
    return res.status(400).json({ error: '活动日期和开始时间必填' });
  }
  if (!parseChinaEventStart({ event_date: nextEventDate, start_time: nextStartTime })) {
    return res.status(400).json({ error: '活动日期或开始时间格式不正确' });
  }
  db.prepare(`
    UPDATE events SET title=?, type=?, event_date=?, start_time=?, end_time=?, location=?, leader=?, description=?, status=?
    WHERE id=?
  `).run(
    title || existing.title,
    type || existing.type,
    nextEventDate,
    nextStartTime,
    end_time !== undefined ? end_time : existing.end_time,
    location !== undefined ? location : existing.location,
    leader !== undefined ? leader : existing.leader,
    description !== undefined ? description : existing.description,
    status || existing.status,
    req.params.id
  );

  if (nextEventDate !== existing.event_date || nextStartTime !== existing.start_time) {
    db.prepare('DELETE FROM event_start_reminders WHERE event_id = ?').run(req.params.id);
  }

  res.json(db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id));
});

// DELETE /api/admin/events/:id - Delete event (admin)
router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM event_members WHERE event_id = ?').run(req.params.id);
  db.prepare('DELETE FROM event_guest_signups WHERE event_id = ?').run(req.params.id);
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
