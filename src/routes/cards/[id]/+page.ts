import { resolveEntityRoute } from '#lib/entity-route'
import { CARDS, MOD_BY_ID } from '#lib/data/mods'
import type { PageLoad } from './$types'

export const load: PageLoad = ({ params, data, url }) => {
	const route = resolveEntityRoute('card', params.id, url)
	const card = route.game.data
	const index = CARDS.indexOf(card)
	const mod = MOD_BY_ID.get(card.mod)

	return {
		...data,
		entityRef: route.entityRef,
		entityKey: route.entityKey,
		card,
		mod,
		prev: CARDS[index - 1] ?? null,
		next: CARDS[index + 1] ?? null
	}
}
