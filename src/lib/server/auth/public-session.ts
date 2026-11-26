import type { WikiViewer } from '#lib/wiki-collaboration'
import type { AuthSession } from './session'

export function publicSession(session: AuthSession | null): WikiViewer['session'] {
	if (!session) return null
	return {
		userId: session.userId,
		username: session.username,
		avatarUrl: session.avatarUrl,
		role: session.role,
		status: session.status
	}
}
