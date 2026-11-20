import { error, json } from '@sveltejs/kit'
import { hasPermission } from '#lib/server/auth/permissions'
import { getInvite, listInviteRedemptions } from '#lib/server/auth/invites'
import { collaborationDb } from '#lib/server/wiki/api-helpers'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.session) error(401, 'Sign in required')
	if (!hasPermission(locals.session, 'invite:manage')) error(403, 'Forbidden')
	const db = collaborationDb(locals)
	const invite = await getInvite(db, params.id)
	if (!invite) error(404, 'Invitation code not found')
	const redemptions = await listInviteRedemptions(db, params.id)
	return json({ invite, redemptions }, { headers: { 'cache-control': 'no-store' } })
}
