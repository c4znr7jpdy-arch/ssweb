module.exports = {
  version: 9,
  name: 'event-start-reminders',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS event_start_reminders (
        event_id INTEGER NOT NULL,
        reminder_minutes INTEGER NOT NULL,
        notified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (event_id, reminder_minutes),
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_event_start_reminders_notified_at
      ON event_start_reminders(notified_at);
    `);
  }
};
