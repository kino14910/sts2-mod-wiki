import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import CardDescription from './CardDescription.svelte'
import type { CardView } from '#lib/data/cards'

function card(overrides: Partial<CardView> = {}): CardView {
	return {
		id: 'Test',
		name: 'Test',
		mod: 'sts2',
		pool: ['ironclad'],
		color: 'ironclad',
		type: 'attack',
		rarity: 'common',
		cost: 1,
		keywords: [],
		text: '',
		...overrides
	}
}

describe('CardDescription.svelte', () => {
	it('links gold entities and resolves variables through the unified pipeline', () => {
		const { container } = render(CardDescription, {
			card: card({
				text: 'Apply [gold]{Amount}[/gold] [gold]Vulnerable[/gold].',
				variables: { Amount: 2 }
			})
		})

		expect(container.querySelector('a[href="/power/VulnerablePower"]')).toBeTruthy()
		expect(container.querySelector('.game-variable[data-variable="Amount"]')?.textContent).toBe('2')
		expect(container.querySelector('.desc-body')?.textContent).toBe('Apply 2 Vulnerable.')
	})

	it('keeps the face variant non-interactive', () => {
		const { container } = render(CardDescription, {
			variant: 'face',
			card: card({ text: 'Apply [gold]Vulnerable[/gold].' })
		})

		expect(container.querySelector('a[href="/power/VulnerablePower"]')).toBeNull()
		expect(container.querySelector('.wiki-term')?.textContent).toBe('Vulnerable')
	})

	it('renders keyword lines without entity links', () => {
		const { container } = render(CardDescription, {
			card: card({ text: 'Gain [gold]Strength[/gold].', keywords: ['Exhaust'] })
		})

		const keyword = container.querySelector('.desc-keyword')
		expect(keyword?.textContent).toBe('Exhaust.')
		expect(keyword?.querySelector('.wiki-card-link')).toBeNull()
		expect(keyword?.querySelector<HTMLElement>('.game-text > span')?.style.color).not.toBe('')
		expect(container.querySelector('a[href="/power/StrengthPower"]')).toBeTruthy()
	})

	it('does not emit unparsed BBCode or escaped markup', () => {
		const { container } = render(CardDescription, {
			card: card({ text: '[gold]Deal[/gold] <3 [unknown]x[/unknown]' })
		})

		expect(container.querySelector('.desc-body')?.textContent).toBe('Deal <3 [unknown]x[/unknown]')
	})
})
