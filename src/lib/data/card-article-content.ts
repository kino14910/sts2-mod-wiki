import type { RelicWikiCell } from '#lib/data/relic-wiki'
import type { ArticleContent } from '#lib/wiki-article'
import { articleSectionMarkdown } from '#lib/wiki-article'

/** Shared editorial source, independent of loaded game data, UI and persistence. */
export const BASH_EDITORIAL = {
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

/** Original editorial content; language names remain archived above, outside the article. */
export const BASH_CARD_CONTENT: ArticleContent = {
	lang: 'en',
	intro: [{ kind: 'paragraph', text: BASH_EDITORIAL.intro }],
	sections: [
		{ key: 'obtaining', id: 'Obtaining_Bash', title: 'Obtaining Bash', level: 2,
			blocks: [{ kind: 'paragraph', text: BASH_EDITORIAL.obtaining }] },
		{ key: 'interactions', id: 'Interactions', title: 'Interactions', level: 2, blocks: [] },
		{ key: 'synergies', id: 'Synergies', title: 'Synergies', level: 3,
			blocks: [{ kind: 'list', items: [{ text: BASH_EDITORIAL.synergiesLead, children: BASH_EDITORIAL.synergies.map((text) => ({ text })) }] }] },
		{ key: 'relics', id: 'Relics', title: 'Relics', level: 4,
			blocks: [{ kind: 'list', items: BASH_EDITORIAL.relics.map((text) => ({ text })) }] },
		{ key: 'notes', id: 'Notes', title: 'Notes', level: 2,
			blocks: [{ kind: 'paragraph', text: BASH_EDITORIAL.notesLead }, { kind: 'list', items: BASH_EDITORIAL.notes.map((text) => ({ text })) }] },
		{ key: 'history', id: 'Update_History', title: 'Update History', level: 2,
			blocks: [{ kind: 'table', table: BASH_EDITORIAL.updateHistory }] }
	]
}

/** Initial Markdown revisions and the frontend fallback share one content tree. */
export const BASH_SECTIONS = articleSectionMarkdown(BASH_CARD_CONTENT)

export const CARD_SECTION_KEYS = ['overview', 'obtaining', 'interactions', 'synergies', 'relics', 'notes', 'history'] as const

export function cardSectionSeeds(cardId: string): Record<(typeof CARD_SECTION_KEYS)[number], string> {
	return Object.fromEntries(CARD_SECTION_KEYS.map((key) => [key, cardId === 'Bash' ? BASH_SECTIONS[key] : ''])) as Record<(typeof CARD_SECTION_KEYS)[number], string>
}
