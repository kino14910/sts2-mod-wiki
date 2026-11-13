import type { DiffResult, SourceUpdateStatus } from '#lib/wiki-collaboration'
import { diffLines } from '#lib/wiki-diff'
import { requirePermission, WikiCollaborationError, type MaybeActor } from './access'
import { createWikiEditStore } from './collaboration-repository'
import { publishRevision } from './publish-service'
import { normalizeBaseVersion } from './edit-service'
import {
	findSourceBySection,
	findSourceUpdateById
} from './repository'

export interface SourceUpdateDetail {
	id: string
	sourceId: string
	sectionId: string
	sectionKey: string
	sourcePath: string
	status: SourceUpdateStatus
	currentVersion: number
	baseContent: string
	currentContent: string
	incomingContent: string
	baseHash: string
	incomingHash: string
	createdAt: string
	reviewedAt: string | null
	reviewNote: string | null
	publishedRevisionId: string | null
	/** Upstream change relative to the last synced baseline. */
	upstreamDiff: DiffResult
	/** Conflict surface relative to what the community currently sees. */
	conflictDiff: DiffResult
	hasCommunityDrift: boolean
}

export async function getSourceUpdateDetail(
	db: D1Database,
	id: string
): Promise<SourceUpdateDetail | null> {
	const row = await findSourceUpdateById(db, id)
	if (!row) return null
	const store = createWikiEditStore(db)
	const [section, source] = await Promise.all([
		store.findSection(row.section_id),
		findSourceBySection(db, row.section_id)
	])
	const currentContent = section?.currentContent ?? row.current_content
	return {
		id: row.id,
		sourceId: row.source_id,
		sectionId: row.section_id,
		sectionKey: section?.sectionKey ?? row.section_id,
		sourcePath: source?.source_path ?? '',
		status: row.status,
		currentVersion: section?.version ?? 0,
		baseContent: row.base_content,
		currentContent,
		incomingContent: row.incoming_content,
		baseHash: row.base_hash,
		incomingHash: row.incoming_hash,
		createdAt: row.created_at,
		reviewedAt: row.reviewed_at,
		reviewNote: row.review_note,
		publishedRevisionId: row.published_revision_id,
		upstreamDiff: diffLines(row.base_content, row.incoming_content),
		conflictDiff: diffLines(currentContent, row.incoming_content),
		hasCommunityDrift: currentContent !== row.base_content
	}
}

export interface ResolveSourceUpdateInput {
	id: string
	decision: unknown
	note?: unknown
	baseVersion?: unknown
	actor: MaybeActor
}

/**
 * Human resolution of an upstream conflict. Approval is the ONLY path that can overwrite
 * community content with upstream content; the sync script never does it automatically.
 * Rejection keeps both the published content and the old source snapshot untouched.
 */
export async function resolveSourceUpdate(
	db: D1Database,
	input: ResolveSourceUpdateInput
): Promise<SourceUpdateDetail> {
	const actor = requirePermission(input.actor, 'wiki:source:review')
	if (input.decision !== 'approve' && input.decision !== 'reject')
		throw new WikiCollaborationError(400, 'decision must be approve or reject', 'BAD_DECISION')
	const note =
		typeof input.note === 'string' ? input.note.trim().slice(0, 500) || null : null

	const row = await findSourceUpdateById(db, input.id)
	if (!row) throw new WikiCollaborationError(404, 'Source update not found', 'NOT_FOUND')
	if (row.status !== 'pending' && row.status !== 'conflict')
		throw new WikiCollaborationError(409, 'Source update was already resolved', 'ALREADY_REVIEWED')

	const store = createWikiEditStore(db)
	const section = await store.findSection(row.section_id)
	if (!section) throw new WikiCollaborationError(404, 'Section not found', 'SECTION_NOT_FOUND')

	if (input.decision === 'approve') {
		const baseVersion = normalizeBaseVersion(input.baseVersion)
		if (section.version !== baseVersion)
			throw new WikiCollaborationError(409, 'Section changed since this update was reviewed', 'VERSION_CONFLICT')
		const source = await findSourceBySection(db, row.section_id)
		if (!source) throw new WikiCollaborationError(404, 'Source record not found', 'NOT_FOUND')
		if (source.id !== row.source_id || source.source_hash !== row.base_hash || source.source_status !== 'active')
			throw new WikiCollaborationError(409, 'Source baseline changed; reload the update', 'SOURCE_CONFLICT')
		await publishRevision(store, {
				sectionId: row.section_id,
				expectedVersion: baseVersion,
				content: row.incoming_content,
				summary: `Reviewed upstream update ${row.incoming_hash}`,
				editorId: actor.userId,
				sourceType: 'mod_update',
				sourceReference: source.source_path,
				actorId: actor.userId,
				action: 'wiki.source_update.approve',
				reviewNote: note,
				sourceUpdate: {
					id: row.id, sourceId: row.source_id, baseHash: row.base_hash,
					incomingHash: row.incoming_hash, modVersion: row.incoming_mod_version ?? null
				}
			})
	} else {
		const now = new Date().toISOString()
		const results = await db.batch([
			db.prepare(`UPDATE wiki_source_updates SET status = 'rejected', reviewed_by = ?,
				review_note = ?, reviewed_at = ? WHERE id = ? AND status IN ('pending', 'conflict')`)
				.bind(actor.userId, note, now, row.id),
			db.prepare(`INSERT INTO wiki_audit_logs (id, actor_id, action, target_type, target_id, metadata_json)
				SELECT ?, ?, 'wiki.source_update.reject', 'wiki_source_update', ?, ? WHERE changes() = 1`)
				.bind(crypto.randomUUID(), actor.userId, row.id, JSON.stringify({ note, sectionId: row.section_id }))
		])
		if (Number(results[0].meta?.changes ?? 0) !== 1)
			throw new WikiCollaborationError(409, 'Source update was resolved concurrently', 'ALREADY_REVIEWED')
	}

	const detail = await getSourceUpdateDetail(db, row.id)
	if (!detail) throw new WikiCollaborationError(404, 'Source update not found', 'NOT_FOUND')
	return detail
}
