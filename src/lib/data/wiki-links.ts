import { POWERS, powerHref } from '#lib/data/glossary'
import { CARDS, POTIONS, RELICS } from '#lib/data/mods'
import { cardHref, type Card, type ColorId, type CardType } from '#lib/data/cards'
import { collectionHref } from './collections'
import { resolvePublicEntityRef } from '../entity-identity.ts'
import type { EntityType } from '../entities.ts'

/** Legacy name-only callers may resolve a unique name, never a last-wins homonym. */
function uniqueNames<T extends { name: string }>(entries: T[]): Map<string, T | null> {
    const result = new Map<string, T | null>()
    for (const entry of entries) {
        const key = entry.name.trim().toLowerCase()
        result.set(key, result.has(key) ? null : entry)
    }
    return result
}

const POWER_BY_NAME = uniqueNames(POWERS)
const RELIC_BY_NAME = uniqueNames(RELICS)
const POTION_BY_NAME = uniqueNames(POTIONS)
const CARD_BY_NAME = uniqueNames(CARDS)

function byId<T extends { id: string; mod?: string }>(entries: T[], type: EntityType, id: string, modId?: string): T | undefined {
    const ref = resolvePublicEntityRef({ type, id, modId })
    return ref ? entries.find(x => x.id === ref.id && (x.mod ?? 'sts2') === ref.modId) : undefined
}

export function powerIconByName(name: string): string | null {
    return POWER_BY_NAME.get(name.trim().toLowerCase())?.icon ?? null
}
export function powerIconById(id: string, modId?: string): string | null {
    return byId(POWERS, 'power', id, modId)?.icon ?? null
}
export function relicImageByName(name: string): string | null {
    return RELIC_BY_NAME.get(name.trim().toLowerCase())?.image ?? null
}
export function relicImageById(id: string, modId?: string): string | null {
    return byId(RELICS, 'relic', id, modId)?.image ?? null
}
export function potionImageByName(name: string): string | null {
    return POTION_BY_NAME.get(name.trim().toLowerCase())?.image ?? null
}
export function potionImageById(id: string, modId?: string): string | null {
    return byId(POTIONS, 'potion', id, modId)?.image ?? null
}
export function powerHrefByName(name: string): string | null {
    const entry = POWER_BY_NAME.get(name.trim().toLowerCase())
    return entry ? powerHref(entry) : null
}
export function relicHrefByName(name: string): string | null {
    const entry = RELIC_BY_NAME.get(name.trim().toLowerCase())
    return entry ? collectionHref(entry) : null
}
export function cardByName(name: string): Card | undefined {
    return CARD_BY_NAME.get(name.trim().toLowerCase()) ?? undefined
}
export function cardById(id: string, modId?: string): Card | undefined {
    return byId(CARDS, 'card', id, modId)
}
export function cardHrefByName(name: string): string | null {
    const card = cardByName(name)
    return card ? cardHref(card) : null
}

const COLOR_PREFIX: Record<ColorId, string> = {
	ironclad: 'Ironclad',
	silent: 'Silent',
	regent: 'Regent',
	necrobinder: 'Necrobinder',
	defect: 'Defect',
	fool: 'Fool',
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
	const color = COLOR_PREFIX[card.color as ColorId]
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
