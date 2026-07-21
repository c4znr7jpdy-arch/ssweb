module.exports = {
  version: 6,
  name: 'admin-password-change-fix',
  up(db) {
    db.prepare(`
      UPDATE users
      SET password_change_required = 0
      WHERE username = 'admin' AND role = 'admin'
    `).run();
  }
};
