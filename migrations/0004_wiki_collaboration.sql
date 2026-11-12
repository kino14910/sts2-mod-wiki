PRAGMA foreign_keys = ON;

-- Community collaboration: block comments reuse the existing anonymous comment system.
-- 0003 created `comments` with a CHECK that only allows the 'card' target.
-- SQLite cannot alter a CHECK constraint in place, so the table is expanded via rename + copy.
-- DATA MIGRATION: every existing row is copied verbatim; the original table is KEPT as
-- `comments_card_legacy` as a recovery snapshot. Nothing is dropped and no history is deleted.
-- Migrations are applied once by wrangler; do not re-run this file manually against a migrated DB.

ALTER TABLE comments RENAME TO comments_card_legacy;

CREATE TABLE comments (
	id TEXT PRIMARY KEY,
	target_type TEXT NOT NULL CHECK (target_type IN ('card', 'wiki_section')),
	target_id TEXT NOT NULL,
	parent_id TEXT REFERENCES comments(id) ON DELETE RESTRICT,
	author_name TEXT NOT NULL,
	author_token_hash TEXT NOT NULL,
	author_ip_hash TEXT,
	content TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'deleted')),
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Insert parents first: with foreign_keys ON, a self-referencing parent_id must already exist.
-- Copy all rows with a NULL parent, then restore the link once every row is present.
INSERT INTO comments (id, target_type, target_id, parent_id, author_name, author_token_hash, author_ip_hash, content, status, created_at, updated_at)
SELECT id, target_type, target_id, NULL, author_name, author_token_hash, author_ip_hash, content, status, created_at, updated_at
FROM comments_card_legacy;

UPDATE comments
SET parent_id = (SELECT legacy.parent_id FROM comments_card_legacy legacy WHERE legacy.id = comments.id)
WHERE EXISTS (
	SELECT 1 FROM comments_card_legacy legacy
	WHERE legacy.id = comments.id AND legacy.parent_id IS NOT NULL
);

-- Index names must differ from those still attached to comments_card_legacy.
CREATE INDEX IF NOT EXISTS idx_wiki_comments_target_created ON comments(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wiki_comments_parent_created ON comments(parent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wiki_comments_token_created ON comments(author_token_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wiki_comments_ip_created ON comments(author_ip_hash, created_at DESC);

-- Pending proposals are read by role, then by section. Keep the hot review lookup indexed.
CREATE INDEX IF NOT EXISTS idx_wiki_proposals_submitted_by ON wiki_edit_proposals(submitted_by, status, created_at DESC);
