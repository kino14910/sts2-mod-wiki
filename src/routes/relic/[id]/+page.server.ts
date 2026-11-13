import type { RelicWikiPage } from '#lib/data/relic-wiki'
import { loadWikiPage } from '#lib/server/wiki/page-service'
import { resolveEntityRoute } from '#lib/entity-route'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, locals, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' })
	const { entityRef, entityKey } = resolveEntityRoute('relic', params.id, url)
	const view = await loadWikiPage(locals.wikiDb, entityRef)
	const wiki: RelicWikiPage | null =
		view.document?.kind === 'relic' ? view.document.page : null
	return { entityRef, entityKey, wiki, wikiMeta: view.meta }
}
