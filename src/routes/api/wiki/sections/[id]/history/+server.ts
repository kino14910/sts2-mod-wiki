import { json } from '@sveltejs/kit'
import { collaborationDb } from '#lib/server/wiki/api-helpers'
import { createWikiEditStore } from '#lib/server/wiki/collaboration-repository'
import { getRevisionDiff, listSectionHistory } from '#lib/server/wiki/history-service'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params, url, locals }) => {
	const store = createWikiEditStore(collaborationDb(locals))
	const revisionId = url.searchParams.get('revision')
	if (revisionId) {
		const diff = await getRevisionDiff(store, params.id, revisionId)
		return json({ diff })
	}
	const items = await listSectionHistory(
		store,
		params.id,
		Number(url.searchParams.get('limit') ?? 30),
		Number(url.searchParams.get('offset') ?? 0)
	)
	return json({ items })
}
