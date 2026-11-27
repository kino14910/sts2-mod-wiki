import type { ArticleContent } from '#lib/wiki-article'
import { CARD_SECTION_KEYS, type CardSectionKey } from './card-section-keys'
import history from './card-articles/bash/en/history.md?raw'
import interactions from './card-articles/bash/en/interactions.md?raw'
import notes from './card-articles/bash/en/notes.md?raw'
import obtaining from './card-articles/bash/en/obtaining.md?raw'
import overview from './card-articles/bash/en/overview.md?raw'
import relics from './card-articles/bash/en/relics.md?raw'
import synergies from './card-articles/bash/en/synergies.md?raw'

export { CARD_SECTION_KEYS, type CardSectionKey } from './card-section-keys'

/* Seed content and the refresh script compare exact strings; keep one line-ending form. */
const source = (value: string) => value.replaceAll('\r\n', '\n')

/** Markdown files are the single editorial source for the Bash card article. */
export const BASH_SECTIONS = {
	overview: source(overview),
	obtaining: source(obtaining),
	interactions: source(interactions),
	synergies: source(synergies),
	relics: source(relics),
	notes: source(notes),
	history: source(history)
} as const

export const BASH_CARD_CONTENT: ArticleContent = {
	lang: 'en',
	intro: [],
	introMarkdown: overview,
	sections: [
		{ key: 'obtaining', id: 'Obtaining_Bash', title: 'Obtaining Bash', level: 2, blocks: [], markdown: obtaining },
		{ key: 'interactions', id: 'Interactions', title: 'Interactions', level: 2, blocks: [], markdown: interactions },
		{ key: 'synergies', id: 'Synergies', title: 'Synergies', level: 3, blocks: [], markdown: synergies },
		{ key: 'relics', id: 'Relics', title: 'Relics', level: 4, blocks: [], markdown: relics },
		{ key: 'notes', id: 'Notes', title: 'Notes', level: 2, blocks: [], markdown: notes },
		{ key: 'history', id: 'Update_History', title: 'Update History', level: 2, blocks: [], markdown: history }
	]
}

export function cardSectionSeeds(cardId: string): Record<CardSectionKey, string> {
	return Object.fromEntries(CARD_SECTION_KEYS.map((key) => [key, cardId === 'Bash' ? BASH_SECTIONS[key] : ''])) as Record<CardSectionKey, string>
}
