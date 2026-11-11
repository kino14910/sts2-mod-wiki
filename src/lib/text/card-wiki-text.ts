import type { CardVariables } from '#lib/data/cards'
import { cardTextToPlain } from './card-text'

const DISPLAY_TOKEN = /\{([A-Za-z_][A-Za-z0-9_]*)(?::(?:diff|inverseDiff|energyIcons|starIcons)\(\))?\}/g

/** 保留基础文案，为升级后变化的变量追加 (升级值)，括号内容由 WikiText 统一标绿 */
export function cardTextToWiki(
	text: string,
	variables: CardVariables,
	upgradedVariables?: CardVariables
) {
	if (!upgradedVariables) return cardTextToPlain(text, { variables })

	const extras: CardVariables = {}
	let index = 0
	const annotated = text.replace(DISPLAY_TOKEN, (match, name: string) => {
		const base = variables[name]
		const upgraded = upgradedVariables[name]
		if (base === undefined || upgraded === undefined || String(base) === String(upgraded)) return match
		const key = `__WIKI_UPGRADE_${index++}`
		extras[key] = upgraded
		return `${match} ({${key}})`
	})

	return cardTextToPlain(annotated, { variables: { ...variables, ...extras } })
}
