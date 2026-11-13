import { CARDS } from './mods'
import { cardHref, rarityInfo, rarityMatches, rarityRank, type Card } from './cards'
import { colorName, localizedCards, rarityName } from './localize'
import { publicEntityKey } from '#lib/entities'
import { m } from '#lib/paraglide/messages'

export interface CardNavboxItem {
	name: string
	href: string | null
	key: string
}

export interface CardNavboxGroup {
	label: string
	key: string
	href: string
	rows: { items: CardNavboxItem[] }[]
}

export interface CardNavbox {
	title: string
	href: string
	groups: CardNavboxGroup[]
}

function entityKey(card: Card) {
	return publicEntityKey({ type: 'card', id: card.id, modId: card.mod })!
}

function belongsToRarity(card: Card, rarity: string) {
	const base = rarityInfo(card.rarity).base
	return base === undefined || card.rarity === rarity
}

export function buildCardNavbox(card: Card, cardsPath = '/cards'): CardNavbox {
	const color = card.color
	const colorCards = localizedCards(CARDS.filter((entry) => entry.color === color))
	const selfKey = entityKey(card)
	const filterHref = (rarity?: string) =>
		`${cardsPath}?color=${encodeURIComponent(color)}${rarity ? `&rarity=${encodeURIComponent(rarity)}` : ''}`
	const rarities = [...new Set(colorCards.map((entry) => entry.rarity))]
		.sort((a, b) => rarityRank(a) - rarityRank(b) || a.localeCompare(b))

	const groups = rarities.map((rarity) => {
		const items = colorCards
			.filter((entry) => rarityMatches(rarity, entry.rarity) && belongsToRarity(entry, rarity))
			.sort((a, b) => a.name.localeCompare(b.name))
			.map((entry) => {
				const key = entityKey(entry)
				return { name: entry.name, href: key === selfKey ? null : cardHref(entry), key }
			})
		return { label: rarityName(rarity), key: rarity, href: filterHref(rarity), rows: [{ items }] }
	}).filter((group) => group.rows[0].items.length > 0)

	return { title: m.card_navbox({ name: colorName(color) }), href: filterHref(), groups }
}
