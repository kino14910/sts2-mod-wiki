import type { EntityRef } from '#lib/entities'
import { iconFiles } from 'virtual:mods'
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
	modAsset,
	normalizeIconKey
} from './icon-assets'

export {
	ENERGY_ICON_SRC,
	STAR_ICON_SRC,
	ENERGY_ICON,
	STAR_ICON,
	NECRO_ENERGY_ICON,
	normalizeIconKey
} from './icon-assets'

export type IconVariant = 'card' | 'collection'

export type IconRef =
	| { kind: 'energy' | 'star'; modId?: string; variant?: IconVariant; color?: string }
	| { kind: 'entity'; ref: EntityRef; name?: string }
	| { kind: 'asset'; modId?: string; name: string }

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

function assetIcon(ref: Extract<IconRef, { kind: 'asset' }>): AssetIcon {
	const modId = ref.modId ?? BASE_MOD_ID
	const files = iconFiles[modId]
	if (files) {
		for (const candidate of [ref.name, ref.name.replace(/_.*$/, ''), ref.name.replace(/^icon/i, '')]) {
			const key = normalizeIconKey(candidate)
			if (key && files[key]) return { src: files[key], diagnostic: null }
		}
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
