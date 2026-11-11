import { describe, expect, it } from 'vitest'
import { dataFiles, localizationFiles } from 'virtual:mods'
import { findGameEntity } from './entities'
import { MOD_BY_ID, modContentText } from './mods'
import {
	POWER_REFERENCES,
	listPowerReferences,
	powerReferenceDetails,
	resolvePowerReference,
	type PowerEntityRef,
	type WikiLocale,
	type WikiReferences
} from './power-references'
import { POWER_WIKI } from './power-wiki'
import powerWikiZh from './power-wiki.zh.json'

const POWER_ID = 'VulnerablePower'
const LOCALES: WikiLocale[] = ['eng', 'zhs']
const mod = MOD_BY_ID.get('sts2')!

function field(kind: PowerEntityRef['type'], id: string, name: 'title' | 'description', locale: WikiLocale) {
	return modContentText(mod, kind, id, name, locale)
}

function withoutVariant(name: string) {
	return name.replace(/\s*[（(].*$/, '')
}

function shape(details: WikiReferences) {
	return {
		sources: details.sources.map((section) =>
			section.groups.map((group) => group.entries.map((entry) => entry.id))
		),
		interactions: details.interactions.map((section) =>
			section.groups.map((group) => group.entries.map((entry) => entry.id))
		)
	}
}

describe('power wiki references', () => {
	it('wiki 页面只保留叙述内容，不再保存硬编码的 sources / interactions', () => {
		const page = POWER_WIKI[POWER_ID] as unknown as Record<string, unknown>
		expect(page.sources).toBeUndefined()
		expect(page.interactions).toBeUndefined()
		expect(Object.keys(page).sort()).toEqual(
			['effectsImmune', 'order', 'stackType', 'text', 'title'].sort()
		)

		const zhPage = powerWikiZh[POWER_ID] as unknown as Record<string, unknown>
		expect(zhPage.sources).toBeUndefined()
		expect(zhPage.interactions).toBeUndefined()
	})

	it('powers.json 只保存实体引用，且每条引用都能解析到游戏数据', () => {
		const powers = dataFiles['/static/mods/sts2/powers.json'] as Record<string, unknown>[]
		const vulnerable = powers.find((entry) => entry.id === POWER_ID)!
		const raw = JSON.stringify([vulnerable.sources, vulnerable.interactions])
		for (const key of ['"name"', '"description"', '"tooltip"', '"summary"', '"heading"', '"subheading"']) {
			expect(raw.includes(key)).toBe(false)
		}

		const refs = listPowerReferences(POWER_ID)
		expect(POWER_REFERENCES[POWER_ID]).toBeDefined()
		expect(refs).toHaveLength(39)
		for (const ref of refs) {
			expect(Object.keys(ref).every((key) => ['type', 'id', 'variant'].includes(key))).toBe(true)
			expect(findGameEntity({ type: ref.type, id: ref.id })).not.toBeNull()
		}

		for (const section of [...POWER_REFERENCES[POWER_ID].sources, ...POWER_REFERENCES[POWER_ID].interactions]) {
			for (const group of section.groups) {
				expect(group.refs.every((ref) => ref.type === group.kind)).toBe(true)
			}
		}
	})

	it('每条引用都有配对的中英标题与描述', () => {
		for (const ref of listPowerReferences(POWER_ID)) {
			const en = field(ref.type, ref.id, 'title', 'eng')
			const zh = field(ref.type, ref.id, 'title', 'zhs')
			expect(en, `${ref.type}:${ref.id} eng title`).toBeTruthy()
			expect(zh, `${ref.type}:${ref.id} zhs title`).toBeTruthy()
			expect(en).not.toBe(zh)
			for (const locale of LOCALES) {
				expect(field(ref.type, ref.id, 'description', locale)).toBeTruthy()
			}
		}

		const samples: Array<[PowerEntityRef, string, string]> = [
			[{ type: 'card', id: 'Bash' }, 'Bash', '痛击'],
			[{ type: 'card', id: 'KnowThyPlace' }, 'Know Thy Place', '何人僭越'],
			[{ type: 'relic', id: 'BagOfMarbles' }, 'Bag of Marbles', '弹珠袋'],
			[{ type: 'potion', id: 'VulnerablePotion' }, 'Vulnerable Potion', '易伤药水'],
			[{ type: 'power', id: 'ColossusPower' }, 'Colossus', '巨像'],
			[{ type: 'power', id: 'SleightOfFleshPower' }, 'Sleight of Flesh', '血肉戏法']
		]
		for (const [ref, en, zh] of samples) {
			expect(withoutVariant(resolvePowerReference(ref, 'eng')!.name)).toBe(en)
			expect(withoutVariant(resolvePowerReference(ref, 'zhs')!.name)).toBe(zh)
		}
	})

	it('中英渲染结构一致，标题、描述与链接均来自数据层', () => {
		const en = powerReferenceDetails(POWER_ID, 'eng')
		const zh = powerReferenceDetails(POWER_ID, 'zhs')
		expect(shape(en)).toEqual(shape(zh))
		expect(en.sources[0].summary).toBe('On Enemies')
		expect(zh.sources[0].summary).toBe('施加于敌人')
		expect(en.interactions.map((section) => section.summary)).toEqual([
			'Vulnerable Synergies',
			'Debuff Synergies'
		])
		expect(zh.interactions.map((section) => section.summary)).toEqual(['易伤协同', '减益协同'])
		expect(en.sources[0].groups[0].heading).toBe('Cards')
		expect(zh.sources[0].groups[0].heading).toBe('卡牌')
		expect(en.sources[0].groups[6].subheading).toBe('Any')
		expect(zh.sources[0].groups[6].subheading).toBe('任意')

		for (const [locale, details] of [['eng', en], ['zhs', zh]] as const) {
			for (const section of [...details.sources, ...details.interactions]) {
				for (const group of section.groups) {
					expect(group.heading).toBeTruthy()
					expect(group.subheading).toBeTruthy()
					for (const entry of group.entries) {
						expect(entry.id).toBeTruthy()
						expect(entry.href).toContain(entry.id!)
						expect(entry.description.length).toBeGreaterThan(0)
						expect(entry.tooltip).toContain(entry.name)
						expect(withoutVariant(entry.name)).toBe(
							field(entry.kind, entry.id!, 'title', locale)
						)
					}
				}
			}
		}
		expect(en.sources[0].groups[0].entries[0].name).toBe('Bash')
		expect(zh.sources[0].groups[0].entries[0].name).toBe('痛击')
	})

	it('Sources / Interactions 的卡牌文本保留基础文案并追加升级值', () => {
		const en = resolvePowerReference({ type: 'card', id: 'Bash' }, 'eng')!
		expect(en.description).toBe('Deal 8 damage.\nApply 2 Vulnerable.')
		expect(en.wikiText).toBe('Deal 8 (10) damage.\nApply 2 (3) Vulnerable.')
		expect(en.tooltip).not.toContain('(10)')

		const zh = resolvePowerReference({ type: 'card', id: 'Bash' }, 'zhs')!
		expect(zh.description).toBe('造成8点伤害。\n给予2层易伤。')
		expect(zh.wikiText).toContain('8 (10)')
		expect(zh.wikiText).toContain('2 (3)')

		const relic = resolvePowerReference({ type: 'relic', id: 'BagOfMarbles' }, 'eng')!
		expect(relic.wikiText).toBeUndefined()
	})

	it('wiki 标签在 eng / zhs 本地化文件中一一对应', () => {
		const eng = localizationFiles['/static/mods/sts2/localization/eng/wiki.json'] as Record<
			string,
			string
		>
		const zhs = localizationFiles['/static/mods/sts2/localization/zhs/wiki.json'] as Record<
			string,
			string
		>
		expect(Object.keys(eng).sort()).toEqual(Object.keys(zhs).sort())
		expect(Object.keys(eng).length).toBeGreaterThan(0)
		for (const key of Object.keys(eng)) {
			expect(eng[key]).toBeTruthy()
			expect(zhs[key]).toBeTruthy()
			expect(zhs[key]).not.toBe(eng[key])
		}
	})
})
