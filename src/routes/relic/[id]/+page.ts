import { resolveEntityRoute } from '#lib/entity-route'
import { RELIC_WIKI_NAVBOX } from '#lib/data/relic-wiki'
import { collectionTextToPlain } from '#lib/text/collection-text'
import type { PageLoad } from './$types'

export const load: PageLoad = ({ params, data, url }) => {
	const route = resolveEntityRoute('relic', params.id, url)
	const entry = route.game.data

	return {
		...data,
		entityRef: route.entityRef,
		entityKey: route.entityKey,
		entry,
		navbox: RELIC_WIKI_NAVBOX,
		text: collectionTextToPlain(entry.text)
	}
}
