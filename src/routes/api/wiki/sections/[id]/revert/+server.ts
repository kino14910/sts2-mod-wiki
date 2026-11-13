import { json } from '@sveltejs/kit'
import {
	collaborationActor,
	collaborationDb,
	collaborationFail,
	readJsonBody
} from '#lib/server/wiki/api-helpers'
import { createWikiEditStore } from '#lib/server/wiki/collaboration-repository'
import { revertToRevision } from '#lib/server/wiki/history-service'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const db = collaborationDb(locals)
	const body = await readJsonBody(request)
	try {
		const result = await revertToRevision(createWikiEditStore(db), {
			sectionId: params.id,
			revisionId: String(body.revisionId ?? ''),
			baseVersion: body.baseVersion,
			summary: body.summary,
			actor: collaborationActor(locals)
		})
		return json(result)
	} catch (cause) {
		collaborationFail(cause)
	}
}
