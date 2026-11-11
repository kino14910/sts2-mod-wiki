import { matchEntityNames, type EntityMatchContext } from '#lib/data/entity-name-index'
import type { GameTextNode } from './types'

/** 只在金色节点内做实体匹配；冲突由索引在匹配阶段按 context 消解 */
export function matchTextEntities(
	text: string,
	gold: boolean,
	context: EntityMatchContext
): GameTextNode[] {
	if (!text) return []
	if (!gold) return [{ type: 'text', value: text }]
	const matches = matchEntityNames(text, context)
	if (!matches.length) return [{ type: 'text', value: text }]

	const result: GameTextNode[] = []
	let cursor = 0
	for (const match of matches) {
		if (match.start > cursor) result.push({ type: 'text', value: text.slice(cursor, match.start) })
		result.push({
			type: 'entity',
			ref: match.entry.ref,
			value: match.name,
			candidates: match.candidates
		})
		cursor = match.end
	}
	if (cursor < text.length) result.push({ type: 'text', value: text.slice(cursor) })
	return result
}
