const Database = require('better-sqlite3');
const fs = require('fs/promises');
const path = require('path');
const config = require('./config');

function backupName(date = new Date()) {
  return `backup-${date.toISOString().replace(/[:.]/g, '-')}`;
}

async function copyDirectoryIfPresent(source, destination) {
  try {
    await fs.access(source);
  } catch {
    return false;
  }
  await fs.cp(source, destination, { recursive: true, force: false });
  return true;
}

async function pruneBackups(backupRoot, retention) {
  const entries = await fs.readdir(backupRoot, { withFileTypes: true });
  const backups = entries
    .filter(entry => entry.isDirectory() && entry.name.startsWith('backup-'))
    .map(entry => entry.name)
    .sort()
    .reverse();

  await Promise.all(
    backups.slice(retention).map(name => (
      fs.rm(path.join(backupRoot, name), { recursive: true, force: true })
    ))
  );
}

async function createBackup(now = new Date()) {
  await fs.access(config.databasePath);
  await fs.mkdir(config.backupDir, { recursive: true });

  const name = backupName(now);
  const destination = path.join(config.backupDir, name);
  const databaseDestination = path.join(destination, 'guild.db');
  await fs.mkdir(destination, { recursive: false });

  let database;
  try {
    database = new Database(config.databasePath, { readonly: true, fileMustExist: true });
    await database.backup(databaseDestination);
    database.close();
    database = null;

    const uploadsIncluded = await copyDirectoryIfPresent(
      config.albumUploadDir,
      path.join(destination, 'uploads', 'albums')
    );
    const databaseStat = await fs.stat(databaseDestination);
    const manifest = {
      createdAt: now.toISOString(),
      database: 'guild.db',
      databaseBytes: databaseStat.size,
      uploadsIncluded
    };
    await fs.writeFile(
      path.join(destination, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8'
    );
    await pruneBackups(config.backupDir, config.backupRetention);
    return destination;
  } catch (error) {
    if (database) database.close();
    await fs.rm(destination, { recursive: true, force: true });
    throw error;
  }
}

if (require.main === module) {
  createBackup()
    .then(destination => console.log(`Backup created: ${destination}`))
    .catch(error => {
      console.error(`Backup failed: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = { backupName, createBackup, pruneBackups };
