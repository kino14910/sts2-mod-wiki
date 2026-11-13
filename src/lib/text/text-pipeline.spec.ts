import { describe, expect, it, vi } from 'vitest'

vi.mock('#lib/data/mods', async () => import('./fixtures/mock-catalog'))
vi.mock('#lib/paraglide/runtime', () => ({ getLocale: () => 'eng' }))
vi.mock('virtual:mods', async () => ({
	dataFiles: {
		'/static/mods/fgo/powers.json': [{ id: 'EchoPower', sources: [{ key: 'sources', groups: [{ kind: 'card', partition: '', refs: [{ type: 'card', id: 'Shared' }] }] }] }],
		'/static/mods/other/powers.json': [{ id: 'EchoPower', refs: [{ kind: 'card', id: 'Shared' }] }]
	}, localizationFiles: {},
	iconFiles: (await import('./fixtures/mock-catalog')).iconFiles
}))

import { parseGameText, tokenizeGameText, type GameTextNode } from './game-text'
import { parseWikiText } from './wiki-text'
import { findExplicitIcons } from './game-text/icon-syntax'
import { localizeEntity, localizedCard, localizedCardForLocale, localizedCollectionForLocale } from '#lib/data/localize'
import { findGameEntity, hasGameEntity, listEntityRefs, ENTITY_ID_CONFLICTS } from '#lib/data/entities'
import { findEntityCandidates, resolveEntityNameDetailed } from '#lib/data/entity-name-index'
import { listPowerReferences, powerReferenceDetails, resolvePowerReference } from '#lib/data/power-references'
import { ENTRY_BY_ID, glossaryHref, entryHref } from '#lib/data/glossary'
import { collectionHref } from '#lib/data/collections'
import { cardHrefByName, cardById, powerIconById } from '#lib/data/wiki-links'
import { CARDS, RELICS } from './fixtures/mock-catalog'
import real from './fixtures/real-game-templates.json'

function visible(nodes: GameTextNode[]): string {
	return nodes.map((node) => node.type === 'text' || node.type === 'entity' ? node.value
		: node.type === 'break' ? '\n' : node.type === 'icon' ? node.label ?? '' : visible(node.children)).join('')
}

describe('real GameText templates', () => {
	it('protects tags and image tokens inside conditional expressions', () => {
		const text = '{IfUpgraded:show:[gold]Exhaust[/gold] §ICON_fgo:ui/shared.png§|}'
		expect(tokenizeGameText(text)).toEqual([{ type: 'text', value: text }])
		expect(visible(parseGameText(text))).toBe('')
	})

	it.each([false, true])('selects Fgo WisdomOfThePeople upgrade branch: %s', (upgraded) => {
		const rendered = visible(parseGameText(real['FGO_CARD_WISDOM_OF_THE_PEOPLE.description'], {
			upgraded, variables: { Heal: 20, Np: 30 }
		}))
		expect(rendered).toBe(`恢复20点生命。\n消耗你所有的状态牌。${upgraded ? '\n获得30%宝具值' : ''}`)
		expect(rendered).not.toMatch(/[{}|]/)
	})

	it.each([false, true])('keeps DragonCore conditional styles and selected text: %s', (upgraded) => {
		const rendered = visible(parseGameText(real['FGO_CARD_DRAGON_CORE.description'], { upgraded }))
		expect(rendered).toContain(upgraded ? '随机已升级的攻击牌' : '随机攻击牌')
		expect(rendered).not.toMatch(/[{}|]/)
	})

	it('resolves entities in selected styled branches but not numeric values', () => {
		const nodes = parseGameText('{IfUpgraded:show:[gold]易伤[/gold]|}', { upgraded: true, upgradeDisplay: 'upgraded', locale: 'zhs' })
		const tag = nodes[0]
		expect(tag.type).toBe('tag')
		if (tag.type === 'tag' && tag.children[0].type === 'variable') {
			expect(tag.children[0].children[0]).toMatchObject({ type: 'entity', ref: { id: 'VulnerablePower' } })
		} else throw new Error('Expected styled conditional branch')
		expect(parseGameText('[gold]{N}[/gold]', { variables: { N: 'Vulnerable' } })[0])
			.toMatchObject({ type: 'tag', children: [{ type: 'variable', children: [{ type: 'text', value: 'Vulnerable' }] }] })
	})

	it('allows real Charge branches to close an outer style before trailing punctuation', () => {
		for (const Cards of [1, 2]) {
			const nodes = parseGameText(real['CHARGE.description'], { variables: { Cards }, matchEntities: false })
			expect(visible(nodes)).toBe(`Choose ${Cards} ${Cards === 1 ? 'card' : 'cards'} in your Draw Pile to Transform into\n${Cards === 1 ? 'Minion Dive Bomb' : 'Minion Dive Bombs'}.`)
			expect(nodes.at(-1)).toEqual({ type: 'text', value: '.' })
		}
	})

	it('renders high energy counts compactly for real UltraManifesto', () => {
		const text = visible(parseGameText(real['FGO_CARD_ULTRA_MANIFESTO.description'], { variables: { NpDamagePower: 50 } }))
		expect(text).toContain('获得8')
		expect(text).not.toMatch(/[{}|]/)
	})

	it('does not re-evaluate braces supplied by scalar variable values', () => {
		expect(visible(parseGameText('{Name}', { variables: { Name: 'literal {Damage}', Damage: 8 } })))
			.toBe('literal {Damage}')
	})
})

describe('shared explicit icon resolution', () => {
	it.each([
		'§ICON_fgo:powers/shared.png§',
		'[img]res://Fgo/images/powers/shared.png[/img]'
	])('uses an exact scoped asset path in both parsers: %s', (text) => {
		expect(parseGameText(text)[0]).toMatchObject({ type: 'icon', src: '/imported/fgo/powers/shared.png' })
		expect(parseWikiText(text)[0]).toMatchObject({ type: 'icon', src: '/imported/fgo/powers/shared.png' })
	})

	it('preserves source resource paths and reports missing Mod icons instead of linking vanilla', () => {
		expect(findExplicitIcons('[img]res://Fgo/images/fields/ImaginarySpace.png[/img]')[0].token.ref)
			.toEqual({ kind: 'asset', modId: 'fgo', name: 'ImaginarySpace', path: 'fields/ImaginarySpace.png' })
		expect(parseWikiText('§ICON_Vulnerable§', { modId: 'missing' })[0])
			.toMatchObject({ type: 'icon', src: '', diagnostic: 'missing asset icon missing:Vulnerable' })
		expect(parseWikiText('§ICON_fgo:missing/shared.png§')[0])
			.toMatchObject({ type: 'icon', src: '', diagnostic: 'missing asset icon fgo:missing/shared.png' })
	})

	it('supports explicit keyword references without overlapping automatic links', () => {
		expect(parseWikiText('[[keyword:exhaust|消耗]]')[0])
			.toMatchObject({ type: 'entity', value: '消耗', ref: { type: 'keyword', id: 'exhaust' }, entry: { href: '/keywords#exhaust' } })
	})
})

describe('localization and namespace contracts', () => {
	it('keeps the public localizedCard callback safe for Array.map', () => {
		expect(CARDS.map(localizedCard).map((card) => card.name)).toEqual(['Bash', 'Shared', 'Shared', 'Shared'])
		expect(localizedCardForLocale(CARDS[0], 'zhs')).toMatchObject({ name: '痛击', text: 'Deal {Damage:diff()} damage.' })
	})

	it('reports per-field fallback and keeps templates separate from display evaluation', () => {
		expect(localizeEntity({ type: 'card', id: 'Bash' }, 'zhs')).toMatchObject({
			name: '痛击', template: 'Deal {Damage:diff()} damage.', nameLocale: 'zhs', descriptionLocale: 'eng'
		})
		expect(localizedCollectionForLocale(RELICS[0], 'eng').text).toBe('Gain 25% Gold.')
		expect(resolvePowerReference({ type: 'card', id: 'Bash' }, 'zhs')).toMatchObject({ name: '痛击', description: 'Deal 8 damage.' })
	})

	it('rejects ambiguous unscoped ids and retains all scoped entities without unsafe links', () => {
		const unscoped = { type: 'card', id: 'Shared' } as const
		expect(findGameEntity(unscoped)).toBeNull()
		expect(hasGameEntity(unscoped)).toBe(false)
		expect(localizeEntity(unscoped, 'eng')).toBeNull()
		expect(resolvePowerReference(unscoped)).toBeNull()
		expect(listEntityRefs().filter((ref) => ref.id === 'Shared')).toHaveLength(3)
		expect(ENTITY_ID_CONFLICTS.get('card:Shared')?.map((ref) => ref.modId)).toEqual(['fgo', 'other', 'sts2'])
		for (const [modId, description] of [['fgo', 'Fgo text.'], ['other', 'Other text.'], ['sts2', 'Base text.']]) {
			const ref = { ...unscoped, modId }
			expect(findGameEntity(ref)?.data.mod).toBe(modId)
			expect(hasGameEntity(ref)).toBe(true)
			expect(localizeEntity(ref, 'eng')?.template).toBe(description)
			expect(resolvePowerReference(ref)).toMatchObject({ modId, description, href: `/cards/${modId}%3AShared` })
		}
		expect(findGameEntity({ ...unscoped, modId: 'missing' })).toBeNull()
		expect(findGameEntity({ type: 'card', id: 'Bash' })?.data.mod).toBe('sts2')
	})

	it('retains namespace ambiguity and supports explicit matching scope', () => {
		expect(resolveEntityNameDetailed('Shared', { locale: 'eng', strategy: 'wiki', scope: 'wiki' }).status).toBe('ambiguous')
		expect(resolveEntityNameDetailed('Shared', { locale: 'eng', modId: 'fgo' }).entry?.ref.modId).toBe('fgo')
		expect(findEntityCandidates('強打', 'eng')[0]).toMatchObject({ ref: { id: 'Bash' }, scope: 'wiki' })
	})

	it('indexes scoped glossary IDs and rejects raw/name-only collisions', () => {
		expect(ENTRY_BY_ID.get('EchoPower')).toBeUndefined()
		expect(ENTRY_BY_ID.get('fgo:EchoPower')?.mod).toBe('fgo')
		expect(ENTRY_BY_ID.get('other:EchoPower')?.mod).toBe('other')
		expect(ENTRY_BY_ID.get('VulnerablePower')?.mod).toBe('sts2')
		expect(cardHrefByName('Shared')).toBeNull()
		expect(cardById('Shared')).toBeUndefined()
		expect(cardById('fgo:Shared')?.mod).toBe('fgo')
		expect(powerIconById('EchoPower')).toBeNull()
		expect(powerIconById('EchoPower', 'fgo')).toBe('/fgo/echo.png')
	})

	it('keeps explicit power sources in scope without promoting inherited refs into sources', () => {
		expect(listPowerReferences('EchoPower')).toEqual([])
		expect(listPowerReferences('EchoPower', 'fgo')).toEqual([{ type: 'card', id: 'Shared', modId: 'fgo' }])
		expect(powerReferenceDetails('EchoPower', 'eng', 'fgo').sources[0].groups[0].entries[0])
			.toMatchObject({ id: 'Shared', modId: 'fgo', href: '/cards/fgo%3AShared', description: 'Fgo text.' })
		expect(listPowerReferences('other:EchoPower')).toEqual([])
	})

	it('resolves public explicit Wiki refs without overriding their prefix with page context', () => {
		expect(parseWikiText('[[card:Shared]]')[0]).toEqual({ type: 'text', value: '[[card:Shared]]' })
		expect(parseWikiText('[[card:sts2:Shared|Base]]', { modId: 'fgo' })[0])
			.toMatchObject({ type: 'entity', ref: { id: 'Shared', modId: 'sts2' }, entry: { href: '/cards/sts2%3AShared' } })
	})

	it('formats glossary and collection fragments to match literal public DOM ids', () => {
		const entry = { kind: 'power' as const, id: 'AntiBeastMagecraftPower', mod: 'fgo', name: '', summary: '', group: '' }
		const href = glossaryHref(entry)
		expect(href).toBe('/powers#fgo:AntiBeastMagecraftPower')
		expect(new URL(href, 'https://wiki.test').hash.slice(1)).toBe('fgo:AntiBeastMagecraftPower')
		expect(entryHref(entry)).toBe('/power/fgo%3AAntiBeastMagecraftPower')
		expect(glossaryHref({ ...entry, kind: 'keyword' })).toBe('/keywords#fgo:AntiBeastMagecraftPower')
		expect(collectionHref({ ...RELICS[0], kind: 'potion', mod: 'fgo' })).toBe('/potions#potion-fgo:BowlerHat')
		expect(collectionHref({ ...RELICS[0], mod: 'fgo' })).toBe('/relic/fgo%3ABowlerHat')
	})
})
