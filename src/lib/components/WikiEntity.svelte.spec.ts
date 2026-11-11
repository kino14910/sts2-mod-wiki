import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import WikiEntity from './WikiEntity.svelte'
import type { WikiEntry } from '#lib/data/power-wiki'

function entry(partial: Partial<WikiEntry> & Pick<WikiEntry, 'name' | 'kind'>): WikiEntry {
	return { description: '', tooltip: '', href: null, ...partial }
}

describe('WikiEntity.svelte entry icon by kind', () => {
	it('renders a power icon for a power entry', () => {
		const { container } = render(WikiEntity, {
			entry: entry({ name: 'Vulnerable', kind: 'power', id: 'VulnerablePower' })
		})
		const img = container.querySelector('.wiki-icon-img') as HTMLImageElement | null
		expect(img).toBeTruthy()
		expect(img?.getAttribute('src')).toBeTruthy()
	})

	it('renders a card icon for a card entry', () => {
		const { container } = render(WikiEntity, {
			entry: entry({ name: 'Cruelty', kind: 'card', id: 'Cruelty' })
		})
		const img = container.querySelector('.wiki-icon-img') as HTMLImageElement | null
		expect(img).toBeTruthy()
		expect(img?.getAttribute('src')).toBeTruthy()
	})

	it('renders a relic icon when the relic has an image', () => {
		const { container } = render(WikiEntity, {
			entry: entry({ name: 'Bag of Marbles', kind: 'relic', id: 'BagOfMarbles' })
		})
		const img = container.querySelector('.wiki-icon-img') as HTMLImageElement | null
		expect(img?.getAttribute('src')).toBeTruthy()
	})

	it('renders a potion icon when the potion has an image', () => {
		const { container } = render(WikiEntity, {
			entry: entry({ name: 'Vulnerable Potion', kind: 'potion', id: 'VulnerablePotion' })
		})
		const img = container.querySelector('.wiki-icon-img') as HTMLImageElement | null
		expect(img?.getAttribute('src')).toBeTruthy()
	})
})
