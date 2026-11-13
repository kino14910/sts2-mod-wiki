import type { RelicWikiToken } from '#lib/data/relic-wiki'
import {
	cardByName,
	cardHrefByName,
	cardIcon,
	powerHrefByName,
	powerIconByName,
	relicHrefByName,
	relicImageByName
} from '#lib/data/wiki-links'
import { CHARACTER_ASSETS } from '#lib/data/mods'
import type { ArticleContent } from '#lib/wiki-article'
import { BASH_EDITORIAL, BASH_CARD_CONTENT } from './card-article-content'

interface CardWikiTocItem {
	id: string
	number: string
	label: string
	indent?: boolean
	depth?: number
}

const tokens: Record<string, RelicWikiToken> = {}

function cardToken(name: string) {
	const card = cardByName(name)
	tokens[name] = {
		text: name,
		href: cardHrefByName(name) ?? '',
		icon: card ? (cardIcon(card) ?? '') : ''
	}
}

function powerToken(name: string) {
	tokens[name] = {
		text: name,
		href: powerHrefByName(name) ?? '',
		icon: powerIconByName(name) ?? ''
	}
}

function relicToken(name: string) {
	tokens[name] = {
		text: name,
		href: relicHrefByName(name) ?? '',
		icon: relicImageByName(name) ?? ''
	}
}

for (const name of [
	'Bash',
	'Break',
	'Bully',
	'Dismantle',
	'Dominate',
	'Vicious',
	'Colossus',
	'Cruelty'
]) {
	cardToken(name)
}

for (const name of ['Vulnerable', 'Strength', 'Block']) powerToken(name)
for (const name of ['Paper Phrog', 'Unsettling Lamp', 'Intimidating Helmet', 'Archaic Tooth']) {
	relicToken(name)
}

tokens.Energy = {
	text: '',
	icon: CHARACTER_ASSETS.ironclad?.textEnergy ?? ''
}
tokens.Ironclad = { text: 'Ironclad', href: '/cards?color=ironclad' }
tokens.Orobas = { text: 'Orobas' }
tokens.Basic = { text: 'Basic', href: '/cards?rarity=basic&color=ironclad' }
tokens.Attack = { text: 'Attack', href: '/cards?type=attack&color=ironclad' }
tokens.Ancient = { text: 'Ancient', href: '/cards?rarity=ancient&color=ironclad' }
tokens.Enchanted = { text: 'Enchanted' }

export const BASH_WIKI = {
	page: { tokens, tooltips: {} as Record<string, string> },
	toc: [
		{ id: 'Obtaining_Bash', number: '1', label: 'Obtaining Bash' },
		{ id: 'Interactions', number: '2', label: 'Interactions' },
		{ id: 'Synergies', number: '2.1', label: 'Synergies', indent: true, depth: 1 },
		{ id: 'Relics', number: '2.1.1', label: 'Relics', indent: true, depth: 2 },
		{ id: 'Notes', number: '3', label: 'Notes' },
		{ id: 'Update_History', number: '4', label: 'Update History' }
	] satisfies CardWikiTocItem[],
	...BASH_EDITORIAL
}

/** Presentation enrichment resolves entity icons separately from the editorial source. */
export const BASH_CARD_ARTICLE: ArticleContent = { ...BASH_CARD_CONTENT, context: BASH_WIKI.page }
