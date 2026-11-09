import { error } from '@sveltejs/kit'
import { RELIC_WIKI, RELIC_WIKI_NAVBOX } from '#lib/data/relic-wiki'
import { RELICS } from '#lib/data/mods'
import { collectionTextToPlain } from '#lib/text/collection-text'

export function load({ params }: { params: { id: string } }) {
	const entry = RELICS.find((item) => item.id === params.id)
	if (!entry) error(404, 'Relic not found')

	return {
		entry,
		wiki: RELIC_WIKI[params.id] ?? null,
		navbox: RELIC_WIKI_NAVBOX,
		text: collectionTextToPlain(entry.text)
	}
}
