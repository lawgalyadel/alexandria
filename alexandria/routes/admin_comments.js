// routes/admin_comments.js
// Mount in server.js as: app.use('/admin/comments', require('./routes/admin_comments'))

const express = require('express');
const router  = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');

function getDb(req) { return req.app.locals.db; }

// ── GET /admin/comments ───────────────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const db     = getDb(req);
  const status = req.query.status || 'pending';
  const valid  = ['pending', 'approved', 'rejected'];
  const filter = valid.includes(status) ? status : 'pending';

  const comments = db.prepare(`
    SELECT c.*, a.title as article_title, a.slug as article_slug
    FROM comments c
    JOIN articles a ON c.article_id = a.id
    WHERE c.status = ?
    ORDER BY c.created_at ASC
  `).all(filter);

  const counts = db.prepare(`
    SELECT status, COUNT(*) as count FROM comments GROUP BY status
  `).all().reduce((acc, row) => { acc[row.status] = row.count; return acc; }, {});

  res.render('admin/comments', {
    title:    'Comment Moderation — Alexandria Admin',
    comments,
    filter,
    counts,
    user:     req.session.user,
    success:  req.query.success || null
  });
});

// ── POST /admin/comments/:id/approve ─────────────────────────────────────────
router.post('/:id/approve', requireAuth, (req, res) => {
  const db = getDb(req);
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
  if (!comment) return res.redirect('/admin/comments');

  db.prepare(`
    UPDATE comments SET status = 'approved', updated_at = datetime('now') WHERE id = ?
  `).run(req.params.id);

  // Update trust ledger for this session
  db.prepare(`
    INSERT INTO comment_trust (session_key, approved_count, trusted)
    VALUES (?, 1, 0)
    ON CONFLICT(session_key) DO UPDATE SET
      approved_count = approved_count + 1,
      trusted = CASE WHEN approved_count + 1 >= 3 THEN 1 ELSE 0 END,
      last_seen = datetime('now')
  `).run(comment.session_key);

  res.redirect(`/admin/comments?status=pending&success=1`);
});

// ── POST /admin/comments/:id/reject ──────────────────────────────────────────
router.post('/:id/reject', requireAuth, (req, res) => {
  db.prepare(`
    UPDATE comments SET status = 'rejected', updated_at = datetime('now') WHERE id = ?
  `).run(req.params.id);

  res.redirect(`/admin/comments?status=pending&success=1`);
});

// ── POST /admin/comments/:id/reject ──────────────────────────────────────────
router.post('/:id/reject', requireAuth, (req, res) => {
  const db = getDb(req);
  db.prepare(`
    UPDATE comments SET status = 'rejected', updated_at = datetime('now') WHERE id = ?
  `).run(req.params.id);

  res.redirect(`/admin/comments?status=pending&success=1`);
});

// ── POST /admin/comments/:id/delete ──────────────────────────────────────────
router.post('/:id/delete', requireAuth, requireRole('admin', 'managing_editor'), (req, res) => {
  const db = getDb(req);
  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id);
  res.redirect(`/admin/comments?status=${req.query.from || 'pending'}&success=1`);
});

module.exports = router;
