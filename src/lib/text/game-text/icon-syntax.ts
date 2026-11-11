import type { IconRef } from '#lib/data/icon-registry'

export const EXPLICIT_ICON_PATTERN =
	/StS2 (Icon ?[A-Za-z0-9 ]+|[A-Za-z][A-Za-z0-9]*?)\.png|§ICON_([^§]+)§/g

// 括号数字是卡牌升级值高亮，不是图标；只在 WikiText 兼容链路里保留。
export const UPGRADED_PATTERN = /\((\d+)\)/g

export const ICON_PATTERN = new RegExp(
	`${EXPLICIT_ICON_PATTERN.source}|${UPGRADED_PATTERN.source}`,
	'g'
)

export interface IconToken {
	type: 'icon'
	ref: IconRef
	raw: string
}

export interface PositionedIcon {
	start: number
	end: number
	token: IconToken
}

function assetName(raw: string) {
	return raw.replace(/^Icon\s*/i, '').trim()
}

export function iconToken(raw: string, modId?: string): IconToken {
	return {
		type: 'icon',
		ref: modId
			? { kind: 'asset', name: assetName(raw), modId }
			: { kind: 'asset', name: assetName(raw) },
		raw
	}
}

export function findExplicitIcons(text: string, modId?: string): PositionedIcon[] {
	const found: PositionedIcon[] = []
	for (const match of text.matchAll(EXPLICIT_ICON_PATTERN)) {
		const raw = match[1] ?? match[2]
		const start = match.index ?? 0
		found.push({
			start,
			end: start + match[0].length,
			token: iconToken(raw, modId)
		})
	}
	return found
}
