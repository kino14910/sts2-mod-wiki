import { readSessionCookie, verifySession } from './cookie-session'
import { getWikiDb, type WikiRuntimeEnv } from '#lib/server/wiki/db'
import type { WikiDatabase } from '#lib/server/db/types'
import { findUserBySubject } from './users'
import type { Role, UserStatus } from './permissions'

export interface AuthSession {
	userId: string
	authSubject: string
	username: string
	avatarUrl: string | null
	role: Role
	status: UserStatus
}

export interface AuthProvider {
	resolve(
		request: Request,
		env: WikiRuntimeEnv | undefined,
		dbOverride?: WikiDatabase | null
	): Promise<AuthSession | null>
}

const cookieAuthProvider: AuthProvider = {
	async resolve(request, env, dbOverride) {
		const secret = env?.WIKI_SESSION_SECRET
		if (!secret) return null
		let db: WikiDatabase | null
		try { db = dbOverride === undefined ? getWikiDb() : dbOverride } catch { return null }
		if (!db) return null
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

let provider: AuthProvider | null = cookieAuthProvider

// Tests (or a future identity provider) can replace the resolver.
export function setAuthProvider(next: AuthProvider | null): void {
	provider = next
}

export function getAuthProvider(): AuthProvider | null {
	return provider
}

export async function resolveSession(
	request: Request,
	env: WikiRuntimeEnv | undefined,
	dbOverride?: WikiDatabase | null
): Promise<AuthSession | null> {
	if (!provider) return null
	const session = await provider.resolve(request, env, dbOverride)
	return session?.status === 'active' ? session : null
}
