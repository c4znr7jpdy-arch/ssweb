const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'guild-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
const membersRouter = require('./routes/members');
const adminMembersRouter = require('./routes/admin-members');
const contributionsRouter = require('./routes/contributions');
const eventsRouter = require('./routes/events');
const authRouter = require('./routes/auth');

app.use('/api/members', membersRouter);
app.use('/api/admin/members', adminMembersRouter);
app.use('/api/admin/auth', authRouter);
app.use('/api/admin/events', eventsRouter);
app.use('/api/admin/contributions', contributionsRouter);
app.use('/api/contributions', contributionsRouter);
app.use('/api/rank', contributionsRouter);
app.use('/api/events', eventsRouter);

// SPA fallback (Express 5 requires named params for catch-all)
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
