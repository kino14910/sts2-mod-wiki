PRAGMA foreign_keys = ON;

-- Comments are anonymous card tips, not wiki content: they no longer reference wiki_pages/wiki_sections.
-- Preserve authenticated comments, including replies, even on privately deployed installations.
-- Migration 0005 imports compatible targets into the expanded comment table.
DROP INDEX IF EXISTS idx_comments_page_created;
DROP INDEX IF EXISTS idx_comments_section_created;
DROP INDEX IF EXISTS idx_comments_parent_created;
ALTER TABLE comments RENAME TO comments_authenticated_legacy;

CREATE TABLE comments (
	id TEXT PRIMARY KEY,
	target_type TEXT NOT NULL CHECK (target_type IN ('card')),
	target_id TEXT NOT NULL,
	parent_id TEXT REFERENCES comments(id) ON DELETE RESTRICT,
	author_name TEXT NOT NULL,
	-- SHA-256 of the anonymous browser token; the raw token is never stored.
	author_token_hash TEXT NOT NULL,
	-- SHA-256 of the client IP, used only for rate limiting.
	author_ip_hash TEXT,
	content TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'deleted')),
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_comments_target_created ON comments(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent_created ON comments(parent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_token_created ON comments(author_token_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_ip_created ON comments(author_ip_hash, created_at DESC);
