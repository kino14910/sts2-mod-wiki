import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import GameText from './GameText.svelte'

describe('GameText.svelte', () => {
	it('renders the reference description with entity, variable and preserved styles', () => {
		const { container } = render(GameText, {
			text: '[gold]中毒[/gold]会多触发[blue]{Amount}[/blue]次。',
			options: { locale: 'zhs', variables: { Amount: 3 } }
		})

		const link = container.querySelector('a[href="/power/PoisonPower"]')
		expect(link?.textContent).toContain('中毒')
		expect(container.querySelector('.game-variable[data-variable="Amount"]')?.textContent).toBe('3')
		expect(container.textContent).toBe('中毒会多触发3次。')

		const tags = [...container.querySelectorAll<HTMLElement>('.game-text > span')]
		expect(tags).toHaveLength(2)
		expect(tags[0].style.color).not.toBe('')
		expect(tags[1].style.color).not.toBe('')
		expect(tags[0].style.color).not.toBe(tags[1].style.color)
	})

	it('only links entities inside gold nodes', () => {
		const plain = render(GameText, { text: '中毒会多触发一次', options: { locale: 'zhs' } })
		expect(plain.container.querySelector('.wiki-card-link')).toBeNull()

		const blue = render(GameText, { text: '[blue]力量[/blue]', options: { locale: 'zhs' } })
		expect(blue.container.querySelector('a[href="/power/StrengthPower"]')).toBeNull()

		const gold = render(GameText, { text: '[gold]中毒[/gold]', options: { locale: 'zhs' } })
		expect(gold.container.querySelector('a[href="/power/PoisonPower"]')).toBeTruthy()
	})

	it('keeps nested styles and resolves entities through the nesting', () => {
		const { container } = render(GameText, {
			text: '[gold][b]中毒[/b][/gold]',
			options: { locale: 'zhs' }
		})
		expect(container.querySelector('a[href="/power/PoisonPower"]')).toBeTruthy()
		const bold = container.querySelector<HTMLElement>('span[style*="font-weight"]')
		expect(bold?.style.fontWeight).toBe('700')
	})

	it('renders variables together with their BBCode style', () => {
		const { container } = render(GameText, {
			text: '[blue]{Amount}[/blue]',
			options: { locale: 'eng', variables: { Amount: 5 } }
		})
		const tag = container.querySelector<HTMLElement>('.game-text > span')
		expect(tag?.style.color).not.toBe('')
		expect(tag?.querySelector('.game-variable')?.textContent).toBe('5')
	})

	it('renders icons, breaks and unknown tags as text', () => {
		const icons = render(GameText, { text: '[energy_icons=2]', options: { locale: 'eng' } })
		expect(icons.container.querySelectorAll('img.sts-energy-icon')).toHaveLength(2)

		const br = render(GameText, { text: 'a[br]b', options: { locale: 'eng' } })
		expect(br.container.querySelector('br')).toBeTruthy()

		const unknown = render(GameText, {
			text: 'a[mystery]b[/mystery]',
			options: { locale: 'eng' }
		})
		expect(unknown.container.textContent).toBe('a[mystery]b[/mystery]')
	})

	it('does not link ambiguous names', () => {
		const { container } = render(GameText, {
			text: '[gold]Strike[/gold]',
			options: { locale: 'eng' }
		})
		expect(container.querySelector('.wiki-card-link')).toBeNull()
		expect(container.textContent).toContain('Strike')
	})

	it('drops links but keeps entity markup when not interactive', () => {
		const { container } = render(GameText, {
			text: '[gold]Vulnerable[/gold]',
			options: { locale: 'eng', interactive: false }
		})
		expect(container.querySelector('a')).toBeNull()
		expect(container.querySelector('.wiki-term')?.textContent).toBe('Vulnerable')
	})

	it('renders plain text when entity matching is disabled', () => {
		const { container } = render(GameText, {
			text: '[gold]Vulnerable[/gold]',
			options: { locale: 'eng', matchEntities: false }
		})
		expect(container.querySelector('.wiki-card-link')).toBeNull()
		expect(container.querySelector<HTMLElement>('.game-text > span')?.style.color).not.toBe('')
		expect(container.textContent).toBe('Vulnerable')
	})

	it('renders explicit icons through the shared img renderer', () => {
		const { container } = render(GameText, {
			text: '§ICON_star_icon§',
			options: { locale: 'eng' }
		})
		const img = container.querySelector<HTMLImageElement>('img.sts-energy-icon')
		expect(img?.src).toContain('/mods/sts2/images/star_icon.png')
		expect(img?.dataset.iconRef).toContain('star_icon')
	})

	it('keeps a diagnostic placeholder instead of a broken image', () => {
		const { container } = render(GameText, {
			text: '§ICON_NotARealIcon§',
			options: { locale: 'eng' }
		})
		expect(container.querySelector('img.sts-energy-icon')).toBeNull()
		expect(
			container.querySelector('[data-icon-missing]')?.getAttribute('data-icon-missing')
		).toContain('missing asset icon')
	})

	it('does not render an extra icon for bracketed upgraded numbers', () => {
		const { container } = render(GameText, {
			text: 'Deal 8 (10) damage',
			options: { locale: 'eng' }
		})
		expect(container.querySelectorAll('img.sts-energy-icon')).toHaveLength(0)
		expect(container.textContent).toBe('Deal 8 (10) damage')
	})
})
