// routes/submissions.js
// External Submissions Portal — public-facing routes for submitters
// Mount in server.js as: app.use('/submit', require('./routes/submissions'))

const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');

// ── Multer config ────────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '../public/uploads/submissions');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => {
    const ts   = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${ts}_${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx'];
    const ext     = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error('Only PDF, DOC, and DOCX files are accepted.'));
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function requireSubmitterAuth(req, res, next) {
  if (req.session && req.session.submitter) return next();
  req.session.returnTo = req.originalUrl;
  res.redirect('/submit/login');
}

function getDb(req) {
  return req.app.locals.db;
}

// ── GET /submit ──────────────────────────────────────────────────────────────
// Landing page: brief explainer + links to register / login
router.get('/', (req, res) => {
  res.render('submissions/index', {
    title:     'Submit an Article — Alexandria',
    submitter: req.session.submitter || null,
    error:     null,
    success:   null
  });
});

// ── GET /submit/register ─────────────────────────────────────────────────────
router.get('/register', (req, res) => {
  if (req.session.submitter) return res.redirect('/submit/dashboard');
  res.render('submissions/register', {
    title:   'Create a Submitter Account — Alexandria',
    error:   null,
    formData: {}
  });
});

// ── POST /submit/register ────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, confirm_password, full_name, bio_line, subject_area, article_type } = req.body;
  const db = getDb(req);

  // --- Validation ---
  const errors = [];
  if (!email        || !email.includes('@'))      errors.push('A valid email address is required.');
  if (!password     || password.length < 8)       errors.push('Password must be at least 8 characters.');
  if (password      !== confirm_password)          errors.push('Passwords do not match.');
  if (!full_name    || full_name.trim().length < 2) errors.push('Full name is required.');
  if (!bio_line     || bio_line.trim().length < 10) errors.push('Please provide a short bio (at least 10 characters).');
  if (!subject_area)                               errors.push('Subject area is required.');
  if (!['academic', 'current_affairs'].includes(article_type)) errors.push('Please select an article type.');

  if (errors.length) {
    return res.render('submissions/register', {
      title: 'Create a Submitter Account — Alexandria',
      error: errors.join(' '),
      formData: req.body
    });
  }

  // --- Duplicate check ---
  const existing = db.prepare('SELECT id FROM submitters WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) {
    return res.render('submissions/register', {
      title: 'Create a Submitter Account — Alexandria',
      error: 'An account with that email already exists. Please log in.',
      formData: req.body
    });
  }

  // --- Create account ---
  const hash = await bcrypt.hash(password, 12);
  const result = db.prepare(`
    INSERT INTO submitters (email, password_hash, full_name, bio_line, subject_area, article_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    email.toLowerCase().trim(),
    hash,
    full_name.trim(),
    bio_line.trim(),
    subject_area.trim(),
    article_type
  );

  req.session.submitter = {
    id:           result.lastInsertRowid,
    email:        email.toLowerCase().trim(),
    full_name:    full_name.trim(),
    subject_area: subject_area.trim(),
    article_type
  };

  res.redirect('/submit/dashboard?welcome=1');
});

// ── GET /submit/login ────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  if (req.session.submitter) return res.redirect('/submit/dashboard');
  res.render('submissions/login', {
    title: 'Submitter Login — Alexandria',
    error: null,
    email: ''
  });
});

// ── POST /submit/login ───────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const db = getDb(req);

  const submitter = db.prepare('SELECT * FROM submitters WHERE email = ?').get(email.toLowerCase().trim());
  if (!submitter) {
    return res.render('submissions/login', {
      title: 'Submitter Login — Alexandria',
      error: 'No account found with that email address.',
      email
    });
  }

  const match = await bcrypt.compare(password, submitter.password_hash);
  if (!match) {
    return res.render('submissions/login', {
      title: 'Submitter Login — Alexandria',
      error: 'Incorrect password.',
      email
    });
  }

  // Update last login
  db.prepare('UPDATE submitters SET last_login = datetime("now") WHERE id = ?').run(submitter.id);

  req.session.submitter = {
    id:           submitter.id,
    email:        submitter.email,
    full_name:    submitter.full_name,
    subject_area: submitter.subject_area,
    article_type: submitter.article_type
  };

  const returnTo = req.session.returnTo || '/submit/dashboard';
  delete req.session.returnTo;
  res.redirect(returnTo);
});

// ── GET /submit/dashboard ────────────────────────────────────────────────────
router.get('/dashboard', requireSubmitterAuth, (req, res) => {
  const db = getDb(req);
  const submissions = db.prepare(`
    SELECT * FROM submissions
    WHERE submitter_id = ?
    ORDER BY submitted_at DESC
  `).all(req.session.submitter.id);

  res.render('submissions/dashboard', {
    title:       'My Submissions — Alexandria',
    submitter:   req.session.submitter,
    submissions,
    welcome:     req.query.welcome === '1',
    error:       null,
    success:     null
  });
});

// ── GET /submit/new ──────────────────────────────────────────────────────────
router.get('/new', requireSubmitterAuth, (req, res) => {
  res.render('submissions/new', {
    title:     'New Submission — Alexandria',
    submitter: req.session.submitter,
    error:     null,
    formData:  {}
  });
});

// ── POST /submit/new ─────────────────────────────────────────────────────────
router.post('/new', requireSubmitterAuth, (req, res, next) => {
  upload.single('article_file')(req, res, (err) => {
    if (err) {
      return res.render('submissions/new', {
        title:     'New Submission — Alexandria',
        submitter: req.session.submitter,
        error:     err.message,
        formData:  req.body || {}
      });
    }
    next();
  });
}, async (req, res) => {
  const { article_title, summary, subject_area, article_type } = req.body;
  const db = getDb(req);

  // --- Validation ---
  const errors = [];
  if (!article_title || article_title.trim().length < 3) errors.push('Article title is required.');
  if (!summary       || summary.trim().length < 20)      errors.push('Please provide a summary (at least 20 characters).');
  if (!subject_area)                                      errors.push('Subject area is required.');
  if (!['academic', 'current_affairs'].includes(article_type)) errors.push('Please select an article type.');
  if (!req.file)                                          errors.push('Please attach your article file (PDF, DOC, or DOCX).');

  if (errors.length) {
    // Clean up uploaded file if validation fails
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.render('submissions/new', {
      title:     'New Submission — Alexandria',
      submitter: req.session.submitter,
      error:     errors.join(' '),
      formData:  req.body
    });
  }

  // --- Save submission ---
  db.prepare(`
    INSERT INTO submissions
      (submitter_id, article_title, summary, subject_area, article_type, file_path, file_name, file_size)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.session.submitter.id,
    article_title.trim(),
    summary.trim(),
    subject_area.trim(),
    article_type,
    req.file.path,
    req.file.originalname,
    req.file.size
  );

  res.redirect('/submit/dashboard?submitted=1');
});

// ── GET /submit/logout ───────────────────────────────────────────────────────
router.get('/logout', (req, res) => {
  delete req.session.submitter;
  res.redirect('/submit');
});

module.exports = router;
