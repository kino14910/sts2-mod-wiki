import { diffLines } from '#lib/wiki-diff'
import type { ProposalView, RevisionView } from '#lib/wiki-collaboration'
import type { ProposalState, RevisionState } from './collaboration-types'

export function toRevisionView(row: RevisionState): RevisionView {
	return {
		id: row.id,
		sectionId: row.sectionId,
		revisionNo: row.revisionNo,
		parentRevisionId: row.parentRevisionId,
		content: row.content,
		summary: row.summary,
		editorId: row.editorId,
		editorName: row.editorName,
		sourceType: row.sourceType,
		sourceReference: row.sourceReference,
		createdAt: row.createdAt
	}
}

export function toProposalView(row: ProposalState, withDiff = true): ProposalView {
	return {
		id: row.id,
		sectionId: row.sectionId,
		sectionKey: row.sectionKey,
		baseRevisionId: row.baseRevisionId,
		baseVersion: row.baseVersion,
		proposedContent: row.proposedContent,
		currentContent: row.currentContent,
		summary: row.summary,
		submittedBy: row.submittedBy,
		submittedByName: row.submittedByName,
		status: row.status,
		reviewedBy: row.reviewedBy,
		reviewedByName: row.reviewedByName,
		reviewNote: row.reviewNote,
		createdAt: row.createdAt,
		reviewedAt: row.reviewedAt,
		publishedRevisionId: row.publishedRevisionId,
		diff: withDiff ? diffLines(row.currentContent, row.proposedContent) : null
	}
}
