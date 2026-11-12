import { readSessionCookie, verifySession } from './cookie-session'
import { findUserBySubject } from './users'
import type { Role, UserStatus } from './permissions'

export interface AuthSession {
	userId: string
	authSubject: string
	username: string
	role: Role
	status: UserStatus
}

export interface AuthProvider {
	resolve(request: Request, env: Env | undefined): Promise<AuthSession | null>
}

/**
 * Default provider: a signed cookie identifies the subject, while the role/status always come
 * from the server-side users table. Without WIKI_SESSION_SECRET no session is trusted at all.
 */
const d1AuthProvider: AuthProvider = {
	async resolve(request, env) {
		const secret = env?.WIKI_SESSION_SECRET
		const db = env?.DB
		if (!secret || !db) return null
		const payload = await verifySession(readSessionCookie(request), secret)
		if (!payload) return null
		try {
			return await findUserBySubject(db, payload.sub)
		} catch (error) {
			console.warn('[auth] user lookup failed', error)
			return null
		}
	}
}

let provider: AuthProvider | null = d1AuthProvider

// Tests (or a future identity provider) can replace the resolver.
export function setAuthProvider(next: AuthProvider | null): void {
	provider = next
}

export function getAuthProvider(): AuthProvider | null {
	return provider
}

export async function resolveSession(
	request: Request,
	env: Env | undefined
): Promise<AuthSession | null> {
	if (!provider) return null
	const session = await provider.resolve(request, env)
	return session?.status === 'active' ? session : null
}
