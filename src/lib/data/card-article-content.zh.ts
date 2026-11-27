import { canonicalSectionKey, type ArticleContent } from '#lib/wiki-article'
import history from './card-articles/bash/zh/history.md?raw'
import interactions from './card-articles/bash/zh/interactions.md?raw'
import notes from './card-articles/bash/zh/notes.md?raw'
import obtaining from './card-articles/bash/zh/obtaining.md?raw'
import overview from './card-articles/bash/zh/overview.md?raw'
import relics from './card-articles/bash/zh/relics.md?raw'
import synergies from './card-articles/bash/zh/synergies.md?raw'

/* Seed content and the refresh script compare exact strings; keep one line-ending form. */
const source = (value: string) => value.replaceAll('\r\n', '\n')

export const BASH_SECTIONS_ZH = {
	overview: source(overview),
	obtaining: source(obtaining),
	interactions: source(interactions),
	synergies: source(synergies),
	relics: source(relics),
	notes: source(notes),
	history: source(history)
} as const

export const BASH_CARD_CONTENT_ZH: ArticleContent = {
	lang: 'zh-Hans',
	intro: [],
	introMarkdown: overview,
	sections: [
		{ key: 'obtaining', id: 'Obtaining_Bash', title: '获取痛击', level: 2, blocks: [], markdown: obtaining },
		{ key: 'interactions', id: 'Interactions', title: '交互', level: 2, blocks: [], markdown: interactions },
		{ key: 'synergies', id: 'Synergies', title: '协同', level: 3, blocks: [], markdown: synergies },
		{ key: 'relics', id: 'Relics', title: '遗物', level: 4, blocks: [], markdown: relics },
		{ key: 'notes', id: 'Notes', title: '备注', level: 2, blocks: [], markdown: notes },
		{ key: 'history', id: 'Update_History', title: '更新历史', level: 2, blocks: [], markdown: history }
	]
}

export { CARD_SECTION_KEYS } from './card-article-content'

interface LocalizableSeedSection {
	key: string
	sourceType: string | null
	content: string
}

/** Only imported seed text is locale-swapped; community revisions stay language-agnostic. */
export function localizedBashSection<T extends LocalizableSeedSection>(section: T, locale: string): T {
	if (locale !== 'zhs' || section.sourceType !== 'mod_seed') return section
	const zh = BASH_SECTIONS_ZH[canonicalSectionKey(section.key) as keyof typeof BASH_SECTIONS_ZH]
	return zh === undefined ? section : { ...section, content: zh }
}
