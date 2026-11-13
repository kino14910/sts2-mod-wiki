-- Catalog-dependent data changes run through the identity service after this schema migration.
-- Original entity/page/section/revision rows are retained, including ambiguous legacy records.
ALTER TABLE wiki_pages ADD COLUMN identity_status TEXT NOT NULL DEFAULT 'active'
	CHECK (identity_status IN ('active', 'archived'));
-- Editorial Mod ownership and the entity referenced by its article are independent scopes.
ALTER TABLE wiki_pages ADD COLUMN entity_mod_id TEXT;
UPDATE wiki_pages SET entity_mod_id=CASE WHEN instr(entity_id,':')>0
	THEN substr(entity_id,1,instr(entity_id,':')-1) ELSE mod_id END WHERE entity_id IS NOT NULL;
DROP INDEX uq_wiki_pages_entity;
DROP INDEX uq_wiki_pages_entity_slug;
CREATE UNIQUE INDEX uq_wiki_pages_entity ON wiki_pages(entity_type, entity_id)
	WHERE page_type = 'entity' AND identity_status = 'active' AND entity_type IS NOT NULL AND entity_id IS NOT NULL;
CREATE UNIQUE INDEX uq_wiki_pages_entity_slug ON wiki_pages(slug)
	WHERE page_type = 'entity' AND identity_status = 'active';

CREATE TABLE wiki_identity_mappings (
	entity_type TEXT NOT NULL,
	legacy_id TEXT NOT NULL,
	resolution TEXT NOT NULL CHECK (resolution IN ('unique', 'ambiguous', 'missing', 'owner_mismatch')),
	owner_mod_id TEXT,
	canonical_id TEXT,
	candidates_json TEXT NOT NULL,
	catalog_hash TEXT NOT NULL,
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	PRIMARY KEY (entity_type, legacy_id)
);

CREATE TABLE wiki_identity_archives (
	page_id TEXT PRIMARY KEY REFERENCES wiki_pages(id) ON DELETE RESTRICT,
	entity_type TEXT NOT NULL,
	legacy_id TEXT NOT NULL,
	original_mod_id TEXT,
	original_entity_mod_id TEXT,
	original_slug TEXT NOT NULL,
	reason TEXT NOT NULL,
	candidates_json TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE wiki_comment_identity_archives (
	comment_id TEXT PRIMARY KEY REFERENCES comments(id) ON DELETE RESTRICT,
	legacy_target_id TEXT NOT NULL,
	reason TEXT NOT NULL,
	candidates_json TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE wiki_identity_runs (
	catalog_hash TEXT PRIMARY KEY,
	completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE wiki_identity_current (
	id INTEGER PRIMARY KEY CHECK (id=1),
	catalog_hash TEXT NOT NULL
);
