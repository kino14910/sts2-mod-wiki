import { describe, expect, it } from 'vitest'
import { parseWikiText, type WikiNode } from './wiki-text'

function collect<T extends WikiNode['type']>(
	nodes: WikiNode[],
	type: T
): Extract<WikiNode, { type: T }>[] {
	const out: Extract<WikiNode, { type: T }>[] = []
	for (const node of nodes) {
		if (node.type === type) out.push(node as Extract<WikiNode, { type: T }>)
		if (node.type === 'tag') out.push(...collect(node.children, type))
	}
	return out
}

function visibleText(nodes: WikiNode[]): string {
	return nodes
		.map((node) => {
			if (node.type === 'tag') return visibleText(node.children)
			if (node.type === 'break') return '\n'
			if (node.type === 'text' || node.type === 'entity' || node.type === 'ambiguous') {
				return node.value
			}
			return node.value
		})
		.join('')
}

const eng = { locale: 'eng' }

describe('WikiText 可见文本实体匹配', () => {
	it('普通文本匹配实体，标签名与属性不参与匹配', () => {
		const plain = parseWikiText('Vulnerable and Poison', eng)
		expect(collect(plain, 'entity').map((node) => node.ref?.id)).toEqual([
			'VulnerablePower',
			'PoisonPower'
		])

		const tagged = parseWikiText('[color=Poison]Vulnerable[/color]', eng)
		expect(collect(tagged, 'tag')[0].arg).toBe('Poison')
		expect(collect(tagged, 'entity').map((node) => node.value)).toEqual(['Vulnerable'])
		expect(collect(tagged, 'ambiguous')).toHaveLength(0)
	})

	it('gold / blue / red / b / i / u 中的可见文本都匹配', () => {
		for (const name of ['gold', 'blue', 'red', 'b', 'i', 'u']) {
			const nodes = parseWikiText(`[${name}]Vulnerable[/${name}]`, eng)
			expect(collect(nodes, 'tag'), name).toHaveLength(1)
			expect(collect(nodes, 'entity').map((node) => node.ref?.id), name).toEqual([
				'VulnerablePower'
			])
		}
	})

	it('多层嵌套 BBCode 保持样式树且只匹配可见文本', () => {
		const nodes = parseWikiText('[b][i][gold]Vulnerable[/gold][/i][/b]', eng)
		expect(collect(nodes, 'tag').map((tag) => tag.name)).toEqual(['b', 'i', 'gold'])
		expect(collect(nodes, 'tag')[0].style.bold).toBe(true)
		expect(collect(nodes, 'tag')[1].style.italic).toBe(true)
		expect(collect(nodes, 'entity')).toHaveLength(1)
		expect(visibleText(nodes)).toBe('Vulnerable')
	})

	it('相邻不同样式节点各自匹配，不跨节点合并', () => {
		const nodes = parseWikiText('[gold]Poison[/gold][red]Vulnerable[/red]', eng)
		expect(collect(nodes, 'entity').map((node) => node.value)).toEqual([
			'Poison',
			'Vulnerable'
		])
		expect(collect(nodes, 'tag').map((tag) => tag.style.color)).toEqual([
			'#EFC851',
			'#FF5555'
		])
	})

	it('Wiki 显式引用先解析，保留 label 与 EntityRef', () => {
		const nodes = parseWikiText('[[card:Colossus|巨像]]', eng)
		const entities = collect(nodes, 'entity')
		expect(entities).toHaveLength(1)
		expect(entities[0].value).toBe('巨像')
		expect(entities[0].ref).toEqual({ type: 'card', id: 'Colossus' })
		expect(visibleText(nodes)).toBe('巨像')
	})

	it('显式图标语法整体解析，内部不进入实体名称匹配', () => {
		const nodes = parseWikiText('[b]StS2 Icon Vulnerable.png Vulnerable[/b]', eng)
		expect(collect(nodes, 'entity')).toHaveLength(1)
		expect(collect(nodes, 'entity')[0].icon?.name).toBe('Vulnerable')
		expect(visibleText(nodes)).toBe('Vulnerable')
		expect(collect(nodes, 'text').map((node) => node.value).join('')).toBe('')
	})

	it('升级值语法独立成节点', () => {
		const nodes = parseWikiText('Deal 8 (10) damage.', eng)
		expect(collect(nodes, 'upgraded').map((node) => node.value)).toEqual(['10'])
		expect(collect(nodes, 'entity')).toHaveLength(0)
		expect(visibleText(nodes)).toBe('Deal 8 (10) damage.')
	})

	it('同名实体保留全部候选，不生成确定链接', () => {
		const nodes = parseWikiText('Strike and Vulnerable', eng)
		const ambiguous = collect(nodes, 'ambiguous')
		expect(ambiguous).toHaveLength(1)
		expect(ambiguous[0].value).toBe('Strike')
		expect(ambiguous[0].refs.length).toBeGreaterThan(1)
		expect(ambiguous[0].refs.every((ref) => ref.type === 'card')).toBe(true)
		expect(new Set(ambiguous[0].candidates.map((entry) => entry.ref.id)).size).toBe(
			ambiguous[0].refs.length
		)
		expect(collect(nodes, 'entity')).toHaveLength(1)
	})

	it('WikiText 使用自己的消解策略，不复用 GameText 默认优先级', () => {
		const nodes = parseWikiText('Inferno', eng)
		const entity = collect(nodes, 'entity')[0]
		expect(entity.ref).toEqual({ type: 'card', id: 'Inferno' })
	})

	it('不生成重复或重叠链接', () => {
		const nodes = parseWikiText('[gold]Vulnerable Poison Vulnerable[/gold]', eng)
		expect(collect(nodes, 'entity').map((node) => node.value)).toEqual([
			'Vulnerable',
			'Poison',
			'Vulnerable'
		])
		expect(collect(nodes, 'text').map((node) => node.value).join('')).toBe('  ')
	})

	it('小写普通英文词不当成专有实体名', () => {
		const nodes = parseWikiText('cast inferno on the enemy', eng)
		expect(collect(nodes, 'entity')).toHaveLength(0)
		expect(collect(nodes, 'ambiguous')).toHaveLength(0)
		expect(visibleText(nodes)).toBe('cast inferno on the enemy')
	})

	it('非实体 tooltip 词条仍保留链接与提示', () => {
		const nodes = parseWikiText('Gain Block.', eng)
		const entities = collect(nodes, 'entity')
		expect(entities.map((node) => node.value)).toContain('Block')
		expect(entities.find((node) => node.value === 'Block')?.entry.tooltip).toBeTruthy()
	})

	it('不同语义节点不产生跨节点错误匹配', () => {
		const nodes = parseWikiText('[gold]Poison[/gold]X[blue]Vulnerable[/blue]', eng)
		expect(collect(nodes, 'entity').map((node) => node.value)).toEqual([
			'Poison',
			'Vulnerable'
		])
		expect(visibleText(nodes)).toBe('PoisonXVulnerable')
	})
})
