import { describe, expect, it } from 'vitest'
import { cardTextToWiki } from './card-wiki-text'

const BASH = 'Deal {Damage:diff()} damage.\nApply {VulnerablePower:diff()} [gold]Vulnerable[/gold].'

describe('cardTextToWiki', () => {
	it('保留基础文案并为变化的变量追加括号升级值', () => {
		expect(
			cardTextToWiki(BASH, { Damage: 8, VulnerablePower: 2 }, { Damage: 10, VulnerablePower: 3 })
		).toBe('Deal 8 (10) damage.\nApply 2 (3) Vulnerable.')
	})

	it('未变化的变量不加括号', () => {
		const text = 'Deal {Damage:diff()} damage and apply {VulnerablePower:diff()} Vulnerable.'
		expect(cardTextToWiki(text, { Damage: 4, VulnerablePower: 1 }, { Damage: 7 })).toBe(
			'Deal 4 (7) damage and apply 1 Vulnerable.'
		)
	})

	it('无升级变量时与基础文本一致', () => {
		expect(cardTextToWiki(BASH, { Damage: 8, VulnerablePower: 2 })).toBe(
			'Deal 8 damage.\nApply 2 Vulnerable.'
		)
	})

	it('中文文案保留原文并插入升级值', () => {
		expect(cardTextToWiki('造成{Damage:diff()}点伤害。', { Damage: 8 }, { Damage: 10 })).toBe(
			'造成8 (10)点伤害。'
		)
	})

	it('plain 变量与 energyIcons 同样补充升级值', () => {
		expect(
			cardTextToWiki(
				'Gain {Block} Block and {Energy:energyIcons()}.',
				{ Block: 6, Energy: 2 },
				{ Block: 9, Energy: 3 }
			)
		).toBe('Gain 6 (9) Block and 2 (3).')
	})

	it('基础分支保持不变，升级态新增文案不覆盖原文', () => {
		expect(
			cardTextToWiki('Deal {Damage:diff()} damage.{IfUpgraded:show: twice|}', { Damage: 8 }, { Damage: 10 })
		).toBe('Deal 8 (10) damage.')
	})
})
