import { paraglideMiddleware } from '#lib/paraglide/server'
import { resolveSession } from '#lib/server/auth/session'
import { getPlatformEnv, getWikiDb } from '#lib/server/wiki/db'
import type { Handle } from '@sveltejs/kit/hooks'

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.wikiDb = getWikiDb(event.platform)
	event.locals.session = await resolveSession(event.request, getPlatformEnv(event.platform))

	return paraglideMiddleware(event.request, ({ locale }) => {
		const langTag = { eng: 'en', zhs: 'zh-Hans' }[locale] ?? locale
		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', langTag)
		})
	})
}
