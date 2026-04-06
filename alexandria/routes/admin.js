const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const slugify = require('slugify');
const { requireAuth, requireRole, canPublish, canPublishSubject, isAdmin } = require('../middleware/auth');

// ─── File Upload Config ───
const storage = multer.diskStorage({
    destination: path.join(__dirname, '..', 'public', 'uploads'),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, unique + path.extname(file.originalname));
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp|svg/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        cb(null, ext && mime);
    }
});

// ═══════════════════════════════════════
// LOGIN / LOGOUT
// ═══════════════════════════════════════
router.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/admin');
    res.render('admin/login', { title: 'Sign In — Alexandria Admin', error: null });
});

router.post('/login', (req, res) => {
    const db = req.app.locals.db;
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.render('admin/login', { title: 'Sign In — Alexandria Admin', error: 'Invalid email or password.' });
    }

    req.session.user = {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        subject_id: user.subject_id
    };

    res.redirect('/admin');
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

// ═══════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════
router.get('/', requireAuth, (req, res) => {
    const db = req.app.locals.db;

    const totalArticles   = db.prepare("SELECT COUNT(*) as c FROM articles WHERE status = 'published'").get().c;
    const totalDrafts     = db.prepare("SELECT COUNT(*) as c FROM articles WHERE status = 'draft'").get().c;
    const totalAuthors    = db.prepare('SELECT COUNT(*) as c FROM authors').get().c;
    const totalViews      = db.prepare("SELECT COALESCE(SUM(view_count),0) as c FROM articles WHERE status = 'published'").get().c;

    const recentPublished = db.prepare(`
        SELECT COUNT(*) as c FROM articles
        WHERE status = 'published' AND publish_date >= datetime('now', '-7 days')
    `).get().c;

    let totalComments = 0;
    try { totalComments = db.prepare("SELECT COUNT(*) as c FROM comments").get().c; } catch (e) {}

    const topArticles = db.prepare(`
        SELECT a.id, a.title, a.slug, a.view_count,
               GROUP_CONCAT(DISTINCT s.name) as subject_names
        FROM articles a
        LEFT JOIN article_subjects asub ON a.id = asub.article_id
        LEFT JOIN subjects s ON asub.subject_id = s.id
        WHERE a.status = 'published'
        GROUP BY a.id ORDER BY a.view_count DESC LIMIT 5
    `).all();

    const viewsBySubject = db.prepare(`
        SELECT s.id, s.name, s.slug,
               COALESCE(SUM(a.view_count), 0) as total_views,
               COUNT(DISTINCT a.id) as article_count
        FROM subjects s
        LEFT JOIN article_subjects asub ON s.id = asub.subject_id
        LEFT JOIN articles a ON asub.article_id = a.id AND a.status = 'published'
        GROUP BY s.id ORDER BY total_views DESC
    `).all();

    const recentArticles = db.prepare(`
        SELECT a.*, GROUP_CONCAT(DISTINCT s.name) as subject_names
        FROM articles a
        LEFT JOIN article_subjects asub ON a.id = asub.article_id
        LEFT JOIN subjects s ON asub.subject_id = s.id
        GROUP BY a.id ORDER BY a.updated_at DESC LIMIT 10
    `).all();

    res.render('admin/dashboard', {
        title: 'Dashboard \u2013 Alexandria Admin',
        stats: { totalArticles, totalDrafts, totalAuthors, totalViews, recentPublished, totalComments },
        recentArticles,
        topArticles,
        viewsBySubject
    });
});

// ═══════════════════════════════════════
// ARTICLES CRUD
// ═══════════════════════════════════════
router.get('/articles', requireAuth, (req, res) => {
    const db = req.app.locals.db;
    const status = req.query.status || 'all';

    let where = '';
    if (status !== 'all') where = `WHERE a.status = '${status}'`;

    const articles = db.prepare(`
        SELECT a.*, GROUP_CONCAT(DISTINCT s.name) as subject_names,
               GROUP_CONCAT(DISTINCT au.name) as author_names
        FROM articles a
        LEFT JOIN article_subjects asub ON a.id = asub.article_id
        LEFT JOIN subjects s ON asub.subject_id = s.id
        LEFT JOIN article_authors aa ON a.id = aa.article_id
        LEFT JOIN authors au ON aa.author_id = au.id
        ${where}
        GROUP BY a.id ORDER BY a.updated_at DESC
    `).all();

    res.render('admin/articles', { title: 'Articles — Alexandria Admin', articles, status });
});

router.get('/articles/new', requireAuth, (req, res) => {
    const db = req.app.locals.db;
    res.render('admin/article-edit', {
        title: 'New Article — Alexandria Admin',
        article: null,
        allSubjects: db.prepare('SELECT * FROM subjects ORDER BY sort_order').all(),
        allAuthors: db.prepare('SELECT * FROM authors ORDER BY name').all(),
        allTags: db.prepare('SELECT * FROM tags ORDER BY name').all(),
        allIssues: db.prepare('SELECT * FROM issues ORDER BY publication_date DESC').all(),
        error: null
    });
});

router.post('/articles/save', requireAuth, upload.single('cover_image'), (req, res) => {
    const db = req.app.locals.db;
    const user = req.session.user;
    const { id, title, subtitle, slug: rawSlug, body, content_type, status,
            seo_title, seo_description, seo_keywords, cover_image_alt,
            is_global_featured, is_subject_featured, retraction_notice,
            correction_notice, issue_id } = req.body;

    const subjects = [].concat(req.body.subjects || []).map(Number);
    const authors = [].concat(req.body.authors || []).map(Number);
    const tags = [].concat(req.body.tags || []).map(Number);
    const primaryAuthor = parseInt(req.body.primary_author) || (authors[0] || null);

    // Role check: regional editors can only save as draft
    if (user.role === 'regional_editor' && status !== 'draft') {
        return res.redirect('/admin/articles?error=no_permission');
    }

    // Head of subject can only publish for their subject
    if (user.role === 'head_of_subject' && status === 'published') {
        if (!subjects.includes(user.subject_id)) {
            return res.redirect('/admin/articles?error=wrong_subject');
        }
    }

    const slug = rawSlug || slugify(title, { lower: true, strict: true });
    const coverUrl = req.file ? `/uploads/${req.file.filename}` : (req.body.existing_cover || null);

    const publishDate = status === 'published' ? (req.body.publish_date || new Date().toISOString()) : null;

    try {
        if (id) {
            // Update
            db.prepare(`
                UPDATE articles SET title=?, subtitle=?, slug=?, body=?, content_type=?,
                status=?, publish_date=COALESCE(?,publish_date), cover_image_url=COALESCE(?,cover_image_url),
                cover_image_alt=?, is_global_featured=?, is_subject_featured=?,
                seo_title=?, seo_description=?, seo_keywords=?,
                retraction_notice=?, correction_notice=?, issue_id=?,
                updated_at=CURRENT_TIMESTAMP
                WHERE id=?
            `).run(title, subtitle, slug, body, content_type || 'long_form',
                   status || 'draft', publishDate, coverUrl,
                   cover_image_alt, is_global_featured ? 1 : 0, is_subject_featured ? 1 : 0,
                   seo_title, seo_description, seo_keywords,
                   retraction_notice, correction_notice, issue_id || null, id);

            // Clear and re-insert relations
            db.prepare('DELETE FROM article_subjects WHERE article_id = ?').run(id);
            db.prepare('DELETE FROM article_authors WHERE article_id = ?').run(id);
            db.prepare('DELETE FROM article_tags WHERE article_id = ?').run(id);

            for (const sid of subjects) {
                db.prepare('INSERT INTO article_subjects (article_id, subject_id) VALUES (?, ?)').run(id, sid);
            }
            authors.forEach((aid, i) => {
                db.prepare('INSERT INTO article_authors (article_id, author_id, is_primary, sort_order) VALUES (?, ?, ?, ?)').run(id, aid, aid === primaryAuthor ? 1 : 0, i);
            });
            for (const tid of tags) {
                db.prepare('INSERT INTO article_tags (article_id, tag_id) VALUES (?, ?)').run(id, tid);
            }

            res.redirect(`/admin/articles/${id}/edit`);
        } else {
            // Create
            const result = db.prepare(`
                INSERT INTO articles (title, subtitle, slug, body, content_type, status,
                publish_date, cover_image_url, cover_image_alt, is_global_featured,
                is_subject_featured, seo_title, seo_description, seo_keywords,
                retraction_notice, correction_notice, issue_id, created_by)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            `).run(title, subtitle, slug, body, content_type || 'long_form',
                   status || 'draft', publishDate, coverUrl, cover_image_alt,
                   is_global_featured ? 1 : 0, is_subject_featured ? 1 : 0,
                   seo_title, seo_description, seo_keywords,
                   retraction_notice, correction_notice, issue_id || null, user.id);

            const newId = result.lastInsertRowid;

            for (const sid of subjects) {
                db.prepare('INSERT INTO article_subjects (article_id, subject_id) VALUES (?, ?)').run(newId, sid);
            }
            authors.forEach((aid, i) => {
                db.prepare('INSERT INTO article_authors (article_id, author_id, is_primary, sort_order) VALUES (?, ?, ?, ?)').run(newId, aid, aid === primaryAuthor ? 1 : 0, i);
            });
            for (const tid of tags) {
                db.prepare('INSERT INTO article_tags (article_id, tag_id) VALUES (?, ?)').run(newId, tid);
            }

            res.redirect(`/admin/articles/${newId}/edit`);
        }
    } catch (err) {
        console.error(err);
        res.redirect('/admin/articles?error=save_failed');
    }
});

router.get('/articles/:id/edit', requireAuth, (req, res) => {
    const db = req.app.locals.db;
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
    if (!article) return res.redirect('/admin/articles');

    article.subject_ids = db.prepare('SELECT subject_id FROM article_subjects WHERE article_id = ?').all(article.id).map(r => r.subject_id);
    article.author_ids = db.prepare('SELECT author_id FROM article_authors WHERE article_id = ? ORDER BY sort_order').all(article.id).map(r => r.author_id);
    article.primary_author_id = (db.prepare('SELECT author_id FROM article_authors WHERE article_id = ? AND is_primary = 1').get(article.id) || {}).author_id;
    article.tag_ids = db.prepare('SELECT tag_id FROM article_tags WHERE article_id = ?').all(article.id).map(r => r.tag_id);

    res.render('admin/article-edit', {
        title: `Edit: ${article.title} — Alexandria Admin`,
        article,
        allSubjects: db.prepare('SELECT * FROM subjects ORDER BY sort_order').all(),
        allAuthors: db.prepare('SELECT * FROM authors ORDER BY name').all(),
        allTags: db.prepare('SELECT * FROM tags ORDER BY name').all(),
        allIssues: db.prepare('SELECT * FROM issues ORDER BY publication_date DESC').all(),
        error: null
    });
});

router.post('/articles/:id/delete', requireAuth, requireRole('admin', 'managing_editor'), (req, res) => {
    const db = req.app.locals.db;
    db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);
    res.redirect('/admin/articles');
});

// ═══════════════════════════════════════
// AUTHORS CRUD
// ═══════════════════════════════════════
router.get('/authors', requireAuth, (req, res) => {
    const db = req.app.locals.db;
    const authors = db.prepare(`
        SELECT a.*, COUNT(aa.article_id) as article_count
        FROM authors a LEFT JOIN article_authors aa ON a.id = aa.author_id
        GROUP BY a.id ORDER BY a.name
    `).all();
    res.render('admin/authors', { title: 'Authors — Alexandria Admin', authors });
});

router.get('/authors/new', requireAuth, (req, res) => {
    res.render('admin/author-edit', { title: 'New Author — Alexandria Admin', author: null, error: null });
});

router.get('/authors/:id/edit', requireAuth, (req, res) => {
    const db = req.app.locals.db;
    const author = db.prepare('SELECT * FROM authors WHERE id = ?').get(req.params.id);
    if (!author) return res.redirect('/admin/authors');
    res.render('admin/author-edit', { title: `Edit: ${author.name} — Alexandria Admin`, author, error: null });
});

router.post('/authors/save', requireAuth, upload.single('headshot'), (req, res) => {
    const db = req.app.locals.db;
    const { id, name, bio, website_url, twitter_url, linkedin_url } = req.body;
    const slug = slugify(name, { lower: true, strict: true });
    const headshotUrl = req.file ? `/uploads/${req.file.filename}` : (req.body.existing_headshot || null);

    try {
        if (id) {
            db.prepare(`UPDATE authors SET name=?, slug=?, bio=?, headshot_url=COALESCE(?,headshot_url),
                website_url=?, twitter_url=?, linkedin_url=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
            ).run(name, slug, bio, headshotUrl, website_url, twitter_url, linkedin_url, id);
            res.redirect(`/admin/authors/${id}/edit`);
        } else {
            const result = db.prepare(`INSERT INTO authors (name, slug, bio, headshot_url, website_url, twitter_url, linkedin_url)
                VALUES (?,?,?,?,?,?,?)`).run(name, slug, bio, headshotUrl, website_url, twitter_url, linkedin_url);
            res.redirect(`/admin/authors/${result.lastInsertRowid}/edit`);
        }
    } catch (err) {
        console.error(err);
        res.redirect('/admin/authors?error=save_failed');
    }
});

router.post('/authors/:id/delete', requireAuth, requireRole('admin', 'managing_editor'), (req, res) => {
    req.app.locals.db.prepare('DELETE FROM authors WHERE id = ?').run(req.params.id);
    res.redirect('/admin/authors');
});

// ═══════════════════════════════════════
// SUBJECTS (admin + managing_editor only)
// ═══════════════════════════════════════
router.get('/subjects', requireAuth, requireRole('admin', 'managing_editor'), (req, res) => {
    const db = req.app.locals.db;
    const subjectsList = db.prepare('SELECT * FROM subjects ORDER BY sort_order').all();
    res.render('admin/subjects', { title: 'Subjects — Alexandria Admin', subjectsList });
});

router.post('/subjects/save', requireAuth, requireRole('admin', 'managing_editor'), (req, res) => {
    const db = req.app.locals.db;
    const { id, name, description, sort_order } = req.body;
    const slug = slugify(name, { lower: true, strict: true });

    if (id) {
        db.prepare('UPDATE subjects SET name=?, slug=?, description=?, sort_order=? WHERE id=?')
            .run(name, slug, description, sort_order || 0, id);
    } else {
        db.prepare('INSERT INTO subjects (name, slug, description, sort_order) VALUES (?,?,?,?)')
            .run(name, slug, description, sort_order || 0);
    }
    res.redirect('/admin/subjects');
});

// ═══════════════════════════════════════
// MEDIA LIBRARY
// ═══════════════════════════════════════
router.get('/media', requireAuth, (req, res) => {
    const db = req.app.locals.db;
    const media = db.prepare('SELECT * FROM media ORDER BY created_at DESC').all();
    res.render('admin/media', { title: 'Media Library — Alexandria Admin', media });
});

router.post('/media/upload', requireAuth, upload.single('file'), (req, res) => {
    const db = req.app.locals.db;
    if (!req.file) return res.redirect('/admin/media');

    db.prepare('INSERT INTO media (filename, original_name, mime_type, file_size, alt_text, uploaded_by) VALUES (?,?,?,?,?,?)')
        .run(req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, req.body.alt_text || '', req.session.user.id);

    res.redirect('/admin/media');
});

// ═══════════════════════════════════════
// USERS (admin only)
// ═══════════════════════════════════════
router.get('/users', requireAuth, requireRole('admin'), (req, res) => {
    const db = req.app.locals.db;
    const users = db.prepare(`
        SELECT u.*, s.name as subject_name FROM users u
        LEFT JOIN subjects s ON u.subject_id = s.id ORDER BY u.created_at
    `).all();
    res.render('admin/users', { title: 'Users — Alexandria Admin', users });
});

router.post('/users/save', requireAuth, requireRole('admin'), (req, res) => {
    const db = req.app.locals.db;
    const { id, email, display_name, role, subject_id, password } = req.body;

    if (id) {
        if (password) {
            const hash = bcrypt.hashSync(password, 12);
            db.prepare('UPDATE users SET email=?, display_name=?, role=?, subject_id=?, password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
                .run(email, display_name, role, subject_id || null, hash, id);
        } else {
            db.prepare('UPDATE users SET email=?, display_name=?, role=?, subject_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
                .run(email, display_name, role, subject_id || null, id);
        }
    } else {
        const hash = bcrypt.hashSync(password || 'changeme123', 12);
        db.prepare('INSERT INTO users (email, password_hash, display_name, role, subject_id) VALUES (?,?,?,?,?)')
            .run(email, hash, display_name, role, subject_id || null);
    }
    res.redirect('/admin/users');
});

router.post('/users/:id/delete', requireAuth, requireRole('admin'), (req, res) => {
    if (parseInt(req.params.id) === req.session.user.id) return res.redirect('/admin/users');
    req.app.locals.db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.redirect('/admin/users');
});

module.exports = router;
