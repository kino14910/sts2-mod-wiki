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

let provider: AuthProvider | null = null

// No provider is registered by default: unauthenticated requests stay unauthenticated.
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
