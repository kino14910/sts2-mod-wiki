import { json } from '@sveltejs/kit'
import { collaborationDb, collaborationFail, readJsonBody } from '#lib/server/wiki/api-helpers'
import { moderateComment } from '#lib/server/wiki/comment-moderation'
import type { RequestHandler } from './$types'

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const input = await readJsonBody(request)
	try {
		return json(await moderateComment(collaborationDb(locals), locals.session, params.id, { status: input.status, reason: input.reason }))
	} catch (cause) { collaborationFail(cause) }
}
