import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'

vi.mock('#lib/data/mods', async () => import('./fixtures/mock-catalog'))
vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/cards/Bash') } }))
vi.mock('virtual:mods', async () => ({
	dataFiles: {}, localizationFiles: {},
	iconFiles: (await import('./fixtures/mock-catalog')).iconFiles
}))

import GameText from '#lib/components/GameText.svelte'
import WikiText from '#lib/components/WikiText.svelte'
import real from './fixtures/real-game-templates.json'

describe('text rendering in the browser', () => {
	it('renders a hidden branch as empty content without WikiVariable fallback placeholders', async () => {
		const view = await render(GameText, {
			text: real['FGO_CARD_WISDOM_OF_THE_PEOPLE.description'],
			options: { variables: { Heal: 20, Np: 30 }, matchEntities: false }
		})
		expect(document.querySelector('.game-text')?.textContent).toBe('恢复20点生命。\n消耗你所有的状态牌。')
		expect(document.querySelector('[data-variable="IfUpgraded"]')?.textContent).toBe('')
		await view.rerender({ options: { upgraded: true, variables: { Heal: 20, Np: 30 }, matchEntities: false } })
		expect(view.container.textContent).toBe('恢复20点生命。\n消耗你所有的状态牌。\n获得30%宝具值')
	})

	it('renders selected branch styling, exact visible text and compact energy output', async () => {
		await render(GameText, {
			text: '{IfUpgraded:show:[gold]升级[/gold]|} {energyPrefix:energyIcons(8)}',
			options: { upgraded: true, matchEntities: false }
		})
		const element = document.querySelector('.game-text')!
		expect(element.textContent).toBe('升级 8')
		expect(element.querySelectorAll('img')).toHaveLength(1)
		expect(element.querySelector('span[style] [data-variable="IfUpgraded"]')).not.toBeNull()
	})

	it('uses one resource contract in WikiText and keeps missing assets diagnosable', async () => {
		await render(WikiText, { text: '§ICON_fgo:powers/shared.png§ §ICON_missing:absent.png§' })
		expect(document.querySelector('img[data-icon-ref]')?.getAttribute('src')).toBe('/imported/fgo/powers/shared.png')
		expect(document.querySelector('[data-icon-missing]')?.getAttribute('data-icon-missing')).toContain('missing asset icon missing:absent')
	})

	it('keeps all namespace candidates visible without generating an incorrect link', async () => {
		await render(WikiText, { text: 'Shared', locale: 'eng' })
		expect(document.querySelector('.wiki-ambiguous')?.textContent).toBe('Shared')
		expect(document.querySelector('.wiki-ambiguous')?.getAttribute('data-entity-candidates'))
			.toBe('["fgo:card:Shared","other:card:Shared","sts2:card:Shared"]')
		expect(document.querySelector('a')).toBeNull()
	})

	it('links public and raw scoped refs to their own namespace', async () => {
		await render(WikiText, { text: '[[card:fgo:Shared|Fgo]] [[card:sts2:Shared|Base]] [[card:Shared|Ambiguous]]', locale: 'eng' })
		expect([...document.querySelectorAll('a')].map((a) => a.getAttribute('href')))
			.toEqual(['/cards/fgo%3AShared', '/cards/sts2%3AShared'])
		expect(document.body.textContent).toContain('[[card:Shared|Ambiguous]]')
	})
})
