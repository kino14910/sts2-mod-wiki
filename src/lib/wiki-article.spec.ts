import { describe, expect, it } from 'vitest'
import { articleBlocks, articleMarkdown, articleSectionMarkdown, articleToc, composeWikiArticle, type ArticleContent, type PublishedSection } from './wiki-article'
import { BASH_CARD_CONTENT, BASH_EDITORIAL, BASH_SECTIONS } from './data/card-article-content'

const original: ArticleContent = {
	intro: [{ kind: 'paragraph', text: 'Original introduction' }],
	sections: [
		{ key: 'obtaining', id: 'Obtaining_Bash', title: 'Obtaining Bash', level: 2, blocks: [{ kind: 'paragraph', text: 'Starting deck' }] },
		{ key: 'interactions', id: 'Interactions', title: 'Interactions', level: 2, blocks: [] },
		{ key: 'synergies', id: 'Synergies', title: 'Synergies', level: 3, blocks: [] },
		{ key: 'relics', id: 'Relics', title: 'Relics', level: 4, blocks: [] },
		{ key: 'history', id: 'Update_History', title: 'Update History', level: 2, blocks: [] }
	]
}
function persisted(key: string, content: string, contentType = 'markdown'): PublishedSection {
	return { key, content, contentType, sectionId: `db:${key}`, version: 3 }
}

describe('article composition', () => {
	it('renders published content in the original section and keeps unedited text', () => {
		const article = composeWikiArticle(original, [persisted('synergies', 'Published synergy')])
		expect(article.sections.find((section) => section.key === 'synergies')).toMatchObject({
			id: 'Synergies', blocks: [{ kind: 'paragraph', text: 'Published synergy' }], published: { version: 3 }
		})
		expect(article.sections[0].blocks).toEqual(original.sections[0].blocks)
	})
	it('does not resurrect fallback text when a published section is intentionally blank', () => {
		expect(composeWikiArticle(original, [persisted('obtaining', '')]).sections[0].blocks).toEqual([])
	})
	it('overlays introduction and history aliases without creating duplicate headings', () => {
		const article = composeWikiArticle(original, [persisted('overview', 'Published intro'), persisted('update-history', 'A correction')])
		expect(article.intro).toEqual([{ kind: 'paragraph', text: 'Published intro' }])
		expect(article.sections.at(-1)?.blocks).toEqual([{ kind: 'paragraph', text: 'A correction' }])
		expect(article.sections.filter((section) => section.id === 'Update_History')).toHaveLength(1)
	})
	it('hides language names without mutating source content or persisted history', () => {
		const names = persisted('Names_in_Other_Languages', 'Archived names')
		const article = composeWikiArticle(original, [names])
		expect(article.sections.some((section) => section.id === 'Names_in_Other_Languages')).toBe(false)
		expect(names.content).toBe('Archived names')
		expect(original.sections).toHaveLength(6)
	})
	it('includes additional community sections in persisted sort order', () => {
		const article = composeWikiArticle(original, [
			{ ...persisted('strategy', 'Strategy'), sortOrder: 20 },
			{ ...persisted('mechanics', 'Mechanics'), sortOrder: 10 }
		])
		expect(article.sections.slice(-2).map((section) => section.key)).toEqual(['mechanics', 'strategy'])
	})
	it('derives continuous heading numbers after language-section removal', () => {
		expect(articleToc(composeWikiArticle(original, []).sections).map((item) => item.number)).toEqual(['1', '2', '2.1', '2.1.1', '3'])
	})
})

describe('persisted content rendering boundary', () => {
	it('uses one Bash content tree for fallback, published seed and editor drafts', () => {
		const published = Object.entries(BASH_SECTIONS).map(([key, content]) => persisted(key, content))
		const article = composeWikiArticle(BASH_CARD_CONTENT, published)
		expect(article.intro).toEqual(BASH_CARD_CONTENT.intro)
		expect(article.sections.map((section) => section.blocks)).toEqual(BASH_CARD_CONTENT.sections.map((section) => section.blocks))
		expect(articleSectionMarkdown(BASH_CARD_CONTENT)).toEqual(BASH_SECTIONS)
		expect(BASH_EDITORIAL.names.rows.length).toBeGreaterThan(0)
		expect(BASH_SECTIONS).not.toHaveProperty('names-in-other-languages')
	})
	it('round-trips nested lists, headings, escaped pipes and multiline history cells', () => {
		const blocks: Parameters<typeof articleMarkdown>[0] = [
			{ kind: 'heading', level: 3, text: 'Editorial context' },
			{ kind: 'list', items: [{ text: 'Parent', children: [{ text: 'First child' }, { text: 'Second child', children: [{ text: 'Grandchild' }] }] }, { text: 'Sibling' }] },
			{ kind: 'paragraph', text: 'Paragraph after the list.' },
			{ kind: 'table', table: { columns: ['Path', 'Changes'], rows: [[{ text: 'C:\\cards | wiki' }, { lines: ['First change', 'Second change'] }]] } }
		]
		expect(articleBlocks(articleMarkdown(blocks))).toEqual(blocks)
	})
	it('renders the Markdown update-history tables used by card initialization', () => {
		expect(articleBlocks('| Version | Changes |\n| --- | --- |\n| V1 | Added Bash |')).toEqual([
			{ kind: 'table', table: { columns: ['Version', 'Changes'], rows: [[{ text: 'V1' }, { text: 'Added Bash' }]] } }
		])
	})
	it('renders table revisions and removes executable links', () => {
		const blocks = articleBlocks(JSON.stringify({ columns: ['Change'], rows: [[{ text: 'Safe text', href: 'javascript:alert(1)' }], [{ text: 'Reference', href: 'https://example.com' }]] }), 'table')
		expect(blocks).toMatchObject([{ kind: 'table', table: { columns: ['Change'], rows: [[{ text: 'Safe text', href: undefined }], [{ href: 'https://example.com' }]] } }])
	})
	it('keeps nested lists in structured editorial sections', () => {
		const blocks = articleBlocks(JSON.stringify({ blocks: [{ kind: 'list', items: [{ text: 'Vulnerable', children: [{ text: 'Bully' }] }] }] }), 'structured')
		expect(blocks).toEqual([{ kind: 'list', items: [{ text: 'Vulnerable', children: [{ text: 'Bully', children: [] }] }] }])
	})
})
