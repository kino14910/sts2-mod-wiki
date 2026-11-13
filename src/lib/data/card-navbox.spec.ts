import { describe, expect, it } from 'vitest'
import { CARDS } from './mods'
import { cardHref, rarityMatches } from './cards'
import { publicEntityKey } from '#lib/entities'
import { buildCardNavbox } from './card-navbox'
import type { Card } from './cards'

const selfKey = (card: Card) => publicEntityKey({ type: 'card', id: card.id, modId: card.mod })!
const groupFor = (navbox: ReturnType<typeof buildCardNavbox>, href: string) =>
	navbox.groups.find((group) => group.href === href)

describe('buildCardNavbox', () => {
	it('derives the Ironclad Basic row from /cards?color=ironclad&rarity=basic', () => {
		const bash = CARDS.find((card) => card.mod === 'sts2' && card.id === 'Bash')!
		expect(bash).toBeDefined()
		const navbox = buildCardNavbox(bash)
		expect(navbox.href).toBe('/cards?color=ironclad')

		const basic = groupFor(navbox, '/cards?color=ironclad&rarity=basic')
		expect(basic).toBeDefined()
		const expected = CARDS.filter((card) => card.color === 'ironclad' && rarityMatches('basic', card.rarity))
		expect(basic!.rows[0].items).toHaveLength(expected.length)
		expect(basic!.rows[0].items.filter((item) => item.href === null).map((item) => item.name)).toEqual(['Bash'])
		for (const card of expected.filter((entry) => entry !== bash)) {
			expect(basic!.rows[0].items.some((item) => item.href === cardHref(card)), card.id).toBe(true)
		}
	})

	it('builds all rarity groups from the catalog instead of a static snapshot', () => {
		const bash = CARDS.find((card) => card.mod === 'sts2' && card.id === 'Bash')!
		const navbox = buildCardNavbox(bash)
		const ironclad = CARDS.filter((card) => card.color === 'ironclad')
		const items = navbox.groups.flatMap((group) => group.rows.flatMap((row) => row.items))
		expect(items).toHaveLength(ironclad.length)
		expect(new Set(navbox.groups.map((group) => group.key))).toEqual(new Set(ironclad.map((card) => card.rarity)))
		expect(new Set(items.map((item) => item.key)).size).toBe(items.length)
		for (const group of navbox.groups) {
			expect(group.href).toBe(`/cards?color=ironclad&rarity=${group.key}`)
		}
	})

	it('uses one shared dynamic navbox for every color and rarity, with exactly one selflink', () => {
		const representatives = [...new Map(CARDS.map((card) => [`${card.color}:${card.rarity}`, card])).values()]
		expect(representatives.length).toBeGreaterThan(1)
		for (const card of representatives) {
			const navbox = buildCardNavbox(card)
			const items = navbox.groups.flatMap((group) => group.rows.flatMap((row) => row.items))
			const label = `${card.mod}:${card.id}`
			expect(items.filter((item) => item.href === null).map((item) => item.key), label).toEqual([selfKey(card)])
			expect(items, label).toHaveLength(CARDS.filter((entry) => entry.color === card.color).length)
			expect(new Set(items.map((item) => item.key)).size, label).toBe(items.length)
			expect(navbox.href, label).toBe(`/cards?color=${encodeURIComponent(card.color)}`)
		}
	})

	it('keeps cards with an inherited custom rarity out of the built-in group', () => {
		const noble = CARDS.find((card) => card.color === 'noble')
		expect(noble).toBeDefined()
		const navbox = buildCardNavbox(noble!)
		const items = navbox.groups.flatMap((group) => group.rows.flatMap((row) => row.items))
		expect(navbox.groups.some((group) => group.key === noble!.rarity)).toBe(true)
		expect(new Set(items.map((item) => item.key)).size).toBe(items.length)
	})
})
