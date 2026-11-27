import { describe, expect, it } from 'vitest'
import { BASH_SECTIONS } from '#lib/data/card-article-content'
import { parseWikiMarkdown, type HastElement, type HastNode } from './wiki-markdown'

const SAMPLE = `Bash applies [[sts2:Keyword:Vulnerable]].

See [[sts2:Card:Bash]].

A Mod card: [[fgo:Card:Strike]].

| Card | Effect |
|---|---|
| [[sts2:Card:Bash]] | Apply [[sts2:Keyword:Vulnerable]] |

:::details{summary="Interactions"}
[[sts2:Card:Bash]]
:::`

function walk(node: HastNode | { type: 'root'; children: HastNode[] }, visit: (node: HastElement) => void) {
	if (node.type === 'element') visit(node)
	if (node.type === 'element' || node.type === 'root') {
		for (const child of node.children) walk(child, visit)
	}
}

function elements(markdown: string, tagName: string) {
	const found: HastElement[] = []
	walk(parseWikiMarkdown(markdown), (node) => {
		if (node.tagName === tagName) found.push(node)
	})
	return found
}

function textOf(node: { type: string; value?: string; children?: HastNode[] }): string {
	if (node.type === 'text' && typeof node.value === 'string') return node.value
	return (node.children ?? []).map(textOf).join('')
}

describe('wiki markdown pipeline', () => {
	it('parses namespace entity references into structured nodes', () => {
		const nodes = elements(SAMPLE, 'wiki-entity')
		expect(nodes.map((node) => node.properties)).toEqual([
			{ namespace: 'sts2', entityType: 'Keyword', entityId: 'Vulnerable', raw: '[[sts2:Keyword:Vulnerable]]' },
			{ namespace: 'sts2', entityType: 'Card', entityId: 'Bash', raw: '[[sts2:Card:Bash]]' },
			{ namespace: 'fgo', entityType: 'Card', entityId: 'Strike', raw: '[[fgo:Card:Strike]]' },
			{ namespace: 'sts2', entityType: 'Card', entityId: 'Bash', raw: '[[sts2:Card:Bash]]' },
			{ namespace: 'sts2', entityType: 'Keyword', entityId: 'Vulnerable', raw: '[[sts2:Keyword:Vulnerable]]' },
			{ namespace: 'sts2', entityType: 'Card', entityId: 'Bash', raw: '[[sts2:Card:Bash]]' }
		])
	})

	it('renders details containers with entity references inside', () => {
		const details = elements(SAMPLE, 'wiki-details')
		expect(details).toHaveLength(1)
		expect(details[0].properties).toEqual({ summary: 'Interactions' })
		expect(elements(SAMPLE, 'wiki-entity').at(-1)?.properties.entityId).toBe('Bash')
	})

	it('supports attributed details blocks separated by blank lines', () => {
		const details = elements(
			':::details{summary="Synergies"}\n\n**Bold** body\n\n- [[sts2:Card:Bash]]\n\n:::',
			'wiki-details'
		)
		expect(details).toHaveLength(1)
		expect(details[0].properties.summary).toBe('Synergies')
		expect(textOf(details[0])).toContain('Bold')
		const entities: HastElement[] = []
		walk(details[0], (node) => { if (node.tagName === 'wiki-entity') entities.push(node) })
		expect(entities.map((node) => node.properties.entityId)).toEqual(['Bash'])
	})

	it('keeps GFM tables and their entity cells', () => {
		const tables = elements(SAMPLE, 'table')
		expect(tables).toHaveLength(1)
		expect(elements(SAMPLE, 'th')).toHaveLength(2)
		expect(elements(SAMPLE, 'td')).toHaveLength(2)
	})

	it('leaves references inside fenced and inline code untouched', () => {
		const markdown = '```\n[[sts2:Card:Bash]]\n```\n\nInline `[[sts2:Keyword:Vulnerable]]` code.'
		expect(elements(markdown, 'wiki-entity')).toHaveLength(0)
		expect(elements(markdown, 'pre')).toHaveLength(1)
		expect(elements(markdown, 'code')).toHaveLength(2)
		expect(textOf(elements(markdown, 'pre')[0])).toBe('[[sts2:Card:Bash]]\n')
		expect(textOf(elements(markdown, 'code')[1])).toBe('[[sts2:Keyword:Vulnerable]]')
	})

	it('keeps incomplete references and unknown entity types as literal text', () => {
		const markdown = '[[sts2:Card]] [[Card:Bash]] [[sts2:Widget:Bash]]'
		expect(elements(markdown, 'wiki-entity')).toHaveLength(0)
		expect(textOf(parseWikiMarkdown(markdown))).toBe(markdown)
	})

	it('maps legacy [[Key]] tokens to token nodes for existing content', () => {
		const tokens = elements('[[Bash]] applies [[Vulnerable]]', 'wiki-token')
		expect(tokens.map((node) => node.properties)).toEqual([
			{ key: 'Bash', raw: '[[Bash]]' },
			{ key: 'Vulnerable', raw: '[[Vulnerable]]' }
		])
	})

	it('adds deterministic heading anchors and de-duplicates them', () => {
		const markdown = '# Obtaining Bash\n\n## Obtaining Bash\n\n## 中文 标题'
		const headings: HastElement[] = []
		walk(parseWikiMarkdown(markdown), (node) => {
			if (/^h[1-6]$/.test(node.tagName)) headings.push(node)
		})
		expect(headings.map((node) => node.properties.id)).toEqual(['obtaining-bash', 'obtaining-bash-2', '中文-标题'])
		expect(headings.map((node) => node.properties.headingText)).toEqual(['Obtaining Bash', 'Obtaining Bash', '中文 标题'])
	})

	it('never turns user HTML into elements and keeps <br> as a line break', () => {
		const markdown = '<script>alert(1)</script>\n\n| A | B |\n|---|---|\n| first<br>second | <b>raw</b> |'
		expect(elements(markdown, 'script')).toHaveLength(0)
		expect(elements(markdown, 'b')).toHaveLength(0)
		expect(textOf(parseWikiMarkdown(markdown))).toContain('<script>alert(1)</script>')
		expect(textOf(parseWikiMarkdown(markdown))).toContain('<b>raw</b>')
		expect(elements(markdown, 'br')).toHaveLength(1)
	})

	it('parses the Bash Markdown files into structured entities and tables', () => {
		const markdown = Object.values(BASH_SECTIONS).join('\n\n')
		const refs = elements(markdown, 'wiki-entity').map((node) =>
			`${node.properties.namespace}:${node.properties.entityType}:${node.properties.entityId}`
		)
		expect(refs).toContain('sts2:Card:Bash')
		expect(refs).toContain('sts2:Keyword:Vulnerable')
		expect(refs).toContain('sts2:Card:Bully')
		expect(refs).toContain('sts2:Relic:PaperPhrog')
		expect(refs).toContain('sts2:Relic:ArchaicTooth')
		expect(markdown).not.toMatch(/\[\[(Bash|Bully|Vulnerable|Paper Phrog|Archaic Tooth)\]\]/)
		expect(elements(BASH_SECTIONS.history, 'table')).toHaveLength(1)
		expect(elements(BASH_SECTIONS.history, 'br').length).toBeGreaterThan(0)
		expect(elements(BASH_SECTIONS.synergies, 'ul')).toHaveLength(2)
	})
})
