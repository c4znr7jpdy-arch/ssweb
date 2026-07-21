module.exports = {
  version: 5,
  name: 'raid-signups',
  up(db) {
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_event_members_unique
      ON event_members(event_id, member_id);

      CREATE INDEX IF NOT EXISTS idx_events_date_type_title
      ON events(event_date, type, title);
    `);
  }
};
