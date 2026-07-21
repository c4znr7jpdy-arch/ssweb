const migrations = [
  require('./001-initial-schema'),
  require('./002-auth-and-albums'),
  require('./003-password-change-required'),
  require('./004-persistent-sessions'),
  require('./005-raid-signups'),
  require('./006-admin-password-change-fix'),
  require('./007-rename-display-role'),
  require('./008-event-guest-signups'),
  require('./009-event-start-reminders'),
  require('./010-event-creation-announcements')
];

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map(item => item.version)
  );
  const record = db.prepare(
    'INSERT INTO schema_migrations (version, name) VALUES (?, ?)'
  );

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;

    db.transaction(() => {
      migration.up(db);
      record.run(migration.version, migration.name);
    })();

    console.log(`Applied database migration ${migration.version}: ${migration.name}`);
  }
}

module.exports = { migrations, runMigrations };
