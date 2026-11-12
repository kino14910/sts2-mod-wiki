import type { SectionEditResult } from '#lib/wiki-collaboration'
import { hasPermission } from '#lib/server/auth/permissions'
import { requirePermission, WikiCollaborationError, type MaybeActor } from './access'
import type { WikiEditStore } from './collaboration-types'
import { publishRevision } from './publish-service'
import { validateWikiContent } from './validation'

export const MAX_EDIT_SUMMARY_LENGTH = 500

export interface SubmitEditInput {
	sectionId: unknown
	content: unknown
	baseVersion: unknown
	summary?: unknown
	actor: MaybeActor
}

function normalizeSummary(value: unknown): string {
	if (value === undefined || value === null || value === '') return ''
	if (typeof value !== 'string') throw new WikiCollaborationError(400, 'Invalid summary', 'BAD_SUMMARY')
	const summary = value.replace(/\r\n?/g, '\n').trim()
	if (summary.length > MAX_EDIT_SUMMARY_LENGTH)
		throw new WikiCollaborationError(400, 'Summary is too long', 'BAD_SUMMARY')
	if (/[\u0000-\u001f\u007f]/.test(summary.replaceAll('\n', '')))
		throw new WikiCollaborationError(400, 'Summary contains control characters', 'BAD_SUMMARY')
	return summary
}

function normalizeBaseVersion(value: unknown): number {
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
		throw new WikiCollaborationError(400, 'baseVersion must be a non-negative integer', 'BAD_VERSION')
	return value
}

/**
 * One section, one submission. Members create a pending proposal; trusted users publish
 * immediately. Both paths go through the same optimistic version check.
 */
export async function submitSectionEdit(
	store: WikiEditStore,
	input: SubmitEditInput
): Promise<SectionEditResult> {
	const actor = requirePermission(input.actor, 'wiki:proposal:create')
	if (typeof input.sectionId !== 'string' || input.sectionId.length === 0 || input.sectionId.length > 191)
		throw new WikiCollaborationError(400, 'Invalid section id', 'BAD_SECTION')
	if (typeof input.content !== 'string')
		throw new WikiCollaborationError(400, 'content must be a string', 'BAD_CONTENT')
	const contentError = validateWikiContent(input.content)
	if (contentError) throw new WikiCollaborationError(400, contentError, 'BAD_CONTENT')
	const content = input.content.replace(/\r\n?/g, '\n')
	const summary = normalizeSummary(input.summary)
	const baseVersion = normalizeBaseVersion(input.baseVersion)

	const section = await store.findSection(input.sectionId)
	if (!section) throw new WikiCollaborationError(404, 'Section not found', 'SECTION_NOT_FOUND')
	if (section.version !== baseVersion)
		throw new WikiCollaborationError(
			409,
			'Section changed while editing; reload the section and retry',
			'VERSION_CONFLICT'
		)
	if (content === section.currentContent)
		throw new WikiCollaborationError(400, 'No changes to submit', 'NO_CHANGES')

	if (!hasPermission(actor, 'wiki:revision:publish')) {
		const proposalId = crypto.randomUUID()
		await store.insertProposal({
			id: proposalId,
			sectionId: section.id,
			baseRevisionId: section.currentRevisionId,
			baseVersion,
			proposedContent: content,
			summary,
			submittedBy: actor.userId,
			createdAt: new Date().toISOString()
		})
		await store.insertAuditLog({
			id: crypto.randomUUID(),
			actorId: actor.userId,
			action: 'wiki.proposal.create',
			targetType: 'wiki_section',
			targetId: section.id,
			metadata: { proposalId, baseVersion }
		})
		return {
			kind: 'proposed',
			sectionId: section.id,
			version: section.version,
			revisionId: null,
			proposalId
		}
	}

	const published = await publishRevision(store, {
		sectionId: section.id,
		expectedVersion: baseVersion,
		content,
		summary,
		editorId: actor.userId,
		sourceType: 'community',
		sourceReference: null,
		actorId: actor.userId,
		action: 'wiki.section.publish.direct'
	})
	return {
		kind: 'published',
		sectionId: section.id,
		version: published.version,
		revisionId: published.revisionId,
		proposalId: null
	}
}
