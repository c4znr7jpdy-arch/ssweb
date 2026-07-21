const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shengshi-http-'));
process.env.NODE_ENV = 'production';
process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';
process.env.REGISTRATION_INVITE_CODE = 'test-invite-code';
process.env.DATABASE_PATH = path.join(tempDir, 'guild.db');
process.env.ALBUM_UPLOAD_DIR = path.join(tempDir, 'uploads');
process.env.BOT_API_TOKEN = 'test-bot-token';

const db = require('../server/db');
const { app } = require('../server/index');

function listen() {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
    server.once('error', reject);
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });
}

test('production responses use safe cache and security policies', async () => {
  const server = await listen();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const home = await fetch(`${baseUrl}/`);
    assert.equal(home.status, 200);
    assert.equal(home.headers.get('cache-control'), 'no-cache');
    assert.match(home.headers.get('content-security-policy'), /object-src 'none'/);
    assert.equal(
      home.headers.get('strict-transport-security'),
      'max-age=31536000; includeSubDomains'
    );
    assert.equal(home.headers.get('cross-origin-resource-policy'), 'same-origin');

    const stylesheet = await fetch(`${baseUrl}/css/site-nav.css`);
    assert.equal(stylesheet.status, 200);
    assert.equal(stylesheet.headers.get('cache-control'), 'public, max-age=604800');

    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.equal(health.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await health.json(), { ok: true });
  } finally {
    await close(server);
  }
});

test('public event signup is rate limited', async () => {
  const server = await listen();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const eventId = db.prepare(`
    INSERT INTO events (title, type, event_date, start_time, description)
    VALUES (?, ?, ?, ?, ?)
  `).run('Rate limit event', 'PVP', '2099-12-31', '20:00', 'Test event').lastInsertRowid;

  try {
    for (let attempt = 1; attempt <= 12; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/events/raid-signup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ eventId, name: 'Repeated guest' })
      });
      assert.ok([200, 201].includes(response.status));
    }

    const blocked = await fetch(`${baseUrl}/api/events/raid-signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ eventId, name: 'Repeated guest' })
    });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get('ratelimit-remaining'), '0');
  } finally {
    await close(server);
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
