import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import WikiText from './WikiText.svelte'

describe('WikiText.svelte', () => {
	it('renders every token through WikiEntity', () => {
		const { container } = render(WikiText, {
			text: 'Apply 2 StS2 Icon Vulnerable.png Vulnerable and play Inferno.'
		})
		const links = [...container.querySelectorAll('.wiki-card-link')]
		expect(links.length).toBe(2)
		expect(container.querySelector('a[href="/power/VulnerablePower"]')).toBeTruthy()
		expect(container.querySelector('a[href="/cards/Inferno"]')).toBeTruthy()
		expect(container.querySelector('.wiki-term')).toBeNull()
		expect(container.querySelectorAll('.wiki-icon-img').length).toBeGreaterThan(0)
	})

	it('links relic icons and their following label as one entity', () => {
		const { container } = render(WikiText, { text: 'StS2 PaperPhrog.png Paper Phrog is useful.' })
		const link = container.querySelector('a[href="/relic/PaperPhrog"]')
		expect(link).toBeTruthy()
		expect(link?.textContent).toContain('Paper Phrog')
		expect(container.textContent).not.toContain('.png')
	})

	it('merges a Chinese power icon label into one element', () => {
		const { container } = render(WikiText, {
			text: 'StS2 Icon Vulnerable.png 易伤是玩家和敌人都可以施加给其目标的减益效果。'
		})
		const links = [...container.querySelectorAll('.wiki-card-link')]
		expect(links.length).toBe(1)
		expect(links[0].querySelector('.wiki-icon-link')).toBeTruthy()
		expect(links[0].querySelector('.wiki-icon-label')?.textContent).toBe('易伤')
		expect(container.querySelectorAll('.wiki-icon-img').length).toBe(1)
		expect(container.textContent).not.toContain('.png')
	})

	it('merges a multi-word English icon label into one element', () => {
		const { container } = render(WikiText, {
			text: 'StS2 Icon DoubleDamage.png Double Damage applies before other effects.'
		})
		expect(container.querySelectorAll('.wiki-card-link').length).toBe(1)
		expect(container.querySelector('.wiki-icon-label')?.textContent).toBe('Double Damage')
		expect(container.querySelector('.wiki-icon-link')).toBeTruthy()
	})

	it('keeps upgraded numbers styled but plain', () => {
		const { container } = render(WikiText, { text: 'Deal 8 (10) damage.' })
		expect(container.querySelector('.wiki-upgraded')?.textContent).toBe('10')
		expect(container.querySelector('.wiki-card-link')).toBeNull()
	})

	it('渲染所有括号内的升级值为绿色', () => {
		const { container } = render(WikiText, {
			text: 'Deal 8 (10) damage. Apply 2 (3) Vulnerable.'
		})
		const values = [...container.querySelectorAll('.wiki-upgraded')]
		expect(values.map((node) => node.textContent)).toEqual(['10', '3'])
		expect(values.every((node) => node.className.includes('text-[#94ee93]'))).toBe(true)
	})

	it('does not link lowercase occurrences of uncurated proper nouns', () => {
		const { container } = render(WikiText, { text: 'cast inferno on the enemy' })
		expect(container.querySelector('a[href="/cards/Inferno"]')).toBeNull()
		expect(container.textContent).toBe('cast inferno on the enemy')
	})

	it('links entities inside every BBCode style, including nested ones', () => {
		const { container } = render(WikiText, {
			locale: 'eng',
			text: '[gold]Vulnerable[/gold] [blue]Poison[/blue] [red]Strength[/red] [b]Weak[/b] [i]Frail[/i] [u]Exhaust[/u] [b][gold]Poison[/gold][/b]'
		})
		expect(container.querySelectorAll('.wiki-card-link').length).toBe(7)
		expect(container.querySelectorAll('span[style]').length).toBeGreaterThanOrEqual(7)
		expect(container.textContent).not.toContain('[gold]')
	})

	it('does not match tag names or attributes', () => {
		const { container } = render(WikiText, {
			locale: 'eng',
			text: '[color=Poison]plain words[/color] [font=Vulnerable]text[/font]'
		})
		expect(container.querySelector('.wiki-card-link')).toBeNull()
		expect(container.textContent).toBe('plain words text')
	})

	it('renders ambiguous names without a definite or overlapping link', () => {
		const { container } = render(WikiText, { locale: 'eng', text: 'Strike' })
		expect(container.querySelector('.wiki-card-link')).toBeNull()
		const markers = container.querySelectorAll('.wiki-ambiguous')
		expect(markers).toHaveLength(1)
		expect(markers[0].getAttribute('data-entity-candidates')).toContain('card:StrikeIronclad')
		expect(markers[0].querySelector('a')).toBeNull()
	})

	it('does not duplicate links for explicit icons inside BBCode', () => {
		const { container } = render(WikiText, {
			locale: 'eng',
			text: '[b]StS2 Icon Vulnerable.png Vulnerable[/b]'
		})
		expect(container.querySelectorAll('.wiki-card-link').length).toBe(1)
		expect(container.querySelectorAll('.wiki-icon-img').length).toBeGreaterThan(0)
	})

	it('keeps non-entity tooltip terms linked', () => {
		const { container } = render(WikiText, { locale: 'eng', text: 'Gain Block.' })
		const links = [...container.querySelectorAll('.wiki-card-link')]
		expect(links.some((link) => link.textContent?.includes('Block'))).toBe(true)
	})

	it('resolves explicit refs to the declared entity type', () => {
		const { container } = render(WikiText, {
			text: '既有卡牌[[card:Colossus]]这样的防御选项，也有[[card:Colossus|巨像]]。'
		})
		expect(container.querySelectorAll('a[href="/cards/Colossus"]').length).toBe(2)
		expect(container.querySelector('a[href="/power/ColossusPower"]')).toBeNull()
		expect(container.textContent).toContain('巨像')
		expect(container.textContent).not.toContain('[[')
	})
})
