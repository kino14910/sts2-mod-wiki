import { describe, expect, it, vi } from 'vitest'
import { assertNoCrossModEntityIdConflicts, EntityIdConflictError } from './entity-id-conflicts'

vi.mock('#lib/data/mods', async () => import('./fixtures/mock-catalog'))

describe('legacy raw-ID collision diagnostics (not a production admission gate)', () => {
	it('accepts unique IDs and matching IDs of different types', () => {
		expect(() => assertNoCrossModEntityIdConflicts([
			{ type: 'card', id: 'Shared', modId: 'fgo' },
			{ type: 'relic', id: 'Shared', modId: 'sts2' },
			{ type: 'card', id: 'Unique', modId: 'other' }
		])).not.toThrow()
	})

	it('treats absent Mod scope as sts2 without inventing a cross-Mod collision', () => {
		expect(() => assertNoCrossModEntityIdConflicts([
			{ type: 'card', id: 'Bash' },
			{ type: 'card', id: 'Bash', modId: 'sts2' }
		])).not.toThrow()
	})

	it('rejects collisions across Mods, regardless of input order, with every owner', () => {
		const refs = [
			{ type: 'card', id: 'Shared', modId: 'other' },
			{ type: 'card', id: 'Shared', modId: 'fgo' },
			{ type: 'card', id: 'Shared', modId: 'sts2' },
			{ type: 'power', id: 'Shared', modId: 'sts2' },
			{ type: 'power', id: 'Shared', modId: 'fgo' }
		] as const
		for (const input of [refs, [...refs].reverse()]) {
			let caught: unknown
			try { assertNoCrossModEntityIdConflicts(input) } catch (error) { caught = error }
			expect(caught).toBeInstanceOf(EntityIdConflictError)
			expect((caught as EntityIdConflictError).conflicts).toEqual([
				{ key: 'card:Shared', modIds: ['fgo', 'other', 'sts2'] },
				{ key: 'power:Shared', modIds: ['fgo', 'sts2'] }
			])
			expect((caught as Error).message).toContain('Public URLs and community history use type:id')
		}
	})

	it('rejects a collision between an implicit base entity and a Mod entity', () => {
		expect(() => assertNoCrossModEntityIdConflicts([
			{ type: 'card', id: 'Bash' },
			{ type: 'card', id: 'Bash', modId: 'fgo' }
		])).toThrow('card:Bash [fgo, sts2]')
	})

	it('admits scoped collisions but rejects ambiguous refs when the real entity data module initializes', async () => {
		const { findGameEntity } = await import('#lib/data/entities')
		expect(findGameEntity({ type: 'card', id: 'Shared' })).toBeNull()
		expect(findGameEntity({ type: 'card', id: 'fgo:Shared' })?.data.mod).toBe('fgo')
		expect(findGameEntity({ type: 'card', id: 'sts2:Shared' })?.data.mod).toBe('sts2')
	})
})
