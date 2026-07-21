const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shengshi-backup-'));
const databasePath = path.join(tempDir, 'source', 'guild.db');
const uploadDir = path.join(tempDir, 'uploads', 'albums');
const backupDir = path.join(tempDir, 'backups');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

const source = new Database(databasePath);
source.exec('CREATE TABLE sample (value TEXT NOT NULL); INSERT INTO sample VALUES (\'preserved\')');
source.close();
fs.writeFileSync(path.join(uploadDir, 'photo.txt'), 'album-data');

process.env.DATABASE_PATH = databasePath;
process.env.ALBUM_UPLOAD_DIR = uploadDir;
process.env.BACKUP_DIR = backupDir;
process.env.BACKUP_RETENTION = '2';

const { createBackup } = require('../server/backup');

test('backup includes database and uploads and applies retention', async () => {
  try {
    await createBackup(new Date('2026-07-19T01:00:00.000Z'));
    await createBackup(new Date('2026-07-20T01:00:00.000Z'));
    const latest = await createBackup(new Date('2026-07-21T01:00:00.000Z'));

    const directories = fs.readdirSync(backupDir).sort();
    assert.deepEqual(directories, [
      'backup-2026-07-20T01-00-00-000Z',
      'backup-2026-07-21T01-00-00-000Z'
    ]);

    const restored = new Database(path.join(latest, 'guild.db'), { readonly: true });
    assert.equal(restored.prepare('SELECT value FROM sample').get().value, 'preserved');
    restored.close();
    assert.equal(
      fs.readFileSync(path.join(latest, 'uploads', 'albums', 'photo.txt'), 'utf8'),
      'album-data'
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
