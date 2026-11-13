import { ALIGN_TAGS, EFFECT_TAGS, NAMED_COLORS, sizeToUnit } from '../bbcode'
import { resolveIconSrc, type IconRef } from '#lib/data/icon-registry'
import { resolveExplicitIcon } from './icon-syntax'
import type { GameTextNode, GameTextOptions, GameTextStyle, GameTextTagNode } from './types'
import { tokenizeGameText, type GameTextToken } from './tokenizer'
import { parseGameTemplate, resolveGameTemplate } from '../game-template'

/**
 * gold 状态只由本地化文件里的命名标签 [gold] 产生。
 * [color=#EFC851] 即使视觉上同色也不是游戏实体高亮，不触发实体匹配。
 */
export function isGoldStyle(style: GameTextStyle): boolean {
	return style.colorName === 'gold'
}

type OpenToken = Extract<GameTextToken, { type: 'open' }>

function styleOf(token: OpenToken, options: GameTextOptions): GameTextStyle {
	const { name, arg } = token
	if (name === 'color' && arg) {
		return { color: arg, colorName: null }
	}
	if (NAMED_COLORS[name]) return { color: NAMED_COLORS[name], colorName: name }
	if (name === 'font' && arg) return { font: arg }
	if (name === 'font_size' && arg) {
		return { fontSize: sizeToUnit(arg, options.sizeUnit ?? 'px') }
	}
	if (name === 'b') return { bold: true }
	if (name === 'i') return { italic: true }
	if (name === 'u') return { underline: true }
	if (ALIGN_TAGS.has(name)) return { align: name as GameTextStyle['align'] }
	if (EFFECT_TAGS.has(name)) return {}
	return {}
}

function iconNode(token: OpenToken, options: GameTextOptions): GameTextNode | null {
	const { name, arg } = token
	if (!['energy_icons', 'star_icons', 'energy', 'star'].includes(name)) return null

	const kind = name === 'energy_icons' || name === 'energy' ? 'energy' : 'star'
	const ref: IconRef = {
		kind,
		variant: options.mode === 'collection' ? 'collection' : 'card',
		modId: options.modId
	}
	const src = resolveIconSrc(ref, options) ?? ''
	const amount =
		name === 'energy_icons' || name === 'star_icons'
			? Math.trunc(Number(arg) || 0)
			: 1
	// Raw icon tags are accepted too; avoid allocating an unbounded repeat array.
	const compact = amount <= 0 || amount >= 5
	return { type: 'icon', kind, count: compact ? 1 : amount, src, ref, ...(compact ? { label: String(amount) } : {}) }
}

function explicitIconNode(
	token: Extract<GameTextToken, { type: 'iconRef' }>,
	options: GameTextOptions
): GameTextNode {
	const { ref, src, diagnostic } = resolveExplicitIcon({ type: 'icon', ref: token.ref, raw: token.raw }, options.locale)
	return {
		type: 'icon',
		kind: 'asset',
		count: 1,
		src,
		ref,
		raw: token.raw,
		...(diagnostic ? { diagnostic } : {})
	}
}

type VariableNode = Extract<GameTextNode, { type: 'variable' }>

function tokensWithVariables(src: string, options: GameTextOptions, evaluate: boolean) {
	if (!evaluate) return tokenizeGameText(src, options.modId).map((token) => ({ token, variable: undefined as VariableNode | undefined }))
	return parseGameTemplate(src).flatMap((node) => {
		if (node.type === 'text') return tokenizeGameText(node.value, options.modId).map((token) => ({ token, variable: undefined as VariableNode | undefined }))
		const value = resolveGameTemplate(node.raw, {
			...options,
			variables: options.mode === 'collection' ? options.collectionVariables ?? options.variables : options.variables
		})
		const variable: VariableNode = {
			type: 'variable', name: node.name, raw: node.raw.slice(1, -1), value, children: [],
			// Selected text branches inherit semantic highlighting. Scalar values do not
			// become entity links merely because their enclosing tag happens to be gold.
			matchEntities: !!node.args && /^(?:show:|choose\(|cond:|plural(?:\(|:))|\|/.test(node.args)
		}
		const tokens = tokenizeGameText(value, options.modId)
		if (!tokens.length) tokens.push({ type: 'text', value: '' })
		return tokens.map((token) => ({ token, variable }))
	})
}

export function parseGameTextNodes(src: string, options: GameTextOptions = {}, evaluateTemplates = false): GameTextNode[] {
	const root: GameTextNode[] = []
	const stack: Array<{ name: string; children: GameTextNode[] }> = []
	const current = () => (stack.length ? stack[stack.length - 1].children : root)

	for (const { token, variable } of tokensWithVariables(src, options, evaluateTemplates)) {
		const emit = (node: GameTextNode) => current().push(variable ? { ...variable, children: [node] } : node)
		switch (token.type) {
			case 'text':
				emit({ type: 'text', value: token.value })
				break
			case 'unknown':
				emit({ type: 'text', value: token.raw })
				break
			case 'break':
				emit({ type: 'break' })
				break
			case 'iconRef':
				emit(explicitIconNode(token, options))
				break
			case 'close': {
				let index = -1
				for (let i = stack.length - 1; i >= 0; i--) {
					if (stack[i].name === token.name) {
						index = i
						break
					}
				}
				// 闭合外层标签时同时丢弃仍打开的内层标签，避免后续文本被错误继承。
				if (index >= 0) stack.splice(index)
				break
			}
			case 'open': {
				const icon = iconNode(token, options)
				if (icon) {
					emit(icon)
					break
				}
				const tag: GameTextTagNode = {
					type: 'tag',
					name: token.name,
					arg: token.arg,
					style: styleOf(token, options),
					children: []
				}
				current().push(tag)
				stack.push({ name: tag.name, children: tag.children })
				break
			}
		}
	}
	return root
}
