// routes/admin_submissions.js
// Add these routes into your existing admin.js router, or mount separately.
// Mount in server.js as: app.use('/admin/submissions', require('./routes/admin_submissions'))

const express = require('express');
const router  = express.Router();
const path    = require('path');

// Reuse your existing admin auth middleware
const { requireAuth, requireRole } = require('../middleware/auth');

function getDb(req) { return req.app.locals.db; }

// ── GET /admin/submissions ───────────────────────────────────────────────────
// List all submissions with filters
router.get('/', requireAuth, requireRole('admin', 'managing_editor'), (req, res) => {
  const db     = getDb(req);
  const status = req.query.status || 'pending';
  const valid  = ['pending', 'under_review', 'accepted', 'rejected', 'all'];
  const filter = valid.includes(status) ? status : 'pending';

  const query = filter === 'all'
    ? `SELECT s.*, sub.full_name, sub.email, sub.bio_line
       FROM submissions s
       JOIN submitters sub ON s.submitter_id = sub.id
       ORDER BY s.submitted_at DESC`
    : `SELECT s.*, sub.full_name, sub.email, sub.bio_line
       FROM submissions s
       JOIN submitters sub ON s.submitter_id = sub.id
       WHERE s.status = ?
       ORDER BY s.submitted_at DESC`;

  const submissions = filter === 'all'
    ? db.prepare(query).all()
    : db.prepare(query).all(filter);

  const counts = db.prepare(`
    SELECT status, COUNT(*) as count FROM submissions GROUP BY status
  `).all().reduce((acc, row) => { acc[row.status] = row.count; return acc; }, {});
  counts.all = (counts.pending || 0) + (counts.under_review || 0) + (counts.accepted || 0) + (counts.rejected || 0);

  res.render('admin/submissions/index', {
    title:       'Submissions — Alexandria Admin',
    submissions,
    filter,
    counts,
    user:        req.session.user,
    success:     req.query.success || null,
    error:       null
  });
});

// ── GET /admin/submissions/:id ───────────────────────────────────────────────
router.get('/:id', requireAuth, requireRole('admin', 'managing_editor'), (req, res) => {
  const db = getDb(req);
  const submission = db.prepare(`
    SELECT s.*, sub.full_name, sub.email, sub.bio_line, sub.subject_area as submitter_subject
    FROM submissions s
    JOIN submitters sub ON s.submitter_id = sub.id
    WHERE s.id = ?
  `).get(req.params.id);

  if (!submission) return res.status(404).render('admin/404', { title: '404', user: req.session.user });

  // Mark as under_review if it was pending
  if (submission.status === 'pending') {
    db.prepare(`
      UPDATE submissions SET status = 'under_review', updated_at = datetime('now')
      WHERE id = ?
    `).run(submission.id);
    submission.status = 'under_review';
  }

  res.render('admin/submissions/detail', {
    title:      `Submission: ${submission.article_title} — Admin`,
    submission,
    user:       req.session.user,
    success:    req.query.success || null,
    error:      null
  });
});

// ── POST /admin/submissions/:id/status ───────────────────────────────────────
// Update submission status + optional admin notes
router.post('/:id/status', requireAuth, requireRole('admin', 'managing_editor'), (req, res) => {
  const db     = getDb(req);
  const { status, admin_notes } = req.body;
  const valid  = ['pending', 'under_review', 'accepted', 'rejected'];

  if (!valid.includes(status)) {
    return res.redirect(`/admin/submissions/${req.params.id}?error=invalid_status`);
  }

  db.prepare(`
    UPDATE submissions
    SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(status, admin_notes || null, req.session.user.id, req.params.id);

  res.redirect(`/admin/submissions/${req.params.id}?success=1`);
});

// ── GET /admin/submissions/:id/download ──────────────────────────────────────
router.get('/:id/download', requireAuth, requireRole('admin', 'managing_editor'), (req, res) => {
  const db         = getDb(req);
  const submission = db.prepare('SELECT file_path, file_name FROM submissions WHERE id = ?').get(req.params.id);
  if (!submission) return res.status(404).send('Not found');

  res.download(submission.file_path, submission.file_name);
});

module.exports = router;
