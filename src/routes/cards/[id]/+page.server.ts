import { loadWikiPage } from '#lib/server/wiki/page-service'
import { rolePermissions } from '#lib/server/auth/permissions'
import { getPlatformEnv } from '#lib/server/wiki/db'
import { isLocalHost } from '#lib/server/auth/github'
import { resolveEntityRoute } from '#lib/entity-route'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, locals, platform, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' })
	const { entityRef, entityKey } = resolveEntityRoute('card', params.id, url)
	const view = await loadWikiPage(locals.wikiDb, entityRef)
	const session = locals.session
	const env = getPlatformEnv(platform)
	return {
		entityRef,
		entityKey,
		wikiAuth: {
			developmentLogin: isLocalHost(url) && env?.WIKI_DEV_LOGIN === '1' && Boolean(env.WIKI_SESSION_SECRET),
			githubLogin: Boolean(env?.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.WIKI_SESSION_SECRET && env.WIKI_PUBLIC_ORIGIN)
		},
		wikiSections: view.sections,
		wikiMeta: view.meta,
		viewer: {
			session: session ? { userId: session.userId, username: session.username, role: session.role, status: session.status } : null,
			permissions: session ? [...rolePermissions(session.role)] : []
		}
	}
}
