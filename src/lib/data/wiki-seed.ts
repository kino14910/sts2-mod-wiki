import { entityKey, type EntityRef } from '#lib/entities'
import { POWER_WIKI } from './power-wiki'
import { RELIC_WIKI } from './relic-wiki'
import { parseWikiDocument, type WikiDocument } from '#lib/wiki-document'

export type { WikiDocument }
export { parseWikiDocument }

export const SEED_SUMMARY = 'Initial import from mod provided wiki data'

export function seedDocument(ref: EntityRef): WikiDocument | null {
	if (ref.type === 'relic') {
		const page = RELIC_WIKI[ref.id]
		return page ? { kind: 'relic', page } : null
	}
	if (ref.type === 'power') {
		const page = POWER_WIKI[ref.id]
		return page ? { kind: 'power', page } : null
	}
	return null
}

export function listSeedRefs(): EntityRef[] {
	const refs: EntityRef[] = []
	for (const id of Object.keys(RELIC_WIKI)) refs.push({ type: 'relic', id })
	for (const id of Object.keys(POWER_WIKI)) refs.push({ type: 'power', id })
	return refs
}

export function seedKey(ref: EntityRef): string {
	return entityKey(ref)
}
