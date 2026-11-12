import type { ProposalStatus, ProposalView } from '#lib/wiki-collaboration'
import { requirePermission, WikiCollaborationError, type MaybeActor } from './access'
import type { WikiEditStore } from './collaboration-types'
import { toProposalView } from './collaboration-view'
import { publishRevision } from './publish-service'

export const MAX_REVIEW_NOTE_LENGTH = 500

export interface ListProposalsInput {
	status?: ProposalStatus[]
	sectionId?: string | null
	limit?: number
	offset?: number
}

function normalizePaging(value: number | undefined, fallback: number, max: number): number {
	if (value === undefined || !Number.isFinite(value)) return fallback
	return Math.min(max, Math.max(1, Math.trunc(value)))
}

function normalizeNote(value: unknown): string {
	if (value === undefined || value === null || value === '') return ''
	if (typeof value !== 'string') throw new WikiCollaborationError(400, 'Invalid review note', 'BAD_NOTE')
	const note = value.replace(/\r\n?/g, '\n').trim()
	if (note.length > MAX_REVIEW_NOTE_LENGTH)
		throw new WikiCollaborationError(400, 'Review note is too long', 'BAD_NOTE')
	return note
}

export async function listProposals(
	store: WikiEditStore,
	input: ListProposalsInput = {}
): Promise<ProposalView[]> {
	const rows = await store.listProposals({
		status: input.status,
		sectionId: input.sectionId ?? null,
		limit: normalizePaging(input.limit, 30, 100),
		offset: Math.max(0, Math.trunc(input.offset ?? 0))
	})
	return rows.map((row) => toProposalView(row))
}

export async function getProposal(
	store: WikiEditStore,
	proposalId: string
): Promise<ProposalView | null> {
	const row = await store.findProposal(proposalId)
	return row ? toProposalView(row) : null
}

export interface ReviewProposalInput {
	proposalId: string
	decision: unknown
	note?: unknown
	actor: MaybeActor
}

/**
 * Approving publishes a NEW revision and records reviewer/time/result. Rejecting only changes
 * proposal status. A stale base_version is turned into a conflict instead of overwriting
 * content published during the review.
 */
export async function reviewProposal(
	store: WikiEditStore,
	input: ReviewProposalInput
): Promise<ProposalView> {
	const actor = requirePermission(input.actor, 'wiki:proposal:review')
	const note = normalizeNote(input.note)
	if (input.decision !== 'approve' && input.decision !== 'reject')
		throw new WikiCollaborationError(400, 'decision must be approve or reject', 'BAD_DECISION')
	if (!input.proposalId || input.proposalId.length > 191)
		throw new WikiCollaborationError(400, 'Invalid proposal id', 'BAD_PROPOSAL')

	const proposal = await store.findProposal(input.proposalId)
	if (!proposal) throw new WikiCollaborationError(404, 'Proposal not found', 'NOT_FOUND')
	if (proposal.status !== 'pending')
		throw new WikiCollaborationError(409, 'Proposal was already reviewed', 'ALREADY_REVIEWED')

	const section = await store.findSection(proposal.sectionId)
	if (!section) throw new WikiCollaborationError(404, 'Section not found', 'SECTION_NOT_FOUND')
	if (section.version !== proposal.baseVersion)
		return markConflict(store, proposal.id, actor.userId, section.version, proposal.baseVersion)

	const now = new Date().toISOString()
	if (input.decision === 'reject') {
		const changes = await store.setProposalStatus(proposal.id, {
			status: 'rejected',
			reviewedBy: actor.userId,
			reviewNote: note || null,
			reviewedAt: now,
			onlyIfStatus: 'pending'
		})
		if (changes === 0)
			throw new WikiCollaborationError(409, 'Proposal was reviewed concurrently', 'ALREADY_REVIEWED')
		await store.insertAuditLog({
			id: crypto.randomUUID(),
			actorId: actor.userId,
			action: 'wiki.proposal.reject',
			targetType: 'wiki_proposal',
			targetId: proposal.id,
			metadata: { sectionId: proposal.sectionId, note }
		})
	} else {
		try {
			await publishRevision(store, {
				sectionId: proposal.sectionId,
				expectedVersion: proposal.baseVersion,
				content: proposal.proposedContent,
				summary: proposal.summary,
				editorId: proposal.submittedBy,
				sourceType: 'community',
				sourceReference: `proposal:${proposal.id}`,
				actorId: actor.userId,
				action: 'wiki.proposal.approve',
				proposalId: proposal.id,
				reviewNote: note || null
			})
		} catch (cause) {
			if (cause instanceof WikiCollaborationError && cause.code === 'VERSION_CONFLICT')
				return markConflict(store, proposal.id, actor.userId, section.version, proposal.baseVersion)
			throw cause
		}
	}

	const updated = await store.findProposal(proposal.id)
	if (!updated) throw new WikiCollaborationError(404, 'Proposal not found', 'NOT_FOUND')
	return toProposalView(updated)
}

async function markConflict(
	store: WikiEditStore,
	proposalId: string,
	reviewerId: string,
	currentVersion: number,
	baseVersion: number
): Promise<ProposalView> {
	await store.setProposalStatus(proposalId, {
		status: 'conflict',
		reviewNote: `Published version changed from ${baseVersion} to ${currentVersion}`,
		// Status is informational here; the section was not published by this review.
		reviewedAt: new Date().toISOString(),
		reviewedBy: reviewerId,
		onlyIfStatus: 'pending'
	})
	await store.insertAuditLog({
		id: crypto.randomUUID(),
		actorId: reviewerId,
		action: 'wiki.proposal.conflict',
		targetType: 'wiki_proposal',
		targetId: proposalId,
		metadata: { currentVersion, baseVersion }
	})
	const row = await store.findProposal(proposalId)
	if (!row) throw new WikiCollaborationError(404, 'Proposal not found', 'NOT_FOUND')
	return toProposalView(row)
}
