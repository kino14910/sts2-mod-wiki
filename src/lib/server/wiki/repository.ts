import type { CommentTargetType } from '#lib/comments'
import { resolvePublicEntityRef, type EntityRef, type PageType, type RevisionSourceType } from '#lib/entities'
import { CommentError, COMMENT_RATE_LIMIT_PER_IP, COMMENT_RATE_LIMIT_PER_TOKEN } from './comment-service'
import type {
	CommentInsert,
	CommentRow,
	CommentStore,
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
	'id, source_id, section_id, base_content, current_content, incoming_content, base_hash, incoming_hash, incoming_mod_version, status, reviewed_by, review_note, created_at, reviewed_at, published_revision_id'
const COMMENT_COLUMNS =
	'id, target_type, target_id, parent_id, author_name, author_token_hash, author_ip_hash, content, status, created_at, updated_at'

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
	const resolved = resolvePublicEntityRef(ref)
	const scopedId = resolved ? `${resolved.modId}:${resolved.id}` : ref.id
	return db
		.prepare(
			`SELECT ${PAGE_COLUMNS} FROM wiki_pages WHERE page_type = 'entity' AND entity_type = ? AND entity_id IN (?, ?)
			AND NOT EXISTS (SELECT 1 FROM wiki_identity_archives a WHERE a.page_id = wiki_pages.id)
			ORDER BY CASE WHEN entity_id = ? THEN 0 ELSE 1 END LIMIT 1`
		)
		.bind(ref.type, ref.id, scopedId, scopedId)
		.first<WikiPageRow>()
}

export async function findPageByModSlug(
	db: D1Database,
	modId: string,
	slug: string
): Promise<WikiPageRow | null> {
	return db
		.prepare(
			`SELECT ${PAGE_COLUMNS} FROM wiki_pages WHERE page_type = 'mod' AND mod_id = ? AND slug = ?
			AND NOT EXISTS (SELECT 1 FROM wiki_identity_archives a WHERE a.page_id = wiki_pages.id) LIMIT 1`
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

export async function findSourceUpdateById(
	db: D1Database,
	id: string
): Promise<WikiSourceUpdateRow | null> {
	return db
		.prepare(`SELECT ${UPDATE_COLUMNS} FROM wiki_source_updates WHERE id = ? LIMIT 1`)
		.bind(id)
		.first<WikiSourceUpdateRow>()
}

export async function setSourceUpdateReview(
	db: D1Database,
	id: string,
	input: {
		status: SourceUpdateStatus
		reviewedBy: string
		reviewNote: string | null
		publishedRevisionId: string | null
	}
): Promise<number> {
	const result = await db
		.prepare(
			`UPDATE wiki_source_updates
			SET status = ?, reviewed_by = ?, review_note = ?, reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), published_revision_id = ?
			WHERE id = ? AND status IN ('pending', 'conflict')`
		)
		.bind(input.status, input.reviewedBy, input.reviewNote, input.publishedRevisionId, id)
		.run()
	return Number(result.meta?.changes ?? 0)
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

async function countRows(db: D1Database, sql: string, ...params: unknown[]): Promise<number> {
	const row = await db
		.prepare(sql)
		.bind(...params)
		.first<{ value: number }>()
	return Number(row?.value ?? 0)
}

export function createCommentStore(db: D1Database): CommentStore {
	return {
		async listTopLevel({ targetType, targetId, limit, offset }): Promise<CommentRow[]> {
			const { results } = await db
				.prepare(
					`SELECT ${COMMENT_COLUMNS} FROM comments
					WHERE target_type = ? AND target_id = ? AND parent_id IS NULL
					AND NOT EXISTS (SELECT 1 FROM wiki_comment_identity_archives a WHERE a.comment_id = comments.id)
					ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`
				)
				.bind(targetType, targetId, limit, offset)
				.all<CommentRow>()
			return results
		},

		async listReplies(parentIds: string[]): Promise<CommentRow[]> {
			if (parentIds.length === 0) return []
			const placeholders = parentIds.map(() => '?').join(', ')
			const { results } = await db
				.prepare(
					`SELECT ${COMMENT_COLUMNS} FROM comments WHERE parent_id IN (${placeholders}) ORDER BY created_at, id`
				)
				.bind(...parentIds)
				.all<CommentRow>()
			return results
		},

		countTopLevel(targetType: CommentTargetType, targetId: string): Promise<number> {
			return countRows(
				db,
				`SELECT COUNT(*) AS value FROM comments WHERE target_type = ? AND target_id = ? AND parent_id IS NULL
				AND NOT EXISTS (SELECT 1 FROM wiki_comment_identity_archives a WHERE a.comment_id = comments.id)`,
				targetType,
				targetId
			)
		},

		async findComment(id: string): Promise<CommentRow | null> {
			return db
				.prepare(`SELECT ${COMMENT_COLUMNS} FROM comments WHERE id = ? LIMIT 1`)
				.bind(id)
				.first<CommentRow>()
		},

		async targetExists(targetType: CommentTargetType, targetId: string): Promise<boolean> {
			if (targetType === 'card') return true
			const row = await db
				.prepare('SELECT 1 AS present FROM wiki_sections WHERE id = ? LIMIT 1')
				.bind(targetId)
				.first<{ present: number }>()
			return row !== null
		},

		countRecentByToken(tokenHash: string, since: string): Promise<number> {
			return countRows(
				db,
				'SELECT COUNT(*) AS value FROM comments WHERE author_token_hash = ? AND created_at >= ?',
				tokenHash,
				since
			)
		},

		countRecentByIp(ipHash: string, since: string): Promise<number> {
			return countRows(
				db,
				'SELECT COUNT(*) AS value FROM comments WHERE author_ip_hash = ? AND created_at >= ?',
				ipHash,
				since
			)
		},

		async insertComment(input: CommentInsert): Promise<void> {
			// Count and insertion form one SQL statement, so parallel requests cannot all pass
			// a separate rate check before any insert is visible.
			const result = await db
				.prepare(
					`INSERT INTO comments (id, target_type, target_id, parent_id, author_name, author_token_hash, author_ip_hash, content)
					SELECT ?, ?, ?, ?, ?, ?, ?, ?
					WHERE (SELECT COUNT(*) FROM comments WHERE author_token_hash = ?
					AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-60 seconds')) < ?
					AND (? IS NULL OR (SELECT COUNT(*) FROM comments WHERE author_ip_hash = ?
					AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-60 seconds')) < ?)`
				)
				.bind(
					input.id,
					input.targetType,
					input.targetId,
					input.parentId,
					input.authorName,
					input.authorTokenHash,
					input.authorIpHash,
					input.content,
					input.authorTokenHash, COMMENT_RATE_LIMIT_PER_TOKEN,
					input.authorIpHash, input.authorIpHash, COMMENT_RATE_LIMIT_PER_IP
				)
				.run()
			if (!Number(result.meta?.changes ?? 0)) throw new CommentError(429, 'comment rate limit exceeded')
		},

		async updateContent(id: string, tokenHash: string, content: string, expected): Promise<number> {
			const result = await db
				.prepare(
					`UPDATE comments SET content = ?, updated_at = CASE
					WHEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') <= updated_at THEN strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0.001 seconds')
					ELSE strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END
					WHERE id = ? AND author_token_hash = ? AND status = 'visible'
					AND (? IS NULL OR (updated_at = ? AND content = ?))`
				)
				.bind(content, id, tokenHash, expected?.updatedAt ?? null, expected?.updatedAt ?? null, expected?.content ?? null)
				.run()
			return Number(result.meta?.changes ?? 0)
		},

		async softDelete(id: string, tokenHash: string): Promise<number> {
			const results = await db.batch([
				db.prepare(`UPDATE comments SET status = 'deleted', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
					WHERE id = ? AND author_token_hash = ? AND status = 'visible'`).bind(id, tokenHash),
				db.prepare(`INSERT INTO wiki_audit_logs (id, actor_id, action, target_type, target_id, metadata_json)
					SELECT ?, NULL, 'comment.delete', 'comment', id,
					json_object('targetType', target_type, 'targetId', target_id, 'authorName', author_name)
					FROM comments WHERE id = ? AND changes() = 1`).bind(crypto.randomUUID(), id)
			])
			return Number(results[0].meta?.changes ?? 0)
		},

		async insertAuditLog(input): Promise<void> {
			await insertAuditLog(db, input)
		}
	}
}
