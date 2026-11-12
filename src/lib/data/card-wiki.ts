import navboxRaw from './ironclad-card-navbox.json'
import type { RelicWikiCell, RelicWikiToken } from '#lib/data/relic-wiki'
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

interface CardWikiTocItem {
	id: string
	number: string
	label: string
	indent?: boolean
	depth?: number
}

export interface CardWikiNavboxItem {
	name: string
	href: string | null
}

export interface CardWikiNavboxRow {
	group?: string
	href?: string
	items: CardWikiNavboxItem[]
}

export interface CardWikiNavboxGroup {
	label: string
	href: string
	rows: CardWikiNavboxRow[]
}

export interface CardWikiNavbox {
	title: string
	href: string
	templateHref: string
	groups: CardWikiNavboxGroup[]
}

export const IRONCLAD_CARD_NAVBOX = navboxRaw as CardWikiNavbox

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
		{ id: 'Names_in_Other_Languages', number: '4', label: 'Names in Other Languages' },
		{ id: 'Update_History', number: '5', label: 'Update History' }
	] satisfies CardWikiTocItem[],
	intro: '[[Bash]] is a 2 [[Energy]] cost [[Basic]] [[Attack]] Card for the [[Ironclad]].',
	obtaining: 'The [[Ironclad]] starts the game with one copy of [[Bash]] in his deck. It is not found in card rewards.',
	synergiesLead: '[[Vulnerable]] applied by this card:',
	synergies: [
		'Increases damage dealt by [[Bully]].',
		'Grants an additional hit from [[Dismantle]].',
		'Grants additional [[Strength]] from [[Dominate]].',
		'Draws 1 (2) card via [[Vicious]].',
		'Makes enemies deal 50% less damage with [[Colossus]].',
		'Makes enemies take 25% (50%) more damage with [[Cruelty]].',
		'Makes enemies take 25% more damage with [[Paper Phrog]].',
		'Is potentially doubled by [[Unsettling Lamp]].'
	],
	relics: ['[[Intimidating Helmet]] grants 4 [[Block]] whenever this card is played.'],
	notesLead: '[[Archaic Tooth]], if taken from [[Orobas]], transforms [[Bash]] into its [[Ancient]] version [[Break]].',
	notes: [
		'If [[Bash]] has already been upgraded and/or [[Enchanted]], [[Break]] will be upgraded and/or [[Enchanted]] by default.'
	],
	names: {
		columns: ['Language', 'Name', 'Meaning/Explanation'],
		rows: [
			['Simplified Chinese', '痛击', 'tongji'],
			['French', 'Heurt', ''],
			['German', 'Schmettern', ''],
			['Indonesian', 'Remuk', ''],
			['Italian', 'Mazzata', ''],
			['Japanese', '強打', 'Kyouda'],
			['Korean', '강타', 'gangta'],
			['Polish', 'Grzmotnięcie', ''],
			['Brazilian Portuguese', 'Esmagar', ''],
			['Russian', 'Вмятина', 'Vmjatina'],
			['Spanish (Spain)', 'Porrazo', ''],
			['Spanish (Latin America)', 'Mazazo', ''],
			['Thai', 'ทุบตี', 'thupti'],
			['Turkish', 'Göçertme', ''],
			['Internal name', 'BASH', '']
		].map(([language, name, subtext]) => [
			{ text: language },
			{ text: name, subtext },
			{ text: '' }
		]) as RelicWikiCell[][]
	},
	updateHistory: {
		columns: ['Type', 'Version', 'Release Date', 'Changes'],
		rows: [
			[
				{ text: 'Pre-release' },
				{ text: 'V0.55.0' },
				{ text: 'May 8th, 2025' },
				{
					lines: [
						'Fixed an issue where killing an enemy with an attack that also applied a power to them (like Bash) caused a softlock'
					]
				}
			],
			[
				{ text: 'Pre-release' },
				{ text: 'V0.43.0' },
				{ text: 'January 30th, 2025' },
				{
					lines: [
						'Added special transformed starter cards for Orobas’ Transcendence blessing:',
						'Ironclad: Bash -> Break'
					]
				}
			],
			[
				{ text: 'Pre-release' },
				{ text: '2023-04-21' },
				{ text: 'April 21st, 2023' },
				{ lines: ['Bug Fixes: Unable to play bash after unrelenting'] }
			],
			[
				{ text: 'Pre-release' },
				{ text: 'Unknown' },
				{ text: '—' },
				{ lines: ['Added Bash to the game'] }
			]
		] satisfies RelicWikiCell[][]
	}
}
