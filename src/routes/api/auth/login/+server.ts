import { json } from '@sveltejs/kit'
import { loginWithEmail } from '#lib/server/auth/email-auth'
import { rolePermissions } from '#lib/server/auth/permissions'
import { publicSession } from '#lib/server/auth/public-session'
import { getRuntimeEnv } from '#lib/server/wiki/db'
import { WikiCollaborationError } from '#lib/server/wiki/access'
import { collaborationDb, collaborationFail, readJsonBody } from '#lib/server/wiki/api-helpers'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const secret = getRuntimeEnv()?.WIKI_SESSION_SECRET
		if (!secret) collaborationFail(new WikiCollaborationError(503, 'Login is not configured', 'LOGIN_UNAVAILABLE'))
		const result = await loginWithEmail(collaborationDb(locals), secret, await readJsonBody(request))
		return json({
			session: publicSession(result.session),
			permissions: rolePermissions(result.session.role)
		}, { headers: { 'set-cookie': result.cookie, 'cache-control': 'no-store' } })
	} catch (cause) { collaborationFail(cause) }
}
