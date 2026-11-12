import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { iconConflicts, iconFiles } from 'virtual:mods'
import { collectModIcons, indexIconFiles, type IconFile } from '../../../scripts/mod-icons.ts'
import { iconPathKey, normalizeIconKey } from './icon-assets'
import { classifyIconRef, iconDiagnostic, resolveIconSrc } from './icon-registry'

const filesOf = (modId: string, relatives: string[]): IconFile[] =>
	relatives.map((relative) => ({
		relative,
		url: `/mods/${modId}/images/${relative}`
	}))

describe('图标资源命名空间', () => {
	it('资源唯一键由 Mod 内相对路径归一化产生', () => {
		expect(iconPathKey('UI\\Energy_Colorless.PNG')).toBe('ui/energy_colorless.png')
		expect(iconPathKey('/ui/star_icon.png')).toBe('ui/star_icon.png')
		expect(normalizeIconKey('Star_Icon')).toBe('staricon')
	})

	it('同一 Mod 不同目录下的同名图标互不覆盖，冲突被诊断', () => {
		const { map, conflicts } = indexIconFiles(
			'mod-a',
			filesOf('mod-a', ['a/coin.png', 'b/coin.png', 'a/coin.webp', 'a/COIN.PNG'])
		)
		expect(map['a/coin.png']).toBe('/mods/mod-a/images/a/COIN.PNG')
		expect(map['b/coin.png']).toBe('/mods/mod-a/images/b/coin.png')
		expect(map['a/coin.webp']).toBe('/mods/mod-a/images/a/coin.webp')
		expect(map.coin).toBeTruthy()

		const basename = conflicts.find((conflict) => conflict.kind === 'basename')
		expect(basename?.key).toBe('coin')
		expect(basename?.paths).toHaveLength(4)
		const pathCase = conflicts.find((conflict) => conflict.kind === 'path-case')
		expect(pathCase?.key).toBe('a/coin.png')
		expect(pathCase?.paths).toHaveLength(2)
	})

	it('beta 旧资源不会覆盖正式资源', () => {
		const { map, conflicts } = indexIconFiles(
			'mod-a',
			filesOf('mod-a', ['relics/beta/coin.png', 'relics/coin.png'])
		)
		expect(map.coin).toBe('/mods/mod-a/images/relics/coin.png')
		expect(conflicts.some((conflict) => conflict.kind === 'basename')).toBe(true)
	})

	it('不同 Mod 的同名图标按 modId 隔离，且输出构建诊断', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sts2-icon-index-'))
		try {
			for (const modId of ['mod-a', 'mod-b']) {
				for (const relative of ['a/coin.png', 'b/coin.png']) {
					const file = path.join(root, modId, 'images', relative)
					fs.mkdirSync(path.dirname(file), { recursive: true })
					fs.writeFileSync(file, '')
				}
			}
			const { icons, conflicts } = collectModIcons(root)
			expect(icons['mod-a']['a/coin.png']).toBe('/mods/mod-a/images/a/coin.png')
			expect(icons['mod-b']['a/coin.png']).toBe('/mods/mod-b/images/a/coin.png')
			expect(icons['mod-a']['b/coin.png']).toBe('/mods/mod-a/images/b/coin.png')
			expect(conflicts.filter((conflict) => conflict.kind === 'basename')).toHaveLength(2)
			expect(warn).toHaveBeenCalled()
			expect(String(warn.mock.calls[0][0])).toContain('图标资源键冲突')
		} finally {
			warn.mockRestore()
			fs.rmSync(root, { recursive: true, force: true })
		}
	})
})

describe('构建产物', () => {
	it('路径键与冲突诊断都进入 virtual:mods', () => {
		expect(iconFiles.sts2['relics/paper_phrog.png']).toBe(
			'/mods/sts2/images/relics/paper_phrog.png'
		)
		expect(iconConflicts.length).toBeGreaterThan(0)
		expect(iconConflicts.every((conflict) => conflict.paths.length > 1)).toBe(true)
	})
})

describe('显式图标解析', () => {
	it('Vanilla 显式资源按相对路径精确命中', () => {
		expect(resolveIconSrc({ kind: 'asset', name: 'ui/energy_colorless.png', modId: 'sts2' })).toBe(
			'/mods/sts2/images/ui/energy_colorless.png'
		)
		expect(resolveIconSrc({ kind: 'asset', name: 'energy_colorless.png', modId: 'sts2' })).toBe(
			'/mods/sts2/images/energy_colorless.png'
		)
		expect(resolveIconSrc({ kind: 'asset', name: 'star_icon', modId: 'sts2' })).toBe(
			'/mods/sts2/images/star_icon.png'
		)
	})

	it('显式 Mod 资源不存在时不回退 Vanilla，也不串用其他 Mod', () => {
		expect(resolveIconSrc({ kind: 'asset', name: 'Vulnerable' })).toBe(
			'/mods/sts2/images/powers/vulnerable_power.png'
		)
		expect(resolveIconSrc({ kind: 'asset', name: 'Vulnerable', modId: 'other-mod' })).toBeNull()
		expect(iconDiagnostic({ kind: 'asset', name: 'Vulnerable', modId: 'other-mod' })).toContain(
			'other-mod'
		)
		expect(resolveIconSrc({ kind: 'asset', name: 'star_icon', modId: 'other-mod' })).toBeNull()
		expect(
			resolveIconSrc({ kind: 'asset', name: 'ui/energy_colorless.png', modId: 'other-mod' })
		).toBeNull()
	})

	it('实体图标复用 EntityRef，普通图标保持独立 asset 引用', () => {
		expect(classifyIconRef({ kind: 'asset', name: 'Vulnerable' }, 'eng')).toEqual({
			kind: 'entity',
			ref: { type: 'power', id: 'VulnerablePower' },
			name: 'Vulnerable'
		})
		expect(classifyIconRef({ kind: 'asset', name: 'star_icon' }, 'eng')).toEqual({
			kind: 'asset',
			name: 'star_icon'
		})
		expect(
			classifyIconRef({ kind: 'asset', name: 'Vulnerable', modId: 'other-mod' }, 'eng')
		).toEqual({ kind: 'asset', name: 'Vulnerable', modId: 'other-mod' })
		expect(
			resolveIconSrc(classifyIconRef({ kind: 'asset', name: 'Vulnerable' }, 'eng'))
		).toBe('/mods/sts2/images/powers/vulnerable_power.png')
	})
})
