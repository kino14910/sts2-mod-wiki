import { requirePermission, WikiCollaborationError, type MaybeActor } from './access'
import { isValidSectionKey } from './validation'

export async function addWikiSection(db: D1Database, actorInput: MaybeActor, input: {
	pageId: string; key: unknown; sortOrder?: unknown
}) {
	const actor = requirePermission(actorInput, 'wiki:section:manage')
	if (typeof input.key !== 'string' || !isValidSectionKey(input.key))
		throw new WikiCollaborationError(400, 'Invalid section key', 'BAD_SECTION')
	if (input.sortOrder !== undefined && (typeof input.sortOrder !== 'number' || !Number.isSafeInteger(input.sortOrder)))
		throw new WikiCollaborationError(400, 'Invalid section order', 'BAD_INPUT')
	const page = await db.prepare(`SELECT id FROM wiki_pages WHERE id = ?
		AND NOT EXISTS (SELECT 1 FROM wiki_identity_archives a WHERE a.page_id = wiki_pages.id)`).bind(input.pageId).first()
	if (!page) throw new WikiCollaborationError(404, 'Page not found', 'NOT_FOUND')
	const sectionId = crypto.randomUUID(), revisionId = crypto.randomUUID(), now = new Date().toISOString()
	const results = await db.batch([
		db.prepare(`INSERT OR IGNORE INTO wiki_sections (id, page_id, section_key, content_type, sort_order)
			VALUES (?, ?, ?, 'markdown', ?)`).bind(sectionId, input.pageId, input.key, input.sortOrder ?? 0),
		db.prepare(`INSERT INTO wiki_revisions (id, section_id, revision_no, content, summary, editor_id, source_type, created_at)
			SELECT ?, id, 1, '', 'Community section created', ?, 'moderation', ? FROM wiki_sections WHERE id = ?`)
			.bind(revisionId, actor.userId, now, sectionId),
		db.prepare(`UPDATE wiki_sections SET current_revision_id = ?, version = 1 WHERE id = ?`)
			.bind(revisionId, sectionId),
		db.prepare(`INSERT INTO wiki_audit_logs (id, actor_id, action, target_type, target_id, metadata_json)
			SELECT ?, ?, 'wiki.section.create', 'wiki_section', id, ? FROM wiki_sections WHERE id = ?`)
			.bind(crypto.randomUUID(), actor.userId, JSON.stringify({ pageId: input.pageId, key: input.key }), sectionId)
	])
	if (!Number(results[0].meta?.changes ?? 0))
		throw new WikiCollaborationError(409, 'Section already exists', 'SECTION_EXISTS')
	return { sectionId, revisionId, key: input.key, contentType: 'markdown', version: 1 }
}
