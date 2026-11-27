import type { EntityMatchContext } from '#lib/data/entity-name-index'
import { getLocale } from '#lib/paraglide/runtime'
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

const cacheLimit = 512
const cache = new Map<string, GameTextNode[]>()

/** 命中时复用同一份节点树，调用方只读；带诊断回调的调用必须每次触发副作用，因此绕过缓存。 */
function cacheKey(text: string, options: GameTextOptions): string | null {
	if (options.onDiagnostic) return null
	// options.locale 缺省时实体匹配会退回当前语言，实际语言也必须进 key
	const locale = options.locale ?? getLocale()
	// 顶层键排序后字符串化，调用方换个字面量顺序也命中；undefined 与 null 需要区分开。
	const entries = Object.entries(options).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
	const signature = JSON.stringify(entries, (_key, value) =>
		value === undefined ? '\u0001undefined' : value
	)
	return `${locale}\u0000${signature}\u0000${text}`
}

function parse(text: string, options: GameTextOptions): GameTextNode[] {
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

/** Template evaluation precedes the shared BBCode stack; only visible gold text is linked. */
export function parseGameText(text: string, options: GameTextOptions = {}): GameTextNode[] {
	const key = cacheKey(text, options)
	if (key === null) return parse(text, options)

	const cached = cache.get(key)
	if (cached) {
		cache.delete(key)
		cache.set(key, cached)
		return cached
	}

	const nodes = parse(text, options)
	if (cache.size >= cacheLimit) {
		const oldest = cache.keys().next().value
		if (oldest !== undefined) cache.delete(oldest)
	}
	cache.set(key, nodes)
	return nodes
}
