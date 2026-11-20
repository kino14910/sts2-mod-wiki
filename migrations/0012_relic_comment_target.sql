-- Relic pages keep one discussion at the bottom, scoped by relic entity id.
-- SQLite cannot widen the CHECK in place; old tables are kept verbatim as recovery snapshots.
PRAGMA legacy_alter_table = ON;
DROP TRIGGER comment_revision_insert;
DROP TRIGGER comment_revision_update;
DROP TRIGGER wiki_identity_comment_insert;
DROP TRIGGER wiki_identity_comment_delete;
DROP TRIGGER wiki_identity_comment_update;
DROP TRIGGER wiki_identity_comment_archive_insert;
DROP TRIGGER wiki_identity_comment_archive_delete;
ALTER TABLE comments RENAME TO comments_target_legacy;
ALTER TABLE comment_revisions RENAME TO comment_revisions_target_legacy;
ALTER TABLE wiki_comment_identity_archives RENAME TO wiki_comment_identity_archives_target_legacy;

CREATE TABLE comments (
	id TEXT PRIMARY KEY,
	target_type TEXT NOT NULL CHECK (target_type IN ('card', 'relic', 'wiki_section')),
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
CREATE TABLE comment_revisions (
	id TEXT PRIMARY KEY,
	comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE RESTRICT,
	content TEXT NOT NULL,
	status TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE wiki_comment_identity_archives (
	comment_id TEXT PRIMARY KEY REFERENCES comments(id) ON DELETE RESTRICT,
	legacy_target_id TEXT NOT NULL,
	reason TEXT NOT NULL,
	candidates_json TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO comments (id, target_type, target_id, parent_id, author_name, author_token_hash, author_ip_hash, content, status, created_at, updated_at)
SELECT id, target_type, target_id, NULL, author_name, author_token_hash, author_ip_hash, content, status, created_at, updated_at
FROM comments_target_legacy;
UPDATE comments
SET parent_id = (SELECT legacy.parent_id FROM comments_target_legacy legacy WHERE legacy.id = comments.id)
WHERE EXISTS (SELECT 1 FROM comments_target_legacy legacy WHERE legacy.id = comments.id AND legacy.parent_id IS NOT NULL);
INSERT INTO comment_revisions (id, comment_id, content, status, created_at)
SELECT id, comment_id, content, status, created_at FROM comment_revisions_target_legacy;
INSERT INTO wiki_comment_identity_archives (comment_id, legacy_target_id, reason, candidates_json, created_at)
SELECT comment_id, legacy_target_id, reason, candidates_json, created_at FROM wiki_comment_identity_archives_target_legacy;

CREATE INDEX idx_comments_relic_target_created ON comments(target_type, target_id, created_at DESC);
CREATE INDEX idx_comments_relic_parent_created ON comments(parent_id, created_at);
CREATE INDEX idx_comments_relic_token_created ON comments(author_token_hash, created_at DESC);
CREATE INDEX idx_comments_relic_ip_created ON comments(author_ip_hash, created_at DESC);
CREATE INDEX idx_comment_revisions_relic_comment ON comment_revisions(comment_id, created_at);

CREATE TRIGGER comment_revision_insert AFTER INSERT ON comments BEGIN
	INSERT INTO comment_revisions (id, comment_id, content, status)
	VALUES (lower(hex(randomblob(16))), NEW.id, NEW.content, NEW.status);
END;
CREATE TRIGGER comment_revision_update AFTER UPDATE OF content, status ON comments
WHEN OLD.content IS NOT NEW.content OR OLD.status IS NOT NEW.status BEGIN
	INSERT INTO comment_revisions (id, comment_id, content, status)
	VALUES (lower(hex(randomblob(16))), NEW.id, NEW.content, NEW.status);
END;
CREATE TRIGGER wiki_identity_comment_insert AFTER INSERT ON comments BEGIN
	UPDATE wiki_identity_data_epoch SET version=version+1 WHERE id=1;
END;
CREATE TRIGGER wiki_identity_comment_delete AFTER DELETE ON comments BEGIN
	UPDATE wiki_identity_data_epoch SET version=version+1 WHERE id=1;
END;
CREATE TRIGGER wiki_identity_comment_update AFTER UPDATE OF target_type,target_id ON comments
WHEN OLD.target_type IS NOT NEW.target_type OR OLD.target_id IS NOT NEW.target_id BEGIN
	UPDATE wiki_identity_data_epoch SET version=version+1 WHERE id=1;
END;
CREATE TRIGGER wiki_identity_comment_archive_insert AFTER INSERT ON wiki_comment_identity_archives BEGIN
	UPDATE wiki_identity_data_epoch SET version=version+1 WHERE id=1;
END;
CREATE TRIGGER wiki_identity_comment_archive_delete AFTER DELETE ON wiki_comment_identity_archives BEGIN
	UPDATE wiki_identity_data_epoch SET version=version+1 WHERE id=1;
END;
PRAGMA legacy_alter_table = OFF;
