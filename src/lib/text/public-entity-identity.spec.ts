import { beforeEach, describe, expect, it } from 'vitest'
import { initializePublicEntityRefs, registerPublicEntityRefs, resolvePublicEntityRef, publicEntityId, publicEntityKey, toPublicEntityRef, entityHref, parseEntityKey, type ScopedEntityRef } from '../entities'

const refs: ScopedEntityRef[] = [
	{ type: 'card', id: 'TeslaCoil', modId: 'sts2' },
	{ type: 'card', id: 'TeslaCoil', modId: 'fgo' },
	{ type: 'card', id: 'Bash', modId: 'sts2' },
	{ type: 'card', id: 'WisdomOfThePeople', modId: 'fgo' },
	{ type: 'relic', id: 'TeslaCoil', modId: 'sts2' }
]

describe('public entity identity', () => {
	beforeEach(() => initializePublicEntityRefs(refs))

	it('preserves raw data and encodes non-base identities and colliding base identities', () => {
		expect(publicEntityId(refs[0])).toBe('sts2:TeslaCoil')
		expect(publicEntityId(refs[1])).toBe('fgo:TeslaCoil')
		expect(publicEntityId(refs[2])).toBe('Bash')
		expect(publicEntityId(refs[3])).toBe('fgo:WisdomOfThePeople')
		expect(publicEntityId(refs[4])).toBe('TeslaCoil')
		expect(refs[0].id).toBe('TeslaCoil')
	})

	it('refuses ambiguous legacy IDs and supports unique legacy redirects', () => {
		expect(resolvePublicEntityRef({ type: 'card', id: 'TeslaCoil' })).toBeNull()
		expect(publicEntityId({ type: 'card', id: 'TeslaCoil' })).toBeNull()
		expect(entityHref({ type: 'card', id: 'TeslaCoil' })).toBeNull()
		expect(resolvePublicEntityRef({ type: 'card', id: 'WisdomOfThePeople' })).toEqual(refs[3])
		expect(entityHref({ type: 'card', id: 'WisdomOfThePeople' })).toBe('/cards/fgo%3AWisdomOfThePeople')
	})

	it('resolves prefixed inputs and rejects mismatching scope, unknown owners and malformed prefixes', () => {
		expect(resolvePublicEntityRef({ type: 'card', id: 'fgo:TeslaCoil' })).toEqual(refs[1])
		expect(resolvePublicEntityRef({ type: 'card', id: 'sts2:Bash' })).toEqual(refs[2])
		for (const ref of [
			{ type: 'card', id: 'fgo:TeslaCoil', modId: 'sts2' },
			{ type: 'card', id: 'missing:TeslaCoil' }, { type: 'card', id: 'fgo:Missing' },
			{ type: 'card', id: 'fgo:' }, { type: 'card', id: ':TeslaCoil' },
			{ type: 'card', id: 'fgo:other:TeslaCoil' }
		] as ScopedEntityRef[]) expect(resolvePublicEntityRef(ref)).toBeNull()
	})

	it('round trips canonical public keys and links through the resolver', () => {
		for (const ref of refs) {
			const publicRef = toPublicEntityRef(ref)!
			expect(resolvePublicEntityRef(publicRef)).toEqual(ref)
			expect(parseEntityKey(publicEntityKey(ref)!)).toEqual(publicRef)
		}
		expect(entityHref(refs[0])).toBe('/cards/sts2%3ATeslaCoil')
		expect(entityHref(refs[1])).toBe('/cards/fgo%3ATeslaCoil')
	})

	it('registers the same owner idempotently and replaces ownership on catalog reload', () => {
		registerPublicEntityRefs(refs)
		expect(resolvePublicEntityRef({ type: 'card', id: 'Bash' })).toEqual(refs[2])
		initializePublicEntityRefs([refs[0]])
		expect(publicEntityId(refs[0])).toBe('TeslaCoil')
		expect(resolvePublicEntityRef({ type: 'card', id: 'fgo:TeslaCoil' })).toBeNull()
	})

	it('keeps namespace colons literal in DOM fragments while encoding path parameters', () => {
		for (const [type, rawId, prefix] of [
			['potion', 'ManaPotion', '/potions#potion-'],
			['keyword', 'special', '/keywords#']
		] as const) {
			const ref = { type, id: rawId, modId: 'fgo' }
			const href = entityHref(ref)!
			expect(href).toBe(`${prefix}fgo:${rawId}`)
			const domId = type === 'potion' ? `potion-${publicEntityId(ref)}` : publicEntityId(ref)
			expect(new URL(href, 'https://wiki.test').hash.slice(1)).toBe(domId)
		}
		expect(entityHref({ type: 'power', id: 'AntiBeastMagecraftPower', modId: 'fgo' }))
			.toBe('/power/fgo%3AAntiBeastMagecraftPower')
	})
})
