const crypto = require('crypto');
const express = require('express');
const config = require('../config');
const {
  archiveWeeklyEvent,
  ensureWeeklyEvent,
  getWeeklyEventRoster,
  replaceEventRoster,
  replaceWeeklyEventRoster
} = require('../services/raidSignup');

const router = express.Router();

function safeTokenEqual(received, expected) {
  const left = Buffer.from(String(received || ''), 'utf8');
  const right = Buffer.from(String(expected || ''), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function requireKdocsToken(req, res, next) {
  if (!config.kdocsSyncToken) {
    return res.status(503).json({ error: 'KDOCS_SYNC_TOKEN is not configured' });
  }

  const token = req.get('x-kdocs-token') || (req.body && req.body.token);
  if (!safeTokenEqual(token, config.kdocsSyncToken)) {
    return res.status(401).json({ error: 'Invalid KDocs sync token' });
  }

  next();
}

// WPS AirScript pushes the game names from column B into this endpoint.
router.post('/events/:eventId/roster', requireKdocsToken, (req, res) => {
  try {
    const result = replaceEventRoster({
      eventId: req.params.eventId,
      names: req.body.names,
      allowEmpty: req.body.allowEmpty === true
    });
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || '金山文档名单同步失败' });
  }
});

// An empty new-week sheet creates the weekly event without clearing an existing roster.
router.post('/events/weekly-roster/ensure', requireKdocsToken, (req, res) => {
  try {
    const result = ensureWeeklyEvent({
      title: req.body.title,
      type: req.body.type,
      startTime: req.body.startTime
    });
    res.status(result.created ? 201 : 200).json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || '创建本周活动失败' });
  }
});

// At the configured start time AirScript archives the website event. The roster
// remains stored on the website; only the shared sheet is cleared afterwards.
router.post('/events/weekly-roster/archive', requireKdocsToken, (req, res) => {
  try {
    res.json(archiveWeeklyEvent(req.body.title));
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || '封存本周活动失败' });
  }
});

// WPS AirScript resolves the current China week by title, creates the event when
// missing, and replaces its roster. This avoids persisting a stale weekly event ID.
router.post('/events/weekly-roster', requireKdocsToken, (req, res) => {
  try {
    const result = replaceWeeklyEventRoster({
      title: req.body.title,
      type: req.body.type,
      startTime: req.body.startTime,
      names: req.body.names,
      allowEmpty: req.body.allowEmpty === true
    });
    res.status(result.created ? 201 : 200).json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || '金山文档本周名单同步失败' });
  }
});

// AirScript pulls the current website roster when a website signup triggers its webhook.
// This read-only route never invokes the webhook, which prevents a sync loop.
router.get('/events/weekly-roster', requireKdocsToken, (req, res) => {
  try {
    res.json(getWeeklyEventRoster(req.query.title));
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || '读取网站本周名单失败' });
  }
});

module.exports = router;
