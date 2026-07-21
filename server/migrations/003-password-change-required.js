function hasColumn(db, table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(item => item.name === column);
}

module.exports = {
  version: 3,
  name: 'password-change-required',
  up(db) {
    if (!hasColumn(db, 'users', 'password_change_required')) {
      db.exec(`
        ALTER TABLE users
        ADD COLUMN password_change_required INTEGER NOT NULL DEFAULT 0
      `);
    }

    db.prepare(`
      UPDATE users
      SET password_change_required = 1
      WHERE username IN ('ss1', 'ss2', 'ss3', 'ss4', 'ss5')
    `).run();
  }
};
