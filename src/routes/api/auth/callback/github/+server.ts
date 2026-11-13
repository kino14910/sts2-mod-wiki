import { getPlatformEnv } from '#lib/server/wiki/db'
import { collaborationDb, collaborationFail } from '#lib/server/wiki/api-helpers'
import { clearOAuthCookie, completeGithubLogin, OAUTH_COOKIE } from '#lib/server/auth/github'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals, platform, url, cookies }) => {
	try {
		const result = await completeGithubLogin(collaborationDb(locals), getPlatformEnv(platform) ?? {} as Env, url, cookies.get(OAUTH_COOKIE))
		const headers = new Headers({ location: result.location, 'cache-control': 'no-store' })
		headers.append('set-cookie', result.cookie)
		headers.append('set-cookie', clearOAuthCookie())
		return new Response(null, { status: 303, headers })
	} catch (cause) { collaborationFail(cause) }
}
