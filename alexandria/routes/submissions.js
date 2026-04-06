const express = require('express');
const router = express.Router();

// GET /submit — show submission form
router.get('/', (req, res) => {
    const db = req.app.locals.db;
    const subjects = db.prepare('SELECT * FROM subjects ORDER BY sort_order').all();
    const success = req.query.success === '1';
    res.render('submissions/new', {
        title: 'Submit an Article — Alexandria',
        subjects,
        success,
        error: null
    });
});

// POST /submit — handle submission
router.post('/', (req, res) => {
    const db = req.app.locals.db;
    const { name, email, title, subject_id, abstract, body } = req.body;

    if (!name || !email || !title || !abstract || !body) {
        const subjects = db.prepare('SELECT * FROM subjects ORDER BY sort_order').all();
        return res.render('submissions/new', {
            title: 'Submit an Article — Alexandria',
            subjects,
            success: false,
            error: 'Please fill in all required fields.'
        });
    }

    try {
        db.prepare(`
            INSERT INTO submissions (name, email, title, subject_id, abstract, body)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(name, email, title, subject_id || null, abstract, body);

        res.redirect('/submit?success=1');
    } catch (err) {
        console.error(err);
        const subjects = db.prepare('SELECT * FROM subjects ORDER BY sort_order').all();
        res.render('submissions/new', {
            title: 'Submit an Article — Alexandria',
            subjects,
            success: false,
            error: 'Something went wrong. Please try again.'
        });
    }
});

module.exports = router;
