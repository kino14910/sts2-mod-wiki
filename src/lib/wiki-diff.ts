import type { DiffLine, DiffResult } from './wiki-collaboration'

// LCS is O(n*m); above this threshold fall back to a whole-block replacement so a huge
// pasted section cannot stall a request.
const MAX_DIFF_LINES = 800

export function splitLines(value: string): string[] {
	const normalized = value.replace(/\r\n?/g, '\n')
	const lines = normalized.split('\n')
	// A trailing newline only terminates the last line; it is not an extra blank line.
	if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
	return lines
}

function wholeBlockDiff(before: string[], after: string[], truncated: boolean): DiffResult {
	const lines: DiffLine[] = []
	before.forEach((text, index) =>
		lines.push({ type: 'remove', text, oldNumber: index + 1, newNumber: null })
	)
	after.forEach((text, index) =>
		lines.push({ type: 'add', text, oldNumber: null, newNumber: index + 1 })
	)
	return { lines, additions: after.length, deletions: before.length, truncated }
}

/** Line-level LCS diff used by review, history and upstream conflict views. */
export function diffLines(beforeText: string, afterText: string): DiffResult {
	const before = splitLines(beforeText)
	const after = splitLines(afterText)
	if (before.length > MAX_DIFF_LINES || after.length > MAX_DIFF_LINES)
		return wholeBlockDiff(before, after, true)

	const width = after.length + 1
	const table = new Uint16Array((before.length + 1) * width)
	for (let i = before.length - 1; i >= 0; i -= 1) {
		for (let j = after.length - 1; j >= 0; j -= 1) {
			table[i * width + j] =
				before[i] === after[j]
					? table[(i + 1) * width + j + 1] + 1
					: Math.max(table[(i + 1) * width + j], table[i * width + j + 1])
		}
	}

	const lines: DiffLine[] = []
	let i = 0
	let j = 0
	let additions = 0
	let deletions = 0
	while (i < before.length || j < after.length) {
		if (i < before.length && j < after.length && before[i] === after[j]) {
			lines.push({ type: 'equal', text: before[i], oldNumber: i + 1, newNumber: j + 1 })
			i += 1
			j += 1
			continue
		}
		const skipBefore = i < before.length ? table[(i + 1) * width + j] : 0
		const skipAfter = j < after.length ? table[i * width + j + 1] : 0
		if (j >= after.length || (i < before.length && skipBefore >= skipAfter)) {
			lines.push({ type: 'remove', text: before[i], oldNumber: i + 1, newNumber: null })
			deletions += 1
			i += 1
		} else {
			lines.push({ type: 'add', text: after[j], oldNumber: null, newNumber: j + 1 })
			additions += 1
			j += 1
		}
	}
	return { lines, additions, deletions, truncated: false }
}
