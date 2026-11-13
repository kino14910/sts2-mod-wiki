import { describe, expect, it } from 'vitest'
import { parseGameTemplate, resolveGameTemplate, type TemplateDiagnostic } from './game-template'
import { resolveCardTextToBBCode, cardTextToPlain } from './card-text'
import { resolveCollectionText } from './collection-text'
import { adaptLegacyCollectionVariables } from './legacy-variables'
import real from './fixtures/real-game-templates.json'

// Snapshots copied from Fgo/localization/zhs/cards.json and the game's eng tables.
// Expectations follow Core/Localization/Formatters, not Spire Codex's approximations.
describe('shared game template evaluator', () => {
	it('keeps complete conditional expressions including nested BBCode', () => {
		const nodes = parseGameTemplate(real['FGO_CARD_WISDOM_OF_THE_PEOPLE.description'])
		expect(nodes.at(-1)).toMatchObject({ type: 'variable', name: 'IfUpgraded' })
		expect(resolveGameTemplate(real['FGO_CARD_WISDOM_OF_THE_PEOPLE.description'], {
			variables: { Heal: 20, Np: 30 }
		})).toBe('恢复20点生命。\n[gold]消耗[/gold]你所有的状态牌。')
	})

	it('evaluates selected nested branches and distinguishes upgrade from preview', () => {
		const text = real['FGO_CARD_WISDOM_OF_THE_PEOPLE.description']
		const variables = { Heal: 20, Np: 30 }
		expect(resolveGameTemplate(text, { variables, upgraded: true, upgradeDisplay: 'upgraded' }))
			.toBe('恢复20点生命。\n[gold]消耗[/gold]你所有的状态牌。\n获得30%[gold]宝具值[/gold]')
		expect(resolveGameTemplate(text, { variables, upgraded: true }))
			.toContain('[green]\n获得30%[gold]宝具值[/gold][/green]')
	})

	it('handles Fgo current-value references in conditional branches', () => {
		const text = real['FGO_CARD_PROOF_AND_REBUTTAL.description']
		expect(cardTextToPlain(text, { variables: { Cards: 1 } })).toContain('抽一张牌。')
		expect(cardTextToPlain(text, { variables: { Cards: 2 } })).toContain('抽2张牌。')
	})

	it('handles actual choose fallbacks without leaking unused branch markup', () => {
		const text = real['FGO_CARD_CHARISMA.description']
		expect(resolveGameTemplate(text, { variables: { Fatigue: 0 } })).not.toContain('[gold]疲劳[/gold]：')
		expect(resolveGameTemplate(text, { variables: { Fatigue: 3 } })).toContain('[gold]疲劳[/gold]：3。')
		expect(cardTextToPlain(real['ASTRAL_PULSE.description'], { variables: { Damage: 9, HitCount: 3 } }))
			.toBe('Deal 9 damage to ALL enemies 3 times.')
	})

	it.each([0, 1, 4, 5, 8, -1])('uses game energy and star layout at count %s', (count) => {
		const expected = count > 0 && count < 5 ? `[energy_icons=${count}]` : `${count}[energy_icons=1]`
		expect(resolveCardTextToBBCode('{Energy:energyIcons()}', { variables: { Energy: count } })).toBe(expected)
		expect(resolveCollectionText('{Energy:energyIcons()}', { Energy: count })).toBe(expected)
		expect(resolveGameTemplate('{Stars:starIcons()}', { variables: { Stars: count } }))
			.toBe(expected.replaceAll('energy', 'star'))
	})

	it('uses explicit count for an energy prefix string and keeps plain output numeric', () => {
		expect(resolveGameTemplate('{energyPrefix:energyIcons(8)}')).toBe('8[energy_icons=1]')
		expect(cardTextToPlain('{Energy:energyIcons()}', { variables: { Energy: 0 } })).toBe('0')
	})

	it('uses raw ratios and game midpoint rounding without adding percent signs', () => {
		expect(resolveCollectionText(real['BOWLER_HAT.description'], { GoldIncrease: 1.25 }))
			.toBe('Gain [blue]25%[/blue] additional [gold]Gold[/gold].')
		expect(resolveGameTemplate('{N:percentMore()}', { variables: { N: 1.125 } })).toBe('12')
		expect(resolveGameTemplate('{N:percentLess()}', { variables: { N: 0.75 } })).toBe('25')
	})

	it('shares nested plural and condition semantics across cards and collections', () => {
		const text = '{N:plural:{IfUpgraded:show:[gold]one+[/gold]|one}|[blue]{}[/blue] items}'
		for (const N of [1, 2]) {
			expect(resolveCollectionText(text, { N }, { upgraded: true }))
				.toBe(resolveCardTextToBBCode(text, { variables: { N }, upgraded: true }))
		}
		expect(resolveGameTemplate('{N:cond:>5?large|=2?two|other}', { variables: { N: 2 } })).toBe('two')
	})

	it('handles known DynamicVar string properties and default library context', () => {
		expect(resolveGameTemplate(real['ARCHAIC_TOOTH.description'], {
			variables: { StarterCard: 'Strike', AncientCard: 'Ancient Strike' }
		})).toBe('Upon pickup, [gold]Transform[/gold] [gold]Strike[/gold] into [gold]Ancient Strike[/gold].')
		expect(resolveGameTemplate('{InCombat:combat|library}')).toBe('library')
	})

	it('retains unknown inputs with structured diagnostics', () => {
		const diagnostics: TemplateDiagnostic[] = []
		const text = '{Missing} {N:unsupported()} broken {Open'
		expect(resolveGameTemplate(text, { variables: { N: 1 }, onDiagnostic: (d) => diagnostics.push(d) })).toBe(text)
		expect(diagnostics.map((d) => d.code)).toEqual(['missing-variable', 'unsupported-format', 'unclosed-variable'])
	})
})

describe('explicit legacy collection migration', () => {
	it.each([25, '25', '25%'])('migrates old BowlerHat display percentage %s exactly once at the load boundary', (GoldIncrease) => {
		const input = { GoldIncrease, Other: 25 }
		const variables = adaptLegacyCollectionVariables(real['BOWLER_HAT.description'], input, {
			modId: 'sts2', source: 'legacy-static'
		})
		expect(variables).toEqual({ GoldIncrease: 1.25, Other: 25 })
		expect(input.GoldIncrease).toBe(GoldIncrease)
		expect(resolveCollectionText(real['BOWLER_HAT.description'], variables)).toContain('[blue]25%[/blue]')
	})

	it('never guesses build values or Mod variables from their magnitude', () => {
		for (const value of [0, 1.25, 25, 100]) {
			const variables = { GoldIncrease: value }
			expect(adaptLegacyCollectionVariables(real['BOWLER_HAT.description'], variables, { modId: 'sts2', source: 'build' })).toBe(variables)
			expect(adaptLegacyCollectionVariables(real['BOWLER_HAT.description'], variables, { modId: 'fgo', source: 'legacy-static' })).toBe(variables)
		}
	})

	it('does not reinterpret ordinary values or unsupported legacy formatters', () => {
		expect(adaptLegacyCollectionVariables('{N} {M:percentLess()}', { N: 25, M: 0.75 }, {
			modId: 'sts2', source: 'legacy-static'
		})).toEqual({ N: 25, M: 0.75 })
	})
})
