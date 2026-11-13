import { entityKey, type EntityRef } from '#lib/entities'
import POWER_WIKI from './power-wiki.json'
import RELIC_WIKI from './relic-wiki.json'
import { parseWikiDocument, type WikiDocument } from '#lib/wiki-document'
import { CARD_SECTION_KEYS, cardSectionSeeds } from './card-article-content'
export { CARD_SECTION_KEYS } from './card-article-content'

export type { WikiDocument }
export { parseWikiDocument }

export const SEED_SUMMARY = 'Initial import from mod provided wiki data'

export const BASH_SECTIONS = cardSectionSeeds('Bash')

export function seedDocument(ref: EntityRef): WikiDocument | null {
	if (ref.type === 'card' && ref.id === 'Bash')
		return { kind: 'card', page: { title: 'Bash', sections: CARD_SECTION_KEYS.map((key) => ({ key, content: BASH_SECTIONS[key] })) } }
	if (ref.type === 'relic') {
		const page = (RELIC_WIKI as Record<string, unknown>)[ref.id]
		return page ? parseWikiDocument({ kind: 'relic', page }) : null
	}
	if (ref.type === 'power') {
		const page = (POWER_WIKI as Record<string, unknown>)[ref.id]
		return page ? parseWikiDocument({ kind: 'power', page }) : null
	}
	return null
}

export function listSeedRefs(): EntityRef[] {
	const refs: EntityRef[] = []
	refs.push({ type: 'card', id: 'Bash' })
	for (const id of Object.keys(RELIC_WIKI)) refs.push({ type: 'relic', id })
	for (const id of Object.keys(POWER_WIKI)) refs.push({ type: 'power', id })
	return refs
}

export function seedKey(ref: EntityRef): string {
	return entityKey(ref)
}
