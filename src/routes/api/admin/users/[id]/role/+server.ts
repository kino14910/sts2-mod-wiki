import { error, json } from '@sveltejs/kit'
import { hasPermission } from '#lib/server/auth/permissions'
import { isRole, setUserRole } from '#lib/server/auth/users'
import { insertAuditLog } from '#lib/server/wiki/repository'
import type { RequestHandler } from './$types'

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!hasPermission(locals.session, 'user:role:manage')) error(403, 'Forbidden')
	if (!locals.wikiDb) error(503, 'Wiki database unavailable')

	const body: unknown = await request.json().catch(() => null)
	const role = (body as { role?: unknown } | null)?.role
	if (!isRole(role)) error(400, 'Invalid role')

	const changed = await setUserRole(locals.wikiDb, params.id, role)
	if (!changed) error(404, 'User not found')

	await insertAuditLog(locals.wikiDb, {
		id: crypto.randomUUID(),
		actorId: locals.session!.userId,
		action: 'user.role.change',
		targetType: 'user',
		targetId: params.id,
		metadata: { role }
	})
	return json({ userId: params.id, role })
}
