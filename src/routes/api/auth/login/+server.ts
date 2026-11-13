import { getPlatformEnv } from '#lib/server/wiki/db'
import { collaborationDb, collaborationFail } from '#lib/server/wiki/api-helpers'
import { startGithubLogin } from '#lib/server/auth/github'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals, platform, url }) => {
	try {
		const result = await startGithubLogin(collaborationDb(locals), getPlatformEnv(platform) ?? {} as Env, url)
		return new Response(null, { status: 303, headers: { location: result.location, 'set-cookie': result.cookie, 'cache-control': 'no-store' } })
	} catch (cause) { collaborationFail(cause) }
}
