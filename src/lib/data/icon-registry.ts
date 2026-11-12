import { entityKey, type EntityRef } from '#lib/entities'
import { iconFiles } from 'virtual:mods'
import { findEntityCandidates } from './entity-name-index'
import {
	cardById,
	cardByName,
	cardIcon,
	powerIconById,
	powerIconByName,
	potionImageById,
	potionImageByName,
	relicImageById,
	relicImageByName
} from '#lib/data/wiki-links'
import {
	BASE_MOD_ID,
	NAMED_ICONS,
	iconPathKey,
	modAsset,
	normalizeIconKey
} from './icon-assets'

export {
	ENERGY_ICON_SRC,
	STAR_ICON_SRC,
	ENERGY_ICON,
	STAR_ICON,
	NECRO_ENERGY_ICON,
	iconPathKey,
	normalizeIconKey
} from './icon-assets'

export type IconVariant = 'card' | 'collection'

export type IconRef =
	| { kind: 'energy' | 'star'; modId?: string; variant?: IconVariant; color?: string }
	/** 实体图标：复用 EntityRef，仍可带 name 作为兼容回退 */
	| { kind: 'entity'; ref: EntityRef; name?: string }
	/** 普通图标 / 显式资源引用：path 为 Mod 内相对路径，省略时按 name 归一化查询 */
	| { kind: 'asset'; modId?: string; name: string; path?: string }

export interface IconResolutionOptions {
	energyIconSrc?: string
	secondEnergyIconSrc?: string
}

function entityIcon(ref: EntityRef, name: string): string | null {
	switch (ref.type) {
		case 'card': {
			const card = cardById(ref.id) ?? cardByName(name)
			return card ? cardIcon(card) : null
		}
		case 'power':
			return powerIconById(ref.id) ?? powerIconByName(name)
		case 'relic':
			return relicImageById(ref.id) ?? relicImageByName(name)
		case 'potion':
			return potionImageById(ref.id) ?? potionImageByName(name)
		default:
			return null
	}
}

type AssetIcon = { src: string | null; diagnostic: string | null }

/** 带路径或扩展名的显式引用，按 Mod ID + 相对路径精确定位 */
function explicitPath(ref: Extract<IconRef, { kind: 'asset' }>): string | null {
	const value = (ref.path ?? ref.name).trim()
	if (!/\.(png|webp)$/i.test(value) && !value.includes('/') && !value.includes('\\')) return null
	return iconPathKey(value)
}

function assetIcon(ref: Extract<IconRef, { kind: 'asset' }>): AssetIcon {
	const modId = ref.modId ?? BASE_MOD_ID
	const files = iconFiles[modId]
	if (files) {
		const exact = explicitPath(ref)
		if (exact && files[exact]) return { src: files[exact], diagnostic: null }
		for (const candidate of [ref.name, ref.name.replace(/_.*$/, ''), ref.name.replace(/^icon/i, '')]) {
			const key = normalizeIconKey(candidate)
			if (key && files[key]) return { src: files[key], diagnostic: null }
		}
	}

	// 显式 Mod 资源查找失败：不得回退到 Vanilla 同名实体，更不得串用其他 Mod 资源。
	if (ref.modId && ref.modId !== BASE_MOD_ID) {
		return { src: null, diagnostic: `missing asset icon ${modId}:${ref.name}` }
	}

	const candidates = new Set<string>()
	for (const hit of [
		powerIconByName(ref.name),
		relicImageByName(ref.name),
		potionImageByName(ref.name),
		(() => {
			const card = cardByName(ref.name)
			return card ? cardIcon(card) : null
		})()
	]) {
		if (hit) candidates.add(hit)
	}
	if (candidates.size === 1) {
		return { src: [...candidates][0], diagnostic: null }
	}
	if (candidates.size > 1) {
		return { src: null, diagnostic: `ambiguous icon ${modId}:${ref.name}` }
	}
	return { src: null, diagnostic: `missing asset icon ${modId}:${ref.name}` }
}

export function resolveIconSrc(
	ref: IconRef,
	options: IconResolutionOptions = {}
): string | null {
	if (ref.kind === 'energy' || ref.kind === 'star') {
		const override = ref.kind === 'energy' ? options.energyIconSrc : options.secondEnergyIconSrc
		if (override) return override
		const variant = ref.variant ?? 'card'
		const path =
			(ref.color ? NAMED_ICONS[`${ref.kind}/${variant}/${ref.color}`] : undefined) ??
			NAMED_ICONS[`${ref.kind}/${variant}`]
		return path ? modAsset(ref.modId ?? BASE_MOD_ID, path) : null
	}
	if (ref.kind === 'entity') return entityIcon(ref.ref, ref.name ?? '')
	if (ref.kind === 'asset') return assetIcon(ref).src
	return null
}

export function iconDiagnostic(ref: IconRef): string | null {
	if (ref.kind === 'asset') return assetIcon(ref).diagnostic
	if (resolveIconSrc(ref)) return null
	if (ref.kind === 'entity') return `missing entity icon ${ref.ref.type}:${ref.ref.id}`
	return `missing ${ref.kind} icon`
}

/**
 * 显式图标名唯一指向某个游戏实体时改走 EntityRef 分支；
 * 普通图标 / 歧义名 / 带 Mod 命名空间的资源仍是独立 asset 引用。
 */
export function classifyIconRef(ref: IconRef, locale?: string): IconRef {
	if (ref.kind !== 'asset' || ref.modId || ref.path) return ref
	const candidates = findEntityCandidates(ref.name, locale).filter(
		(entry) => entry.scope === 'game'
	)
	if (new Set(candidates.map((entry) => entityKey(entry.ref))).size !== 1) return ref
	return { kind: 'entity', ref: candidates[0].ref, name: ref.name }
}
