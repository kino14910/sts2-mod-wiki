import type { WikiPage } from '#lib/data/power-wiki'
import { loadWikiPage } from '#lib/server/wiki/page-service'
import { resolveEntityRoute } from '#lib/entity-route'
import type { PageServerLoad } from './$types'

/** Legacy D1 revisions may still carry the old inline source / interaction lists. */
function narrativeOnly(page: WikiPage): WikiPage {
	const { title, stackType, text, order, effectsImmune } = page
	return { title, stackType, text, order, effectsImmune }
}

export const load: PageServerLoad = async ({ params, locals, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' })
	const { entityRef, entityKey } = resolveEntityRoute('power', params.id, url)
	const view = await loadWikiPage(locals.wikiDb, entityRef)
	const page = view.document?.kind === 'power' ? view.document.page : null
	const wiki: WikiPage | null = page ? narrativeOnly(page) : null
	return { entityRef, entityKey, wiki, wikiMeta: view.meta }
}
