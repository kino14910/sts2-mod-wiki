import { json } from '@sveltejs/kit'
import { collaborationDb, proposalViewer } from '#lib/server/wiki/api-helpers'
import { createWikiEditStore } from '#lib/server/wiki/collaboration-repository'
import { listProposals } from '#lib/server/wiki/review-service'
import type { ProposalStatus } from '#lib/wiki-collaboration'
import type { RequestHandler } from './$types'

const ALLOWED: readonly ProposalStatus[] = ['pending', 'approved', 'rejected', 'conflict', 'withdrawn']

export const GET: RequestHandler = async ({ params, url, locals }) => {
	const viewer = proposalViewer(locals)
	const requested = (url.searchParams.get('status') ?? 'pending')
		.split(',')
		.filter((value): value is ProposalStatus => (ALLOWED as readonly string[]).includes(value))
	const items = await listProposals(createWikiEditStore(collaborationDb(locals)), {
		sectionId: params.id,
		submittedBy: viewer.reviewer ? null : viewer.actor.userId,
		status: requested.length ? requested : ['pending'],
		limit: Number(url.searchParams.get('limit') ?? 20)
	})
	return json({ items })
}
