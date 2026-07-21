const session = require('express-session');

class SQLiteSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
    this.getStatement = db.prepare(
      'SELECT sess, expires_at AS expiresAt FROM sessions WHERE sid = ?'
    );
    this.setStatement = db.prepare(`
      INSERT INTO sessions (sid, sess, expires_at, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(sid) DO UPDATE SET
        sess = excluded.sess,
        expires_at = excluded.expires_at,
        updated_at = CURRENT_TIMESTAMP
    `);
    this.destroyStatement = db.prepare('DELETE FROM sessions WHERE sid = ?');
    this.touchStatement = db.prepare(`
      UPDATE sessions
      SET expires_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE sid = ?
    `);
    this.clearExpiredStatement = db.prepare('DELETE FROM sessions WHERE expires_at <= ?');
    this.cleanupTimer = setInterval(() => this.clearExpired(), 15 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  expiration(sessionData) {
    const expires = sessionData?.cookie?.expires;
    const timestamp = expires ? new Date(expires).getTime() : NaN;
    return Number.isFinite(timestamp) ? timestamp : Date.now() + 24 * 60 * 60 * 1000;
  }

  get(sid, callback) {
    try {
      const row = this.getStatement.get(sid);
      if (!row) return callback(null, null);
      if (row.expiresAt <= Date.now()) {
        this.destroyStatement.run(sid);
        return callback(null, null);
      }
      return callback(null, JSON.parse(row.sess));
    } catch (error) {
      return callback(error);
    }
  }

  set(sid, sessionData, callback = () => {}) {
    try {
      this.setStatement.run(sid, JSON.stringify(sessionData), this.expiration(sessionData));
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  destroy(sid, callback = () => {}) {
    try {
      this.destroyStatement.run(sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(sid, sessionData, callback = () => {}) {
    try {
      this.touchStatement.run(this.expiration(sessionData), sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  clearExpired() {
    try {
      this.clearExpiredStatement.run(Date.now());
    } catch (error) {
      console.error('Failed to clear expired sessions:', error.message);
    }
  }

  close() {
    clearInterval(this.cleanupTimer);
  }
}

module.exports = SQLiteSessionStore;
