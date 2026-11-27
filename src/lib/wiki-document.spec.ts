import { describe, expect, it } from 'vitest'
import { parseWikiDocument } from './wiki-document'
import { seedDocument, listSeedRefs } from './data/wiki-seed'
import { BASH_SECTIONS, CARD_SECTION_KEYS, cardSectionSeeds } from './data/card-article-content'

describe('validated wiki documents and the canonical card content source', () => {
	it('validates every existing seed without inventing missing fields', () => {
		for (const ref of listSeedRefs()) expect(seedDocument(ref), `${ref.type}:${ref.id}`).not.toBeNull()
	})
	it('rejects shallow forged documents which would break the renderer', () => {
		expect(parseWikiDocument({ kind: 'relic', page: { title: 'Forged', infobox: {}, gameTabs: [], glossary: [], intro: [], sections: [], updateHistory: {}, tokens: {}, tooltips: {} } })).toBeNull()
		expect(parseWikiDocument({ kind: 'power', page: { title: 'Forged' } })).toBeNull()
		expect(parseWikiDocument({ kind: 'card', page: { title: 'Forged', sections: [{ key: 'notes', content: 123 }] } })).toBeNull()
	})
	it('uses the Markdown files as the single Bash seed source', () => {
		const sections = cardSectionSeeds('Bash')
		expect(Object.keys(sections)).toEqual([...CARD_SECTION_KEYS])
		expect(sections.overview).toBe(BASH_SECTIONS.overview)
		expect(sections.overview).toContain('[[sts2:Card:Bash]]')
		expect(sections.synergies).toContain('[[sts2:Card:Bully]]')
		expect(sections.history).toContain('| Type | Version | Release Date | Changes |')
		expect(Object.values(cardSectionSeeds('OtherCard'))).toEqual(CARD_SECTION_KEYS.map(() => ''))
	})
})
