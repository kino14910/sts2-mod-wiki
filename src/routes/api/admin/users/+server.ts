import { error, json } from '@sveltejs/kit'
import { hasPermission } from '#lib/server/auth/permissions'
import { listUsers } from '#lib/server/auth/user-directory'
import { collaborationDb } from '#lib/server/wiki/api-helpers'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.session) error(401, 'Sign in required')
	if (!hasPermission(locals.session, 'user:role:manage')) error(403, 'Forbidden')
	const users = await listUsers(collaborationDb(locals), url.searchParams.get('q') ?? '')
	return json({ users }, { headers: { 'cache-control': 'no-store' } })
}
