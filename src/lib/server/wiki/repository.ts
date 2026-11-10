import type { EntityRef, PageType, RevisionSourceType } from '#lib/entities'
import type {
	ContentType,
	SourceStatus,
	SourceUpdateStatus,
	WikiPageRow,
	WikiRevisionRow,
	WikiSectionRow,
	WikiSectionSourceRow,
	WikiSourceUpdateRow
} from './types'

const PAGE_COLUMNS = 'id, mod_id, entity_type, entity_id, slug, page_type, created_at'
const SECTION_COLUMNS =
	'id, page_id, section_key, content_type, sort_order, current_revision_id, version, updated_at'
const REVISION_COLUMNS =
	'id, section_id, revision_no, parent_revision_id, content, summary, editor_id, source_type, source_reference, created_at'
const SOURCE_COLUMNS =
	'id, section_id, source_type, source_path, source_hash, source_content, source_mod_version, source_status, last_synced_at, created_at, updated_at'
const UPDATE_COLUMNS =
	'id, source_id, section_id, base_content, current_content, incoming_content, base_hash, incoming_hash, status, reviewed_by, review_note, created_at, reviewed_at, published_revision_id'

export interface PageInsert {
	id: string
	modId: string | null
	entityType: string | null
	entityId: string | null
	slug: string
	pageType: PageType
}

export interface RevisionInsert {
	id: string
	sectionId: string
	revisionNo: number
	parentRevisionId: string | null
	content: string
	summary: string
	editorId: string | null
	sourceType: RevisionSourceType
	sourceReference?: string | null
}

export interface SourceInsert {
	id: string
	sectionId: string
	sourcePath: string
	sourceHash: string
	sourceContent: string
	modVersion: string | null
}

export interface SourceUpdateInsert {
	id: string
	sourceId: string
	sectionId: string
	baseContent: string
	currentContent: string
	incomingContent: string
	baseHash: string
	incomingHash: string
	status: SourceUpdateStatus
}

export async function findPageByEntity(
	db: D1Database,
	ref: EntityRef
): Promise<WikiPageRow | null> {
	return db
		.prepare(
			`SELECT ${PAGE_COLUMNS} FROM wiki_pages WHERE page_type = 'entity' AND entity_type = ? AND entity_id = ? LIMIT 1`
		)
		.bind(ref.type, ref.id)
		.first<WikiPageRow>()
}

export async function findPageByModSlug(
	db: D1Database,
	modId: string,
	slug: string
): Promise<WikiPageRow | null> {
	return db
		.prepare(
			`SELECT ${PAGE_COLUMNS} FROM wiki_pages WHERE page_type = 'mod' AND mod_id = ? AND slug = ? LIMIT 1`
		)
		.bind(modId, slug)
		.first<WikiPageRow>()
}

export async function listSectionsByPage(
	db: D1Database,
	pageId: string
): Promise<WikiSectionRow[]> {
	const { results } = await db
		.prepare(
			`SELECT ${SECTION_COLUMNS} FROM wiki_sections WHERE page_id = ? ORDER BY sort_order, section_key`
		)
		.bind(pageId)
		.all<WikiSectionRow>()
	return results
}

export async function findSectionByKey(
	db: D1Database,
	pageId: string,
	sectionKey: string
): Promise<WikiSectionRow | null> {
	return db
		.prepare(
			`SELECT ${SECTION_COLUMNS} FROM wiki_sections WHERE page_id = ? AND section_key = ? LIMIT 1`
		)
		.bind(pageId, sectionKey)
		.first<WikiSectionRow>()
}

export async function findRevisionsByIds(
	db: D1Database,
	ids: string[]
): Promise<Map<string, WikiRevisionRow>> {
	if (ids.length === 0) return new Map()
	const placeholders = ids.map(() => '?').join(', ')
	const { results } = await db
		.prepare(`SELECT ${REVISION_COLUMNS} FROM wiki_revisions WHERE id IN (${placeholders})`)
		.bind(...ids)
		.all<WikiRevisionRow>()
	return new Map(results.map((row) => [row.id, row]))
}

export async function listRevisionsBySection(
	db: D1Database,
	sectionId: string,
	limit = 50,
	offset = 0
): Promise<WikiRevisionRow[]> {
	const { results } = await db
		.prepare(
			`SELECT ${REVISION_COLUMNS} FROM wiki_revisions WHERE section_id = ? ORDER BY revision_no DESC LIMIT ? OFFSET ?`
		)
		.bind(sectionId, limit, offset)
		.all<WikiRevisionRow>()
	return results
}

export async function maxRevisionNo(db: D1Database, sectionId: string): Promise<number> {
	const row = await db
		.prepare('SELECT COALESCE(MAX(revision_no), 0) AS value FROM wiki_revisions WHERE section_id = ?')
		.bind(sectionId)
		.first<{ value: number }>()
	return Number(row?.value ?? 0)
}

export async function insertPage(db: D1Database, input: PageInsert): Promise<void> {
	await db
		.prepare(
			'INSERT INTO wiki_pages (id, mod_id, entity_type, entity_id, slug, page_type) VALUES (?, ?, ?, ?, ?, ?)'
		)
		.bind(
			input.id,
			input.modId,
			input.entityType,
			input.entityId,
			input.slug,
			input.pageType
		)
		.run()
}

export async function insertSection(
	db: D1Database,
	input: {
		id: string
		pageId: string
		key: string
		contentType: ContentType
		sortOrder: number
	}
): Promise<void> {
	await db
		.prepare(
			'INSERT INTO wiki_sections (id, page_id, section_key, content_type, sort_order) VALUES (?, ?, ?, ?, ?)'
		)
		.bind(input.id, input.pageId, input.key, input.contentType, input.sortOrder)
		.run()
}

export async function insertRevision(db: D1Database, input: RevisionInsert): Promise<void> {
	await db
		.prepare(
			'INSERT INTO wiki_revisions (id, section_id, revision_no, parent_revision_id, content, summary, editor_id, source_type, source_reference) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
		)
		.bind(
			input.id,
			input.sectionId,
			input.revisionNo,
			input.parentRevisionId,
			input.content,
			input.summary,
			input.editorId,
			input.sourceType,
			input.sourceReference ?? null
		)
		.run()
}

// A conditional UPDATE that affects zero rows is not an error in D1, so callers must inspect `changes`.
export async function linkCurrentRevision(
	db: D1Database,
	sectionId: string,
	expectedVersion: number,
	revisionId: string
): Promise<number> {
	const result = await db
		.prepare(
			'UPDATE wiki_sections SET current_revision_id = ?, version = version + 1, updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\') WHERE id = ? AND version = ?'
		)
		.bind(revisionId, sectionId, expectedVersion)
		.run()
	return Number(result.meta?.changes ?? 0)
}

export interface SourceOverviewRow extends WikiSectionSourceRow {
	section_key: string
	page_id: string
	slug: string
	mod_id: string | null
	version: number
	current_revision_id: string | null
	current_content: string | null
}

export async function listSourceOverviewRows(
	db: D1Database
): Promise<SourceOverviewRow[]> {
	const { results } = await db
		.prepare(
			`SELECT src.id, src.section_id, src.source_type, src.source_path, src.source_hash, src.source_content,
				src.source_mod_version, src.source_status, src.last_synced_at, src.created_at, src.updated_at,
				sec.section_key, sec.page_id, sec.version, sec.current_revision_id,
				p.slug, p.mod_id, rev.content AS current_content
			FROM wiki_section_sources src
			JOIN wiki_sections sec ON sec.id = src.section_id
			JOIN wiki_pages p ON p.id = sec.page_id
			LEFT JOIN wiki_revisions rev ON rev.id = sec.current_revision_id
			ORDER BY src.source_path`
		)
		.all<SourceOverviewRow>()
	return results
}

export async function findSourceByPath(
	db: D1Database,
	sourcePath: string
): Promise<WikiSectionSourceRow | null> {
	return db
		.prepare(`SELECT ${SOURCE_COLUMNS} FROM wiki_section_sources WHERE source_path = ? LIMIT 1`)
		.bind(sourcePath)
		.first<WikiSectionSourceRow>()
}

export async function findSourceBySection(
	db: D1Database,
	sectionId: string
): Promise<WikiSectionSourceRow | null> {
	return db
		.prepare(`SELECT ${SOURCE_COLUMNS} FROM wiki_section_sources WHERE section_id = ? LIMIT 1`)
		.bind(sectionId)
		.first<WikiSectionSourceRow>()
}

export async function listSources(db: D1Database): Promise<WikiSectionSourceRow[]> {
	const { results } = await db
		.prepare(`SELECT ${SOURCE_COLUMNS} FROM wiki_section_sources ORDER BY source_path`)
		.all<WikiSectionSourceRow>()
	return results
}

export async function insertSource(db: D1Database, input: SourceInsert): Promise<void> {
	await db
		.prepare(
			'INSERT INTO wiki_section_sources (id, section_id, source_path, source_hash, source_content, source_mod_version) VALUES (?, ?, ?, ?, ?, ?)'
		)
		.bind(
			input.id,
			input.sectionId,
			input.sourcePath,
			input.sourceHash,
			input.sourceContent,
			input.modVersion
		)
		.run()
}

export async function updateSourceSync(
	db: D1Database,
	id: string,
	input: {
		hash: string
		content: string
		modVersion: string | null
		status: SourceStatus
	}
): Promise<void> {
	await db
		.prepare(
			'UPDATE wiki_section_sources SET source_hash = ?, source_content = ?, source_mod_version = ?, source_status = ?, last_synced_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\'), updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\') WHERE id = ?'
		)
		.bind(input.hash, input.content, input.modVersion, input.status, id)
		.run()
}

export async function findOpenSourceUpdate(
	db: D1Database,
	sourceId: string,
	incomingHash: string
): Promise<WikiSourceUpdateRow | null> {
	return db
		.prepare(
			`SELECT ${UPDATE_COLUMNS} FROM wiki_source_updates WHERE source_id = ? AND incoming_hash = ? AND status IN ('pending', 'conflict') LIMIT 1`
		)
		.bind(sourceId, incomingHash)
		.first<WikiSourceUpdateRow>()
}

export async function insertSourceUpdate(
	db: D1Database,
	input: SourceUpdateInsert
): Promise<void> {
	await db
		.prepare(
			'INSERT INTO wiki_source_updates (id, source_id, section_id, base_content, current_content, incoming_content, base_hash, incoming_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
		)
		.bind(
			input.id,
			input.sourceId,
			input.sectionId,
			input.baseContent,
			input.currentContent,
			input.incomingContent,
			input.baseHash,
			input.incomingHash,
			input.status
		)
		.run()
}

export async function listSourceUpdates(
	db: D1Database,
	limit = 50
): Promise<WikiSourceUpdateRow[]> {
	const { results } = await db
		.prepare(
			`SELECT ${UPDATE_COLUMNS} FROM wiki_source_updates ORDER BY created_at DESC LIMIT ?`
		)
		.bind(limit)
		.all<WikiSourceUpdateRow>()
	return results
}

export async function insertAuditLog(
	db: D1Database,
	input: {
		id: string
		actorId: string | null
		action: string
		targetType: string
		targetId: string
		metadata?: unknown
	}
): Promise<void> {
	await db
		.prepare(
			'INSERT INTO wiki_audit_logs (id, actor_id, action, target_type, target_id, metadata_json) VALUES (?, ?, ?, ?, ?, ?)'
		)
		.bind(
			input.id,
			input.actorId,
			input.action,
			input.targetType,
			input.targetId,
			JSON.stringify(input.metadata ?? {})
		)
		.run()
}
