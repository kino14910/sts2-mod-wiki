import { describe, expect, it } from 'vitest'
import { entityKey } from '#lib/entities'
import {
	findEntityByName,
	findEntityCandidates,
	getEntityNameIndex,
	matchEntityNames,
	resolveEntityName
} from './entity-name-index'
import { findGameEntity } from './entities'

describe('multilingual entity name index', () => {
	it('maps localized .title to EntityRef and GameEntity', () => {
		const zh = findEntityByName('中毒', 'zhs')
		expect(zh?.ref).toEqual({ type: 'power', id: 'PoisonPower' })
		expect(zh?.entity.kind).toBe('power')
		expect(zh?.source).toBe('title')
		expect(findGameEntity(zh!.ref)).toBe(zh!.entity)

		const en = findEntityByName('Poison', 'eng')
		expect(en?.ref).toEqual({ type: 'power', id: 'PoisonPower' })
	})

	it('reads keyword names from the keyword localization', () => {
		expect(findEntityByName('消耗', 'zhs')?.ref).toEqual({ type: 'keyword', id: 'exhaust' })
		expect(findEntityByName('Exhaust', 'eng')?.ref).toEqual({ type: 'keyword', id: 'exhaust' })
	})

	it('keeps locales isolated and caches one index per locale', () => {
		expect(getEntityNameIndex('eng').locale).toBe('eng')
		expect(getEntityNameIndex('zhs').locale).toBe('zhs')
		expect(getEntityNameIndex('zhs')).toBe(getEntityNameIndex('zhs'))
		expect(getEntityNameIndex('zhs').pattern).toBe(getEntityNameIndex('zhs').pattern)
		expect(getEntityNameIndex('eng')).not.toBe(getEntityNameIndex('zhs'))
		expect(findEntityByName('中毒', 'eng')).toBeNull()
	})

	it('supports structural aliases without duplicating names', () => {
		expect(findEntityByName('Duplicate', 'eng')?.ref).toEqual({
			type: 'power',
			id: 'DuplicationPower'
		})
		expect(findEntityByName('Duplicate', 'eng')?.source).toBe('alias')
	})

	it('retains every candidate and only records conflicts for diagnostics', () => {
		const list = findEntityCandidates('Accelerant', 'eng')
		expect(list.map((entry) => entry.ref.type).sort()).toEqual(['card', 'power'])
		expect(getEntityNameIndex('eng').conflicts).toContainEqual(
			expect.objectContaining({ name: 'Accelerant', reason: 'cross-type' })
		)
		expect(findEntityCandidates('Strike', 'eng').length).toBeGreaterThan(1)
		expect(getEntityNameIndex('eng').conflicts).toContainEqual(
			expect.objectContaining({ name: 'Strike', reason: 'same-type' })
		)
	})

	it('defers conflict resolution to match time and honours context', () => {
		expect(resolveEntityName('Accelerant', { locale: 'eng' })?.ref.type).toBe('power')
		expect(
			resolveEntityName('Accelerant', { locale: 'eng', prefer: ['card', 'power'] })?.ref.type
		).toBe('card')
		expect(resolveEntityName('Strike', { locale: 'eng' })).toBeNull()
		expect(matchEntityNames('Strike', { locale: 'eng' })).toEqual([])
	})

	it('exposes all candidates on a resolved match', () => {
		const [match] = matchEntityNames('Accelerant', { locale: 'eng' })
		expect(match.candidates).toHaveLength(2)
		expect(match.entry.ref.type).toBe('power')
	})

	it('uses the current entity as context to disambiguate', () => {
		const list = findEntityCandidates('饥饿', 'zhs')
		expect(list.length).toBeGreaterThan(1)
		const resolved = resolveEntityName('饥饿', { locale: 'zhs', current: list[0].ref })
		expect(entityKey(resolved!.ref)).not.toBe(entityKey(list[0].ref))
	})

	it('enables enemy-only powers like any other candidate', () => {
		const entry = [...getEntityNameIndex('eng').candidates.values()]
			.flat()
			.find(
				(candidate) =>
					candidate.enemyOnly && findEntityCandidates(candidate.name, 'eng').length === 1
			)
		expect(entry).toBeDefined()
		expect(resolveEntityName(entry!.name, { locale: 'eng' })).toEqual(entry)
	})

	it('matches Chinese names without word boundaries and repeats', () => {
		const matches = matchEntityNames('中毒中毒', { locale: 'zhs' })
		expect(matches.map((match) => match.name)).toEqual(['中毒', '中毒'])
		expect(matches.every((match) => match.entry.ref.id === 'PoisonPower')).toBe(true)
	})

	it('handles consecutive distinct entities', () => {
		const matches = matchEntityNames('中毒力量中毒', { locale: 'zhs' })
		expect(matches.map((match) => match.name)).toEqual(['中毒', '力量', '中毒'])
	})

	it('prefers the longest name at the same position', () => {
		expect(matchEntityNames('精准剪刀', { locale: 'zhs' }).map((match) => match.name)).toEqual([
			'精准剪刀'
		])
		expect(matchEntityNames('Breakthrough', { locale: 'eng' }).map((match) => match.name)).toEqual([
			'Breakthrough'
		])
	})

	it('escapes regexp metacharacters in entity names', () => {
		const matches = matchEntityNames('Anchor???', { locale: 'eng' })
		expect(matches.map((match) => match.name)).toEqual(['Anchor???'])
		expect(matches[0].entry.ref.type).toBe('relic')
	})

	it('does not match an English entity in the middle of a word', () => {
		expect(
			matchEntityNames('Poisoned', { locale: 'eng' }).some((match) => match.name === 'Poison')
		).toBe(false)
		expect(
			matchEntityNames('Poison', { locale: 'eng' }).some((match) => match.name === 'Poison')
		).toBe(true)
	})

	it('does not treat variable placeholders as entities', () => {
		const matches = matchEntityNames('{Poison} Poison', { locale: 'eng' })
		expect(matches.map((match) => match.name)).toEqual(['Poison'])
		expect(matches[0].start).toBe(9)
	})

	it('leaves plain text without entity names untouched', () => {
		expect(matchEntityNames('@@@', { locale: 'zhs' })).toEqual([])
	})

	it('exposes longest-first terms and a reusable global pattern', () => {
		const index = getEntityNameIndex('zhs')
		expect(index.terms.length).toBeGreaterThan(500)
		expect(index.terms[0].length).toBeGreaterThanOrEqual(index.terms[index.terms.length - 1].length)
		expect(index.pattern.flags).toContain('g')
		expect(index.pattern.flags).toContain('i')
	})
})
