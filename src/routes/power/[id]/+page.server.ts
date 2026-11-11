import type { WikiPage } from '#lib/data/power-wiki'
import { loadWikiPage } from '#lib/server/wiki/page-service'
import type { PageServerLoad } from './$types'

/** Legacy D1 revisions may still carry the old inline source / interaction lists. */
function narrativeOnly(page: WikiPage): WikiPage {
	const { title, stackType, text, order, effectsImmune } = page
	return { title, stackType, text, order, effectsImmune }
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const view = await loadWikiPage(locals.wikiDb, { type: 'power', id: params.id })
	const page = view.document?.kind === 'power' ? view.document.page : null
	const wiki: WikiPage | null = page ? narrativeOnly(page) : null
	return { wiki, wikiMeta: view.meta }
}
