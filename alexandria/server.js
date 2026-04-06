// ═══════════════════════════════════════
// Alexandria CMS — Main Server
// ═══════════════════════════════════════
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Database ───
const DB_PATH = path.join(__dirname, 'db', 'alexandria.db');
if (!fs.existsSync(DB_PATH)) {
    console.error('Database not found. Run: npm run seed');
    process.exit(1);
}
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Make db available to routes
app.locals.db = db;

// ─── View Engine ───
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Static Files ───
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// ─── Body Parsing ───
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

// ─── Sessions ───
app.use(session({
    store: new SQLiteStore({ dir: path.join(__dirname, 'db') }),
    secret: process.env.SESSION_SECRET || 'alexandria-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
}));

// ─── Global Template Variables ───
app.use((req, res, next) => {
    res.locals.user = req.session ? req.session.user : null;
    res.locals.subjects = db.prepare('SELECT * FROM subjects ORDER BY sort_order').all();
    res.locals.currentPath = req.path;
    next();
});

// ─── Routes ───
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');
const submissionsRoute = require('./routes/submissions');

app.use('/', publicRoutes);
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);
app.use('/submit', submissionsRoute);

// ─── 404 ───
app.use((req, res) => {
    res.status(404).render('public/404', { title: 'Page Not Found' });
});

// ─── Error Handler ───
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('public/404', { title: 'Server Error' });
});

// ─── Start ───
app.listen(PORT, () => {
    console.log(`\n  Alexandria CMS running at http://localhost:${PORT}`);
    console.log(`  Admin panel: http://localhost:${PORT}/admin`);
    console.log(`  Press Ctrl+C to stop.\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close();
    process.exit(0);
});
