import type { RelicWikiPage } from '#lib/data/relic-wiki'
import { loadWikiPage } from '#lib/server/wiki/page-service'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, locals }) => {
	const view = await loadWikiPage(locals.wikiDb, { type: 'relic', id: params.id })
	const wiki: RelicWikiPage | null =
		view.document?.kind === 'relic' ? view.document.page : null
	return { wiki, wikiMeta: view.meta }
}
