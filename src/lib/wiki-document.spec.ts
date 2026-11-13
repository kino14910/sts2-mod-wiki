import { describe, expect, it } from 'vitest'
import { parseWikiDocument } from './wiki-document'
import { seedDocument, listSeedRefs } from './data/wiki-seed'
import { BASH_EDITORIAL, CARD_SECTION_KEYS, cardSectionSeeds } from './data/card-article-content'

describe('validated wiki documents and the canonical card content source', () => {
	it('validates every existing seed without inventing missing fields', () => {
		for (const ref of listSeedRefs()) expect(seedDocument(ref), `${ref.type}:${ref.id}`).not.toBeNull()
	})
	it('rejects shallow forged documents which would break the renderer', () => {
		expect(parseWikiDocument({ kind: 'relic', page: { title: 'Forged', infobox: {}, gameTabs: [], glossary: [], intro: [], sections: [], updateHistory: {}, tokens: {}, tooltips: {} } })).toBeNull()
		expect(parseWikiDocument({ kind: 'power', page: { title: 'Forged' } })).toBeNull()
		expect(parseWikiDocument({ kind: 'card', page: { title: 'Forged', sections: [{ key: 'notes', content: 123 }] } })).toBeNull()
	})
	it('serializes editorial facts into seed content with no second hand-written copy', () => {
		const sections = cardSectionSeeds('Bash')
		expect(Object.keys(sections)).toEqual([...CARD_SECTION_KEYS])
		expect(sections.overview).toBe(BASH_EDITORIAL.intro)
		for (const text of BASH_EDITORIAL.synergies) expect(sections.synergies).toContain(text)
		for (const row of BASH_EDITORIAL.updateHistory.rows) {
			for (const cell of row) {
				if ('text' in cell) expect(sections.history).toContain(cell.text)
				if ('lines' in cell) for (const line of cell.lines ?? []) expect(sections.history).toContain(line)
			}
		}
		expect(Object.values(cardSectionSeeds('OtherCard'))).toEqual(CARD_SECTION_KEYS.map(() => ''))
	})
})
