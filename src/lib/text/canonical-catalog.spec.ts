import { describe, expect, it } from 'vitest'
import { CARDS, MOD_BY_ID, RELICS } from '#lib/data/mods'
import { localizeEntity, localizedCardForLocale, localizedCollectionForLocale } from '#lib/data/localize'
import { resolvePowerReference } from '#lib/data/power-references'
import { findEntityCandidates } from '#lib/data/entity-name-index'
import { findGameEntity } from '#lib/data/entities'
import { entityHref, resolvePublicEntityRef, publicEntityKey } from '#lib/entities'
import { resolveCollectionText } from './collection-text'
import { parseGameText, type GameTextNode } from './game-text'

function visible(nodes: GameTextNode[]): string {
	return nodes.map((node) => node.type === 'text' || node.type === 'entity' ? node.value
		: node.type === 'break' ? '\n' : node.type === 'icon' ? node.label ?? '' : visible(node.children)).join('')
}

describe('canonical catalog text integration', () => {
	it('keeps both real TeslaCoil entities independently addressable without changing raw IDs', () => {
		if (!MOD_BY_ID.has('fgo')) { expect(MOD_BY_ID.has('sts2')).toBe(true); return }
		expect(resolvePublicEntityRef({ type: 'card', id: 'TeslaCoil' })).toBeNull()
		for (const modId of ['sts2', 'fgo']) {
			const ref = { type: 'card' as const, id: 'TeslaCoil', modId }
			const entity = findGameEntity({ type: 'card', id: `${modId}:TeslaCoil` })!
			expect(entity.data.id).toBe('TeslaCoil')
			expect(entity.data.mod).toBe(modId)
			expect(entityHref(ref)).toBe(`/cards/${modId}%3ATeslaCoil`)
			expect(publicEntityKey(ref)).toBe(`card:${modId}:TeslaCoil`)
			expect(localizeEntity({ type: 'card', id: `${modId}:TeslaCoil` }, 'eng')?.template).toContain('{Damage:diff()}')
		}
	})

	it('loads actual entity data and shares Bash titles across display, lookup and references', () => {
		const bash = CARDS.find((card) => card.mod === 'sts2' && card.id === 'Bash')!
		expect(bash).toBeDefined()
		for (const locale of ['eng', 'zhs']) {
			const localized = localizedCardForLocale(bash, locale)
			expect(localizeEntity({ type: 'card', id: 'Bash', modId: 'sts2' }, locale)?.name).toBe(localized.name)
			expect(resolvePowerReference({ type: 'card', id: 'Bash' }, locale)?.name).toBe(localized.name)
			expect(findEntityCandidates(localized.name, locale).some((candidate) => candidate.ref.id === 'Bash')).toBe(true)
		}
	})

	it('renders real imported Fgo WisdomOfThePeople in both upgrade states', () => {
		// Some portable test installations intentionally contain only the base catalog.
		if (!MOD_BY_ID.has('fgo')) { expect(MOD_BY_ID.has('sts2')).toBe(true); return }
		const card = CARDS.find((entry) => entry.mod === 'fgo' && entry.id === 'WisdomOfThePeople')!
		expect(card).toBeDefined()
		const localized = localizedCardForLocale(card, 'zhs')
		const base = visible(parseGameText(localized.text, { variables: card.variables, locale: 'zhs' }))
		const upgraded = visible(parseGameText(localized.text, { variables: card.variables, locale: 'zhs', upgraded: true }))
		expect(base).toContain('恢复20点生命')
		expect(base).not.toContain('宝具值')
		expect(upgraded).toContain('获得30%宝具值')
		expect(upgraded).not.toMatch(/[{}|]/)
	})

	it('keeps legacy BowlerHat migration correct through the real loader and localization', () => {
		const item = RELICS.find((entry) => entry.mod === 'sts2' && entry.id === 'BowlerHat')!
		expect(item).toBeDefined()
		expect(item.variables?.GoldIncrease).toBe(1.25)
		expect(localizedCollectionForLocale(item, 'eng').text).toContain('25%')
		expect(resolveCollectionText('Gain {GoldIncrease:percentMore()}%.', item.variables)).toBe('Gain 25%.')
	})
})
