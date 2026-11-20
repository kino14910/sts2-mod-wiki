import type { AuthSession } from './session'

export function publicSession(session: AuthSession | null) {
	if (!session) return null
	return {
		userId: session.userId,
		username: session.username,
		role: session.role,
		status: session.status
	}
}
