import { error } from '@sveltejs/kit'
import { RELIC_WIKI_NAVBOX } from '#lib/data/relic-wiki'
import { RELICS } from '#lib/data/mods'
import { collectionTextToPlain } from '#lib/text/collection-text'
import type { PageLoad } from './$types'

export const load: PageLoad = ({ params, data }) => {
	const entry = RELICS.find((item) => item.id === params.id)
	if (!entry) error(404, 'Relic not found')

	return {
		...data,
		entry,
		navbox: RELIC_WIKI_NAVBOX,
		text: collectionTextToPlain(entry.text)
	}
}
