import { afterEach, describe, expect, it } from 'vitest'
import { parseWikiText, type WikiNode } from './wiki-text'
import { parseGameText } from './game-text'
import {
	GAME_ENTITY_PREFERENCE,
	WIKI_ENTITY_PREFERENCE,
	matchEntityNames,
	scanEntityNames
} from '#lib/data/entity-name-index'
import {
	ENTITY_AUTO_LINK_OVERRIDES,
	autoLinkPolicy,
	canAutoLinkAt
} from '#lib/data/entity-link-policy'

const WIKI_ZH = { locale: 'zhs', scope: 'wiki', strategy: 'wiki', prefer: WIKI_ENTITY_PREFERENCE } as const
const GAME_ZH = { locale: 'zhs', scope: 'game', strategy: 'game', prefer: GAME_ENTITY_PREFERENCE } as const

function entityValues(nodes: WikiNode[]): string[] {
	return nodes.flatMap((node) =>
		node.type === 'entity' || node.type === 'ambiguous'
			? [node.value]
			: node.type === 'tag'
				? entityValues(node.children)
				: []
	)
}

afterEach(() => {
	for (const key of Object.keys(ENTITY_AUTO_LINK_OVERRIDES)) delete ENTITY_AUTO_LINK_OVERRIDES[key]
})

describe('single-character CJK names are morphemes in running text', () => {
	it('does not split 杀戮尖塔 with the card 塔', () => {
		const nodes = parseWikiText('杀戮尖塔是一款游戏', { locale: 'zhs' })
		expect(nodes).toEqual([{ type: 'text', value: '杀戮尖塔是一款游戏' }])
		expect(scanEntityNames('杀戮尖塔是一款游戏', WIKI_ZH)).toEqual([])
	})

	it('does not link 塔 inside 塔罗牌 in wiki prose or gold game text', () => {
		expect(entityValues(parseWikiText('将一张随机塔罗牌加入手牌', { locale: 'zhs' }))).toEqual([])
		const gold = parseGameText('[gold]塔罗牌[/gold]', { locale: 'zhs' })
		expect(gold[0]).toMatchObject({ type: 'tag', children: [{ type: 'text', value: '塔罗牌' }] })
	})

	it('still links a standalone 塔 as an intentional reference in both pipelines', () => {
		expect(parseWikiText('塔', { locale: 'zhs' })[0]).toMatchObject({
			type: 'entity',
			ref: { type: 'card', id: 'TheTower' }
		})
		const gold = parseGameText('[gold]塔[/gold]', { locale: 'zhs' })
		expect(gold[0]).toMatchObject({
			type: 'tag',
			children: [{ type: 'entity', value: '塔', ref: { type: 'card', id: 'TheTower' } }]
		})
	})

	it('links 塔 next to punctuation but not glued to Han characters', () => {
		expect(canAutoLinkAt('塔', '打出「塔」时', 3, 4)).toBe(true)
		expect(canAutoLinkAt('塔', '杀戮尖塔', 3, 4)).toBe(false)
		expect(entityValues(parseWikiText('打出「塔」时', { locale: 'zhs' }))).toEqual(['塔'])
	})

	it('keeps explicit references working for single-character names inside prose', () => {
		const nodes = parseWikiText('打出[[card:TheTower|塔]]时', { locale: 'zhs' })
		expect(nodes.map((node) => node.type)).toEqual(['text', 'entity', 'text'])
		expect(nodes[1]).toMatchObject({ type: 'entity', value: '塔', ref: { id: 'TheTower' } })
	})
})

describe('longest-name priority and ambiguity', () => {
	it('matches the full name 希望灯塔 instead of the embedded 塔', () => {
		const nodes = parseWikiText('希望灯塔', { locale: 'zhs' })
		expect(nodes).toHaveLength(1)
		expect(nodes[0]).toMatchObject({ type: 'entity', value: '希望灯塔', ref: { type: 'card', id: 'BeaconOfHope' } })
	})

	it('keeps same-type collisions ambiguous without choosing a target', () => {
		const nodes = parseWikiText('苦恼', { locale: 'zhs' })
		expect(nodes[0]).toMatchObject({ type: 'ambiguous', value: '苦恼' })
		if (nodes[0].type !== 'ambiguous') throw new Error('expected ambiguous node')
		expect(nodes[0].refs.map((ref) => ref.id).sort()).toEqual(['Anguish', 'Writhe'])
		expect(matchEntityNames('苦恼', GAME_ZH)).toEqual([])
	})

	it('resolves cross-type collisions by the explicit strategy preference', () => {
		expect(scanEntityNames('触媒', WIKI_ZH)[0]).toMatchObject({
			status: 'resolved',
			entry: { ref: { type: 'card', id: 'Accelerant' } }
		})
		expect(scanEntityNames('触媒', GAME_ZH)[0]).toMatchObject({
			status: 'resolved',
			entry: { ref: { type: 'power', id: 'AccelerantPower' } }
		})
	})

	it('does not re-scan explicit reference labels for nested entities', () => {
		const nodes = parseWikiText('[[card:Bash|Vulnerable]]', { locale: 'eng' })
		expect(nodes).toHaveLength(1)
		expect(nodes[0]).toMatchObject({ type: 'entity', value: 'Vulnerable', ref: { type: 'card', id: 'Bash' } })
	})
})

describe('configurable per-alias policy', () => {
	it('defaults single characters to explicit-only and multi-character names to auto', () => {
		expect(autoLinkPolicy('塔')).toBe('explicit-only')
		expect(autoLinkPolicy('易伤')).toBe('auto')
		expect(autoLinkPolicy('Vulnerable')).toBe('auto')
	})

	it('allows re-enabling a disabled alias via overrides', () => {
		ENTITY_AUTO_LINK_OVERRIDES['塔'] = 'auto'
		expect(scanEntityNames('杀戮尖塔', WIKI_ZH).map((match) => match.name)).toEqual(['塔'])
	})

	it('allows disabling a common-word alias via overrides', () => {
		expect(scanEntityNames('施加易伤效果', GAME_ZH).map((match) => match.name)).toEqual(['易伤'])
		ENTITY_AUTO_LINK_OVERRIDES['易伤'] = 'explicit-only'
		expect(scanEntityNames('施加易伤效果', GAME_ZH)).toEqual([])
	})
})

describe('wiki and game strategies stay independent', () => {
	it('requires canonical case for ASCII names only in wiki prose', () => {
		expect(entityValues(parseWikiText('apply vulnerable now', { locale: 'eng' }))).toEqual([])
		expect(entityValues(parseWikiText('apply Vulnerable now', { locale: 'eng' }))).toEqual(['Vulnerable'])
		const gold = parseGameText('[gold]vulnerable[/gold]', { locale: 'eng' })
		expect(gold[0]).toMatchObject({ type: 'tag', children: [{ type: 'entity', value: 'vulnerable' }] })
	})

	it('keeps cross-language titles wiki-only', () => {
		expect(scanEntityNames('Bash', WIKI_ZH)[0]).toMatchObject({ status: 'resolved', entry: { ref: { id: 'Bash' } } })
		expect(matchEntityNames('Bash', GAME_ZH)).toEqual([])
	})

	it('does not match entity names inside URLs', () => {
		const nodes = parseWikiText('see https://slaythespire.wiki.gg/wiki/Vulnerable for details', { locale: 'eng' })
		expect(entityValues(nodes)).toEqual([])
		expect(entityValues(parseWikiText('https://x.com/a then Vulnerable', { locale: 'eng' }))).toEqual(['Vulnerable'])
	})
})

describe('parse result cache', () => {
	it('reuses the AST for identical inputs and separates locales', () => {
		const text = '造成易伤。'
		const first = parseWikiText(text, { locale: 'zhs' })
		expect(parseWikiText(text, { locale: 'zhs' })).toBe(first)
		expect(parseWikiText(text, { locale: 'eng' })).not.toBe(first)
		expect(parseWikiText(text, { locale: 'zhs', modId: 'sts2' })).not.toBe(first)
	})
})