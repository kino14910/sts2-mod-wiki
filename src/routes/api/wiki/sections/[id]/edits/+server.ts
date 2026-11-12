import { json } from '@sveltejs/kit'
import {
	collaborationActor,
	collaborationDb,
	collaborationFail,
	readJsonBody
} from '#lib/server/wiki/api-helpers'
import { createWikiEditStore } from '#lib/server/wiki/collaboration-repository'
import { submitSectionEdit } from '#lib/server/wiki/edit-service'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const db = collaborationDb(locals)
	const body = await readJsonBody(request)
	try {
		const result = await submitSectionEdit(createWikiEditStore(db), {
			sectionId: params.id,
			content: body.content,
			baseVersion: body.baseVersion,
			summary: body.summary,
			actor: collaborationActor(locals)
		})
		return json(result, { status: result.kind === 'proposed' ? 202 : 200 })
	} catch (cause) {
		collaborationFail(cause)
	}
}
