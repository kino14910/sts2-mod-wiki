export const BASE_MOD_ID = 'sts2'

export const NAMED_ICONS: Record<string, string> = {
	'energy/card': 'images/colorless_energy_icon.png',
	'star/card': 'images/star_icon.png',
	'energy/collection': 'images/ui/energy_colorless.png',
	'star/collection': 'images/ui/star.png',
	'energy/collection/necrobinder': 'images/ui/energy_necrobinder.png'
}

export function modAsset(modId: string, filePath: string) {
	return `/mods/${modId}/${filePath}`
}

/** 兼容键：归一化 basename，显式引用按名字查询时用 */
export function normalizeIconKey(value: string) {
	return value.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '')
}

/**
 * 唯一资源键：Mod ID + 相对路径（调用方按 modId 分表）。
 * 保留扩展名，大小写归一；`powers/a.png` 与 `ui/a.png` 不再互相覆盖。
 */
export function iconPathKey(value: string) {
	return value
		.trim()
		.replace(/\\/g, '/')
		.replace(/^\/+/, '')
		.toLowerCase()
}

export const ENERGY_ICON_SRC = modAsset(BASE_MOD_ID, NAMED_ICONS['energy/card'])
export const STAR_ICON_SRC = modAsset(BASE_MOD_ID, NAMED_ICONS['star/card'])
export const ENERGY_ICON = modAsset(BASE_MOD_ID, NAMED_ICONS['energy/collection'])
export const STAR_ICON = modAsset(BASE_MOD_ID, NAMED_ICONS['star/collection'])
export const NECRO_ENERGY_ICON = modAsset(
	BASE_MOD_ID,
	NAMED_ICONS['energy/collection/necrobinder']
)
