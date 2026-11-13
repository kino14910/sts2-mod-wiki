import { error, json } from '@sveltejs/kit'
import {
	collaborationActor,
	collaborationDb,
	collaborationFail,
	readJsonBody,
	proposalViewer
} from '#lib/server/wiki/api-helpers'
import { createWikiEditStore } from '#lib/server/wiki/collaboration-repository'
import { getProposal, reviewProposal, withdrawProposal } from '#lib/server/wiki/review-service'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params, locals }) => {
	const viewer = proposalViewer(locals)
	const proposal = await getProposal(createWikiEditStore(collaborationDb(locals)), params.id)
	if (!proposal) error(404, 'Proposal not found')
	if (!viewer.reviewer && proposal.submittedBy !== viewer.actor.userId) error(403, 'Forbidden')
	return json(proposal)
}

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const db = collaborationDb(locals)
	const body = await readJsonBody(request)
	try {
		if (body.decision === 'withdraw')
			return json(await withdrawProposal(createWikiEditStore(db), params.id, collaborationActor(locals)))
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
