import { json } from '@sveltejs/kit'
import { registerWithEmail } from '#lib/server/auth/email-auth'
import { clientIpHash } from '#lib/server/auth/rate-limit'
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
		const body = await readJsonBody(request)
		const ipHash = await clientIpHash(request, secret)
		const result = await registerWithEmail(collaborationDb(locals), secret, body, ipHash)
		return json({
			session: publicSession(result.session),
			permissions: rolePermissions(result.session.role)
		}, { status: 201, headers: { 'set-cookie': result.cookie, 'cache-control': 'no-store' } })
	} catch (cause) { collaborationFail(cause) }
}
