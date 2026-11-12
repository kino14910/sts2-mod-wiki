import type { DiffResult, RevisionView, SectionEditResult } from '#lib/wiki-collaboration'
import { diffLines } from '#lib/wiki-diff'
import { requirePermission, WikiCollaborationError, type MaybeActor } from './access'
import type { WikiEditStore } from './collaboration-types'
import { toRevisionView } from './collaboration-view'
import { publishRevision } from './publish-service'
import { MAX_EDIT_SUMMARY_LENGTH } from './edit-service'

export interface RevisionDiffView {
	revision: RevisionView
	/** Content of the parent revision (empty string for the first revision). */
	parentContent: string
	diff: DiffResult
}

export async function listSectionHistory(
	store: WikiEditStore,
	sectionId: string,
	limit = 30,
	offset = 0
): Promise<RevisionView[]> {
	const rows = await store.listRevisions(
		sectionId,
		Math.min(100, Math.max(1, Math.trunc(limit))),
		Math.max(0, Math.trunc(offset))
	)
	return rows.map(toRevisionView)
}

export async function getRevisionDiff(
	store: WikiEditStore,
	sectionId: string,
	revisionId: string
): Promise<RevisionDiffView | null> {
	const revision = await store.findRevision(revisionId)
	if (!revision || revision.sectionId !== sectionId) return null
	const parent = revision.parentRevisionId
		? await store.findRevision(revision.parentRevisionId)
		: null
	const parentContent = parent?.content ?? ''
	return {
		revision: toRevisionView(revision),
		parentContent,
		diff: diffLines(parentContent, revision.content)
	}
}

export interface RevertInput {
	sectionId: string
	revisionId: string
	summary?: unknown
	actor: MaybeActor
}

/** A rollback is a NEW published revision that copies historical content. History is never deleted. */
export async function revertToRevision(
	store: WikiEditStore,
	input: RevertInput
): Promise<SectionEditResult> {
	const actor = requirePermission(input.actor, 'wiki:revision:revert')
	if (!input.sectionId || !input.revisionId)
		throw new WikiCollaborationError(400, 'sectionId and revisionId are required', 'BAD_INPUT')
	const summaryValue = typeof input.summary === 'string' ? input.summary : ''
	const summary = (`Rollback to ${input.revisionId}` + (summaryValue.trim() ? `: ${summaryValue.trim()}` : '')).slice(
		0,
		MAX_EDIT_SUMMARY_LENGTH
	)

	const revision = await store.findRevision(input.revisionId)
	if (!revision || revision.sectionId !== input.sectionId)
		throw new WikiCollaborationError(404, 'Revision not found for this section', 'NOT_FOUND')
	const section = await store.findSection(input.sectionId)
	if (!section) throw new WikiCollaborationError(404, 'Section not found', 'SECTION_NOT_FOUND')
	if (section.currentContent === revision.content)
		throw new WikiCollaborationError(400, 'Content already matches this revision', 'NO_CHANGES')

	const published = await publishRevision(store, {
		sectionId: input.sectionId,
		expectedVersion: section.version,
		content: revision.content,
		summary,
		editorId: actor.userId,
		sourceType: 'rollback',
		sourceReference: revision.id,
		actorId: actor.userId,
		action: 'wiki.section.rollback'
	})
	return {
		kind: 'published',
		sectionId: input.sectionId,
		version: published.version,
		revisionId: published.revisionId,
		proposalId: null
	}
}
