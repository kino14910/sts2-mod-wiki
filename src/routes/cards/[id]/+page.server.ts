import { loadWikiPage } from '#lib/server/wiki/page-service'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, locals }) => {
	const view = await loadWikiPage(locals.wikiDb, { type: 'card', id: params.id })
	return { wikiSections: view.sections, wikiMeta: view.meta }
}
