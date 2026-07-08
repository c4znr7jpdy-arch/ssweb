const express = require('express');
const router = express.Router();

// POST /api/admin/auth/login - Admin login
router.post('/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'guild2026';

  if (password === adminPassword) {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: '密码错误' });
  }
});

// POST /api/admin/auth/logout - Logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// GET /api/admin/auth/check - Check login status
router.get('/check', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

module.exports = router;
