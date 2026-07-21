const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { getSessionUser } = require('../middleware/auth');
const config = require('../config');
const { establishSession } = require('../auth/session');
const { createRateLimiter } = require('../middleware/rate-limit');

const router = express.Router();
const adminLoginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: '登录尝试过于频繁，请稍后再试'
});

// POST /api/admin/auth/login - Admin login
router.post('/login', adminLoginLimiter, async (req, res) => {
  const username = String(req.body.username || 'admin').trim();
  const password = String(req.body.password || '').trim();
  const user = db.prepare(
    `SELECT id, username, password_hash, role,
      password_change_required AS passwordChangeRequired
    FROM users WHERE username = ?`
  ).get(username);

  if (user && user.role === 'admin' && await bcrypt.compare(password, user.password_hash)) {
    await establishSession(req, user.id);
    res.json({
      success: true,
      mustChangePassword: Boolean(user.passwordChangeRequired),
      user: { id: user.id, username: user.username, role: user.role }
    });
    return;
  }

  res.status(401).json({ error: '账号、密码或权限不正确' });
});

// POST /api/admin/auth/logout - Logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('yanyun.sid', {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'strict'
    });
    res.json({ success: true });
  });
});

// GET /api/admin/auth/check - Check login status
router.get('/check', (req, res) => {
  const user = getSessionUser(req);
  const isAdmin = Boolean(user && user.role === 'admin' && !user.passwordChangeRequired);
  res.json({
    isAdmin,
    mustChangePassword: Boolean(user?.passwordChangeRequired),
    user: isAdmin ? user : null
  });
});

module.exports = router;
