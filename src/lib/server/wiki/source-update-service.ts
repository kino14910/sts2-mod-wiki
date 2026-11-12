import type { DiffResult, SourceUpdateStatus } from '#lib/wiki-collaboration'
import { diffLines } from '#lib/wiki-diff'
import { requirePermission, WikiCollaborationError, type MaybeActor } from './access'
import { createWikiEditStore } from './collaboration-repository'
import { publishRevision } from './publish-service'
import {
	findSourceBySection,
	findSourceUpdateById,
	insertAuditLog,
	setSourceUpdateReview,
	updateSourceSync
} from './repository'

export interface SourceUpdateDetail {
	id: string
	sourceId: string
	sectionId: string
	sectionKey: string
	sourcePath: string
	status: SourceUpdateStatus
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

	let publishedRevisionId: string | null = null
	if (input.decision === 'approve') {
		const source = await findSourceBySection(db, row.section_id)
		if (!source) throw new WikiCollaborationError(404, 'Source record not found', 'NOT_FOUND')
		if (section.currentContent !== row.incoming_content) {
			const published = await publishRevision(store, {
				sectionId: row.section_id,
				expectedVersion: section.version,
				content: row.incoming_content,
				summary: `Reviewed upstream update ${row.incoming_hash}`,
				editorId: actor.userId,
				sourceType: 'mod_update',
				sourceReference: source.source_path,
				actorId: actor.userId,
				action: 'wiki.source_update.approve'
			})
			publishedRevisionId = published.revisionId
		} else {
			publishedRevisionId = row.published_revision_id
		}
		await updateSourceSync(db, source.id, {
			hash: row.incoming_hash,
			content: row.incoming_content,
			modVersion: source.source_mod_version,
			status: 'active'
		})
	}

	const changes = await setSourceUpdateReview(db, row.id, {
		status: input.decision === 'approve' ? 'approved' : 'rejected',
		reviewedBy: actor.userId,
		reviewNote: note,
		publishedRevisionId
	})
	if (changes === 0)
		throw new WikiCollaborationError(409, 'Source update was resolved concurrently', 'ALREADY_REVIEWED')

	await insertAuditLog(db, {
		id: crypto.randomUUID(),
		actorId: actor.userId,
		action: `wiki.source_update.${input.decision}`,
		targetType: 'wiki_source_update',
		targetId: row.id,
		metadata: { sectionId: row.section_id, incomingHash: row.incoming_hash, publishedRevisionId, note }
	})

	const detail = await getSourceUpdateDetail(db, row.id)
	if (!detail) throw new WikiCollaborationError(404, 'Source update not found', 'NOT_FOUND')
	return detail
}
