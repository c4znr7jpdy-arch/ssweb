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

// API routes (to be added in later tasks)
// app.use('/api/members', require('./routes/members'));
// app.use('/api/events', require('./routes/events'));
// app.use('/api/contributions', require('./routes/contributions'));
// app.use('/api/admin', require('./routes/auth'));

// SPA fallback (Express 5 requires named params for catch-all)
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
