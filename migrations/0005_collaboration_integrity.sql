PRAGMA foreign_keys = ON;

-- Entity documents have one canonical page; mod documentation may reference that entity too.
DROP INDEX uq_wiki_pages_entity;
CREATE UNIQUE INDEX uq_wiki_pages_entity ON wiki_pages(entity_type, entity_id)
WHERE page_type = 'entity' AND entity_type IS NOT NULL AND entity_id IS NOT NULL;

ALTER TABLE wiki_source_updates ADD COLUMN incoming_mod_version TEXT;

-- A path can move from static/mods to content/wiki without losing its previous identity.
CREATE TABLE wiki_source_paths (
	source_path TEXT PRIMARY KEY,
	source_id TEXT NOT NULL REFERENCES wiki_section_sources(id) ON DELETE RESTRICT,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
INSERT INTO wiki_source_paths (source_path, source_id)
SELECT source_path, id FROM wiki_section_sources;

-- This table is populated by the corrected 0003 on new upgrades. Installations which
-- already applied the destructive original 0003 get an empty archive, not invented data.
CREATE TABLE IF NOT EXISTS comments_authenticated_legacy (
	id TEXT PRIMARY KEY, page_id TEXT NOT NULL, section_id TEXT, parent_id TEXT,
	author_id TEXT NOT NULL, content TEXT NOT NULL, status TEXT NOT NULL,
	created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO comments
	(id, target_type, target_id, parent_id, author_name, author_token_hash, content, status, created_at, updated_at)
SELECT c.id, CASE WHEN c.section_id IS NOT NULL THEN 'wiki_section' ELSE 'card' END,
	CASE WHEN c.section_id IS NOT NULL THEN c.section_id ELSE p.entity_id END,
	NULL, COALESCE(u.username, 'Archived contributor'), 'legacy-authenticated:' || c.author_id,
	c.content, CASE WHEN c.status = 'visible' THEN 'visible' ELSE 'deleted' END, c.created_at, c.updated_at
FROM comments_authenticated_legacy c
JOIN wiki_pages p ON p.id = c.page_id
LEFT JOIN users u ON u.id = c.author_id
WHERE c.section_id IS NOT NULL OR (p.page_type = 'entity' AND p.entity_type = 'card');

UPDATE comments SET parent_id = (
	SELECT legacy.parent_id FROM comments_authenticated_legacy legacy WHERE legacy.id = comments.id
)
WHERE id IN (SELECT id FROM comments_authenticated_legacy WHERE parent_id IS NOT NULL)
AND EXISTS (SELECT 1 FROM comments parent WHERE parent.id = (
	SELECT legacy.parent_id FROM comments_authenticated_legacy legacy WHERE legacy.id = comments.id
));

-- Authenticated 'hidden' comments stay hidden (publicly deleted), while the archive keeps
-- their exact original status. Anonymous comment content remains stored after soft deletion.
CREATE TABLE comment_revisions (
	id TEXT PRIMARY KEY,
	comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE RESTRICT,
	content TEXT NOT NULL,
	status TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_comment_revisions_comment ON comment_revisions(comment_id, created_at);
INSERT INTO comment_revisions (id, comment_id, content, status, created_at)
SELECT 'initial:' || id, id, content, status, updated_at FROM comments;
CREATE TRIGGER comment_revision_insert AFTER INSERT ON comments BEGIN
	INSERT INTO comment_revisions (id, comment_id, content, status)
	VALUES (lower(hex(randomblob(16))), NEW.id, NEW.content, NEW.status);
END;
CREATE TRIGGER comment_revision_update AFTER UPDATE OF content, status ON comments
WHEN OLD.content IS NOT NEW.content OR OLD.status IS NOT NEW.status BEGIN
	INSERT INTO comment_revisions (id, comment_id, content, status)
	VALUES (lower(hex(randomblob(16))), NEW.id, NEW.content, NEW.status);
END;

-- OAuth state is single-use even when a callback is replayed before the browser clears its cookie.
CREATE TABLE auth_oauth_states (
	id TEXT PRIMARY KEY,
	expires_at INTEGER NOT NULL,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

