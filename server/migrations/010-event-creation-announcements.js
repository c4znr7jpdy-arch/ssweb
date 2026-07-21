module.exports = {
  version: 10,
  name: 'event-creation-announcements',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS event_creation_announcements (
        event_id INTEGER PRIMARY KEY,
        announced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
      );

      INSERT OR IGNORE INTO event_creation_announcements (event_id)
      SELECT id FROM events;
    `);
  }
};
