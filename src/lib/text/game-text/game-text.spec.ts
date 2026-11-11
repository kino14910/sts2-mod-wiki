import { describe, expect, it } from 'vitest'
import { parseGameText, type GameTextNode } from './index'

function collect<T extends GameTextNode['type']>(
	nodes: GameTextNode[],
	type: T
): Extract<GameTextNode, { type: T }>[] {
	const out: Extract<GameTextNode, { type: T }>[] = []
	for (const node of nodes) {
		if (node.type === type) out.push(node as Extract<GameTextNode, { type: T }>)
		if (node.type === 'tag') out.push(...collect(node.children, type))
		if (node.type === 'variable') out.push(...collect(node.children, type))
	}
	return out
}

function text<T extends GameTextNode['type']>(
	nodes: GameTextNode[],
	type: T
): Extract<GameTextNode, { type: T }>[] {
	return collect(nodes, type)
}

describe('game text AST', () => {
	it('parses the reference example into tag, entity, variable and text nodes', () => {
		const nodes = parseGameText('[gold]中毒[/gold]会多触发[blue]{Amount}[/blue]次。', {
			locale: 'zhs'
		})
		expect(nodes.map((node) => node.type)).toEqual(['tag', 'text', 'tag', 'text'])

		const gold = nodes[0]
		expect(gold.type).toBe('tag')
		if (gold.type !== 'tag') throw new Error('expected tag')
		expect(gold.style.colorName).toBe('gold')
		expect(gold.children[0]).toMatchObject({
			type: 'entity',
			value: '中毒',
			ref: { type: 'power', id: 'PoisonPower' }
		})

		expect(nodes[1]).toEqual({ type: 'text', value: '会多触发' })
		const blue = nodes[2]
		expect(blue.type).toBe('tag')
		if (blue.type !== 'tag') throw new Error('expected tag')
		expect(blue.children[0]).toMatchObject({ type: 'variable', name: 'Amount' })
		expect(nodes[3]).toEqual({ type: 'text', value: '次。' })
	})

	it('only matches entities inside gold nodes', () => {
		const plain = parseGameText('中毒会多触发一次', { locale: 'zhs' })
		expect(text(plain, 'entity')).toEqual([])
		expect(collect(plain, 'text').map((node) => node.value).join('')).toBe('中毒会多触发一次')

		expect(text(parseGameText('[blue]力量[/blue]', { locale: 'zhs' }), 'entity')).toEqual([])
		expect(text(parseGameText('[b]力量[/b]', { locale: 'zhs' }), 'entity')).toEqual([])
		expect(text(parseGameText('[gold]中毒[/gold]', { locale: 'zhs' }), 'entity')).toHaveLength(1)
	})

	it('keeps nested styles and gold context through nesting', () => {
		const nested = parseGameText('[color=#ffffff][gold]中毒[/gold][/color]', { locale: 'zhs' })
		expect(text(nested, 'entity')).toHaveLength(1)
		expect(nested[0].type).toBe('tag')

		const bold = parseGameText('[gold][b]中毒[/b][/gold]', { locale: 'zhs' })
		expect(text(bold, 'entity')).toHaveLength(1)
		const outer = bold[0]
		if (outer.type !== 'tag') throw new Error('expected tag')
		const inner = outer.children[0]
		expect(inner.type).toBe('tag')
		if (inner.type !== 'tag') throw new Error('expected tag')
		expect(inner.style.bold).toBe(true)
	})

	it('keeps tag order and text order for nested BBCode', () => {
		const nodes = parseGameText('[b]A[/b]B[gold]中毒[/gold]C', { locale: 'zhs' })
		expect(nodes.map((node) => node.type)).toEqual(['tag', 'text', 'tag', 'text'])
		const tags = collect(nodes, 'tag')
		expect(tags.map((tag) => tag.name)).toEqual(['b', 'gold'])
	})

	it('resolves variables together with BBCode styles', () => {
		const nodes = parseGameText('[blue]{Amount}[/blue]', {
			locale: 'zhs',
			variables: { Amount: 3 }
		})
		const variable = text(nodes, 'variable')[0]
		expect(variable.name).toBe('Amount')
		expect(variable.value).toBe('3')
		expect(collect(nodes, 'tag').map((tag) => tag.name)).toEqual(['blue'])
	})

	it('preserves the existing variable syntax', () => {
		const cases = ['{Damage:diff()}', '{IfUpgraded:show:升级|未升级}', '{InCombat:战斗|平时}']
		for (const source of cases) {
			const variable = text(parseGameText(source, { locale: 'eng' }), 'variable')[0]
			expect(variable).toBeDefined()
		}
		expect(
			text(parseGameText('{Amount:plural:time|times}', { locale: 'eng', variables: { Amount: 2 } }), 'variable')[0].value
		).toBe('times')
	})

	it('does not treat variable placeholders as entities', () => {
		const nodes = parseGameText('[gold]{Poison}[/gold]', { locale: 'eng' })
		expect(text(nodes, 'entity')).toEqual([])
		expect(text(nodes, 'variable').map((node) => node.name)).toEqual(['Poison'])
	})

	it('keeps ambiguous names as plain text and honours match-time context', () => {
		const ambiguous = parseGameText('[gold]Strike[/gold]', { locale: 'eng' })
		expect(text(ambiguous, 'entity')).toEqual([])

		const defaultPick = parseGameText('[gold]Accelerant[/gold]', { locale: 'eng' })
		expect(text(defaultPick, 'entity')[0].ref.type).toBe('power')

		const cardPick = parseGameText('[gold]Accelerant[/gold]', {
			locale: 'eng',
			prefer: ['card', 'power', 'keyword', 'relic', 'potion']
		})
		expect(text(cardPick, 'entity')[0].ref.type).toBe('card')
	})

	it('matches multiple, repeated and longest names inside gold', () => {
		const nodes = parseGameText('[gold]中毒力量中毒[/gold]', { locale: 'zhs' })
		expect(text(nodes, 'entity').map((node) => node.value)).toEqual(['中毒', '力量', '中毒'])

		const longest = parseGameText('[gold]精准剪刀[/gold]', { locale: 'zhs' })
		expect(text(longest, 'entity').map((node) => node.value)).toEqual(['精准剪刀'])
	})

	it('falls back unknown tags to text and supports break / icons', () => {
		const unknown = parseGameText('a[mystery]b[/mystery]', { locale: 'eng' })
		expect(collect(unknown, 'text').map((node) => node.value).join('')).toBe(
			'a[mystery]b[/mystery]'
		)
		expect(text(parseGameText('a[br]b', { locale: 'eng' }), 'break')).toHaveLength(1)
		const icon = text(parseGameText('[energy_icons=2]', { locale: 'eng' }), 'icon')[0]
		expect(icon).toMatchObject({ kind: 'energy', count: 2 })
	})

	it('supports English and Chinese names in the same locale index', () => {
		expect(text(parseGameText('[gold]Poison[/gold]', { locale: 'eng' }), 'entity')[0].ref.id).toBe(
			'PoisonPower'
		)
		expect(text(parseGameText('[gold]中毒[/gold]', { locale: 'zhs' }), 'entity')[0].ref.id).toBe(
			'PoisonPower'
		)
	})

	it('keeps styles but skips entities when matchEntities is off', () => {
		const nodes = parseGameText('[gold]中毒[/gold]{Amount}', {
			locale: 'zhs',
			variables: { Amount: 2 },
			matchEntities: false
		})
		expect(text(nodes, 'entity')).toEqual([])
		expect(text(nodes, 'tag').map((tag) => tag.style.colorName)).toEqual(['gold'])
		expect(nodes.map((node) => node.type)).toEqual(['tag', 'variable'])
		expect(text(nodes, 'variable')[0].value).toBe('2')
	})
})
