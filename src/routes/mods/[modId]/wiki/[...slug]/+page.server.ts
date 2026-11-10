import { error } from '@sveltejs/kit'
import { loadModWikiPage } from '#lib/server/wiki/page-service'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, locals }) => {
	const view = await loadModWikiPage(locals.wikiDb, params.modId, params.slug)
	if (view.meta.source === 'unavailable') error(503, 'Wiki database unavailable')
	if (view.meta.source === 'none') error(404, 'Mod wiki page not found')
	return { wikiSections: view.sections, wikiMeta: view.meta }
}
