import { error, json } from '@sveltejs/kit'
import { collaborationDb, proposalViewer } from '#lib/server/wiki/api-helpers'
import { createWikiEditStore } from '#lib/server/wiki/collaboration-repository'
import { listProposals } from '#lib/server/wiki/review-service'
import type { ProposalStatus } from '#lib/wiki-collaboration'
import type { RequestHandler } from './$types'

const ALLOWED: readonly ProposalStatus[] = ['pending', 'approved', 'rejected', 'conflict', 'withdrawn']

export const GET: RequestHandler = async ({ url, locals }) => {
	const viewer = proposalViewer(locals)
	const sectionId = url.searchParams.get('sectionId')
	const pageId = url.searchParams.get('pageId')
	if (sectionId && sectionId.length > 191) error(400, 'Invalid section id')
	if (pageId && pageId.length > 191) error(400, 'Invalid page id')
	const requested = (url.searchParams.get('status') ?? 'pending')
		.split(',')
		.filter((value): value is ProposalStatus => (ALLOWED as readonly string[]).includes(value))
	const items = await listProposals(createWikiEditStore(collaborationDb(locals)), {
		status: requested.length ? requested : ['pending'],
		sectionId,
		pageId,
		submittedBy: viewer.reviewer ? null : viewer.actor.userId,
		limit: Number(url.searchParams.get('limit') ?? 30),
		offset: Number(url.searchParams.get('offset') ?? 0)
	})
	return json({ items })
}
