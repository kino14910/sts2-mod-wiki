import { error, json } from '@sveltejs/kit'
import { hasPermission } from '#lib/server/auth/permissions'
import type { RequestHandler } from './$types'

/** Read-only review surface. Reattribution requires independently verified ownership evidence. */
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!hasPermission(locals.session, 'wiki:source:view')) error(403, 'Forbidden')
	const db = locals.wikiDb
	if (!db) error(503, 'Wiki database unavailable')
	const requested = Number(url.searchParams.get('limit') ?? 50)
	const limit = Number.isFinite(requested) ? Math.max(1, Math.min(100, Math.trunc(requested))) : 50
	const requestedOffset = Number(url.searchParams.get('offset') ?? 0)
	const offset = Number.isFinite(requestedOffset) ? Math.max(0, Math.trunc(requestedOffset)) : 0
	const [pages, comments, mappings] = await Promise.all([
		db.prepare(`SELECT a.*, (SELECT COUNT(*) FROM wiki_sections s WHERE s.page_id=a.page_id) AS section_count
			FROM wiki_identity_archives a ORDER BY a.created_at,a.page_id LIMIT ? OFFSET ?`).bind(limit, offset).all(),
		db.prepare(`SELECT comment_id,legacy_target_id,reason,candidates_json,created_at
			FROM wiki_comment_identity_archives ORDER BY created_at,comment_id LIMIT ? OFFSET ?`).bind(limit, offset).all(),
		db.prepare(`SELECT * FROM wiki_identity_mappings ORDER BY entity_type,legacy_id LIMIT ? OFFSET ?`).bind(limit, offset).all()
	])
	return json({ pages: pages.results, comments: comments.results, mappings: mappings.results }, { headers: { 'cache-control': 'no-store' } })
}
