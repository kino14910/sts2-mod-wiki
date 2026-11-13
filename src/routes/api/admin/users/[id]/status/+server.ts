import { json } from '@sveltejs/kit'
import { manageUser } from '#lib/server/auth/manage-users'
import { collaborationDb, collaborationFail, readJsonBody } from '#lib/server/wiki/api-helpers'
import type { RequestHandler } from './$types'

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const body = await readJsonBody(request)
	try {
		const result = await manageUser(collaborationDb(locals), locals.session, params.id, 'status', body.status)
		return json({ userId: result.userId, status: result.value })
	} catch (cause) { collaborationFail(cause) }
}
