import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified, type Plugin } from 'unified'
import { parseWikiEntityReference } from './wiki-entity-syntax.ts'

/** 解析产物只使用 text / element 两种节点，渲染层无需信任任意 HTML。 */
export interface HastText {
	type: 'text'
	value: string
}

export interface HastElement {
	type: 'element'
	tagName: string
	properties: Record<string, unknown>
	children: HastNode[]
}

export type HastNode = HastText | HastElement

export interface HastRoot {
	type: 'root'
	children: HastNode[]
}

interface MarkdownNode {
	type: string
	value?: string
	children?: MarkdownNode[]
	data?: { hName?: string; hProperties?: Record<string, unknown> }
}

interface MarkdownRoot extends MarkdownNode {
	type: 'root'
}

const DETAILS_OPEN = /^:::\s*details\s*(?:\{([^}]*)\})?\s*$/i
const DETAILS_CLOSE = /^:::\s*$/
/** 旧 WikiInline 的 [[key]] 形式保留兼容；含冒号的引用必须是完整实体语法。 */
const WIKI_REFERENCE = /\[\[([^[\]\n]+)\]\]/g
const BR_HTML = /^<br\s*\/?>$/i
const SKIP_ENTITY_SCAN = new Set(['code', 'inlineCode', 'link', 'definition', 'html'])

/** 仅用于解析 details 单段落内部的 Markdown 片段。 */
const fragmentParser = unified().use(remarkParse).use(remarkGfm)

function normalizeRawHtml(parent: MarkdownNode) {
	if (!parent.children) return
	parent.children = parent.children.map((child) => {
		if (child.type === 'html' && typeof child.value === 'string') {
			/* 只把 <br> 当作换行；其余 HTML 一律降级成普通文本，永不生成 raw 节点。 */
			return BR_HTML.test(child.value.trim())
				? { type: 'break' }
				: { type: 'text', value: child.value }
		}
		normalizeRawHtml(child)
		return child
	})
}

function nodeText(node: MarkdownNode): string {
	return (node.children ?? [])
		.map((child) => (child.type === 'break' ? '\n' : child.value ?? ''))
		.join('')
}

function attribute(source: string, name: string): string {
	const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(source)
	return (match?.[1] ?? match?.[2] ?? '').trim()
}

function detailsNode(summary: string, children: MarkdownNode[]): MarkdownNode {
	return {
		type: 'wikiDetails',
		data: { hName: 'wiki-details', hProperties: { summary } },
		children
	}
}

function transformDetails(parent: MarkdownNode) {
	if (!parent.children) return
	const children = parent.children

	for (const child of children) {
		if (child.children && child.type !== 'wikiDetails') transformDetails(child)
	}

	let index = 0
	while (index < children.length) {
		const paragraph = children[index]
		const first = paragraph.children?.[0]
		if (paragraph.type !== 'paragraph' || !first || first.type !== 'text' || typeof first.value !== 'string') {
			index++
			continue
		}

		const newline = first.value.indexOf('\n')
		const firstLine = (newline === -1 ? first.value : first.value.slice(0, newline)).trim()
		const open = DETAILS_OPEN.exec(firstLine)
		if (!open) {
			index++
			continue
		}

		const summary = attribute(open[1] ?? '', 'summary')

		/* :::details{summary="…"} 与内容、::: 位于同一段落（无空行） */
		if (paragraph.children?.length === 1) {
			const lines = first.value.split('\n')
			if (lines.length >= 2 && DETAILS_CLOSE.test(lines.at(-1)!.trim())) {
				const body = parseFragment(lines.slice(1, -1).join('\n'))
				const details = detailsNode(summary, body)
				transformDetails(details)
				children.splice(index, 1, details)
				index++
				continue
			}
		}

		/* 独立段落形式：opening / body / ::: */
		if (first.value.trim() !== firstLine) {
			index++
			continue
		}
		let close = index + 1
		while (close < children.length) {
			const candidate = children[close]
			if (candidate.type === 'paragraph' && DETAILS_CLOSE.test(nodeText(candidate).trim())) break
			close++
		}
		if (close >= children.length) {
			index++
			continue
		}
		const details = detailsNode(summary, children.slice(index + 1, close))
		transformDetails(details)
		children.splice(index, close - index + 1, details)
		index++
	}
}

function splitText(value: string): MarkdownNode[] {
	const nodes: MarkdownNode[] = []
	let last = 0
	WIKI_REFERENCE.lastIndex = 0
	for (const match of value.matchAll(WIKI_REFERENCE)) {
		const start = match.index ?? 0
		if (start > last) nodes.push({ type: 'text', value: value.slice(last, start) })

		const inner = match[1]
		const reference = parseWikiEntityReference(inner)
		if (reference) {
			nodes.push({
				type: 'wikiEntity',
				data: {
					hName: 'wiki-entity',
					hProperties: {
						namespace: reference.namespace,
						entityType: reference.entityType,
						entityId: reference.entityId,
						raw: match[0]
					}
				},
				children: []
			})
		} else if (!inner.includes(':')) {
			/* 兼容旧 [[key]] token；未命中的 token 由渲染层原样输出。 */
			nodes.push({
				type: 'wikiToken',
				data: { hName: 'wiki-token', hProperties: { key: inner, raw: match[0] } },
				children: []
			})
		} else {
			/* 不完整或未知类型的引用保持字面量，不猜测实体。 */
			nodes.push({ type: 'text', value: match[0] })
		}
		last = start + match[0].length
	}
	if (last < value.length) nodes.push({ type: 'text', value: value.slice(last) })
	return nodes
}

function transformEntityReferences(parent: MarkdownNode) {
	if (!parent.children) return
	const next: MarkdownNode[] = []
	for (const child of parent.children) {
		if (child.type === 'text' && typeof child.value === 'string' && child.value.includes('[[')) {
			next.push(...splitText(child.value))
			continue
		}
		if (!SKIP_ENTITY_SCAN.has(child.type)) transformEntityReferences(child)
		next.push(child)
	}
	parent.children = next
}

function parseFragment(markdown: string): MarkdownNode[] {
	if (!markdown.trim()) return []
	const tree = fragmentParser.parse(markdown) as unknown as MarkdownRoot
	normalizeRawHtml(tree)
	transformDetails(tree)
	return tree.children ?? []
}

/** mdast 阶段的 Wiki 语法：安全 HTML 降级、details 容器、实体引用节点。 */
export const remarkWikiSyntax: Plugin = () => (tree) => {
	const root = tree as unknown as MarkdownRoot
	normalizeRawHtml(root)
	transformDetails(root)
	transformEntityReferences(root)
}

function hasteText(node: HastNode): string {
	if (node.type === 'text') return node.value
	return node.children.map(hasteText).join('')
}

function slugify(value: string): string {
	return value
		.normalize('NFKC')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s_-]/gu, '')
		.trim()
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
}

function walkHast(node: HastNode, visit: (node: HastElement) => void) {
	if (node.type !== 'element') return
	visit(node)
	for (const child of node.children) walkHast(child, visit)
}

/** 标题锚点：确定性 slug + 去重，供 WikiHeading 复用复制链接能力。 */
export const rehypeHeadingAnchors: Plugin = () => (tree) => {
	const root = tree as unknown as HastRoot
	const used = new Map<string, number>()
	const anchors = (element: HastElement) => {
		if (!/^h[1-6]$/.test(element.tagName)) return
		const text = hasteText(element).trim()
		const base = slugify(text) || 'section'
		const seen = used.get(base) ?? 0
		used.set(base, seen + 1)
		element.properties = {
			...element.properties,
			id: seen === 0 ? base : `${base}-${seen + 1}`,
			headingText: text
		}
	}
	for (const child of root.children) walkHast(child, anchors)
}

const parser = unified()
	.use(remarkParse)
	.use(remarkGfm)
	.use(remarkWikiSyntax)
	.use(remarkRehype)
	.use(rehypeHeadingAnchors)

export function parseWikiMarkdown(markdown: string): HastRoot {
	if (!markdown) return { type: 'root', children: [] }
	const tree = parser.runSync(parser.parse(markdown))
	return tree as unknown as HastRoot
}
