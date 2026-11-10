import { error, json } from '@sveltejs/kit'
import { hasPermission } from '#lib/server/auth/permissions'
import { getSourceUpdates } from '#lib/server/wiki/source-service'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals }) => {
	if (!hasPermission(locals.session, 'wiki:source:view')) error(403, 'Forbidden')
	if (!locals.wikiDb) error(503, 'Wiki database unavailable')
	return json({ items: await getSourceUpdates(locals.wikiDb) })
}
