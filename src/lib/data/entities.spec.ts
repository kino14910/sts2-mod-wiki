import { describe, expect, it } from 'vitest'
import { findGameEntity, hasGameEntity, listEntityKeys, listEntityRefs } from './entities'
import { parseWikiDocument, seedDocument, listSeedRefs } from './wiki-seed'

describe('game data registry', () => {
	it('resolves raw game entities by stable id', () => {
		const card = findGameEntity({ type: 'card', id: 'Abrasive' })
		expect(card?.kind).toBe('card')
		if (card?.kind !== 'card') throw new Error('expected a card')
		expect(card.data.cost).toBe(3)
		expect(card.data.rarity).toBe('rare')
		expect(card.data.type).toBe('power')
	})

	it('resolves relic, potion, power and keyword entities', () => {
		expect(findGameEntity({ type: 'relic', id: 'CrackedCore' })?.kind).toBe('relic')
		expect(findGameEntity({ type: 'power', id: 'VulnerablePower' })?.kind).toBe('power')
		expect(findGameEntity({ type: 'keyword', id: 'exhaust' })?.kind).toBe('keyword')
		expect(typeof findGameEntity({ type: 'potion', id: listPotionId() })).toBe('object')
	})

	it('does not expose wiki content through the game data layer', () => {
		const entity = findGameEntity({ type: 'card', id: 'Abrasive' })
		expect(entity).not.toBeNull()
		const keys = Object.keys(entity as object)
		expect(keys).not.toContain('mechanics')
		expect(keys).not.toContain('strategy')
		expect(keys).not.toContain('history')
		expect(keys).not.toContain('content')
	})

	it('returns null for unknown entities and reserved types', () => {
		expect(findGameEntity({ type: 'card', id: '__missing__' })).toBeNull()
		expect(findGameEntity({ type: 'character', id: 'NeroBride' })).toBeNull()
		expect(hasGameEntity({ type: 'relic', id: '__missing__' })).toBe(false)
	})

	it('lists unique stable keys', () => {
		const keys = listEntityKeys()
		expect(keys.length).toBeGreaterThan(500)
		expect(new Set(keys).size).toBe(keys.length)
		expect(listEntityRefs().length).toBe(keys.length)
	})
})

describe('wiki seed baseline', () => {
	it('maps seed documents by entity id, not display name', () => {
		const relic = seedDocument({ type: 'relic', id: 'CrackedCore' })
		expect(relic?.kind).toBe('relic')
		const power = seedDocument({ type: 'power', id: 'VulnerablePower' })
		expect(power?.kind).toBe('power')
		expect(seedDocument({ type: 'card', id: 'Abrasive' })).toBeNull()
	})

	it('round trips a seed document through JSON', () => {
		const original = seedDocument({ type: 'relic', id: 'CrackedCore' })
		expect(parseWikiDocument(JSON.parse(JSON.stringify(original)))).toEqual(original)
	})

	it('rejects malformed stored documents', () => {
		expect(parseWikiDocument(null)).toBeNull()
		expect(parseWikiDocument({ kind: 'relic' })).toBeNull()
		expect(parseWikiDocument({ kind: 'unknown', page: { title: 'x' } })).toBeNull()
		expect(parseWikiDocument({ kind: 'power', page: {} })).toBeNull()
	})

	it('only seeds entities that exist in game data', () => {
		for (const ref of listSeedRefs()) expect(hasGameEntity(ref)).toBe(true)
	})
})

function listPotionId() {
	const keys = listEntityKeys().filter((key) => key.startsWith('potion:'))
	return keys[0]?.slice('potion:'.length) ?? '__missing__'
}
