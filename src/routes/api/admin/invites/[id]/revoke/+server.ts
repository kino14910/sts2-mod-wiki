import { json } from '@sveltejs/kit'
import { revokeInvite } from '#lib/server/auth/invites'
import { collaborationActor, collaborationDb, collaborationFail } from '#lib/server/wiki/api-helpers'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ locals, params }) => {
	try {
		const invite = await revokeInvite(collaborationDb(locals), collaborationActor(locals), params.id)
		return json({ invite }, { headers: { 'cache-control': 'no-store' } })
	} catch (cause) { collaborationFail(cause) }
}
