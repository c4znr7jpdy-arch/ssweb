module.exports = {
  version: 1,
  name: 'initial-schema',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nickname TEXT NOT NULL,
        role TEXT NOT NULL,
        avatar TEXT,
        cover TEXT,
        tags TEXT,
        signature TEXT,
        join_date TEXT,
        status TEXT DEFAULT 'active',
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        event_date TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        location TEXT,
        leader TEXT,
        description TEXT,
        status TEXT DEFAULT 'upcoming',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS event_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        FOREIGN KEY(event_id) REFERENCES events(id),
        FOREIGN KEY(member_id) REFERENCES members(id)
      );

      CREATE TABLE IF NOT EXISTS contributions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        points INTEGER NOT NULL,
        type TEXT,
        reason TEXT,
        event_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(member_id) REFERENCES members(id),
        FOREIGN KEY(event_id) REFERENCES events(id)
      );
    `);
  }
};
