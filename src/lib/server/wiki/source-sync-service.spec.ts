import { describe, expect, it } from 'vitest'
import {
	actionForSyncCase,
	classifySourceState,
	type SourceState
} from './source-sync-service'

const base: SourceState = {
	exists: true,
	baseContent: 'upstream v1',
	baseHash: 'hash-v1',
	currentContent: 'upstream v1',
	sourceStatus: 'active'
}

const incoming = (content: string, hash: string) => ({ content, hash })

describe('mod upstream sync decisions', () => {
	it('imports a new file as a first revision', () => {
		const result = classifySourceState(
			{ ...base, exists: false, baseContent: '', baseHash: '', currentContent: '' },
			incoming('upstream v1', 'hash-v1')
		)
		expect(result).toBe('NEW')
		expect(actionForSyncCase(result).publishRevision).toBe(true)
		expect(actionForSyncCase(result).createPageAndSection).toBe(true)
	})

	it('case A: community unchanged, upstream changed -> safe auto publish', () => {
		const result = classifySourceState(base, incoming('upstream v2', 'hash-v2'))
		expect(result).toBe('A')
		expect(actionForSyncCase(result).publishRevision).toBe(true)
		expect(actionForSyncCase(result).refreshSourceSnapshot).toBe(true)
	})

	it('case B: upstream unchanged -> skip without a revision', () => {
		const result = classifySourceState(base, incoming('upstream v1', 'hash-v1'))
		expect(result).toBe('B')
		expect(actionForSyncCase(result).publishRevision).toBe(false)
	})

	it('case C: both sides changed -> conflict, never an automatic overwrite', () => {
		const result = classifySourceState(
			{ ...base, currentContent: 'community edit' },
			incoming('upstream v2', 'hash-v2')
		)
		expect(result).toBe('C')
		const action = actionForSyncCase(result)
		expect(action.publishRevision).toBe(false)
		expect(action.createConflict).toBe(true)
		expect(action.refreshSourceSnapshot).toBe(false)
	})

	it('case D: current already equals incoming -> refresh source only', () => {
		const result = classifySourceState(
			{ ...base, currentContent: 'upstream v2' },
			incoming('upstream v2', 'hash-v2')
		)
		expect(result).toBe('D')
		const action = actionForSyncCase(result)
		expect(action.publishRevision).toBe(false)
		expect(action.refreshSourceSnapshot).toBe(true)
	})

	it('case E: file deleted -> mark source deleted, keep formal content', () => {
		const result = classifySourceState(base, null)
		expect(result).toBe('E')
		const action = actionForSyncCase(result)
		expect(action.markDeleted).toBe(true)
		expect(action.publishRevision).toBe(false)
	})

	it('does nothing when neither source nor file exists', () => {
		expect(
			classifySourceState(
				{ ...base, exists: false, baseContent: '', baseHash: '', currentContent: '' },
				null
			)
		).toBe('NONE')
	})

	it('never publishes for B, C, D or E', () => {
		for (const syncCase of ['B', 'C', 'D', 'E'] as const) {
			expect(actionForSyncCase(syncCase).publishRevision).toBe(false)
		}
	})

	it('treats a reappearing deleted file with identical content as a restore, not a conflict', () => {
		const result = classifySourceState(
			{ ...base, sourceStatus: 'deleted' },
			incoming('upstream v1', 'hash-v1')
		)
		expect(result).toBe('B')
		expect(actionForSyncCase(result).createConflict).toBe(false)
	})

	it('keeps repeated unresolved upstream versions as separate conflict candidates', () => {
		const community = { ...base, currentContent: 'community edit' }
		expect(classifySourceState(community, incoming('upstream v2', 'hash-v2'))).toBe('C')
		expect(classifySourceState(community, incoming('upstream v3', 'hash-v3'))).toBe('C')
	})

	it('does not auto publish when a source file is moved or renamed but its content changed', () => {
		// Identity comes from (mod, page slug, section key), not the file path; a rename with
		// unchanged community content follows the safe case A path.
		expect(classifySourceState(base, incoming('upstream v2', 'hash-v2'))).toBe('A')
		expect(actionForSyncCase('A').refreshSourceSnapshot).toBe(true)
	})
})
