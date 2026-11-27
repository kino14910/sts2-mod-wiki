import { canonicalSectionKey, articleSectionMarkdown, type ArticleContent } from '#lib/wiki-article'
import type { RelicWikiCell } from '#lib/data/relic-wiki'

export const BASH_EDITORIAL_ZH = {
	intro: '[[Bash]]是[[Ironclad]]的一张消耗 2 点[[Energy]]的[[Basic]][[Attack]]牌。',
	obtaining: '[[Ironclad]]开局时牌组中带有一张[[Bash]]。它不会出现在卡牌奖励中。',
	synergiesLead: '此牌施加的[[Vulnerable]]：',
	synergies: [
		'提高[[Bully]]造成的伤害。',
		'使[[Dismantle]]额外造成一次伤害。',
		'使[[Dominate]]额外获得[[Strength]]。',
		'通过[[Vicious]]抽 1（2）张牌。',
		'配合[[Colossus]]使敌人造成的伤害降低 50%。',
		'配合[[Cruelty]]使敌人受到的伤害提高 25%（50%）。',
		'配合[[Paper Phrog]]使敌人受到的伤害提高 25%。',
		'伤害可能被[[Unsettling Lamp]]翻倍。'
	],
	relics: ['每当打出此牌时，[[Intimidating Helmet]]给予 4 点[[Block]]。'],
	notesLead: '如果从[[Orobas]]处获得[[Archaic Tooth]]，它会将[[Bash]]转变为[[Ancient]]版本[[Break]]。',
	notes: ['如果[[Bash]]已升级和/或被[[Enchanted]]，[[Break]]将默认同样升级和/或附魔。'],
	updateHistory: {
		columns: ['类型', '版本', '发布日期', '改动'],
		rows: [
			[
				{ text: 'beta' },
				{ text: 'V0.55.0' },
				{ text: '2025 年 5 月 8 日' },
				{ lines: ['修复了用同时施加能力的攻击（如痛击）击杀敌人会导致游戏卡死的问题'] }
			],
			[
				{ text: 'beta' },
				{ text: 'V0.43.0' },
				{ text: '2025 年 1 月 30 日' },
				{
					lines: [
						'为欧洛巴斯的超越祝福加入了特殊的变形初始牌：',
						'铁甲战士：痛击 → 破击'
					]
				}
			],
			[
				{ text: 'beta' },
				{ text: '2023-04-21' },
				{ text: '2023 年 4 月 21 日' },
				{ lines: ['错误修复：使用无情猛攻后无法打出痛击'] }
			],
			[
				{ text: 'beta' },
				{ text: '未知' },
				{ text: '—' },
				{ lines: ['将痛击加入游戏'] }
			]
		] satisfies RelicWikiCell[][]
	}
}

export const BASH_CARD_CONTENT_ZH: ArticleContent = {
	lang: 'zh-Hans',
	intro: [{ kind: 'paragraph', text: BASH_EDITORIAL_ZH.intro }],
	sections: [
		{
			key: 'obtaining', id: 'Obtaining_Bash', title: '获取痛击', level: 2,
			blocks: [{ kind: 'paragraph', text: BASH_EDITORIAL_ZH.obtaining }]
		},
		{ key: 'interactions', id: 'Interactions', title: '交互', level: 2, blocks: [] },
		{
			key: 'synergies', id: 'Synergies', title: '协同', level: 3,
			blocks: [{ kind: 'list', items: [{ text: BASH_EDITORIAL_ZH.synergiesLead, children: BASH_EDITORIAL_ZH.synergies.map((text) => ({ text })) }] }]
		},
		{
			key: 'relics', id: 'Relics', title: '遗物', level: 4,
			blocks: [{ kind: 'list', items: BASH_EDITORIAL_ZH.relics.map((text) => ({ text })) }]
		},
		{
			key: 'notes', id: 'Notes', title: '备注', level: 2,
			blocks: [{ kind: 'paragraph', text: BASH_EDITORIAL_ZH.notesLead }, { kind: 'list', items: BASH_EDITORIAL_ZH.notes.map((text) => ({ text })) }]
		},
		{
			key: 'history', id: 'Update_History', title: '更新历史', level: 2,
			blocks: [{ kind: 'table', table: BASH_EDITORIAL_ZH.updateHistory }]
		}
	]
}

export const BASH_SECTIONS_ZH = articleSectionMarkdown(BASH_CARD_CONTENT_ZH)

interface LocalizableSeedSection {
	key: string
	sourceType: string | null
	content: string
}

/** Only imported seed text is locale-swapped; community revisions stay language-agnostic. */
export function localizedBashSection<T extends LocalizableSeedSection>(section: T, locale: string): T {
	if (locale !== 'zhs' || section.sourceType !== 'mod_seed') return section
	const zh = BASH_SECTIONS_ZH[canonicalSectionKey(section.key)]
	return zh === undefined ? section : { ...section, content: zh }
}
