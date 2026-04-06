const express = require('express');
const router = express.Router();

// POST /comments — submit a comment
router.post('/', (req, res) => {
    const db = req.app.locals.db;
    const { article_id, name, email, body } = req.body;

    if (!article_id || !name || !email || !body || body.trim().length < 3) {
        return res.redirect('back');
    }

    // Look up or create commenter record
    let commenter = db.prepare('SELECT * FROM commenters WHERE email = ?').get(email.toLowerCase().trim());

    if (!commenter) {
        const result = db.prepare(
            'INSERT INTO commenters (email, name) VALUES (?, ?)'
        ).run(email.toLowerCase().trim(), name.trim());
        commenter = db.prepare('SELECT * FROM commenters WHERE id = ?').get(result.lastInsertRowid);
    } else {
        // Update name in case they changed it
        db.prepare('UPDATE commenters SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(name.trim(), commenter.id);
    }

    // Trusted + not flagged = auto-approve
    const autoApprove = commenter.is_trusted === 1 && commenter.is_flagged === 0;
    const status = autoApprove ? 'approved' : 'pending';

    db.prepare(`
        INSERT INTO comments (article_id, commenter_id, name, email, body, status)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(article_id, commenter.id, name.trim(), email.toLowerCase().trim(), body.trim(), status);

    // Get the article slug to redirect back
    const article = db.prepare('SELECT slug FROM articles WHERE id = ?').get(article_id);
    const anchor = autoApprove ? '#comments' : '#comment-pending';
    res.redirect(`/article/${article ? article.slug : ''}${anchor}`);
});

module.exports = router;
