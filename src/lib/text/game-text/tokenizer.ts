import { KNOWN_TAGS, parseArg } from '../bbcode'
import type { IconRef } from '#lib/data/icon-registry'
import { findExplicitIcons } from './icon-syntax'
import { parseGameTemplate } from '../game-template'

export type GameTextToken =
	| { type: 'text'; value: string }
	| { type: 'unknown'; raw: string }
	| { type: 'open'; name: string; arg: string | null }
	| { type: 'close'; name: string }
	| { type: 'break' }
	| { type: 'iconRef'; ref: IconRef; raw: string }

const ICON_TAGS = new Set(['energy_icons', 'star_icons', 'energy', 'star'])
const TAG_RE = /\[(\/?)([a-zA-Z_]+)([^\]]*)\]/g

type Hit = { start: number; end: number; token: GameTextToken }

export function tokenizeGameText(src: string, modId?: string): GameTextToken[] {
	const hits: Hit[] = []
	// A formatter branch can contain arbitrary BBCode. Keep the entire expression
	// intact until its branch is selected, otherwise {IfUpgraded:show:[gold]...} breaks.
	const expressions = parseGameTemplate(src).filter((node) => node.type === 'variable')
	const insideExpression = (start: number, end: number) =>
		expressions.some((node) => start < node.end && end > node.start)
	TAG_RE.lastIndex = 0
	for (const match of src.matchAll(TAG_RE)) {
		const start = match.index ?? 0
		if (insideExpression(start, start + match[0].length)) continue
		const name = match[2].toLowerCase()
		const arg = parseArg(match[3])
		let token: GameTextToken
		if (!KNOWN_TAGS.has(name) && !ICON_TAGS.has(name)) {
			token = { type: 'unknown', raw: match[0] }
		} else if (match[1] === '/') {
			token = { type: 'close', name }
		} else if (name === 'br') {
			token = { type: 'break' }
		} else {
			token = { type: 'open', name, arg }
		}
		hits.push({ start, end: start + match[0].length, token })
	}

	const icons = findExplicitIcons(src, modId)
		.filter((icon) => !insideExpression(icon.start, icon.end))
		.sort((a, b) => a.start - b.start)
	for (const icon of icons) {
		hits.push({
			start: icon.start,
			end: icon.end,
			token: { type: 'iconRef', ref: icon.token.ref, raw: icon.token.raw }
		})
	}

	const overlapsIcon = (hit: Hit) =>
		icons.some((icon) => hit.start < icon.end && hit.end > icon.start)

	const ordered = hits
		.filter((hit) => hit.token.type === 'iconRef' || !overlapsIcon(hit))
		.sort((a, b) => a.start - b.start || (a.token.type === 'iconRef' ? -1 : 1))

	const tokens: GameTextToken[] = []
	let last = 0
	for (const hit of ordered) {
		if (hit.start > last) tokens.push({ type: 'text', value: src.slice(last, hit.start) })
		tokens.push(hit.token)
		last = Math.max(last, hit.end)
	}
	if (last < src.length) tokens.push({ type: 'text', value: src.slice(last) })
	return tokens
}
