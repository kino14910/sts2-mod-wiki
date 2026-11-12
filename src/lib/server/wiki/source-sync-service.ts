export type SyncCase = 'NEW' | 'A' | 'B' | 'C' | 'D' | 'E' | 'NONE'

export interface SourceState {
	exists: boolean
	baseContent: string
	baseHash: string
	currentContent: string
	sourceStatus: 'active' | 'deleted'
}

export interface IncomingSource {
	content: string
	hash: string
}

export interface SyncAction {
	publishRevision: boolean
	createConflict: boolean
	refreshSourceSnapshot: boolean
	markDeleted: boolean
	createPageAndSection: boolean
	reason: string
}

const ACTIONS: Record<SyncCase, SyncAction> = {
	NEW: {
		publishRevision: true,
		createConflict: false,
		refreshSourceSnapshot: true,
		markDeleted: false,
		createPageAndSection: true,
		reason: 'First import of a mod provided file'
	},
	A: {
		publishRevision: true,
		createConflict: false,
		refreshSourceSnapshot: true,
		markDeleted: false,
		createPageAndSection: false,
		reason: 'Current content still matches the last synced upstream baseline'
	},
	B: {
		publishRevision: false,
		createConflict: false,
		refreshSourceSnapshot: false,
		markDeleted: false,
		createPageAndSection: false,
		reason: 'Upstream content unchanged'
	},
	C: {
		publishRevision: false,
		createConflict: true,
		refreshSourceSnapshot: false,
		markDeleted: false,
		createPageAndSection: false,
		reason: 'Community and upstream both changed the content'
	},
	D: {
		publishRevision: false,
		createConflict: false,
		refreshSourceSnapshot: true,
		markDeleted: false,
		createPageAndSection: false,
		reason: 'Current content already equals the new upstream content'
	},
	E: {
		publishRevision: false,
		createConflict: false,
		refreshSourceSnapshot: false,
		markDeleted: true,
		createPageAndSection: false,
		reason: 'Upstream file removed; formal content and revisions are preserved'
	},
	NONE: {
		publishRevision: false,
		createConflict: false,
		refreshSourceSnapshot: false,
		markDeleted: false,
		createPageAndSection: false,
		reason: 'No source and no upstream file'
	}
}

export function classifySourceState(
	state: SourceState,
	incoming: IncomingSource | null
): SyncCase {
	if (!state.exists) return incoming ? 'NEW' : 'NONE'
	if (!incoming) return 'E'
	// A deleted source reappearing with the same content is a restore, not a conflict:
	// the sync script reactivates it in case B. Checking the status here used to misclassify
	// it as case C and create a bogus conflict record.
	if (incoming.hash === state.baseHash) return 'B'
	if (state.currentContent === state.baseContent && incoming.content !== state.baseContent) return 'A'
	if (state.currentContent !== state.baseContent && incoming.content === state.currentContent)
		return 'D'
	return 'C'
}

export function actionForSyncCase(syncCase: SyncCase): SyncAction {
	return ACTIONS[syncCase]
}
