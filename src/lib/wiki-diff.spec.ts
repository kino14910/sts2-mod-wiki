import { describe, expect, it } from 'vitest'
import { diffLines, splitLines } from './wiki-diff'

describe('wiki line diff', () => {
	it('reports identical content as equal lines', () => {
		const result = diffLines('one\ntwo', 'one\ntwo')
		expect(result.additions).toBe(0)
		expect(result.deletions).toBe(0)
		expect(result.lines.every((line) => line.type === 'equal')).toBe(true)
	})

	it('marks changed lines and keeps old/new line numbers', () => {
		const result = diffLines('keep\nold\nkeep', 'keep\nnew\nkeep')
		expect(result.additions).toBe(1)
		expect(result.deletions).toBe(1)
		const removed = result.lines.find((line) => line.type === 'remove')
		const added = result.lines.find((line) => line.type === 'add')
		expect(removed?.text).toBe('old')
		expect(removed?.oldNumber).toBe(2)
		expect(added?.text).toBe('new')
		expect(added?.newNumber).toBe(2)
	})

	it('normalizes CRLF and does not invent a trailing blank line', () => {
		expect(splitLines('a\r\nb\r\n')).toEqual(['a', 'b'])
		expect(diffLines('a\r\nb', 'a\nb').additions).toBe(0)
	})

	it('handles pure insertions and deletions', () => {
		expect(diffLines('a\nb', 'a\nx\nb').additions).toBe(1)
		expect(diffLines('a\nx\nb', 'a\nb').deletions).toBe(1)
	})

	it('falls back to a whole-block diff above the safety threshold', () => {
		const before = Array.from({ length: 900 }, (_, index) => `old ${index}`).join('\n')
		const after = Array.from({ length: 900 }, (_, index) => `new ${index}`).join('\n')
		const result = diffLines(before, after)
		expect(result.truncated).toBe(true)
		expect(result.deletions).toBe(900)
		expect(result.additions).toBe(900)
	})
})
