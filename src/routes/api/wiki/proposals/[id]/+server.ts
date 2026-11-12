import { error, json } from '@sveltejs/kit'
import {
	collaborationActor,
	collaborationDb,
	collaborationFail,
	readJsonBody
} from '#lib/server/wiki/api-helpers'
import { createWikiEditStore } from '#lib/server/wiki/collaboration-repository'
import { getProposal, reviewProposal } from '#lib/server/wiki/review-service'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params, locals }) => {
	const proposal = await getProposal(createWikiEditStore(collaborationDb(locals)), params.id)
	if (!proposal) error(404, 'Proposal not found')
	return json(proposal)
}

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const db = collaborationDb(locals)
	const body = await readJsonBody(request)
	try {
		const proposal = await reviewProposal(createWikiEditStore(db), {
			proposalId: params.id,
			decision: body.decision,
			note: body.note,
			actor: collaborationActor(locals)
		})
		return json(proposal)
	} catch (cause) {
		collaborationFail(cause)
	}
}
