/**
 * 实体自动链接策略：识别规则集中在扫描器（entity-name-index.scanEntityNames），
 * 展示组件与解析器不做二次判断。显式引用 [[type:id|label]] 永远绕过本策略。
 */
export type EntityAutoLink = 'auto' | 'explicit-only'

/**
 * 按归一化名称（trim + lowercase）覆盖默认策略。
 * 用于启用被默认规则禁用的别名，或禁用产生歧义的常见词。
 */
export const ENTITY_AUTO_LINK_OVERRIDES: Record<string, EntityAutoLink> = {}

const HAN = /\p{Script=Han}/u

export function autoLinkPolicy(name: string): EntityAutoLink {
	const key = name.trim().toLowerCase()
	const override = ENTITY_AUTO_LINK_OVERRIDES[key]
	if (override) return override
	// 单字名（如「塔」「熵」）在连续文本里几乎总是构词语素而非实体引用
	if ([...key].length <= 1) return 'explicit-only'
	return 'auto'
}

/**
 * explicit-only 名称只有在与相邻汉字不构成词时才允许自动链接：
 * GameText 的金色整段「塔」是真实引用；散文「杀戮尖塔 / 塔罗牌」中的「塔」不是。
 */
export function canAutoLinkAt(name: string, text: string, start: number, end: number): boolean {
	if (autoLinkPolicy(name) === 'auto') return true
	const before = start > 0 ? text[start - 1] : ''
	const after = end < text.length ? text[end] : ''
	return !(before && HAN.test(before)) && !(after && HAN.test(after))
}