import type { WikiPage } from '#lib/data/power-wiki'
import { loadWikiPage } from '#lib/server/wiki/page-service'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, locals }) => {
	const view = await loadWikiPage(locals.wikiDb, { type: 'power', id: params.id })
	const wiki: WikiPage | null = view.document?.kind === 'power' ? view.document.page : null
	return { wiki, wikiMeta: view.meta }
}
