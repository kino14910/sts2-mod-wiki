import { describe, expect, it } from 'vitest'
import {
	ENERGY_ICON,
	ENERGY_ICON_SRC,
	NECRO_ENERGY_ICON,
	STAR_ICON,
	STAR_ICON_SRC
} from '#lib/data/icon-assets'
import { iconDiagnostic, resolveIconSrc } from '#lib/data/icon-registry'
import { parseGameText, type GameTextNode } from './index'
import {
	EXPLICIT_ICON_PATTERN,
	ICON_PATTERN,
	UPGRADED_PATTERN,
	findExplicitIcons
} from './icon-syntax'

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

describe('显式图标语法', () => {
	it('ICON_PATTERN 保留三种原有语法的捕获组顺序', () => {
		ICON_PATTERN.lastIndex = 0
		const matches = [
			...'StS2 Icon Vulnerable.png with §ICON_Star§ and (10) damage'.matchAll(ICON_PATTERN)
		]
		expect(matches.map((match) => [match[1], match[2], match[3]])).toEqual([
			['Icon Vulnerable', undefined, undefined],
			[undefined, 'Star', undefined],
			[undefined, undefined, '10']
		])
	})

	it('括号数字是升级值，不参与图标识别', () => {
		EXPLICIT_ICON_PATTERN.lastIndex = 0
		expect([...'Deal 8 (10) damage'.matchAll(EXPLICIT_ICON_PATTERN)]).toHaveLength(0)
		UPGRADED_PATTERN.lastIndex = 0
		expect(
			[...'Deal 8 (10) damage'.matchAll(UPGRADED_PATTERN)].map((match) => match[1])
		).toEqual(['10'])
	})

	it('不同语法归一化成同一种 asset 引用', () => {
		const hits = findExplicitIcons(
			'StS2 Icon Vulnerable.png and StS2 PaperPhrog.png and §ICON_star_icon§'
		)
		expect(hits.map((hit) => hit.token.ref)).toEqual([
			{ kind: 'asset', name: 'Vulnerable' },
			{ kind: 'asset', name: 'PaperPhrog' },
			{ kind: 'asset', name: 'star_icon' }
		])
	})
})

describe('图标资源注册表', () => {
	it('默认能量/星图标路径与迁移前一致', () => {
		expect(ENERGY_ICON_SRC).toBe('/mods/sts2/images/colorless_energy_icon.png')
		expect(STAR_ICON_SRC).toBe('/mods/sts2/images/star_icon.png')
		expect(ENERGY_ICON).toBe('/mods/sts2/images/ui/energy_colorless.png')
		expect(STAR_ICON).toBe('/mods/sts2/images/ui/star.png')
		expect(NECRO_ENERGY_ICON).toBe('/mods/sts2/images/ui/energy_necrobinder.png')
	})

	it('按 modId 隔离同名资源，不跨模组覆盖', () => {
		expect(resolveIconSrc({ kind: 'asset', name: 'star_icon', modId: 'sts2' })).toBe(
			'/mods/sts2/images/star_icon.png'
		)
		expect(resolveIconSrc({ kind: 'asset', name: 'star_icon', modId: 'another-mod' })).toBeNull()
	})

	it('未找到资源时返回可诊断信息', () => {
		expect(iconDiagnostic({ kind: 'asset', name: 'NotARealIcon' })).toContain(
			'missing asset icon'
		)
	})
})

describe('统一 AST 中的图标节点', () => {
	it('能量/星标签携带统一 ref，且 src 保持不变', () => {
		const energy = collect(parseGameText('[energy_icons=2]', { locale: 'eng' }), 'icon')[0]
		expect(energy).toMatchObject({
			kind: 'energy',
			count: 2,
			src: ENERGY_ICON_SRC,
			ref: { kind: 'energy', variant: 'card', modId: undefined }
		})

		const star = collect(parseGameText('[star]', { mode: 'collection' }), 'icon')[0]
		expect(star).toMatchObject({ kind: 'star', count: 1, src: STAR_ICON })
	})

	it('角色专属图标覆盖仍优先于注册表默认值', () => {
		const icon = collect(
			parseGameText('[energy]', { energyIconSrc: '/custom/energy.png' }),
			'icon'
		)[0]
		expect(icon.src).toBe('/custom/energy.png')
	})

	it('Vanilla 显式图标解析为真实资源', () => {
		const icons = collect(
			parseGameText('§ICON_star_icon§ and StS2 PaperPhrog.png', { locale: 'eng' }),
			'icon'
		)
		expect(icons).toHaveLength(2)
		expect(icons[0].src).toBe('/mods/sts2/images/star_icon.png')
		expect(icons[1].src).toBe('/mods/sts2/images/relics/paper_phrog.png')
	})

	it('指向实体的显式图标复用实体资源', () => {
		const icon = collect(parseGameText('StS2 Icon Vulnerable.png', { locale: 'eng' }), 'icon')[0]
		expect(icon.src).toBe('/mods/sts2/images/powers/vulnerable_power.png')
	})

	it('未找到资源的引用保留 diagnostic 而非静默丢失', () => {
		const icon = collect(parseGameText('§ICON_NotARealIcon§', { locale: 'eng' }), 'icon')[0]
		expect(icon.src).toBe('')
		expect(icon.diagnostic).toContain('missing asset icon')
	})

	it('显式图标作为完整单元，内部不再匹配实体名称', () => {
		const nodes = parseGameText('[gold]StS2 Icon Vulnerable.png[/gold]', { locale: 'eng' })
		expect(collect(nodes, 'icon')).toHaveLength(1)
		expect(collect(nodes, 'entity')).toHaveLength(0)
	})

	it('显式图标与相邻实体名称同时识别且不重复渲染', () => {
		const nodes = parseGameText('[gold]StS2 Icon Vulnerable.png 中毒[/gold]', {
			locale: 'zhs'
		})
		expect(collect(nodes, 'icon')).toHaveLength(1)
		expect(collect(nodes, 'entity').map((node) => node.value)).toEqual(['中毒'])
	})

	it('显式图标范围内的 BBCode 不产生第二个节点', () => {
		const nodes = parseGameText('§ICON_[gold]§', { locale: 'eng' })
		expect(collect(nodes, 'icon')).toHaveLength(1)
		expect(collect(nodes, 'tag')).toHaveLength(0)
	})

	it('不同位置的图标与实体互不干扰', () => {
		const nodes = parseGameText('[gold]中毒[/gold] and [energy_icons=2] and §ICON_star_icon§', {
			locale: 'zhs'
		})
		expect(collect(nodes, 'entity')).toHaveLength(1)
		expect(collect(nodes, 'icon').reduce((total, icon) => total + icon.count, 0)).toBe(3)
	})
})
