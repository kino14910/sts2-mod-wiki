import type { EntityMatchContext } from '#lib/data/entity-name-index'
import { matchTextEntities } from './entity-matcher'
import { isGoldStyle } from './parser'
import type { GameTextNode, GameTextOptions } from './types'

/** Annotate evaluated visible runs without interpreting scalar values as templates. */
export function resolveInline(
	nodes: GameTextNode[],
	options: GameTextOptions,
	context: EntityMatchContext,
	gold = false
): GameTextNode[] {
	const result: GameTextNode[] = []
	for (const node of nodes) {
		if (node.type === 'tag') {
			const childGold = node.style.color ? isGoldStyle(node.style) : gold
			result.push({ ...node, children: resolveInline(node.children, options, context, childGold) })
		} else if (node.type === 'variable') {
			result.push({ ...node, children: resolveInline(node.children, options, context, node.matchEntities === true && gold) })
		} else if (node.type === 'text') {
			result.push(...matchTextEntities(node.value, gold && options.matchEntities !== false, context))
		} else result.push(node)
	}
	return result
}
