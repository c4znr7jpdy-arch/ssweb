const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const path = require('path');
const config = require('./config');
const db = require('./db');
const SQLiteSessionStore = require('./session-store');

const app = express();
const PORT = process.env.PORT || process.argv.find((a, i, arr) => arr[i - 1] === '--port') || 3000;
const sessionStore = new SQLiteSessionStore(db);
const STATIC_MAX_AGE = 7 * 24 * 60 * 60;

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  const contentSecurityPolicy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' blob: https://unpkg.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'"
  ];
  if (config.isProduction) {
    contentSecurityPolicy.push('upgrade-insecure-requests');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader('Content-Security-Policy', contentSecurityPolicy.join('; '));
  next();
});

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));

app.use((req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  if (req.originalUrl.startsWith('/api/kdocs/')) return next();
  const origin = req.get('origin');
  if (!origin) return next();

  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    res.status(403).json({ message: '请求来源无效' });
    return;
  }

  if (originHost !== req.get('host')) {
    res.status(403).json({ message: '请求来源无效' });
    return;
  }
  next();
});

app.use(session({
  name: 'yanyun.sid',
  secret: config.sessionSecret,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  genid: () => crypto.randomBytes(24).toString('base64url'),
  cookie: {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(express.static(path.join(__dirname, '..', 'public'), {
  etag: true,
  maxAge: config.isProduction ? '7d' : 0,
  setHeaders(res, filePath) {
    if (path.extname(filePath).toLowerCase() === '.html') {
      res.setHeader('Cache-Control', 'no-cache');
      return;
    }
    if (config.isProduction) {
      res.setHeader('Cache-Control', `public, max-age=${STATIC_MAX_AGE}`);
    }
  }
}));

const membersRouter = require('./routes/members');
const adminMembersRouter = require('./routes/admin-members');
const contributionsRouter = require('./routes/contributions');
const eventsRouter = require('./routes/events');
const authRouter = require('./routes/auth');
const authAlbumRouter = require('./routes/auth-album');
const botRouter = require('./routes/bot');
const kdocsRouter = require('./routes/kdocs');

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use('/', authAlbumRouter);
app.use('/api/members', membersRouter);
app.use('/api/admin/members', adminMembersRouter);
app.use('/api/admin/auth', authRouter);
app.use('/api/admin/events', eventsRouter);
app.use('/api/admin/contributions', contributionsRouter);
app.use('/api/contributions', contributionsRouter);
app.use('/api/rank', contributionsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/bot', botRouter);
app.use('/api/kdocs', kdocsRouter);

app.get('/api/health', (req, res) => {
  try {
    db.prepare('SELECT 1 AS ok').get();
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

app.get('/{*splat}', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

function startServer(port = PORT) {
  return app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

if (require.main === module) {
  const server = startServer();
  const shutdown = signal => {
    console.log(`${signal} received, shutting down.`);
    server.close(() => {
      sessionStore.close();
      db.close();
      process.exit(0);
    });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = { app, startServer };
