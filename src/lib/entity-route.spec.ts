import { describe, expect, it } from 'vitest'
import { isHttpError, isRedirect } from '@sveltejs/kit'
import { listEntityRefs } from '#lib/data/entities'
import { entityHref, publicEntityId } from '#lib/entities'
import { resolveEntityRoute } from './entity-route'

describe('entity route identity', () => {
	it('keeps the two real TeslaCoil cards distinct without changing game IDs', () => {
		const base = resolveEntityRoute('card', 'sts2:TeslaCoil')
		const imported = resolveEntityRoute('card', 'fgo:TeslaCoil')
		expect(base.game.data).toMatchObject({ id: 'TeslaCoil', mod: 'sts2' })
		expect(imported.game.data).toMatchObject({ id: 'TeslaCoil', mod: 'fgo' })
		expect(base.entityKey).toBe('card:sts2:TeslaCoil')
		expect(imported.entityKey).toBe('card:fgo:TeslaCoil')
		expect(base.entityRef).not.toEqual(imported.entityRef)
	})

	it.each(['TeslaCoil', 'unknown:TeslaCoil', 'fgo:MissingCard', 'fgo:sts2:TeslaCoil'])('rejects missing or ambiguous card route %s', (id) => {
		try {
			resolveEntityRoute('card', id)
			expect.fail('Expected 404')
		} catch (error) {
			expect(isHttpError(error, 404)).toBe(true)
		}
	})

	it('redirects unique imported legacy URLs without reading an unavailable server fragment', () => {
		try {
			const url = new URL('https://wiki.test/cards/Strike?upgraded=1#Notes')
			Object.defineProperty(url, 'hash', { get() { throw new Error('url_hash_unavailable') } })
			resolveEntityRoute('card', 'Strike', url)
			expect.fail('Expected canonical redirect')
		} catch (error) {
			expect(isRedirect(error)).toBe(true)
			if (!isRedirect(error)) throw error
			expect(error.status).toBe(307)
			expect(error.location).toBe('/cards/fgo%3AStrike?upgraded=1')
		}
	})

	it('keeps existing unambiguous base game URLs', () => {
		const route = resolveEntityRoute('card', 'Bash')
		expect(route.game.data.mod).toBe('sts2')
		expect(route.entityRef).toEqual({ type: 'card', id: 'Bash' })
	})

	it.each(['relic', 'potion', 'power', 'keyword'] as const)('resolves scoped %s entries to their canonical public IDs', (type) => {
		const refs = listEntityRefs().filter((ref) => ref.type === type)
		expect(refs.length).toBeGreaterThan(0)
		for (const ref of refs) {
			const id = publicEntityId(ref)!
			const route = resolveEntityRoute(type, id)
			expect(route.game.data.id).toBe(ref.id)
			expect(route.game.data.mod ?? 'sts2').toBe(ref.modId)
			expect(route.entityRef).toEqual({ type, id })
			expect(entityHref(route.entityRef)).toBe(entityHref(ref))
		}
	})
})
