const crypto = require('crypto');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const isProduction = process.env.NODE_ENV === 'production';

function requiredInProduction(name) {
  const value = String(process.env[name] || '').trim();
  if (isProduction && !value) {
    throw new Error(`${name} must be configured in production`);
  }
  return value;
}

const configuredSessionSecret = requiredInProduction('SESSION_SECRET');
const sessionSecret = configuredSessionSecret || crypto.randomBytes(32).toString('hex');

if (!configuredSessionSecret) {
  console.warn('SESSION_SECRET is not configured; using an ephemeral development secret.');
}

module.exports = {
  isProduction,
  sessionSecret,
  registrationInviteCode: requiredInProduction('REGISTRATION_INVITE_CODE'),
  initialAdminUsername: String(process.env.INITIAL_ADMIN_USERNAME || 'admin').trim(),
  initialAdminPassword: String(process.env.INITIAL_ADMIN_PASSWORD || '').trim(),
  databasePath: process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.join(__dirname, '..', 'data', 'guild.db'),
  albumUploadDir: process.env.ALBUM_UPLOAD_DIR
    ? path.resolve(process.env.ALBUM_UPLOAD_DIR)
    : path.join(__dirname, '..', 'public', 'uploads', 'albums'),
  backupDir: process.env.BACKUP_DIR
    ? path.resolve(process.env.BACKUP_DIR)
    : path.join(__dirname, '..', 'data', 'backups'),
  backupRetention: Math.max(1, Number.parseInt(process.env.BACKUP_RETENTION || '14', 10) || 14),
  botApiToken: String(process.env.BOT_API_TOKEN || '').trim(),
  kdocsSyncToken: String(process.env.KDOCS_SYNC_TOKEN || '').trim(),
  kdocsWebhookUrl: String(process.env.KDOCS_WEBHOOK_URL || '').trim(),
  kdocsApiToken: String(process.env.KDOCS_API_TOKEN || '').trim(),
  kdocsEventTitle: String(process.env.KDOCS_EVENT_TITLE || '双10').trim(),
  kdocsWebsiteToSheetEnabled: String(process.env.KDOCS_WEBSITE_TO_SHEET_ENABLED || '')
    .trim()
    .toLowerCase() === 'true'
};
