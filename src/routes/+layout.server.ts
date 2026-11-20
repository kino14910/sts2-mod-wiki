import { rolePermissions } from '#lib/server/auth/permissions'
import type { WikiViewer } from '#lib/wiki-collaboration'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals }) => {
	const session = locals.session
	const viewer: WikiViewer = {
		session: session ? { userId: session.userId, username: session.username, role: session.role, status: session.status } : null,
		permissions: session ? [...rolePermissions(session.role)] : []
	}
	return { viewer }
}
