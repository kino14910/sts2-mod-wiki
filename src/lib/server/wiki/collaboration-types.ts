import type { RevisionSourceType } from '#lib/entities'
import type { ProposalStatus } from '#lib/wiki-collaboration'
import type { ContentType } from './types'

export interface SectionState {
	id: string
	pageId: string
	sectionKey: string
	contentType: ContentType
	sortOrder: number
	version: number
	currentRevisionId: string | null
	currentContent: string
	updatedAt: string
}

export interface RevisionState {
	id: string
	sectionId: string
	revisionNo: number
	parentRevisionId: string | null
	content: string
	summary: string
	editorId: string | null
	editorName: string | null
	sourceType: RevisionSourceType
	sourceReference: string | null
	createdAt: string
}

export interface ProposalState {
	id: string
	sectionId: string
	sectionKey: string
	baseRevisionId: string | null
	baseVersion: number
	proposedContent: string
	currentContent: string
	summary: string
	submittedBy: string
	submittedByName: string
	status: ProposalStatus
	reviewedBy: string | null
	reviewedByName: string | null
	reviewNote: string | null
	createdAt: string
	reviewedAt: string | null
	publishedRevisionId: string | null
}

export interface NewProposal {
	id: string
	sectionId: string
	baseRevisionId: string | null
	baseVersion: number
	proposedContent: string
	summary: string
	submittedBy: string
	createdAt: string
}

export interface ProposalStatusUpdate {
	status: ProposalStatus
	reviewedBy?: string | null
	reviewedByName?: string | null
	reviewNote?: string | null
	reviewedAt?: string | null
	publishedRevisionId?: string | null
	/** Optimistic guard: only update a proposal that is still in this state. */
	onlyIfStatus?: ProposalStatus
}

export interface PublishInput {
	revisionId: string
	sectionId: string
	revisionNo: number
	parentRevisionId: string | null
	content: string
	summary: string
	editorId: string | null
	sourceType: RevisionSourceType
	sourceReference: string | null
	expectedVersion: number
	createdAt: string
	/** Set when approval publishes a member proposal. */
	proposalId?: string | null
	reviewNote?: string | null
	actorId?: string | null
	action?: string
}

export interface PublishResult {
	published: boolean
	version: number
	/** True when the conditional version check failed; no revision remains linked. */
	conflict: boolean
}

export interface WikiEditStore {
	findSection(sectionId: string): Promise<SectionState | null>
	findRevision(revisionId: string): Promise<RevisionState | null>
	listRevisions(sectionId: string, limit: number, offset: number): Promise<RevisionState[]>
	maxRevisionNo(sectionId: string): Promise<number>
	listProposals(filter: {
		status?: ProposalStatus[]
		sectionId?: string | null
		limit: number
		offset: number
	}): Promise<ProposalState[]>
	findProposal(proposalId: string): Promise<ProposalState | null>
	insertProposal(input: NewProposal): Promise<void>
	setProposalStatus(proposalId: string, update: ProposalStatusUpdate): Promise<number>
	publish(input: PublishInput): Promise<PublishResult>
	insertAuditLog(input: {
		id: string
		actorId: string | null
		action: string
		targetType: string
		targetId: string
		metadata?: unknown
	}): Promise<void>
}
