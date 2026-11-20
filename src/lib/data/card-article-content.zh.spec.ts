import { describe, expect, it } from 'vitest'
import { BASH_CARD_CONTENT } from './card-article-content'
import {
	BASH_CARD_CONTENT_ZH,
	BASH_SECTIONS_ZH,
	localizedBashSection
} from './card-article-content.zh'
import { CARD_SECTION_KEYS } from './card-article-content'
import { articleBlocks } from '#lib/wiki-article'

describe('Bash Chinese article', () => {
	it('keeps section keys, ids and levels aligned with the English article', () => {
		const shape = (content: typeof BASH_CARD_CONTENT) =>
			content.sections.map(({ key, id, level }) => ({ key, id, level }))
		expect(shape(BASH_CARD_CONTENT_ZH)).toEqual(shape(BASH_CARD_CONTENT))
		expect(BASH_CARD_CONTENT_ZH.lang).toBe('zh-Hans')
	})

	it('produces seed markdown for every card section and round-trips Chinese text', () => {
		expect(Object.keys(BASH_SECTIONS_ZH).sort()).toEqual([...CARD_SECTION_KEYS].sort())
		const blocks = articleBlocks(BASH_SECTIONS_ZH.history)
		expect(blocks[0]).toMatchObject({ kind: 'table' })
		expect(JSON.stringify(blocks)).toContain('痛击')
	})

	it('swaps only imported seed sections in zhs and preserves community edits', () => {
		const seed = { key: 'obtaining', sourceType: 'mod_seed', content: 'English' }
		const community = { key: 'obtaining', sourceType: 'community', content: 'Community draft' }
		expect(localizedBashSection(seed, 'zhs').content).toBe(BASH_SECTIONS_ZH.obtaining)
		expect(localizedBashSection(seed, 'eng').content).toBe('English')
		expect(localizedBashSection(community, 'zhs').content).toBe('Community draft')
	})
})
