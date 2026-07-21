const express = require('express');
const router = express.Router();
const config = require('../config');
const { refreshKdocsRosterSafely } = require('../services/kdocsWebhook');
const {
  signupActivity,
  cancelSignupActivity,
  listPendingCreationAnnouncements,
  markCreationAnnouncementSent,
  listDueStartReminders,
  markStartReminderSent
} = require('../services/raidSignup');

function requireBotToken(req, res, next) {
  if (!config.botApiToken) {
    return res.status(503).json({ error: 'BOT_API_TOKEN is not configured' });
  }

  const token = req.get('x-bot-token') || (req.body && req.body.token);
  if (token !== config.botApiToken) {
    return res.status(401).json({ error: 'Invalid bot token' });
  }

  next();
}

// GET /api/bot/raid/announcements - Newly created events awaiting a group card
router.get('/raid/announcements', requireBotToken, (req, res) => {
  try {
    res.json({ announcements: listPendingCreationAnnouncements() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || '读取新活动通知失败' });
  }
});

// POST /api/bot/raid/announcements/:eventId/ack - Persist successful delivery
router.post('/raid/announcements/:eventId/ack', requireBotToken, (req, res) => {
  try {
    const result = markCreationAnnouncementSent(req.params.eventId);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || '记录新活动通知失败' });
  }
});

// GET /api/bot/raid/reminders - Events entering the configured reminder window
router.get('/raid/reminders', requireBotToken, (req, res) => {
  try {
    const reminders = listDueStartReminders(req.query.minutes);
    res.json({ reminders });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || '读取活动提醒失败' });
  }
});

// POST /api/bot/raid/reminders/:eventId/ack - Persist successful delivery
router.post('/raid/reminders/:eventId/ack', requireBotToken, (req, res) => {
  try {
    const result = markStartReminderSent(req.params.eventId, req.body.minutes);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || '记录活动提醒失败' });
  }
});

// POST /api/bot/raid/signup - WeChat bot activity signup endpoint
router.post('/raid/signup', requireBotToken, async (req, res) => {
  try {
    const result = signupActivity(req.body);
    const kdocsSync = await refreshKdocsRosterSafely(result.event);
    res.status(result.duplicated ? 200 : 201).json({ ...result, kdocsSync });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || '报名失败' });
  }
});

// POST /api/bot/raid/cancel - WeChat bot activity signup cancellation endpoint
router.post('/raid/cancel', requireBotToken, async (req, res) => {
  try {
    const result = cancelSignupActivity(req.body);
    const kdocsSync = result.cancelled
      ? await refreshKdocsRosterSafely(result.event)
      : { triggered: false, reason: 'unchanged' };
    res.json({ ...result, kdocsSync });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || '取消报名失败' });
  }
});

module.exports = router;
