import { error, json } from '@sveltejs/kit'
import { hasPermission } from '#lib/server/auth/permissions'
import {
	collaborationActor,
	collaborationDb,
	collaborationFail,
	readJsonBody
} from '#lib/server/wiki/api-helpers'
import {
	getSourceUpdateDetail,
	resolveSourceUpdate
} from '#lib/server/wiki/source-update-service'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!hasPermission(locals.session, 'wiki:source:view')) error(403, 'Forbidden')
	const detail = await getSourceUpdateDetail(collaborationDb(locals), params.id)
	if (!detail) error(404, 'Source update not found')
	return json(detail)
}

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!hasPermission(locals.session, 'wiki:source:review')) error(403, 'Forbidden')
	const db = collaborationDb(locals)
	const body = await readJsonBody(request)
	try {
		const detail = await resolveSourceUpdate(db, {
			id: params.id,
			decision: body.decision,
			baseVersion: body.baseVersion,
			note: body.note,
			actor: collaborationActor(locals)
		})
		return json(detail)
	} catch (cause) {
		collaborationFail(cause)
	}
}
