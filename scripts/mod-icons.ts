import fs from 'node:fs'
import path from 'node:path'
import { iconPathKey, normalizeIconKey } from '../src/lib/data/icon-assets.ts'

/**
 * Mod 图标资源索引（构建期）。
 * 唯一标识 = Mod ID + 相对路径；每个 mod 的资源表按 modId 隔离。
 * 归一化 basename 只作为兼容键保留，冲突时按确定性规则选一个并输出诊断，不静默覆盖。
 */
export interface IconConflict {
	modId: string
	key: string
	kind: 'basename' | 'path-case'
	paths: string[]
	chosen: string
}

export interface ModIconIndex {
	/** modId → { iconPathKey(relativePath) | normalizeIconKey(basename) → URL } */
	icons: Record<string, Record<string, string>>
	conflicts: IconConflict[]
}

export interface IconFile {
	relative: string
	url: string
}

/** beta 目录是旧版资源，正式资源优先；其次路径短、字典序靠前 */
function preferred(a: string, b: string): string {
	const betaA = a.includes('/beta/') ? 1 : 0
	const betaB = b.includes('/beta/') ? 1 : 0
	if (betaA !== betaB) return betaA < betaB ? a : b
	const depthA = a.split('/').length
	const depthB = b.split('/').length
	if (depthA !== depthB) return depthA < depthB ? a : b
	return a <= b ? a : b
}

/** 纯函数：便于在无文件系统依赖的情况下验证命名空间与冲突规则 */
export function indexIconFiles(modId: string, files: readonly IconFile[]) {
	const map: Record<string, string> = {}
	const conflicts: IconConflict[] = []

	const group = (keyOf: (file: IconFile) => string | null, kind: IconConflict['kind']) => {
		const grouped = new Map<string, IconFile[]>()
		for (const file of files) {
			const key = keyOf(file)
			if (!key) continue
			const list = grouped.get(key) ?? []
			list.push(file)
			grouped.set(key, list)
		}
		for (const [key, list] of grouped) {
			const chosen = list.map((file) => file.relative).reduce(preferred)
			map[key] = list.find((file) => file.relative === chosen)!.url
			if (list.length > 1) {
				conflicts.push({
					modId,
					key,
					kind,
					paths: list.map((file) => file.relative).sort(),
					chosen
				})
			}
		}
	}

	group((file) => iconPathKey(file.relative), 'path-case')
	group((file) => normalizeIconKey(path.parse(file.relative).name) || null, 'basename')
	return { map, conflicts }
}

function reportConflicts(conflicts: readonly IconConflict[]) {
	const byMod = new Map<string, IconConflict[]>()
	for (const conflict of conflicts) {
		const list = byMod.get(conflict.modId) ?? []
		list.push(conflict)
		byMod.set(conflict.modId, list)
	}
	for (const [modId, list] of byMod) {
		const sample = list
			.slice(0, 3)
			.map((conflict) => `${conflict.key}[${conflict.paths.join(', ')}]`)
			.join('; ')
		console.warn(
			`[mods] ${modId} 图标资源键冲突 ${list.length} 项，已按 Mod ID + 相对路径确定性选优：${sample}${list.length > 3 ? ' …' : ''}`
		)
	}
}

export function collectModIcons(modsDir: string, excluded: ReadonlySet<string> = new Set()): ModIconIndex {
	const icons: Record<string, Record<string, string>> = {}
	const conflicts: IconConflict[] = []
	if (!fs.existsSync(modsDir)) return { icons, conflicts }

	for (const entry of fs.readdirSync(modsDir, { withFileTypes: true })) {
		if (!entry.isDirectory() || excluded.has(entry.name)) continue
		const modId = entry.name
		const imagesDir = path.join(modsDir, modId, 'images')
		if (!fs.existsSync(imagesDir)) continue

		const files: IconFile[] = []
		const walk = (dir: string) => {
			for (const file of fs.readdirSync(dir, { withFileTypes: true })) {
				const full = path.join(dir, file.name)
				if (file.isDirectory()) {
					if (file.name !== 'cards') walk(full)
					continue
				}
				const ext = path.extname(file.name).toLowerCase()
				if (ext !== '.png' && ext !== '.webp') continue
				const relative = path.relative(imagesDir, full).split(path.sep).join('/')
				files.push({ relative, url: `/mods/${modId}/images/${relative}` })
			}
		}
		walk(imagesDir)

		const indexed = indexIconFiles(modId, files)
		icons[modId] = indexed.map
		conflicts.push(...indexed.conflicts)
	}

	reportConflicts(conflicts)
	return { icons, conflicts }
}
