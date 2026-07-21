module.exports = {
  version: 7,
  name: 'rename-display-role',
  up(db) {
    // members.role 只是成员展示职位；后台权限由 users.role 单独控制。
    db.prepare(`
      UPDATE members
      SET role = '长老'
      WHERE role = '管理'
    `).run();
  }
};
