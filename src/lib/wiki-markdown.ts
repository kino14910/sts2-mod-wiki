export type MarkdownBlock =
	| { kind: 'heading'; level: 2 | 3 | 4; text: string }
	| { kind: 'list'; items: string[] }
	| { kind: 'paragraph'; text: string }

export interface InlineSegment {
	text: string
	bold: boolean
}

const HEADING = /^(#{1,3})\s+(.+)$/
const LIST_ITEM = /^\s*[-*]\s+(.+)$/

export function parseMarkdownBlocks(content: string): MarkdownBlock[] {
	const blocks: MarkdownBlock[] = []
	let paragraph: string[] = []
	let list: string[] = []

	const flushParagraph = () => {
		if (paragraph.length === 0) return
		blocks.push({ kind: 'paragraph', text: paragraph.join(' ') })
		paragraph = []
	}
	const flushList = () => {
		if (list.length === 0) return
		blocks.push({ kind: 'list', items: list })
		list = []
	}
	const flushAll = () => {
		flushParagraph()
		flushList()
	}

	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trimEnd()
		if (line.trim().length === 0) {
			flushAll()
			continue
		}
		const heading = HEADING.exec(line)
		if (heading) {
			flushAll()
			blocks.push({
				kind: 'heading',
				level: Math.min(heading[1].length + 1, 4) as 2 | 3 | 4,
				text: heading[2].trim()
			})
			continue
		}
		const item = LIST_ITEM.exec(line)
		if (item) {
			flushParagraph()
			list.push(item[1].trim())
			continue
		}
		flushList()
		paragraph.push(line.trim())
	}
	flushAll()
	return blocks
}

export function parseInlineSegments(text: string): InlineSegment[] {
	const segments: InlineSegment[] = []
	const pattern = /\*\*([^*]+)\*\*/g
	let lastIndex = 0
	for (const match of text.matchAll(pattern)) {
		const index = match.index ?? 0
		if (index > lastIndex) segments.push({ text: text.slice(lastIndex, index), bold: false })
		segments.push({ text: match[1], bold: true })
		lastIndex = index + match[0].length
	}
	if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), bold: false })
	return segments.length > 0 ? segments : [{ text, bold: false }]
}
