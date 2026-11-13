import { rolePermissions } from '#lib/server/auth/permissions'
import { getPlatformEnv } from '#lib/server/wiki/db'
import type { WikiViewer } from '#lib/wiki-collaboration'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals, platform }) => {
	const session = locals.session
	const viewer: WikiViewer = {
		session: session ? { userId: session.userId, username: session.username, role: session.role, status: session.status } : null,
		permissions: session ? [...rolePermissions(session.role)] : []
	}
	const env = getPlatformEnv(platform)
	return { viewer, auth: { provider: env?.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.WIKI_PUBLIC_ORIGIN ? 'github' : null,
		loginUrl: '/api/auth/login' } }
}
