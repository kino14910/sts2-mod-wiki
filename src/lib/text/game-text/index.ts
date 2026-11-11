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

/** 游戏富文本统一入口：BBCode → AST → 变量 / 实体（仅金色节点） */
export function parseGameText(text: string, options: GameTextOptions = {}): GameTextNode[] {
	const context: EntityMatchContext = {
		locale: options.locale,
		prefer: options.prefer,
		current: options.current
	}
	return resolveInline(parseGameTextNodes(text, options), options, context)
}
