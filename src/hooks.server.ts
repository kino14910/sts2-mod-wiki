import { paraglideMiddleware } from '#lib/paraglide/server'
import { resolveSession } from '#lib/server/auth/session'
import { getPlatformEnv, getWikiDb } from '#lib/server/wiki/db'
import type { Handle } from '@sveltejs/kit/hooks'
import { assertSameOrigin } from '#lib/server/wiki/api-helpers'
import { ensureCanonicalIdentities } from '#lib/server/wiki/identity-catalog'

export const handle: Handle = async ({ event, resolve }) => {
	if (!['GET', 'HEAD', 'OPTIONS'].includes(event.request.method) &&
		(event.url.pathname.startsWith('/api/auth/') || event.url.pathname.startsWith('/api/admin/') || event.url.pathname.startsWith('/api/wiki/')))
		assertSameOrigin(event.request)
	event.locals.wikiDb = getWikiDb(event.platform)
	if (event.locals.wikiDb && (event.url.pathname.startsWith('/api/wiki/') || event.url.pathname.startsWith('/api/admin/wiki/') || event.url.pathname.startsWith('/api/comments')))
		await ensureCanonicalIdentities(event.locals.wikiDb)
	event.locals.session = await resolveSession(event.request, getPlatformEnv(event.platform))

	return paraglideMiddleware(event.request, ({ locale }) => {
		const langTag = { eng: 'en', zhs: 'zh-Hans' }[locale] ?? locale
		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', langTag)
		})
	})
}
