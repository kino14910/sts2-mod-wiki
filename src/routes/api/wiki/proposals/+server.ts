import { error, json } from '@sveltejs/kit'
import { hasPermission } from '#lib/server/auth/permissions'
import { collaborationDb } from '#lib/server/wiki/api-helpers'
import { createWikiEditStore } from '#lib/server/wiki/collaboration-repository'
import { listProposals } from '#lib/server/wiki/review-service'
import type { ProposalStatus } from '#lib/wiki-collaboration'
import type { RequestHandler } from './$types'

const ALLOWED: readonly ProposalStatus[] = ['pending', 'approved', 'rejected', 'conflict', 'withdrawn']

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!hasPermission(locals.session, 'wiki:proposal:review')) error(403, 'Forbidden')
	const requested = (url.searchParams.get('status') ?? 'pending')
		.split(',')
		.filter((value): value is ProposalStatus => (ALLOWED as readonly string[]).includes(value))
	const items = await listProposals(createWikiEditStore(collaborationDb(locals)), {
		status: requested.length ? requested : ['pending'],
		limit: Number(url.searchParams.get('limit') ?? 30),
		offset: Number(url.searchParams.get('offset') ?? 0)
	})
	return json({ items })
}
