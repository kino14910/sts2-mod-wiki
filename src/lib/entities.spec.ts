import { describe, expect, it } from 'vitest'
import {
	entityHref,
	entityKey,
	entitySlug,
	isValidEntityRef,
	isValidModId,
	modPageHref,
	modPageKey,
	parseEntityKey,
	parseModPageKey,
	wikiPageKey
} from './entities'

describe('entity identity', () => {
	it('builds a stable key from type and id', () => {
		expect(entityKey({ type: 'card', id: 'Abrasive' })).toBe('card:Abrasive')
		expect(entityKey({ type: 'relic', id: 'CrackedCore' })).toBe('relic:CrackedCore')
	})

	it('round trips a key back to its ref', () => {
		const key = entityKey({ type: 'power', id: 'VulnerablePower' })
		expect(parseEntityKey(key)).toEqual({ type: 'power', id: 'VulnerablePower' })
	})

	it('keeps ids containing colons intact', () => {
		expect(parseEntityKey('card:TEST:Strike')).toEqual({ type: 'card', id: 'TEST:Strike' })
	})

	it('rejects malformed keys', () => {
		expect(parseEntityKey('Abrasive')).toBeNull()
		expect(parseEntityKey(':Abrasive')).toBeNull()
		expect(parseEntityKey('unknown:Abrasive')).toBeNull()
		expect(parseEntityKey('card:')).toBeNull()
		expect(parseEntityKey('card:bad\nid')).toBeNull()
	})

	it('uses the entity key as the page slug', () => {
		expect(entitySlug({ type: 'card', id: 'Abrasive' })).toBe('card:Abrasive')
		expect(entitySlug({ type: 'relic', id: 'CrackedCore' })).not.toBe('Cracked Core')
	})

	it('separates refs that share an id but differ in type', () => {
		expect(entityKey({ type: 'card', id: 'Strike' })).not.toBe(
			entityKey({ type: 'relic', id: 'Strike' })
		)
	})

	it('maps entity types to existing routes', () => {
		expect(entityHref({ type: 'card', id: 'Abrasive' })).toBe('/cards/Abrasive')
		expect(entityHref({ type: 'relic', id: 'CrackedCore' })).toBe('/relic/CrackedCore')
		expect(entityHref({ type: 'power', id: 'VulnerablePower' })).toBe(
			'/power/VulnerablePower'
		)
		expect(entityHref({ type: 'potion', id: 'BlockPotion' })).toBe(
			'/potions#potion-BlockPotion'
		)
		expect(entityHref({ type: 'keyword', id: 'exhaust' })).toBe('/keywords#exhaust')
	})

	it('validates refs before they reach the database', () => {
		expect(isValidEntityRef({ type: 'card', id: 'Abrasive' })).toBe(true)
		expect(isValidEntityRef({ type: 'card', id: '' })).toBe(false)
		expect(isValidEntityRef({ type: 'nope' as 'card', id: 'Abrasive' })).toBe(false)
	})
})

describe('mod wiki page identity', () => {
	it('derives a stable key from mod id and slug, not the file path', () => {
		expect(modPageKey({ modId: 'fgo', slug: 'index' })).toBe('mod:fgo:index')
		expect(modPageKey({ modId: 'fgo', slug: 'characters/nero' })).toBe(
			'mod:fgo:characters/nero'
		)
	})

	it('round trips mod page keys', () => {
		const key = modPageKey({ modId: 'another-mod', slug: 'mechanics/energy' })
		expect(parseModPageKey(key)).toEqual({ modId: 'another-mod', slug: 'mechanics/energy' })
		expect(parseModPageKey('relic:CrackedCore')).toBeNull()
		expect(parseModPageKey('mod:fgo')).toBeNull()
	})

	it('keeps identical slugs in different mods distinct', () => {
		expect(wikiPageKey({ kind: 'mod', modId: 'fgo', slug: 'index' })).not.toBe(
			wikiPageKey({ kind: 'mod', modId: 'base', slug: 'index' })
		)
	})

	it('maps mod pages to nested wiki routes', () => {
		expect(modPageHref({ modId: 'fgo', slug: 'characters/nero' })).toBe(
			'/mods/fgo/wiki/characters/nero'
		)
	})

	it('validates mod ids', () => {
		expect(isValidModId('sts2')).toBe(true)
		expect(isValidModId('another-mod')).toBe(true)
		expect(isValidModId('../etc')).toBe(false)
		expect(isValidModId('')).toBe(false)
	})
})
