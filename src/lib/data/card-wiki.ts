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
import { BASH_CARD_CONTENT } from './card-article-content'
import { BASH_CARD_CONTENT_ZH } from './card-article-content.zh'

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
	] satisfies CardWikiTocItem[]
}

/** Presentation enrichment resolves entity icons separately from the editorial source. */
export const BASH_CARD_ARTICLE: ArticleContent = { ...BASH_CARD_CONTENT, context: BASH_WIKI.page }

const ZH_TOKEN_LABELS: Record<string, string> = {
	Bash: '痛击', Break: '破击', Bully: '欺凌', Dismantle: '拆卸', Dominate: '主宰',
	Vicious: '凶恶', Colossus: '巨像', Cruelty: '残酷', Vulnerable: '易伤',
	Strength: '力量', Block: '格挡', 'Paper Phrog': '纸蛙', 'Unsettling Lamp': '不安油灯',
	'Intimidating Helmet': '骇人头盔', 'Archaic Tooth': '古老牙齿', Ironclad: '铁甲战士',
	Orobas: '欧洛巴斯', Basic: '基础', Attack: '攻击', Ancient: '远古', Enchanted: '附魔'
}

const zhTokens: Record<string, RelicWikiToken> = Object.fromEntries(
	Object.entries(tokens).map(([name, token]) => [
		name,
		{ ...token, text: ZH_TOKEN_LABELS[name] ?? token.text }
	])
)

export const BASH_CARD_ARTICLE_ZH: ArticleContent = {
	...BASH_CARD_CONTENT_ZH,
	context: { tokens: zhTokens, tooltips: BASH_WIKI.page.tooltips }
}
