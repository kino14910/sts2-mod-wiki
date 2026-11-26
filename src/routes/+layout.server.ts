import { rolePermissions } from '#lib/server/auth/permissions'
import { publicSession } from '#lib/server/auth/public-session'
import type { WikiViewer } from '#lib/wiki-collaboration'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals }) => {
	const session = locals.session
	const viewer: WikiViewer = {
		session: publicSession(session),
		permissions: session ? [...rolePermissions(session.role)] : []
	}
	return { viewer }
}
