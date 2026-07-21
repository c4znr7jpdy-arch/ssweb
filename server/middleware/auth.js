const db = require('../db');

function getSessionUser(req) {
  if (!req.session || !req.session.userId) return null;
  return db.prepare(`
    SELECT id, username, role, password_change_required AS passwordChangeRequired
    FROM users
    WHERE id = ?
  `).get(req.session.userId);
}

function requireAuth(req, res, next) {
  const user = getSessionUser(req);
  if (user && user.role === 'admin') {
    if (user.passwordChangeRequired) {
      res.status(403).json({
        code: 'PASSWORD_CHANGE_REQUIRED',
        error: '请先设置新密码'
      });
      return;
    }
    req.user = user;
    return next();
  }
  res.status(401).json({ error: '未授权，请先登录管理后台' });
}

module.exports = requireAuth;
module.exports.getSessionUser = getSessionUser;
