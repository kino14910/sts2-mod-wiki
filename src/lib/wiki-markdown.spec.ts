import { describe, expect, it } from 'vitest'
import { parseInlineSegments, parseMarkdownBlocks } from './wiki-markdown'

describe('mod wiki markdown blocks', () => {
	it('parses headings, paragraphs and lists without executing HTML', () => {
		const blocks = parseMarkdownBlocks(
			'# Title\n\nFirst paragraph.\nContinues here.\n\n## Keywords\n\n- Exhaust\n- **Sly** and StS2 Icon Vulnerable.png Vulnerable\n'
		)
		expect(blocks).toEqual([
			{ kind: 'heading', level: 2, text: 'Title' },
			{ kind: 'paragraph', text: 'First paragraph. Continues here.' },
			{ kind: 'heading', level: 3, text: 'Keywords' },
			{
				kind: 'list',
				items: ['Exhaust', '**Sly** and StS2 Icon Vulnerable.png Vulnerable']
			}
		])
	})

	it('preserves wiki tokens as plain text segments', () => {
		expect(parseInlineSegments('Apply **Vulnerable** with StS2 Icon Vulnerable.png')).toEqual([
			{ text: 'Apply ', bold: false },
			{ text: 'Vulnerable', bold: true },
			{ text: ' with StS2 Icon Vulnerable.png', bold: false }
		])
	})

	it('returns a single segment when no bold markup is present', () => {
		expect(parseInlineSegments('plain text')).toEqual([{ text: 'plain text', bold: false }])
	})

	it('handles empty content', () => {
		expect(parseMarkdownBlocks('')).toEqual([])
	})
})
