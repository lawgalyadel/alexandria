-- ============================================================
-- Alexandria CMS — Submissions Portal Schema
-- Run this against your existing alexandria.db to add submissions support
-- ============================================================

-- Submitter accounts (separate from editorial staff accounts)
CREATE TABLE IF NOT EXISTS submitters (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  full_name     TEXT    NOT NULL,
  bio_line      TEXT    NOT NULL,           -- 1-sentence bio
  subject_area  TEXT    NOT NULL,           -- e.g. "History", "Economics"
  article_type  TEXT    NOT NULL DEFAULT 'academic', -- 'academic' | 'current_affairs'
  verified      INTEGER NOT NULL DEFAULT 0, -- email verification flag (future use)
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  last_login    TEXT
);

-- Submissions themselves
CREATE TABLE IF NOT EXISTS submissions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  submitter_id     INTEGER NOT NULL REFERENCES submitters(id) ON DELETE CASCADE,
  article_title    TEXT    NOT NULL,
  summary          TEXT    NOT NULL,        -- short abstract
  subject_area     TEXT    NOT NULL,        -- may differ from submitter default
  article_type     TEXT    NOT NULL,        -- 'academic' | 'current_affairs'
  file_path        TEXT    NOT NULL,        -- path to uploaded .pdf / .docx
  file_name        TEXT    NOT NULL,        -- original filename for display
  file_size        INTEGER NOT NULL,        -- bytes
  status           TEXT    NOT NULL DEFAULT 'pending',
                                            -- 'pending' | 'under_review' | 'accepted' | 'rejected'
  admin_notes      TEXT,                    -- internal notes from editors
  reviewed_by      INTEGER REFERENCES users(id),
  reviewed_at      TEXT,
  submitted_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Index for admin panel queries
CREATE INDEX IF NOT EXISTS idx_submissions_status     ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_submitter  ON submissions(submitter_id);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted  ON submissions(submitted_at DESC);
