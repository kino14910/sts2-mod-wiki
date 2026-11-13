import type { RelicWikiCell, RelicWikiTable, RelicWikiToken } from '#lib/data/relic-wiki'

/** Content contracts contain no presentation classes or component references. */
export interface ArticleListItem {
	text: string
	children?: ArticleListItem[]
}

export type ArticleBlock =
	| { kind: 'paragraph'; text: string }
	| { kind: 'list'; items: ArticleListItem[] }
	| { kind: 'heading'; level: 2 | 3 | 4; text: string }
	| { kind: 'table'; table: RelicWikiTable }

export interface ArticleSectionContent {
	key: string
	id: string
	title: string
	level: 2 | 3 | 4
	blocks: ArticleBlock[]
}

export interface ArticleContent {
	intro: ArticleBlock[]
	sections: ArticleSectionContent[]
	context?: { tokens: Record<string, RelicWikiToken>; tooltips: Record<string, string> }
	lang?: string
}

export interface PublishedSection {
	key: string
	sectionId: string | null
	contentType: string
	content: string
	version: number
	sortOrder?: number
	revisionId?: string | null
}

export interface ArticleSection extends ArticleSectionContent {
	published: PublishedSection | null
}

export interface ArticleView extends Omit<ArticleContent, 'sections'> {
	sections: ArticleSection[]
	overview: PublishedSection | null
}

/** Serialize the editable Markdown subset without importing game data or UI code. */
export function articleMarkdown(blocks: ArticleBlock[]): string {
	function list(items: ArticleListItem[], depth = 0): string {
		return items.map((item) => `${'  '.repeat(depth)}- ${item.text}${item.children?.length ? `\n${list(item.children, depth + 1)}` : ''}`).join('\n')
	}
	const cell = (value: string) => value.replaceAll('\\', '\\\\').replaceAll('|', '\\|').replaceAll('\n', '<br>')
	return blocks.map((block) => {
		if (block.kind === 'paragraph') return block.text
		if (block.kind === 'heading') return `${'#'.repeat(block.level - 1)} ${block.text}`
		if (block.kind === 'list') return list(block.items)
		const row = (cells: string[]) => `| ${cells.map(cell).join(' | ')} |`
		return [row(block.table.columns), row(block.table.columns.map(() => '---')),
			...block.table.rows.map((cells) => row(cells.map((value) =>
				`${value.text ?? ''}${value.subtext ? `<br>${value.subtext}` : ''}${value.lines?.length ? `<br>${value.lines.join('<br>')}` : ''}`)))].join('\n')
	}).join('\n\n')
}

export function articleSectionMarkdown(article: ArticleContent): Record<string, string> {
	return Object.fromEntries([
		['overview', articleMarkdown(article.intro)],
		...article.sections.filter((section) => !isHiddenArticleSection(section.key))
			.map((section) => [canonicalSectionKey(section.key), articleMarkdown(section.blocks)])
	])
}

const SECTION_ALIASES: Record<string, string> = {
	intro: 'overview', obtaining: 'obtaining', sources: 'obtaining',
	'update-history': 'history', 'update_history': 'history'
}

export function canonicalSectionKey(key: string): string {
	const normalized = key.toLowerCase().replaceAll('_', '-')
	return SECTION_ALIASES[normalized] ?? normalized
}

export function isHiddenArticleSection(key: string): boolean {
	return ['names-in-other-languages', 'other-names'].includes(canonicalSectionKey(key))
}

function record(value: unknown): Record<string, unknown> | null {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? value as Record<string, unknown> : null
}

function listItems(value: unknown, depth = 0): ArticleListItem[] {
	if (!Array.isArray(value) || depth > 10) return []
	return value.flatMap((item): ArticleListItem[] => {
		if (typeof item === 'string') return [{ text: item }]
		const row = record(item)
		return row && typeof row.text === 'string'
			? [{ text: row.text, children: listItems(row.children, depth + 1) }] : []
	})
}

function safeHref(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined
	return /^(https?:\/\/|\/(?!\/)|#)/i.test(value) ? value : undefined
}

export function articleTable(value: unknown): RelicWikiTable | null {
	const table = record(value)
	if (!table || !Array.isArray(table.columns) || !table.columns.every((v) => typeof v === 'string') || !Array.isArray(table.rows)) return null
	const rows: RelicWikiCell[][] = []
	for (const row of table.rows) {
		if (!Array.isArray(row)) return null
		rows.push(row.map((item) => {
			if (typeof item === 'string') return { text: item }
			const cell = record(item)
			return {
				text: typeof cell?.text === 'string' ? cell.text : undefined,
				subtext: typeof cell?.subtext === 'string' ? cell.subtext : undefined,
				lines: Array.isArray(cell?.lines) ? cell.lines.filter((v): v is string => typeof v === 'string') : undefined,
				href: safeHref(cell?.href)
			}
		}))
	}
	return { columns: table.columns, rows }
}

/** Validate persisted content at the UI boundary; never render user HTML. */
export function articleBlocks(content: string, contentType = 'markdown'): ArticleBlock[] {
	if (contentType === 'markdown') return markdownArticleBlocks(content)
	try {
		const value: unknown = JSON.parse(content)
		if (contentType === 'table') {
			const table = articleTable(value)
			if (table) return [{ kind: 'table', table }]
		}
		const data = record(value)
		const blocks: ArticleBlock[] = []
		if (Array.isArray(data?.blocks)) {
			for (const value of data.blocks) {
				const block = record(value)
				if (block?.kind === 'paragraph' && typeof block.text === 'string') blocks.push({ kind: 'paragraph', text: block.text })
				if (block?.kind === 'list') blocks.push({ kind: 'list', items: listItems(block.items) })
				if (block?.kind === 'table') {
					const table = articleTable(block.table)
					if (table) blocks.push({ kind: 'table', table })
				}
			}
			return blocks
		}
		if (Array.isArray(data?.paragraphs)) for (const text of data.paragraphs) {
			if (typeof text === 'string') blocks.push({ kind: 'paragraph', text })
		}
		if (Array.isArray(data?.lists)) for (const items of data.lists) blocks.push({ kind: 'list', items: listItems(items) })
		if (blocks.length) return blocks
	} catch { /* Retain malformed historical content as text instead of losing it. */ }
	return content ? [{ kind: 'paragraph', text: content }] : []
}

function markdownArticleBlocks(content: string): ArticleBlock[] {
	const lines = content.split(/\r?\n/)
	const blocks: ArticleBlock[] = []
	let pending: string[] = []
	function flush() {
		let paragraph: string[] = []
		let roots: ArticleListItem[] | null = null
		let stack: { indent: number; item: ArticleListItem }[] = []
		const flushParagraph = () => {
			if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') })
			paragraph = []
		}
		for (const line of pending) {
			if (!line.trim()) { flushParagraph(); roots = null; stack = []; continue }
			const heading = /^(#{1,3})\s+(.+)$/.exec(line)
			if (heading) {
				flushParagraph(); roots = null; stack = []
				blocks.push({ kind: 'heading', level: (heading[1].length + 1) as 2 | 3 | 4, text: heading[2].trim() })
				continue
			}
			const match = /^(\s*)[-*]\s+(.+)$/.exec(line)
			if (match) {
				flushParagraph()
				if (!roots) { roots = []; blocks.push({ kind: 'list', items: roots }) }
				const item = { text: match[2].trim() }
				const indent = match[1].replaceAll('\t', '  ').length
				while (stack.length && stack.at(-1)!.indent >= indent) stack.pop()
				const parent = stack.at(-1)?.item
				if (parent) (parent.children ??= []).push(item)
				else roots.push(item)
				stack.push({ indent, item })
			} else { roots = null; stack = []; paragraph.push(line.trim()) }
		}
		flushParagraph()
		pending = []
	}
	const cells = (line: string) => {
		const values: string[] = []
		let value = ''
		const source = line.trim().replace(/^\|/, '').replace(/\|$/, '')
		for (let index = 0; index < source.length; index++) {
			if (source[index] === '\\' && ['\\', '|'].includes(source[index + 1])) value += source[++index]
			else if (source[index] === '|') { values.push(value.trim()); value = '' }
			else value += source[index]
		}
		values.push(value.trim())
		return values
	}
	for (let index = 0; index < lines.length; index++) {
		const next = lines[index + 1]
		if (lines[index].includes('|') && next && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(next)) {
			flush()
			const columns = cells(lines[index])
			index += 2
			const rows: RelicWikiCell[][] = []
			while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
				rows.push(cells(lines[index]).map((value) => {
					const [text, ...lines] = value.split(/<br\s*\/?>/i)
					return lines.length ? { ...(text ? { text } : {}), lines } : { text }
				}))
				index++
			}
			index--
			blocks.push({ kind: 'table', table: { columns, rows } })
		} else pending.push(lines[index])
	}
	flush()
	return blocks
}

/** Published empty content is intentional and must not resurrect the seed text. */
export function composeWikiArticle(fallback: ArticleContent, published: PublishedSection[]): ArticleView {
	const byKey = new Map(published.map((section) => [canonicalSectionKey(section.key), section]))
	const overview = byKey.get('overview') ?? null
	const sections: ArticleSection[] = fallback.sections.filter((section) => !isHiddenArticleSection(section.key)).map((section) => {
		const current = byKey.get(canonicalSectionKey(section.key)) ?? null
		byKey.delete(canonicalSectionKey(section.key))
		return { ...section, blocks: current ? articleBlocks(current.content, current.contentType) : section.blocks, published: current }
	})
	for (const section of [...byKey.values()].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))) {
		if (['overview', 'document'].includes(canonicalSectionKey(section.key)) || isHiddenArticleSection(section.key)) continue
		sections.push({ key: section.key, id: section.key, title: section.key.replaceAll('-', ' '), level: 2, blocks: articleBlocks(section.content, section.contentType), published: section })
	}
	return { ...fallback, intro: overview ? articleBlocks(overview.content, overview.contentType) : fallback.intro, sections, overview }
}

export function articleToc(sections: ArticleSectionContent[]) {
	const numbers = [0, 0, 0]
	return sections.map((section) => {
		const depth = section.level - 2
		numbers[depth] += 1
		for (let index = depth + 1; index < numbers.length; index++) numbers[index] = 0
		return { id: section.id, label: section.title, depth, number: numbers.slice(0, depth + 1).join('.') }
	})
}

const UI = {
	eng: {
		edit: 'Edit', copy: 'Copy section link', copied: 'Link copied', copyFailed: 'Copy this link', history: 'History', discussion: 'Discussion',
		close: 'Close', signIn: 'Sign in', signOut: 'Sign out', account: 'Community account', unavailable: 'Sign-in is not configured on this site.',
		development: 'Local development sign-in', subject: 'Account', username: 'Display name', error: 'The request failed. Please try again.',
		conflict: 'This section changed while you were editing. Your draft has been kept.', reload: 'Load latest version', compare: 'Compare with latest',
		readOnly: 'This section is available for reading. Editing is not available yet.', show: 'show', hide: 'hide', overview: 'Overview',
		sessionExpired: 'Your session has expired. Sign in again to submit this draft.', review: 'Review changes', refresh: 'Refresh', summary: 'Edit summary', github: 'Continue with GitHub', withdraw: 'Withdraw proposal', withdrawn: 'Proposal withdrawn', rebase: 'Keep draft and use latest version'
	},
	zhs: {
		edit: '编辑', copy: '复制章节链接', copied: '链接已复制', copyFailed: '请复制此链接', history: '历史', discussion: '讨论',
		close: '关闭', signIn: '登录', signOut: '退出登录', account: '社区账户', unavailable: '本站尚未配置登录方式。',
		development: '本地开发登录', subject: '账户', username: '显示名称', error: '请求失败，请重试。',
		conflict: '编辑期间此章节已更新，草稿已保留。', reload: '载入最新版本', compare: '与最新版本比较',
		readOnly: '此章节可供阅读，暂未开放编辑。', show: '显示', hide: '隐藏', overview: '概述',
		sessionExpired: '登录已失效，请重新登录后提交草稿。', review: '审核修改', refresh: '刷新', summary: '编辑摘要', github: '使用 GitHub 登录', withdraw: '撤回提案', withdrawn: '提案已撤回', rebase: '保留草稿并采用最新版本'
	}
} as const

export function wikiUi(locale: string) { return locale === 'zhs' || locale === 'zh' ? UI.zhs : UI.eng }
