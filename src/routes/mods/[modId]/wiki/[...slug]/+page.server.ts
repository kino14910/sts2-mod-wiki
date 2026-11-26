import { error } from '@sveltejs/kit'
import { rolePermissions } from '#lib/server/auth/permissions'
import { publicSession } from '#lib/server/auth/public-session'
import { loadModWikiPage } from '#lib/server/wiki/page-service'
import type { WikiViewer } from '#lib/wiki-collaboration'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, locals }) => {
	const view = await loadModWikiPage(locals.wikiDb, params.modId, params.slug)
	if (view.meta.source === 'unavailable') error(503, 'Wiki database unavailable')
	if (view.meta.source === 'none') error(404, 'Mod wiki page not found')

	const session = locals.session
	const viewer: WikiViewer = {
		session: publicSession(session),
		permissions: session ? [...rolePermissions(session.role)] : []
	}
	return { wikiSections: view.sections, wikiMeta: view.meta, viewer }
}
