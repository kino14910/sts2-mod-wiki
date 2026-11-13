import type { EntityMatchContext } from '#lib/data/entity-name-index'
import { resolveInline } from './inline'
import { parseGameTextNodes } from './parser'
import type { GameTextNode, GameTextOptions } from './types'

export type {
	GameTextNode,
	GameTextOptions,
	GameTextStyle,
	GameTextTagNode
} from './types'
export { tokenizeGameText } from './tokenizer'
export type { GameTextToken } from './tokenizer'
export { parseGameTextNodes, isGoldStyle } from './parser'
export { matchTextEntities } from './entity-matcher'

/** Template evaluation precedes the shared BBCode stack; only visible gold text is linked. */
export function parseGameText(text: string, options: GameTextOptions = {}): GameTextNode[] {
	const context: EntityMatchContext = {
		locale: options.locale,
		modId: options.modId,
		scope: 'game',
		strategy: 'game',
		prefer: options.prefer,
		current: options.current
	}
	return resolveInline(parseGameTextNodes(text, options, true), options, context)
}
