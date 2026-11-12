import { hasPermission, type Permission, type Role, type UserStatus } from '#lib/server/auth/permissions'

export interface Actor {
	userId: string
	username: string
	role: Role
	status: UserStatus
}

export type MaybeActor = Actor | null | undefined

export class WikiCollaborationError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly code: string
	) {
		super(message)
		this.name = 'WikiCollaborationError'
	}
}

/** Server-side gate. Never infer permissions from a client-supplied role string. */
export function requirePermission(actor: MaybeActor, permission: Permission): Actor {
	if (!actor) throw new WikiCollaborationError(401, 'Sign in required', 'UNAUTHENTICATED')
	if (!hasPermission(actor, permission))
		throw new WikiCollaborationError(403, `Missing permission: ${permission}`, 'FORBIDDEN')
	return actor
}
