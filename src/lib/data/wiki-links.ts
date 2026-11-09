import { POWERS } from '#lib/data/glossary'
import { CARDS, RELICS } from '#lib/data/mods'
import type { Card, ColorId, CardType } from '#lib/data/cards'

const POWER_BY_NAME = new Map<string, (typeof POWERS)[number]>()
for (const entry of POWERS) POWER_BY_NAME.set(entry.name.trim().toLowerCase(), entry)

const RELIC_BY_NAME = new Map<string, (typeof RELICS)[number]>()
for (const relic of RELICS) RELIC_BY_NAME.set(relic.name.trim().toLowerCase(), relic)

const CARD_BY_NAME = new Map<string, Card>()
for (const card of CARDS) CARD_BY_NAME.set(card.name.trim().toLowerCase(), card)

export function powerIconByName(name: string): string | null {
	return POWER_BY_NAME.get(name.trim().toLowerCase())?.icon ?? null
}

export function powerHrefByName(name: string): string | null {
	const entry = POWER_BY_NAME.get(name.trim().toLowerCase())
	return entry ? `/power/${encodeURIComponent(entry.id)}` : null
}

export function relicHrefByName(name: string): string | null {
	const relic = RELIC_BY_NAME.get(name.trim().toLowerCase())
	return relic ? `/relic/${encodeURIComponent(relic.id)}` : null
}

export function relicImageByName(name: string): string | null {
	return RELIC_BY_NAME.get(name.trim().toLowerCase())?.image ?? null
}

export function cardByName(name: string): Card | undefined {
	return CARD_BY_NAME.get(name.trim().toLowerCase())
}

export function cardHrefByName(name: string): string | null {
	const card = CARD_BY_NAME.get(name.trim().toLowerCase())
	return card ? `/cards/${encodeURIComponent(card.id)}` : null
}

const COLOR_PREFIX: Record<ColorId, string> = {
	ironclad: 'Ironclad',
	silent: 'Silent',
	regent: 'Regent',
	necrobinder: 'Necrobinder',
	defect: 'Defect',
	colorless: 'Colorless'
}

const TYPE_PREFIX: Partial<Record<CardType, string>> = {
	attack: 'Attack',
	skill: 'Skill',
	power: 'Power'
}

const CARD_ICON_RARITIES = ['Common', 'Uncommon', 'Rare', 'Ancient']

const CARD_ICONS = new Set<string>()
for (const color of ['Ironclad', 'Silent', 'Regent', 'Necrobinder', 'Defect']) {
	for (const type of ['Attack', 'Skill', 'Power']) {
		for (const rarity of CARD_ICON_RARITIES) CARD_ICONS.add(`${color}_${type}_${rarity}.png`)
	}
}
for (const color of ['Colorless']) {
	for (const type of ['Attack', 'Skill', 'Power']) {
		for (const rarity of ['Uncommon', 'Rare', 'Ancient']) CARD_ICONS.add(`${color}_${type}_${rarity}.png`)
	}
}

function capitalize(value: string): string {
	return value ? value[0].toUpperCase() + value.slice(1) : value
}

export function cardIcon(card: Card): string | null {
	const color = COLOR_PREFIX[card.color]
	const type = TYPE_PREFIX[card.type]
	if (!color || !type) return null
	const wanted = capitalize(card.rarity)
	const rarities = card.color === 'colorless' ? ['Uncommon', 'Rare', 'Ancient'] : CARD_ICON_RARITIES
	for (const rarity of [wanted, ...rarities.filter((r) => r !== wanted)]) {
		const file = `${color}_${type}_${rarity}.png`
		if (CARD_ICONS.has(file)) return `/images/card_icons/${file}`
	}
	return null
}

export function isSelfLink(pathname: string, href: string | null | undefined): boolean {
	if (!href) return false
	const norm = (p: string) => (p || '/').replace(/\/+$/, '') || '/'
	return norm(pathname) === norm(href)
}
