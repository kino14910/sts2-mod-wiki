import { loadWikiPage } from '#lib/server/wiki/page-service'
import { rolePermissions } from '#lib/server/auth/permissions'
import { publicSession } from '#lib/server/auth/public-session'
import { resolveEntityRoute } from '#lib/entity-route'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, locals, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' })
	const { entityRef, entityKey } = resolveEntityRoute('card', params.id, url)
	const view = await loadWikiPage(locals.wikiDb, entityRef)
	const session = locals.session
	return {
		entityRef,
		entityKey,
		wikiSections: view.sections,
		wikiMeta: view.meta,
		viewer: {
			session: publicSession(session),
			permissions: session ? [...rolePermissions(session.role)] : []
		}
	}
}
