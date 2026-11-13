import { classifyIconRef, iconDiagnostic, resolveIconSrc, type IconRef } from '#lib/data/icon-registry'
import { iconFiles } from 'virtual:mods'
import { iconPathKey } from '#lib/data/icon-assets'

export const EXPLICIT_ICON_PATTERN =
	/StS2 (Icon ?[A-Za-z0-9 ]+|[A-Za-z][A-Za-z0-9]*?)\.png|§ICON_([^§]+)§|\[img(?:=[^\]]*)?\]([^\r\n]*?)\[\/img\]/g

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
	let name = assetName(raw)
	let path: string | undefined
	if (name.startsWith('res://')) {
		path = name.slice(6)
		const parts = path.split('/')
		// Vanilla resources live directly under images/, Mod resources under ModName/.
		modId = parts[0] === 'images' ? 'sts2' : parts.shift()!.toLowerCase()
		path = parts.join('/')
	} else {
		const scoped = /^([a-z0-9][a-z0-9._-]*):(.+)$/i.exec(name)
		if (scoped) { modId = scoped[1].toLowerCase(); name = scoped[2] }
		if (/[\\/]|\.(png|webp)$/i.test(name)) path = name.replaceAll('\\', '/')
	}
	// iconFiles keys are relative to each Mod's images/ root (including imported bundles).
	if (path) {
		path = path.replace(/^images\//i, '')
		name = path.split('/').at(-1)!.replace(/\.(png|webp)$/i, '')
	}
	return {
		type: 'icon',
		ref: { kind: 'asset', name, ...(modId ? { modId } : {}), ...(path ? { path } : {}) },
		raw
	}
}

export function findExplicitIcons(text: string, modId?: string): PositionedIcon[] {
	const found: PositionedIcon[] = []
	for (const match of text.matchAll(EXPLICIT_ICON_PATTERN)) {
		const raw = match[1] ?? match[2] ?? match[3]
		const start = match.index ?? 0
		found.push({
			start,
			end: start + match[0].length,
			token: iconToken(raw, modId)
		})
	}
	return found
}

/** One resource resolver for GameText and WikiText, including missing-resource diagnostics. */
export function resolveExplicitIcon(token: IconToken, locale?: string) {
	const ref = classifyIconRef(token.ref, locale)
	if (ref.kind === 'asset' && ref.path) {
		const src = iconFiles[ref.modId ?? 'sts2']?.[iconPathKey(ref.path)] ?? ''
		return { ref, src, diagnostic: src ? undefined : `missing asset icon ${ref.modId ?? 'sts2'}:${ref.path}` }
	}
	return { ref, src: resolveIconSrc(ref) ?? '', diagnostic: iconDiagnostic(ref) ?? undefined }
}
