import type { EntityMatchContext } from '#lib/data/entity-name-index'
import { stripBBCode } from '../bbcode'
import { resolveCardTextToBBCode } from '../card-text'
import { resolveCollectionText } from '../collection-text'
import { matchTextEntities } from './entity-matcher'
import { isGoldStyle, parseGameTextNodes } from './parser'
import type { GameTextNode, GameTextOptions } from './types'

const MAX_DEPTH = 3

function variableName(raw: string) {
	const colon = raw.indexOf(':')
	return (colon < 0 ? raw : raw.slice(0, colon)).trim()
}

function evaluateVariable(raw: string, options: GameTextOptions): string {
	return options.mode === 'collection'
		? resolveCollectionText(`{${raw}}`, options.collectionVariables ?? {})
		: resolveCardTextToBBCode(`{${raw}}`, options)
}

function splitText(
	text: string,
	gold: boolean,
	options: GameTextOptions,
	context: EntityMatchContext,
	depth: number
): GameTextNode[] {
	const result: GameTextNode[] = []
	let cursor = 0
	let start = text.indexOf('{', cursor)
	const scope = gold && options.matchEntities !== false

	while (start >= 0) {
		let braces = 0
		let end = -1
		for (let i = start; i < text.length; i++) {
			if (text[i] === '{') braces++
			else if (text[i] === '}' && --braces === 0) {
				end = i
				break
			}
		}
		if (end < 0) break

		result.push(...matchTextEntities(text.slice(cursor, start), scope, context))
		const raw = text.slice(start + 1, end)
		const value = evaluateVariable(raw, options)
		const children: GameTextNode[] =
			depth < MAX_DEPTH
				? resolveInline(parseGameTextNodes(value, options), options, context, depth + 1, false)
				: [{ type: 'text', value: stripBBCode(value) }]
		result.push({ type: 'variable', name: variableName(raw), raw, value, children })
		cursor = end + 1
		start = text.indexOf('{', cursor)
	}
	if (cursor < text.length) result.push(...matchTextEntities(text.slice(cursor), scope, context))
	return result
}

export function resolveInline(
	nodes: GameTextNode[],
	options: GameTextOptions,
	context: EntityMatchContext,
	depth = 0,
	gold = false
): GameTextNode[] {
	const result: GameTextNode[] = []
	for (const node of nodes) {
		if (node.type === 'tag') {
			const childGold = node.style.color ? isGoldStyle(node.style) : gold
			result.push({
				...node,
				children: resolveInline(node.children, options, context, depth, childGold)
			})
		} else if (node.type === 'text') {
			result.push(...splitText(node.value, gold, options, context, depth))
		} else {
			result.push(node)
		}
	}
	return result
}
