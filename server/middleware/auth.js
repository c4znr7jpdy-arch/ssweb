function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.status(401).json({ error: '未授权，请先登录管理后台' });
}

module.exports = requireAuth;
