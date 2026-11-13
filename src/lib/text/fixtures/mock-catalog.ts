import type { Card } from '#lib/data/cards'
import type { CollectionEntry } from '#lib/data/collections'
import type { GlossaryEntry } from '#lib/data/glossary'

export const CARDS: Card[] = [
	{ id: 'Bash', mod: 'sts2', name: 'Bash', text: 'Deal {Damage:diff()} damage.', cost: 2, pool: ['ironclad'], color: 'ironclad', type: 'attack', rarity: 'basic', keywords: [], variables: { Damage: 8 } },
	{ id: 'Shared', mod: 'fgo', name: 'Shared', text: 'Fgo text.', cost: 1, pool: ['fgo'], color: 'colorless', type: 'skill', rarity: 'common', keywords: [] },
	{ id: 'Shared', mod: 'other', name: 'Shared', text: 'Other text.', cost: 1, pool: ['other'], color: 'colorless', type: 'skill', rarity: 'common', keywords: [] },
	{ id: 'Shared', mod: 'sts2', name: 'Shared', text: 'Base text.', cost: 1, pool: ['ironclad'], color: 'colorless', type: 'skill', rarity: 'common', keywords: [] }
]
export const MOD_POWERS: GlossaryEntry[] = [
	{ id: 'VulnerablePower', mod: 'sts2', name: 'Vulnerable', summary: 'Take more damage.', kind: 'power', group: 'Debuff', icon: '/mods/sts2/images/powers/vulnerable.png' },
	{ id: 'EchoPower', mod: 'fgo', name: 'Echo Duplicate', summary: 'Fgo power.', kind: 'power', group: 'Buff', icon: '/fgo/echo.png' },
	{ id: 'EchoPower', mod: 'other', name: 'Echo Duplicate', summary: 'Other power.', kind: 'power', group: 'Buff', icon: '/other/echo.png' }
]
export const RELICS: CollectionEntry[] = [
	{ id: 'BowlerHat', mod: 'sts2', name: 'Bowler Hat', kind: 'relic', rarity: 'common', character: 'any', tags: [], text: 'Old flattened text.', variables: { GoldIncrease: 1.25 } }
]
export const POTIONS: CollectionEntry[] = []
export const MOD_BY_ID = new Map(['sts2', 'fgo', 'other'].map((id) => [id, {
	id, name: id, dependency: { type: 'other' as const, prefix: '' }
}]))
export const MOD_LOCALES = {}
export const CHARACTER_ASSETS = {}
export const KEYWORD_LOCALES: Record<string, Record<string, string>> = {
	eng: { 'EXHAUST.title': 'Exhaust', 'EXHAUST.description': 'Removed until combat ends.' },
	zhs: { 'EXHAUST.title': '消耗', 'EXHAUST.description': '移出本场战斗。' }
}
export const MOD_CONTENT_LOCALES: Record<string, Record<string, Record<string, string>>> = {
	eng: {
		sts2: { 'card.Bash.title': 'Bash', 'card.Bash.description': 'Deal {Damage:diff()} damage.', 'card.Shared.title': 'Shared', 'card.Shared.description': 'Base text.', 'power.VulnerablePower.title': 'Vulnerable', 'power.VulnerablePower.description': 'Take more damage.', 'relic.BowlerHat.title': 'Bowler Hat', 'relic.BowlerHat.description': 'Gain {GoldIncrease:percentMore()}% Gold.' },
		fgo: { 'card.Shared.title': 'Shared', 'card.Shared.description': 'Fgo text.' },
		other: { 'card.Shared.title': 'Shared', 'card.Shared.description': 'Other text.' }
	},
	zhs: { sts2: { 'card.Bash.title': '痛击', 'power.VulnerablePower.title': '易伤', 'power.VulnerablePower.description': '受到更多伤害。' } },
	jpn: { sts2: { 'card.Bash.title': '強打' } }
}
export function modContentText(mod: { id: string }, kind: string, id: string, field: string, locale = 'eng') {
	return MOD_CONTENT_LOCALES[locale]?.[mod.id]?.[`${kind}.${id}.${field}`]
}
export const iconFiles = {
	sts2: { 'powers/vulnerable.png': '/mods/sts2/images/powers/vulnerable.png', vulnerable: '/mods/sts2/images/powers/vulnerable.png' },
	fgo: {
		'fields/imaginaryspace.png': '/imported/fgo/fields/ImaginarySpace.png',
		'powers/shared.png': '/imported/fgo/powers/shared.png',
		'ui/shared.png': '/imported/fgo/ui/shared.png',
		shared: '/imported/fgo/ui/shared.png'
	}
}
