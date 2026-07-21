function hasColumn(db, table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(item => item.name === column);
}

module.exports = {
  version: 2,
  name: 'auth-and-albums',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS album_photos (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        nickname TEXT,
        title TEXT,
        category TEXT,
        description TEXT,
        url TEXT NOT NULL,
        original_name TEXT,
        original_size INTEGER,
        compressed_size INTEGER,
        status TEXT NOT NULL DEFAULT 'approved',
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(member_id) REFERENCES members(id)
      );
    `);

    if (!hasColumn(db, 'members', 'user_id')) {
      db.exec('ALTER TABLE members ADD COLUMN user_id INTEGER');
    }

    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_members_user_id ON members(user_id);
      CREATE INDEX IF NOT EXISTS idx_album_photos_member_created
      ON album_photos(member_id, created_at DESC);
    `);

    const accounts = [
      { memberId: 1, username: 'ss1', legacyUsername: 'ss001' },
      { memberId: 2, username: 'ss2', legacyUsername: 'ss002' },
      { memberId: 3, username: 'ss3', legacyUsername: 'ss003' },
      { memberId: 4, username: 'ss4', legacyUsername: 'ss004' },
      { memberId: 5, username: 'ss5', legacyUsername: 'ss005' }
    ];

    for (const account of accounts) {
      const member = db.prepare('SELECT id FROM members WHERE id = ?').get(account.memberId);
      if (!member) continue;

      let user = db.prepare('SELECT id FROM users WHERE username = ?').get(account.username);
      const legacyUser = db.prepare('SELECT id FROM users WHERE username = ?').get(account.legacyUsername);

      if (!user && legacyUser) {
        db.prepare('UPDATE users SET username = ? WHERE id = ?').run(account.username, legacyUser.id);
        user = { id: legacyUser.id };
      }

      if (user) {
        db.prepare('UPDATE members SET user_id = NULL WHERE user_id = ? AND id != ?')
          .run(user.id, account.memberId);
        db.prepare('UPDATE members SET user_id = ?, sort_order = ? WHERE id = ?')
          .run(user.id, account.memberId, account.memberId);
      }
    }

    db.prepare(`
      UPDATE members
      SET sort_order = 1000 + id
      WHERE id NOT IN (1, 2, 3, 4, 5)
        AND COALESCE(sort_order, 0) = 0
    `).run();
  }
};
