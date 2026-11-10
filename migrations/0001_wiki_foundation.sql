PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
	id TEXT PRIMARY KEY,
	auth_subject TEXT NOT NULL UNIQUE,
	username TEXT NOT NULL UNIQUE,
	role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'trusted', 'moderator', 'admin')),
	status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS wiki_pages (
	id TEXT PRIMARY KEY,
	mod_id TEXT,
	entity_type TEXT CHECK (entity_type IS NULL OR entity_type IN ('card', 'relic', 'potion', 'power', 'keyword', 'character')),
	entity_id TEXT,
	slug TEXT NOT NULL,
	page_type TEXT NOT NULL DEFAULT 'entity' CHECK (page_type IN ('entity', 'mod')),
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	CHECK (
		(page_type = 'entity' AND entity_type IS NOT NULL AND entity_id IS NOT NULL)
		OR (page_type = 'mod' AND mod_id IS NOT NULL)
	)
);

-- Partial unique indexes keep entity ids and mod-scoped slugs stable without forcing a global unique slug.
CREATE UNIQUE INDEX IF NOT EXISTS uq_wiki_pages_entity ON wiki_pages(entity_type, entity_id)
	WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_wiki_pages_entity_slug ON wiki_pages(slug)
	WHERE page_type = 'entity';
CREATE UNIQUE INDEX IF NOT EXISTS uq_wiki_pages_mod_slug ON wiki_pages(mod_id, slug)
	WHERE page_type = 'mod' AND mod_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS wiki_sections (
	id TEXT PRIMARY KEY,
	page_id TEXT NOT NULL REFERENCES wiki_pages(id) ON DELETE RESTRICT,
	section_key TEXT NOT NULL,
	content_type TEXT NOT NULL DEFAULT 'markdown' CHECK (content_type IN ('markdown', 'table', 'structured')),
	sort_order INTEGER NOT NULL DEFAULT 0,
	current_revision_id TEXT REFERENCES wiki_revisions(id) ON DELETE RESTRICT,
	version INTEGER NOT NULL DEFAULT 0,
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	UNIQUE (page_id, section_key)
);

CREATE TABLE IF NOT EXISTS wiki_revisions (
	id TEXT PRIMARY KEY,
	section_id TEXT NOT NULL REFERENCES wiki_sections(id) ON DELETE RESTRICT,
	revision_no INTEGER NOT NULL,
	parent_revision_id TEXT REFERENCES wiki_revisions(id) ON DELETE RESTRICT,
	content TEXT NOT NULL,
	summary TEXT NOT NULL DEFAULT '',
	editor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
	source_type TEXT NOT NULL DEFAULT 'community' CHECK (source_type IN ('mod_seed', 'mod_update', 'community', 'moderation', 'rollback')),
	source_reference TEXT,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	UNIQUE (section_id, revision_no)
);

CREATE TABLE IF NOT EXISTS wiki_section_sources (
	id TEXT PRIMARY KEY,
	section_id TEXT NOT NULL UNIQUE REFERENCES wiki_sections(id) ON DELETE RESTRICT,
	source_type TEXT NOT NULL DEFAULT 'mod' CHECK (source_type IN ('mod')),
	source_path TEXT NOT NULL UNIQUE,
	source_hash TEXT NOT NULL,
	source_content TEXT NOT NULL,
	source_mod_version TEXT,
	source_status TEXT NOT NULL DEFAULT 'active' CHECK (source_status IN ('active', 'deleted')),
	last_synced_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS wiki_edit_proposals (
	id TEXT PRIMARY KEY,
	section_id TEXT NOT NULL REFERENCES wiki_sections(id) ON DELETE RESTRICT,
	base_revision_id TEXT REFERENCES wiki_revisions(id) ON DELETE RESTRICT,
	base_version INTEGER NOT NULL,
	proposed_content TEXT NOT NULL,
	summary TEXT NOT NULL DEFAULT '',
	submitted_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'conflict', 'withdrawn')),
	reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
	review_note TEXT,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	reviewed_at TEXT,
	published_revision_id TEXT REFERENCES wiki_revisions(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS wiki_source_updates (
	id TEXT PRIMARY KEY,
	source_id TEXT NOT NULL REFERENCES wiki_section_sources(id) ON DELETE RESTRICT,
	section_id TEXT NOT NULL REFERENCES wiki_sections(id) ON DELETE RESTRICT,
	base_content TEXT NOT NULL,
	current_content TEXT NOT NULL,
	incoming_content TEXT NOT NULL,
	base_hash TEXT NOT NULL,
	incoming_hash TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'conflict', 'withdrawn')),
	reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
	review_note TEXT,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	reviewed_at TEXT,
	published_revision_id TEXT REFERENCES wiki_revisions(id) ON DELETE RESTRICT
);

-- One open candidate per source and incoming content keeps repeated syncs idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS uq_wiki_source_updates_open ON wiki_source_updates(source_id, incoming_hash)
	WHERE status IN ('pending', 'conflict');

CREATE TABLE IF NOT EXISTS comments (
	id TEXT PRIMARY KEY,
	page_id TEXT NOT NULL REFERENCES wiki_pages(id) ON DELETE RESTRICT,
	section_id TEXT REFERENCES wiki_sections(id) ON DELETE RESTRICT,
	parent_id TEXT REFERENCES comments(id) ON DELETE RESTRICT,
	author_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
	content TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden', 'deleted')),
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS wiki_audit_logs (
	id TEXT PRIMARY KEY,
	actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
	action TEXT NOT NULL,
	target_type TEXT NOT NULL,
	target_id TEXT NOT NULL,
	metadata_json TEXT NOT NULL DEFAULT '{}',
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_wiki_pages_mod ON wiki_pages(mod_id, page_type);
CREATE INDEX IF NOT EXISTS idx_wiki_sections_page_order ON wiki_sections(page_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_wiki_revisions_section_no ON wiki_revisions(section_id, revision_no);
CREATE INDEX IF NOT EXISTS idx_wiki_revisions_section_created ON wiki_revisions(section_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wiki_revisions_source_type ON wiki_revisions(source_type, created_at);
CREATE INDEX IF NOT EXISTS idx_wiki_proposals_status_created ON wiki_edit_proposals(status, created_at);
CREATE INDEX IF NOT EXISTS idx_wiki_proposals_section_status ON wiki_edit_proposals(section_id, status);
CREATE INDEX IF NOT EXISTS idx_wiki_source_updates_status_created ON wiki_source_updates(status, created_at);
CREATE INDEX IF NOT EXISTS idx_wiki_section_sources_section ON wiki_section_sources(section_id);
CREATE INDEX IF NOT EXISTS idx_wiki_section_sources_status ON wiki_section_sources(source_status);
CREATE INDEX IF NOT EXISTS idx_comments_page_created ON comments(page_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_section_created ON comments(section_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent_created ON comments(parent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wiki_audit_target ON wiki_audit_logs(target_type, target_id, created_at);
