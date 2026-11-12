// Shared wiki collaboration contracts. Server imports only; no runtime dependencies.
import type { RevisionSourceType } from '#lib/entities'

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'conflict' | 'withdrawn'
export type SourceUpdateStatus = ProposalStatus
export type DiffLineType = 'equal' | 'add' | 'remove'

export interface DiffLine {
	type: DiffLineType
	text: string
	oldNumber: number | null
	newNumber: number | null
}

export interface DiffResult {
	lines: DiffLine[]
	additions: number
	deletions: number
	truncated: boolean
}

export interface RevisionView {
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

export interface ProposalView {
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
	/** Diff between the published content at read time and the proposed content. */
	diff: DiffResult | null
}

export interface SectionEditResult {
	kind: 'published' | 'proposed'
	sectionId: string
	version: number
	revisionId: string | null
	proposalId: string | null
}

export interface WikiViewer {
	session: {
		userId: string
		username: string
		role: 'member' | 'trusted' | 'moderator' | 'admin'
		status: 'active' | 'suspended'
	} | null
	permissions: string[]
}
