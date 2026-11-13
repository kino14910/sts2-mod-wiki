import type { RevisionSourceType } from '#lib/entities'
import { WikiCollaborationError } from './access'
import type { PublishInput, WikiEditStore } from './collaboration-types'
import { validateSectionContent } from './content-validation'

export interface PublishRevisionInput {
	sectionId: string
	expectedVersion: number
	content: string
	summary: string
	editorId: string | null
	sourceType: RevisionSourceType
	sourceReference: string | null
	actorId?: string | null
	action?: string
	proposalId?: string | null
	reviewNote?: string | null
	createdAt?: string
	sourceUpdate?: PublishInput['sourceUpdate']
}

export interface PublishedRevision {
	revisionId: string
	version: number
	createdAt: string
}

/**
 * Single publishing path for direct edits, approved proposals, rollbacks and (future) upstream
 * approvals. The section version is the optimistic lock; a failure leaves no published revision.
 */
export async function publishRevision(
	store: WikiEditStore,
	input: PublishRevisionInput
): Promise<PublishedRevision> {
	const section = await store.findSection(input.sectionId)
	if (!section) throw new WikiCollaborationError(404, 'Section not found', 'SECTION_NOT_FOUND')
	validateSectionContent(section, input.content)
	if (section.version !== input.expectedVersion)
		throw new WikiCollaborationError(
			409,
			'Section changed while editing; reload and retry',
			'VERSION_CONFLICT'
		)

	const createdAt = input.createdAt ?? new Date().toISOString()
	const revisionNo = (await store.maxRevisionNo(input.sectionId)) + 1
	const revisionId = crypto.randomUUID()
	const result = await store.publish({
		revisionId,
		sectionId: input.sectionId,
		revisionNo,
		parentRevisionId: section.currentRevisionId,
		content: input.content,
		summary: input.summary,
		editorId: input.editorId,
		sourceType: input.sourceType,
		sourceReference: input.sourceReference,
		expectedVersion: input.expectedVersion,
		createdAt,
		proposalId: input.proposalId ?? null,
		reviewNote: input.reviewNote ?? null,
		actorId: input.actorId ?? null,
		action: input.action ?? 'wiki.section.publish',
		sourceUpdate: input.sourceUpdate
	})
	if (!result.published)
		throw new WikiCollaborationError(
			409,
			'Section changed while publishing; reload and retry',
			'VERSION_CONFLICT'
		)
	return { revisionId, version: result.version, createdAt }
}
