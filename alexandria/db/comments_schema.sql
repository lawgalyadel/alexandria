-- ============================================================
-- Alexandria CMS — Comments Schema
-- Run against alexandria.db after submissions_schema.sql
-- ============================================================

-- Comments on articles
CREATE TABLE IF NOT EXISTS comments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id   INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,

  -- Identity — anonymous users tracked by session fingerprint
  -- If they log in via the submitter portal, we link them
  submitter_id INTEGER REFERENCES submitters(id) ON DELETE SET NULL,
  display_name TEXT    NOT NULL,               -- name they typed, or account name
  session_key  TEXT    NOT NULL,               -- hashed session id for trust tracking

  -- Content
  body         TEXT    NOT NULL,

  -- Moderation
  -- 'approved' | 'rejected' | 'pending' (should never stay pending long — AI handles it)
  status       TEXT    NOT NULL DEFAULT 'pending',
  mod_reason   TEXT,                           -- why it was rejected (internal)
  ai_score     REAL,                           -- toxicity score from AI (0-1)

  -- Soft ranking
  upvotes      INTEGER NOT NULL DEFAULT 0,

  -- Threading (optional — top-level only for now, can extend)
  parent_id    INTEGER REFERENCES comments(id) ON DELETE CASCADE,

  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Trust ledger — tracks how many comments each session_key has had approved
-- Once approved_count >= 3, that session is trusted and bypasses moderation
CREATE TABLE IF NOT EXISTS comment_trust (
  session_key    TEXT    PRIMARY KEY,
  approved_count INTEGER NOT NULL DEFAULT 0,
  trusted        INTEGER NOT NULL DEFAULT 0,   -- 1 = bypass moderation
  first_seen     TEXT    NOT NULL DEFAULT (datetime('now')),
  last_seen      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Comment upvote tracking (prevent double voting per session)
CREATE TABLE IF NOT EXISTS comment_votes (
  comment_id  INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  session_key TEXT    NOT NULL,
  PRIMARY KEY (comment_id, session_key)
);

CREATE INDEX IF NOT EXISTS idx_comments_article  ON comments(article_id);
CREATE INDEX IF NOT EXISTS idx_comments_status   ON comments(status);
CREATE INDEX IF NOT EXISTS idx_comments_session  ON comments(session_key);
