import { error } from '@sveltejs/kit'
import { hasPermission } from '#lib/server/auth/permissions'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.session) error(401, 'Sign in required')
	if (!hasPermission(locals.session, 'user:role:manage')) error(403, 'Forbidden')
	return {}
}
