import { describe, expect, it, vi } from 'vitest'

vi.mock('#lib/data/mods', async () => import('./fixtures/mock-catalog'))
vi.mock('virtual:mods', async () => ({
	dataFiles: {}, localizationFiles: {},
	iconFiles: (await import('./fixtures/mock-catalog')).iconFiles
}))

const runtime = vi.hoisted(() => ({ locale: 'zhs' }))
vi.mock('#lib/paraglide/runtime', () => ({ getLocale: () => runtime.locale }))

import { parseGameText, type GameTextNode } from './game-text'

function visible(nodes: GameTextNode[]): string {
	return nodes.map((node) => node.type === 'text' || node.type === 'entity' ? node.value
		: node.type === 'break' ? '\n' : node.type === 'icon' ? node.label ?? '' : visible(node.children)).join('')
}

describe('parseGameText cache', () => {
	it('keeps variable values apart', () => {
		expect(visible(parseGameText('{N}', { variables: { N: 1 } }))).toBe('1')
		expect(visible(parseGameText('{N}', { variables: { N: 2 } }))).toBe('2')
	})

	it('keeps entity matching apart from plain rendering', () => {
		const linked = parseGameText('[gold]痛击[/gold]', { locale: 'zhs' })
		const plain = parseGameText('[gold]痛击[/gold]', { locale: 'zhs', matchEntities: false })
		expect(visible(linked)).toBe('痛击')
		expect(visible(plain)).toBe('痛击')
		expect(linked[0]).toMatchObject({ type: 'tag', children: [{ type: 'entity' }] })
		expect(plain[0]).toMatchObject({ type: 'tag', children: [{ type: 'text' }] })
	})

	it('reparses when the ambient locale changes', () => {
		runtime.locale = 'zhs'
		expect(parseGameText('[gold]痛击[/gold]')[0]).toMatchObject({ type: 'tag', children: [{ type: 'entity' }] })
		runtime.locale = 'eng'
		expect(parseGameText('[gold]痛击[/gold]')[0]).toMatchObject({ type: 'tag', children: [{ type: 'text' }] })
	})

	it('never swallows diagnostics', () => {
		const codes: string[] = []
		const options = { onDiagnostic: (diagnostic: { code: string }) => codes.push(diagnostic.code) }
		parseGameText('{Missing}', options)
		parseGameText('{Missing}', options)
		expect(codes).toEqual(['missing-variable', 'missing-variable'])
	})
})
