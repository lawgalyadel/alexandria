const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// ═══════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════

// Search articles (AJAX)
router.get('/search', (req, res) => {
    const db = req.app.locals.db;
    const q = req.query.q || '';
    if (!q.trim()) return res.json([]);

    const searchTerm = `%${q.trim()}%`;
    const results = db.prepare(`
        SELECT a.id, a.title, a.subtitle, a.slug, a.publish_date,
               GROUP_CONCAT(DISTINCT s.name) as subject_names
        FROM articles a
        LEFT JOIN article_subjects asub ON a.id = asub.article_id
        LEFT JOIN subjects s ON asub.subject_id = s.id
        WHERE a.status = 'published'
          AND (a.title LIKE ? OR a.subtitle LIKE ?)
        GROUP BY a.id
        ORDER BY a.publish_date DESC LIMIT 10
    `).all(searchTerm, searchTerm);

    res.json(results);
});

// Increment view count
router.post('/articles/:id/view', (req, res) => {
    const db = req.app.locals.db;
    db.prepare('UPDATE articles SET view_count = view_count + 1 WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

// ═══════════════════════════════════════
// ADMIN API (requires auth)
// ═══════════════════════════════════════

// Analytics overview
router.get('/admin/analytics', requireAuth, (req, res) => {
    const db = req.app.locals.db;

    const topArticles = db.prepare(`
        SELECT a.id, a.title, a.slug, a.view_count, a.publish_date
        FROM articles a WHERE a.status = 'published'
        ORDER BY a.view_count DESC LIMIT 20
    `).all();

    const subjectStats = db.prepare(`
        SELECT s.name, COUNT(asub.article_id) as article_count,
               COALESCE(SUM(a.view_count), 0) as total_views
        FROM subjects s
        LEFT JOIN article_subjects asub ON s.id = asub.subject_id
        LEFT JOIN articles a ON asub.article_id = a.id AND a.status = 'published'
        GROUP BY s.id ORDER BY s.sort_order
    `).all();

    res.json({ topArticles, subjectStats });
});

// Generate slug
router.get('/admin/slugify', requireAuth, (req, res) => {
    const slugify = require('slugify');
    const slug = slugify(req.query.title || '', { lower: true, strict: true });
    res.json({ slug });
});

// Tags management
router.post('/admin/tags', requireAuth, (req, res) => {
    const db = req.app.locals.db;
    const slugify = require('slugify');
    const { name } = req.body;
    const slug = slugify(name, { lower: true, strict: true });

    try {
        const result = db.prepare('INSERT INTO tags (name, slug) VALUES (?, ?)').run(name, slug);
        res.json({ id: result.lastInsertRowid, name, slug });
    } catch (err) {
        res.status(400).json({ error: 'Tag already exists' });
    }
});

module.exports = router;
