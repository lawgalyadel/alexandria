// routes/comments.js
// Mount in server.js as: app.use('/comments', require('./routes/comments'))
//
// Requires ANTHROPIC_API_KEY in your environment (or set it in server.js before this runs)

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDb(req) { return req.app.locals.db; }

// Stable anonymous session key — hashed so we never store the raw session id
function getSessionKey(req) {
  const raw = req.session.id + (req.ip || '');
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

// Check if this session is trusted (>= 3 approved comments)
function isTrusted(db, sessionKey) {
  const row = db.prepare('SELECT trusted FROM comment_trust WHERE session_key = ?').get(sessionKey);
  return row && row.trusted === 1;
}

// Update trust ledger after a comment is approved
function recordApproval(db, sessionKey) {
  db.prepare(`
    INSERT INTO comment_trust (session_key, approved_count, trusted)
    VALUES (?, 1, 0)
    ON CONFLICT(session_key) DO UPDATE SET
      approved_count = approved_count + 1,
      trusted = CASE WHEN approved_count + 1 >= 3 THEN 1 ELSE 0 END,
      last_seen = datetime('now')
  `).run(sessionKey);
}

// Update last_seen for session
function touchSession(db, sessionKey) {
  db.prepare(`
    INSERT INTO comment_trust (session_key, approved_count, trusted)
    VALUES (?, 0, 0)
    ON CONFLICT(session_key) DO UPDATE SET last_seen = datetime('now')
  `).run(sessionKey);
}



// ── POST /comments/:articleId ─────────────────────────────────────────────────
// Submit a new comment on an article
router.post('/:articleId', async (req, res) => {
  const db         = getDb(req);
  const articleId  = parseInt(req.params.articleId, 10);
  const sessionKey = getSessionKey(req);
  const { body, display_name } = req.body;

  // Basic validation
  if (!body || body.trim().length < 3) {
    return res.json({ ok: false, error: 'Comment is too short.' });
  }
  if (!display_name || display_name.trim().length < 2) {
    return res.json({ ok: false, error: 'Please enter a name.' });
  }
  if (body.trim().length > 2000) {
    return res.json({ ok: false, error: 'Comment is too long (max 2000 characters).' });
  }

  // Check article exists
  const article = db.prepare('SELECT id FROM articles WHERE id = ? AND status = ?').get(articleId, 'published');
  if (!article) return res.json({ ok: false, error: 'Article not found.' });

  touchSession(db, sessionKey);

  const trusted    = isTrusted(db, sessionKey);
  const submitter  = req.session.submitter || null;

  let status   = 'pending';
  let aiScore  = null;
  let modReason = null;

if (trusted) {
    // Trusted users publish instantly
    status = 'approved';
  } else {
    // Hold for manual admin review
    status = 'pending';
  }
  // Insert comment
  const result = db.prepare(`
    INSERT INTO comments
      (article_id, submitter_id, display_name, session_key, body, status, ai_score, mod_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    articleId,
    submitter ? submitter.id : null,
    display_name.trim(),
    sessionKey,
    body.trim(),
    status,
    aiScore,
    modReason
  );

  // If approved, update trust ledger
  if (status === 'approved') {
    recordApproval(db, sessionKey);

    // Return the comment so it can be appended to the page instantly
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(result.lastInsertRowid);
    return res.json({ ok: true, status: 'approved', comment: formatComment(comment) });
  }

  // Rejected — tell the user politely
return res.json({
    ok: true,
    status: 'pending',
    message: 'Your comment is awaiting moderation and will appear once approved.'
  });
});

// ── POST /comments/:commentId/vote ────────────────────────────────────────────
router.post('/:commentId/vote', (req, res) => {
  const db         = getDb(req);
  const commentId  = parseInt(req.params.commentId, 10);
  const sessionKey = getSessionKey(req);

  // Check comment exists and is approved
  const comment = db.prepare('SELECT id, upvotes FROM comments WHERE id = ? AND status = ?').get(commentId, 'approved');
  if (!comment) return res.json({ ok: false, error: 'Comment not found.' });

  // Check if already voted
  const existing = db.prepare('SELECT 1 FROM comment_votes WHERE comment_id = ? AND session_key = ?').get(commentId, sessionKey);
  if (existing) return res.json({ ok: false, error: 'Already voted.' });

  // Record vote
  db.prepare('INSERT INTO comment_votes (comment_id, session_key) VALUES (?, ?)').run(commentId, sessionKey);
  db.prepare('UPDATE comments SET upvotes = upvotes + 1 WHERE id = ?').run(commentId);

  return res.json({ ok: true, upvotes: comment.upvotes + 1 });
});

// ── Helper: format comment for JSON response ──────────────────────────────────
function formatComment(c) {
  return {
    id:           c.id,
    display_name: c.display_name,
    body:         c.body,
    upvotes:      c.upvotes,
    created_at:   c.created_at
  };
}

module.exports = router;
