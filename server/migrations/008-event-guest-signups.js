module.exports = {
  version: 8,
  name: 'event-guest-signups',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS event_guest_signups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        signup_name TEXT NOT NULL COLLATE NOCASE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
        UNIQUE(event_id, signup_name)
      );

      CREATE INDEX IF NOT EXISTS idx_event_guest_signups_event
      ON event_guest_signups(event_id, id);
    `);
  }
};
