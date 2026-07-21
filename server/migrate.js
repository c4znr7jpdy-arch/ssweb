const db = require('./db');

const applied = db.prepare(
  'SELECT version, name, applied_at AS appliedAt FROM schema_migrations ORDER BY version'
).all();

console.table(applied);
db.close();
