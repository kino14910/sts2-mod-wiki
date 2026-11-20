import { error, json } from '@sveltejs/kit'
import { hasPermission } from '#lib/server/auth/permissions'
import { createInvites, listInvites } from '#lib/server/auth/invites'
import { collaborationActor, collaborationDb, collaborationFail, readJsonBody } from '#lib/server/wiki/api-helpers'
import { getRuntimeEnv } from '#lib/server/wiki/db'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.session) error(401, 'Sign in required')
	if (!hasPermission(locals.session, 'invite:manage')) error(403, 'Forbidden')
	const invites = await listInvites(collaborationDb(locals))
	return json({ invites }, { headers: { 'cache-control': 'no-store' } })
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const secret = getRuntimeEnv()?.WIKI_SESSION_SECRET
	if (!secret) error(503, 'Invitation service is not configured')
	const body = await readJsonBody(request)
	try {
		const result = await createInvites(collaborationDb(locals), secret,
			collaborationActor(locals), body)
		return json(result, { status: 201, headers: { 'cache-control': 'no-store' } })
	} catch (cause) { collaborationFail(cause) }
}
