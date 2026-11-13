import { json } from '@sveltejs/kit'
import { collaborationDb, collaborationFail, readJsonBody } from '#lib/server/wiki/api-helpers'
import { addWikiSection } from '#lib/server/wiki/section-management'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request, params, locals }) => {
	const input = await readJsonBody(request)
	try {
		return json(await addWikiSection(collaborationDb(locals), locals.session,
			{ pageId: params.id, key: input.key, sortOrder: input.sortOrder }), { status: 201 })
	} catch (cause) { collaborationFail(cause) }
}
