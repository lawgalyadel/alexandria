const express = require('express');
const router = express.Router();
const { marked } = require('marked');

// ═══════════════════════════════════════
// HOMEPAGE
// ═══════════════════════════════════════
router.get('/', (req, res) => {
    const db = req.app.locals.db;
    const featured = db.prepare(`
        SELECT a.*, GROUP_CONCAT(DISTINCT s.name) as subject_names,
               GROUP_CONCAT(DISTINCT s.slug) as subject_slugs
        FROM articles a
        LEFT JOIN article_subjects asub ON a.id = asub.article_id
        LEFT JOIN subjects s ON asub.subject_id = s.id
        WHERE a.status = 'published' AND a.is_global_featured = 1
        GROUP BY a.id
        ORDER BY a.publish_date DESC LIMIT 1
    `).get();
    
    if (featured) {
        featured.authors = db.prepare(`
            SELECT au.* FROM authors au
            JOIN article_authors aa ON au.id = aa.author_id
            WHERE aa.article_id = ? ORDER BY aa.sort_order
        `).all(featured.id);
    }
    // Latest articles (unified feed)
    const latest = db.prepare(`
        SELECT a.*, GROUP_CONCAT(DISTINCT s.name) as subject_names,
               GROUP_CONCAT(DISTINCT s.slug) as subject_slugs
        FROM articles a
        LEFT JOIN article_subjects asub ON a.id = asub.article_id
        LEFT JOIN subjects s ON asub.subject_id = s.id
        WHERE a.status = 'published'
        GROUP BY a.id
        ORDER BY a.publish_date DESC LIMIT 10
    `).all();

    // Get authors for each article
    for (const article of latest) {
        article.authors = db.prepare(`
            SELECT au.* FROM authors au
            JOIN article_authors aa ON au.id = aa.author_id
            WHERE aa.article_id = ? ORDER BY aa.sort_order
        `).all(article.id);
    }

    // Subject article counts
    const subjectCounts = db.prepare(`
        SELECT s.id, COUNT(asub.article_id) as count
        FROM subjects s
        LEFT JOIN article_subjects asub ON s.id = asub.subject_id
        LEFT JOIN articles a ON asub.article_id = a.id AND a.status = 'published'
        GROUP BY s.id
    `).all();

    const countMap = {};
    subjectCounts.forEach(sc => countMap[sc.id] = sc.count);

    res.render('public/home', {
        title: 'Alexandria — A Journal of Ideas',
        featured,
        latest,
        subjectCounts: countMap
    });
});

// ═══════════════════════════════════════
// SUBJECT PAGE
// ═══════════════════════════════════════
router.get('/subject/:slug', (req, res) => {
    const db = req.app.locals.db;
    const subject = db.prepare('SELECT * FROM subjects WHERE slug = ?').get(req.params.slug);

    if (!subject) return res.status(404).render('public/404', { title: 'Subject Not Found' });

    const sort = req.query.sort || 'newest';
    const type = req.query.type || 'all';
    const page = parseInt(req.query.page) || 1;
    const perPage = 12;
    const offset = (page - 1) * perPage;

    let orderBy = 'a.publish_date DESC';
    if (sort === 'oldest') orderBy = 'a.publish_date ASC';
    if (sort === 'popular') orderBy = 'a.view_count DESC';

    let typeFilter = '';
    if (type === 'long_form') typeFilter = "AND a.content_type = 'long_form'";
    if (type === 'short_form') typeFilter = "AND a.content_type = 'short_form'";

    // Featured for this subject
    const featured = db.prepare(`
        SELECT a.* FROM articles a
        JOIN article_subjects asub ON a.id = asub.article_id
        WHERE asub.subject_id = ? AND a.status = 'published' AND a.is_subject_featured = 1
        ORDER BY a.publish_date DESC LIMIT 1
    `).get(subject.id);

    if (featured) {
        featured.authors = db.prepare(`
            SELECT au.* FROM authors au JOIN article_authors aa ON au.id = aa.author_id
            WHERE aa.article_id = ? ORDER BY aa.sort_order
        `).all(featured.id);
    }

    // All articles for subject
    const articles = db.prepare(`
        SELECT a.* FROM articles a
        JOIN article_subjects asub ON a.id = asub.article_id
        WHERE asub.subject_id = ? AND a.status = 'published' ${typeFilter}
        ORDER BY ${orderBy} LIMIT ? OFFSET ?
    `).all(subject.id, perPage, offset);

    for (const article of articles) {
        article.authors = db.prepare(`
            SELECT au.* FROM authors au JOIN article_authors aa ON au.id = aa.author_id
            WHERE aa.article_id = ? ORDER BY aa.sort_order
        `).all(article.id);
        article.subjects = db.prepare(`
            SELECT s.* FROM subjects s JOIN article_subjects asub ON s.id = asub.subject_id
            WHERE asub.article_id = ?
        `).all(article.id);
    }

    const totalCount = db.prepare(`
        SELECT COUNT(DISTINCT a.id) as count FROM articles a
        JOIN article_subjects asub ON a.id = asub.article_id
        WHERE asub.subject_id = ? AND a.status = 'published' ${typeFilter}
    `).get(subject.id).count;

    const totalPages = Math.ceil(totalCount / perPage);

    res.render('public/subject', {
        title: `${subject.name} — Alexandria`,
        subject,
        featured,
        articles,
        sort, type, page, totalPages, totalCount
    });
});

// ═══════════════════════════════════════
// ARTICLE PAGE
// ═══════════════════════════════════════
router.get('/article/:slug', (req, res) => {
    const db = req.app.locals.db;

    const article = db.prepare(`
        SELECT a.* FROM articles a WHERE a.slug = ? AND a.status IN ('published', 'retracted')
    `).get(req.params.slug);

    if (!article) return res.status(404).render('public/404', { title: 'Article Not Found' });

    // Increment view count
    db.prepare('UPDATE articles SET view_count = view_count + 1 WHERE id = ?').run(article.id);

    // Get authors
    article.authors = db.prepare(`
        SELECT au.*, aa.is_primary FROM authors au
        JOIN article_authors aa ON au.id = aa.author_id
        WHERE aa.article_id = ? ORDER BY aa.sort_order
    `).all(article.id);

    // Get subjects
    article.subjects = db.prepare(`
        SELECT s.* FROM subjects s
        JOIN article_subjects asub ON s.id = asub.subject_id
        WHERE asub.article_id = ?
    `).all(article.id);

    // Get tags
    article.tags = db.prepare(`
        SELECT t.* FROM tags t
        JOIN article_tags at2 ON t.id = at2.tag_id
        WHERE at2.article_id = ?
    `).all(article.id);

    // Render markdown body to HTML
    article.bodyHtml = marked(article.body || '', { breaks: true });

    // Related articles (same subject/tags)
    const subjectIds = article.subjects.map(s => s.id);
    let related = [];
    if (subjectIds.length > 0) {
        const placeholders = subjectIds.map(() => '?').join(',');
        related = db.prepare(`
            SELECT DISTINCT a.*, GROUP_CONCAT(DISTINCT s.name) as subject_names
            FROM articles a
            JOIN article_subjects asub ON a.id = asub.article_id
            JOIN subjects s ON asub.subject_id = s.id
            WHERE asub.subject_id IN (${placeholders})
              AND a.id != ? AND a.status = 'published'
            GROUP BY a.id
            ORDER BY a.publish_date DESC LIMIT 3
        `).all(...subjectIds, article.id);

        for (const r of related) {
            r.authors = db.prepare(`
                SELECT au.* FROM authors au JOIN article_authors aa ON au.id = aa.author_id
                WHERE aa.article_id = ? ORDER BY aa.sort_order
            `).all(r.id);
        }
    }

    // Load approved comments
    const comments = db.prepare(`SELECT * FROM comments WHERE article_id = ? AND status = 'approved' ORDER BY created_at ASC`).all(article.id);

    res.render('public/article', {
        title: `${article.title} — Alexandria`,
        article,
        related,
        comments
    });
});

// ═══════════════════════════════════════
// AUTHOR PAGE
// ═══════════════════════════════════════
router.get('/author/:slug', (req, res) => {
    const db = req.app.locals.db;
    const author = db.prepare('SELECT * FROM authors WHERE slug = ?').get(req.params.slug);

    if (!author) return res.status(404).render('public/404', { title: 'Author Not Found' });

    const articles = db.prepare(`
        SELECT a.*, GROUP_CONCAT(DISTINCT s.name) as subject_names
        FROM articles a
        JOIN article_authors aa ON a.id = aa.article_id
        JOIN article_subjects asub ON a.id = asub.article_id
        JOIN subjects s ON asub.subject_id = s.id
        WHERE aa.author_id = ? AND a.status = 'published'
        GROUP BY a.id
        ORDER BY a.publish_date DESC
    `).all(author.id);

    res.render('public/author', {
        title: `${author.name} — Alexandria`,
        author,
        articles
    });
});

// ═══════════════════════════════════════
// ABOUT & CONTACT
// ═══════════════════════════════════════
router.get('/about', (req, res) => {
    const db = req.app.locals.db;
    const editors = db.prepare(`
        SELECT id, name, slug, bio, headshot_url
        FROM authors
        ORDER BY name COLLATE NOCASE ASC
    `).all();

    res.render('public/about', {
        title: 'About — Alexandria',
        editors
    });
});

router.get('/contact', (req, res) => {
    res.render('public/contact', { title: 'Contact — Alexandria' });
});

// ═══════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════
router.get('/search', (req, res) => {
    const db = req.app.locals.db;
    const q = req.query.q || '';

    let results = [];
    if (q.trim()) {
        const searchTerm = `%${q.trim()}%`;
        results = db.prepare(`
            SELECT a.*, GROUP_CONCAT(DISTINCT s.name) as subject_names
            FROM articles a
            LEFT JOIN article_subjects asub ON a.id = asub.article_id
            LEFT JOIN subjects s ON asub.subject_id = s.id
            WHERE a.status = 'published'
              AND (a.title LIKE ? OR a.body LIKE ? OR a.subtitle LIKE ?)
            GROUP BY a.id
            ORDER BY a.publish_date DESC LIMIT 50
        `).all(searchTerm, searchTerm, searchTerm);

        for (const article of results) {
            article.authors = db.prepare(`
                SELECT au.* FROM authors au JOIN article_authors aa ON au.id = aa.author_id
                WHERE aa.article_id = ? ORDER BY aa.sort_order
            `).all(article.id);
        }
    }

    res.render('public/search', {
        title: q ? `Search: ${q} — Alexandria` : 'Search — Alexandria',
        query: q,
        results
    });
});

module.exports = router;
