-- Alexandria CMS Database Schema
-- Covers: articles, authors, subjects, tags, monthly issues, users/roles, analytics

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ═══════════════════════════════════════
-- USERS & ROLES (Admin publishing)
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','managing_editor','head_of_subject','regional_editor')),
    -- head_of_subject gets a subject_id they can publish for
    subject_id INTEGER REFERENCES subjects(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════
-- SUBJECTS (5 disciplines)
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════
-- AUTHORS
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS authors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    bio TEXT,
    headshot_url TEXT,
    website_url TEXT,
    twitter_url TEXT,
    linkedin_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════
-- TAGS
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL
);

-- ═══════════════════════════════════════
-- MONTHLY ISSUES (short-form content)
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_number TEXT NOT NULL,
    title TEXT,
    description TEXT,
    publication_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════
-- ARTICLES
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subtitle TEXT,
    slug TEXT UNIQUE NOT NULL,
    cover_image_url TEXT,
    cover_image_alt TEXT,
    body TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'long_form' CHECK(content_type IN ('long_form','short_form')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','retracted')),
    publish_date DATETIME,
    -- Featured flags
    is_global_featured INTEGER DEFAULT 0,
    is_subject_featured INTEGER DEFAULT 0,
    -- SEO
    seo_title TEXT,
    seo_description TEXT,
    seo_keywords TEXT,
    -- Retraction
    retraction_notice TEXT,
    correction_notice TEXT,
    -- Monthly issue (for short-form)
    issue_id INTEGER REFERENCES issues(id),
    -- Analytics
    view_count INTEGER DEFAULT 0,
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- ═══════════════════════════════════════
-- JUNCTION TABLES
-- ═══════════════════════════════════════

-- Article <-> Subject (many-to-many)
CREATE TABLE IF NOT EXISTS article_subjects (
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    PRIMARY KEY (article_id, subject_id)
);

-- Article <-> Author (many-to-many with ordering)
CREATE TABLE IF NOT EXISTS article_authors (
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    is_primary INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    PRIMARY KEY (article_id, author_id)
);

-- Article <-> Tag (many-to-many)
CREATE TABLE IF NOT EXISTS article_tags (
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (article_id, tag_id)
);

-- ═══════════════════════════════════════
-- MEDIA LIBRARY
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER,
    alt_text TEXT,
    uploaded_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════
-- INDEXES for performance
-- ═══════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_publish_date ON articles(publish_date);
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_content_type ON articles(content_type);
CREATE INDEX IF NOT EXISTS idx_articles_global_featured ON articles(is_global_featured);
CREATE INDEX IF NOT EXISTS idx_articles_view_count ON articles(view_count);
CREATE INDEX IF NOT EXISTS idx_authors_slug ON authors(slug);
CREATE INDEX IF NOT EXISTS idx_subjects_slug ON subjects(slug);
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);

-- ═══════════════════════════════════════
-- SUBMISSIONS (public article submissions)
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    title TEXT NOT NULL,
    subject_id INTEGER REFERENCES subjects(id),
    abstract TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reviewing','accepted','rejected')),
    admin_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
