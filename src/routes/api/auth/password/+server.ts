import { json } from '@sveltejs/kit'
import { changePassword } from '#lib/server/auth/email-auth'
import { WikiCollaborationError } from '#lib/server/wiki/access'
import { collaborationDb, collaborationFail, readJsonBody } from '#lib/server/wiki/api-helpers'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		if (!locals.session) collaborationFail(new WikiCollaborationError(401, 'Sign in required', 'UNAUTHENTICATED'))
		await changePassword(collaborationDb(locals), locals.session.userId, await readJsonBody(request))
		return json({ ok: true }, { headers: { 'cache-control': 'no-store' } })
	} catch (cause) { collaborationFail(cause) }
}
