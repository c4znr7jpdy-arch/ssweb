const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { runMigrations } = require('./migrations');

const dataDir = path.dirname(config.databasePath);
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(config.databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

const hasExistingSchema = Boolean(
  db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'").get()
);
const hasMigrationHistory = Boolean(
  db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'").get()
);

if (hasExistingSchema && !hasMigrationHistory) {
  const backupDir = path.join(dataDir, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `guild-before-migrations-${stamp}.db`);
  const escapedPath = backupPath.replace(/'/g, "''");
  db.exec(`VACUUM INTO '${escapedPath}'`);
  console.log(`Database backup created: ${backupPath}`);
}

runMigrations(db);

const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
if (!adminExists && config.initialAdminPassword) {
  const passwordHash = bcrypt.hashSync(config.initialAdminPassword, 12);
  db.prepare(`
    INSERT INTO users (
      username, password_hash, role, password_change_required, created_at
    ) VALUES (?, ?, 'admin', 0, ?)
  `).run(config.initialAdminUsername, passwordHash, new Date().toISOString());
  console.log(`Initial administrator created: ${config.initialAdminUsername}`);
} else if (!adminExists) {
  console.warn('No administrator exists. Set INITIAL_ADMIN_PASSWORD to provision one.');
}

module.exports = db;
