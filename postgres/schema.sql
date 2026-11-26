CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION wiki_now() RETURNS text AS $$
	SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$ LANGUAGE sql STABLE;

CREATE TABLE IF NOT EXISTS users (
	id text PRIMARY KEY,
	auth_subject text NOT NULL UNIQUE,
	username text NOT NULL UNIQUE,
	email text,
	password_hash text,
	role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'trusted', 'moderator', 'admin')),
	status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
	created_at text NOT NULL DEFAULT wiki_now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users(email) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS wiki_pages (
	id text PRIMARY KEY,
	mod_id text,
	entity_type text CHECK (entity_type IS NULL OR entity_type IN ('card', 'relic', 'potion', 'power', 'keyword', 'character')),
	entity_id text,
	entity_mod_id text,
	slug text NOT NULL,
	page_type text NOT NULL DEFAULT 'entity' CHECK (page_type IN ('entity', 'mod')),
	identity_status text NOT NULL DEFAULT 'active' CHECK (identity_status IN ('active', 'archived')),
	created_at text NOT NULL DEFAULT wiki_now(),
	CHECK (
		(page_type = 'entity' AND entity_type IS NOT NULL AND entity_id IS NOT NULL)
		OR (page_type = 'mod' AND mod_id IS NOT NULL)
	)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wiki_pages_entity ON wiki_pages(entity_type, entity_id)
	WHERE page_type = 'entity' AND identity_status = 'active' AND entity_type IS NOT NULL AND entity_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_wiki_pages_entity_slug ON wiki_pages(slug)
	WHERE page_type = 'entity' AND identity_status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS uq_wiki_pages_mod_slug ON wiki_pages(mod_id, slug)
	WHERE page_type = 'mod' AND mod_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wiki_pages_mod ON wiki_pages(mod_id, page_type);

CREATE TABLE IF NOT EXISTS wiki_revisions (
	id text PRIMARY KEY,
	section_id text NOT NULL,
	revision_no integer NOT NULL,
	parent_revision_id text,
	content text NOT NULL,
	summary text NOT NULL DEFAULT '',
	editor_id text REFERENCES users(id) ON DELETE SET NULL,
	source_type text NOT NULL DEFAULT 'community' CHECK (source_type IN ('mod_seed', 'mod_update', 'community', 'moderation', 'rollback')),
	source_reference text,
	created_at text NOT NULL DEFAULT wiki_now(),
	UNIQUE (section_id, revision_no)
);

CREATE TABLE IF NOT EXISTS wiki_sections (
	id text PRIMARY KEY,
	page_id text NOT NULL REFERENCES wiki_pages(id) ON DELETE RESTRICT,
	section_key text NOT NULL,
	content_type text NOT NULL DEFAULT 'markdown' CHECK (content_type IN ('markdown', 'table', 'structured')),
	sort_order integer NOT NULL DEFAULT 0,
	current_revision_id text,
	version integer NOT NULL DEFAULT 0,
	updated_at text NOT NULL DEFAULT wiki_now(),
	UNIQUE (page_id, section_key)
);
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_wiki_revisions_section') THEN
		ALTER TABLE wiki_revisions ADD CONSTRAINT fk_wiki_revisions_section
			FOREIGN KEY (section_id) REFERENCES wiki_sections(id) ON DELETE RESTRICT;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_wiki_sections_current_revision') THEN
		ALTER TABLE wiki_sections ADD CONSTRAINT fk_wiki_sections_current_revision
			FOREIGN KEY (current_revision_id) REFERENCES wiki_revisions(id) ON DELETE RESTRICT;
	END IF;
END;
$$;
CREATE INDEX IF NOT EXISTS idx_wiki_sections_page_order ON wiki_sections(page_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_wiki_revisions_section_no ON wiki_revisions(section_id, revision_no);
CREATE INDEX IF NOT EXISTS idx_wiki_revisions_section_created ON wiki_revisions(section_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wiki_revisions_source_type ON wiki_revisions(source_type, created_at);

CREATE TABLE IF NOT EXISTS wiki_section_sources (
	id text PRIMARY KEY,
	section_id text NOT NULL UNIQUE REFERENCES wiki_sections(id) ON DELETE RESTRICT,
	source_type text NOT NULL DEFAULT 'mod' CHECK (source_type IN ('mod')),
	source_path text NOT NULL UNIQUE,
	source_hash text NOT NULL,
	source_content text NOT NULL,
	source_mod_version text,
	source_status text NOT NULL DEFAULT 'active' CHECK (source_status IN ('active', 'deleted')),
	last_synced_at text NOT NULL DEFAULT wiki_now(),
	created_at text NOT NULL DEFAULT wiki_now(),
	updated_at text NOT NULL DEFAULT wiki_now()
);
CREATE INDEX IF NOT EXISTS idx_wiki_section_sources_section ON wiki_section_sources(section_id);
CREATE INDEX IF NOT EXISTS idx_wiki_section_sources_status ON wiki_section_sources(source_status);

CREATE TABLE IF NOT EXISTS wiki_edit_proposals (
	id text PRIMARY KEY,
	section_id text NOT NULL REFERENCES wiki_sections(id) ON DELETE RESTRICT,
	base_revision_id text REFERENCES wiki_revisions(id) ON DELETE RESTRICT,
	base_version integer NOT NULL,
	proposed_content text NOT NULL,
	summary text NOT NULL DEFAULT '',
	submitted_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
	status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'conflict', 'withdrawn')),
	reviewed_by text REFERENCES users(id) ON DELETE SET NULL,
	review_note text,
	created_at text NOT NULL DEFAULT wiki_now(),
	reviewed_at text,
	published_revision_id text REFERENCES wiki_revisions(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_wiki_proposals_status_created ON wiki_edit_proposals(status, created_at);
CREATE INDEX IF NOT EXISTS idx_wiki_proposals_section_status ON wiki_edit_proposals(section_id, status);
CREATE INDEX IF NOT EXISTS idx_wiki_proposals_submitted_by ON wiki_edit_proposals(submitted_by, status, created_at DESC);

CREATE TABLE IF NOT EXISTS wiki_source_updates (
	id text PRIMARY KEY,
	source_id text NOT NULL REFERENCES wiki_section_sources(id) ON DELETE RESTRICT,
	section_id text NOT NULL REFERENCES wiki_sections(id) ON DELETE RESTRICT,
	base_content text NOT NULL,
	current_content text NOT NULL,
	incoming_content text NOT NULL,
	base_hash text NOT NULL,
	incoming_hash text NOT NULL,
	incoming_mod_version text,
	status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'conflict', 'withdrawn')),
	reviewed_by text REFERENCES users(id) ON DELETE SET NULL,
	review_note text,
	created_at text NOT NULL DEFAULT wiki_now(),
	reviewed_at text,
	published_revision_id text REFERENCES wiki_revisions(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wiki_source_updates_open ON wiki_source_updates(source_id, incoming_hash)
	WHERE status IN ('pending', 'conflict');
CREATE INDEX IF NOT EXISTS idx_wiki_source_updates_status_created ON wiki_source_updates(status, created_at);

CREATE TABLE IF NOT EXISTS comments (
	id text PRIMARY KEY,
	target_type text NOT NULL CHECK (target_type IN ('card', 'relic', 'wiki_section')),
	target_id text NOT NULL,
	parent_id text,
	author_name text NOT NULL,
	author_user_id text REFERENCES users(id) ON DELETE SET NULL,
	author_avatar_url text,
	author_token_hash text NOT NULL,
	author_ip_hash text,
	content text NOT NULL,
	status text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'deleted')),
	created_at text NOT NULL DEFAULT wiki_now(),
	updated_at text NOT NULL DEFAULT wiki_now()
);
-- Existing databases were created before comments carried account attribution.
ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_user_id text REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_avatar_url text;
CREATE INDEX IF NOT EXISTS idx_comments_author_user_created ON comments(author_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_target_created ON comments(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent_created ON comments(parent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_token_created ON comments(author_token_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_ip_created ON comments(author_ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_relic_target_created ON comments(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_relic_parent_created ON comments(parent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_relic_token_created ON comments(author_token_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_relic_ip_created ON comments(author_ip_hash, created_at DESC);

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_comments_parent') THEN
		ALTER TABLE comments ADD CONSTRAINT fk_comments_parent
			FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE RESTRICT;
	END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS comment_revisions (
	id text PRIMARY KEY,
	comment_id text NOT NULL REFERENCES comments(id) ON DELETE RESTRICT,
	content text NOT NULL,
	status text NOT NULL,
	created_at text NOT NULL DEFAULT wiki_now()
);
CREATE INDEX IF NOT EXISTS idx_comment_revisions_relic_comment ON comment_revisions(comment_id, created_at);

CREATE TABLE IF NOT EXISTS wiki_comment_identity_archives (
	comment_id text PRIMARY KEY REFERENCES comments(id) ON DELETE RESTRICT,
	legacy_target_id text NOT NULL,
	reason text NOT NULL,
	candidates_json text NOT NULL,
	created_at text NOT NULL DEFAULT wiki_now()
);

CREATE TABLE IF NOT EXISTS wiki_audit_logs (
	id text PRIMARY KEY,
	actor_id text REFERENCES users(id) ON DELETE SET NULL,
	action text NOT NULL,
	target_type text NOT NULL,
	target_id text NOT NULL,
	metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
	created_at text NOT NULL DEFAULT wiki_now()
);
CREATE INDEX IF NOT EXISTS idx_wiki_audit_target ON wiki_audit_logs(target_type, target_id, created_at);

CREATE TABLE IF NOT EXISTS wiki_source_paths (
	source_path text PRIMARY KEY,
	source_id text NOT NULL REFERENCES wiki_section_sources(id) ON DELETE RESTRICT,
	created_at text NOT NULL DEFAULT wiki_now()
);

CREATE TABLE IF NOT EXISTS wiki_identity_mappings (
	entity_type text NOT NULL,
	legacy_id text NOT NULL,
	resolution text NOT NULL CHECK (resolution IN ('unique', 'ambiguous', 'missing', 'owner_mismatch')),
	owner_mod_id text,
	canonical_id text,
	candidates_json text NOT NULL,
	catalog_hash text NOT NULL,
	updated_at text NOT NULL DEFAULT wiki_now(),
	PRIMARY KEY (entity_type, legacy_id)
);

CREATE TABLE IF NOT EXISTS wiki_identity_archives (
	page_id text PRIMARY KEY REFERENCES wiki_pages(id) ON DELETE RESTRICT,
	entity_type text NOT NULL,
	legacy_id text NOT NULL,
	original_mod_id text,
	original_entity_mod_id text,
	original_slug text NOT NULL,
	reason text NOT NULL,
	candidates_json text NOT NULL,
	created_at text NOT NULL DEFAULT wiki_now()
);

CREATE TABLE IF NOT EXISTS wiki_identity_runs (
	catalog_hash text PRIMARY KEY,
	completed_at text NOT NULL DEFAULT wiki_now()
);

CREATE TABLE IF NOT EXISTS wiki_identity_current (
	id integer PRIMARY KEY CHECK (id = 1),
	catalog_hash text NOT NULL,
	data_epoch integer NOT NULL DEFAULT -1
);

CREATE TABLE IF NOT EXISTS wiki_identity_data_epoch (
	id integer PRIMARY KEY CHECK (id = 1),
	version integer NOT NULL DEFAULT 0
);
INSERT INTO wiki_identity_data_epoch (id, version) VALUES (1, 0)
	ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS auth_oauth_states (
	id text PRIMARY KEY,
	expires_at integer NOT NULL,
	created_at text NOT NULL DEFAULT wiki_now()
);

CREATE TABLE IF NOT EXISTS auth_email_codes (
	id text PRIMARY KEY,
	email text NOT NULL,
	code_hash text NOT NULL,
	expires_at integer NOT NULL,
	attempts integer NOT NULL DEFAULT 0,
	consumed_at integer,
	created_at integer NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_email_codes_email_created ON auth_email_codes(email, created_at DESC);

CREATE TABLE IF NOT EXISTS auth_invite_codes (
	id text PRIMARY KEY,
	code_hash text NOT NULL UNIQUE,
	created_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
	created_at integer NOT NULL,
	expires_at integer NOT NULL,
	max_uses integer NOT NULL CHECK (max_uses > 0),
	used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
	revoked_at integer
);
CREATE INDEX IF NOT EXISTS idx_auth_invite_codes_created ON auth_invite_codes(created_at DESC);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
	key text PRIMARY KEY,
	attempts integer NOT NULL DEFAULT 0,
	window_start integer NOT NULL
);

CREATE OR REPLACE FUNCTION wiki_record_comment_revision() RETURNS trigger AS $$
BEGIN
	INSERT INTO comment_revisions (id, comment_id, content, status)
	VALUES (gen_random_uuid()::text, NEW.id, NEW.content, NEW.status);
	RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS comment_revision_insert ON comments;
CREATE TRIGGER comment_revision_insert
	AFTER INSERT ON comments
	FOR EACH ROW EXECUTE FUNCTION wiki_record_comment_revision();

DROP TRIGGER IF EXISTS comment_revision_update ON comments;
CREATE TRIGGER comment_revision_update
	AFTER UPDATE OF content, status ON comments
	FOR EACH ROW
	WHEN (OLD.content IS DISTINCT FROM NEW.content OR OLD.status IS DISTINCT FROM NEW.status)
	EXECUTE FUNCTION wiki_record_comment_revision();

CREATE OR REPLACE FUNCTION wiki_bump_identity_data_epoch() RETURNS trigger AS $$
BEGIN
	UPDATE wiki_identity_data_epoch SET version = version + 1 WHERE id = 1;
	RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wiki_identity_page_insert ON wiki_pages;
CREATE TRIGGER wiki_identity_page_insert AFTER INSERT ON wiki_pages
	FOR EACH ROW EXECUTE FUNCTION wiki_bump_identity_data_epoch();
DROP TRIGGER IF EXISTS wiki_identity_page_delete ON wiki_pages;
CREATE TRIGGER wiki_identity_page_delete AFTER DELETE ON wiki_pages
	FOR EACH ROW EXECUTE FUNCTION wiki_bump_identity_data_epoch();
DROP TRIGGER IF EXISTS wiki_identity_page_update ON wiki_pages;
CREATE TRIGGER wiki_identity_page_update
	AFTER UPDATE OF entity_type, entity_id, entity_mod_id, mod_id, identity_status ON wiki_pages
	FOR EACH ROW
	WHEN (OLD.entity_type IS DISTINCT FROM NEW.entity_type
		OR OLD.entity_id IS DISTINCT FROM NEW.entity_id
		OR OLD.entity_mod_id IS DISTINCT FROM NEW.entity_mod_id
		OR OLD.mod_id IS DISTINCT FROM NEW.mod_id
		OR OLD.identity_status IS DISTINCT FROM NEW.identity_status)
	EXECUTE FUNCTION wiki_bump_identity_data_epoch();

DROP TRIGGER IF EXISTS wiki_identity_comment_insert ON comments;
CREATE TRIGGER wiki_identity_comment_insert AFTER INSERT ON comments
	FOR EACH ROW EXECUTE FUNCTION wiki_bump_identity_data_epoch();
DROP TRIGGER IF EXISTS wiki_identity_comment_delete ON comments;
CREATE TRIGGER wiki_identity_comment_delete AFTER DELETE ON comments
	FOR EACH ROW EXECUTE FUNCTION wiki_bump_identity_data_epoch();
DROP TRIGGER IF EXISTS wiki_identity_comment_update ON comments;
CREATE TRIGGER wiki_identity_comment_update
	AFTER UPDATE OF target_type, target_id ON comments
	FOR EACH ROW
	WHEN (OLD.target_type IS DISTINCT FROM NEW.target_type OR OLD.target_id IS DISTINCT FROM NEW.target_id)
	EXECUTE FUNCTION wiki_bump_identity_data_epoch();

DROP TRIGGER IF EXISTS wiki_identity_mapping_insert ON wiki_identity_mappings;
CREATE TRIGGER wiki_identity_mapping_insert AFTER INSERT ON wiki_identity_mappings
	FOR EACH ROW EXECUTE FUNCTION wiki_bump_identity_data_epoch();
DROP TRIGGER IF EXISTS wiki_identity_mapping_update ON wiki_identity_mappings;
CREATE TRIGGER wiki_identity_mapping_update AFTER UPDATE ON wiki_identity_mappings
	FOR EACH ROW EXECUTE FUNCTION wiki_bump_identity_data_epoch();
DROP TRIGGER IF EXISTS wiki_identity_mapping_delete ON wiki_identity_mappings;
CREATE TRIGGER wiki_identity_mapping_delete AFTER DELETE ON wiki_identity_mappings
	FOR EACH ROW EXECUTE FUNCTION wiki_bump_identity_data_epoch();

DROP TRIGGER IF EXISTS wiki_identity_archive_insert ON wiki_identity_archives;
CREATE TRIGGER wiki_identity_archive_insert AFTER INSERT ON wiki_identity_archives
	FOR EACH ROW EXECUTE FUNCTION wiki_bump_identity_data_epoch();
DROP TRIGGER IF EXISTS wiki_identity_archive_delete ON wiki_identity_archives;
CREATE TRIGGER wiki_identity_archive_delete AFTER DELETE ON wiki_identity_archives
	FOR EACH ROW EXECUTE FUNCTION wiki_bump_identity_data_epoch();

DROP TRIGGER IF EXISTS wiki_identity_comment_archive_insert ON wiki_comment_identity_archives;
CREATE TRIGGER wiki_identity_comment_archive_insert AFTER INSERT ON wiki_comment_identity_archives
	FOR EACH ROW EXECUTE FUNCTION wiki_bump_identity_data_epoch();
DROP TRIGGER IF EXISTS wiki_identity_comment_archive_delete ON wiki_comment_identity_archives;
CREATE TRIGGER wiki_identity_comment_archive_delete AFTER DELETE ON wiki_comment_identity_archives
	FOR EACH ROW EXECUTE FUNCTION wiki_bump_identity_data_epoch();
