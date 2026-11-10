export type Role = 'member' | 'trusted' | 'moderator' | 'admin'
export type UserStatus = 'active' | 'suspended'

export type Permission =
	| 'wiki:proposal:create'
	| 'wiki:revision:publish'
	| 'wiki:proposal:review'
	| 'wiki:revision:revert'
	| 'wiki:section:manage'
	| 'wiki:source:view'
	| 'wiki:source:review'
	| 'wiki:source:sync'
	| 'comment:create'
	| 'comment:moderate'
	| 'user:role:manage'
	| 'user:status:manage'

const MEMBER: readonly Permission[] = ['wiki:proposal:create', 'comment:create']
const TRUSTED: readonly Permission[] = [...MEMBER, 'wiki:revision:publish']
const MODERATOR: readonly Permission[] = [
	...TRUSTED,
	'wiki:proposal:review',
	'wiki:revision:revert',
	'comment:moderate',
	'wiki:source:view'
]
const ADMIN: readonly Permission[] = [
	...MODERATOR,
	'wiki:section:manage',
	'wiki:source:review',
	'wiki:source:sync',
	'user:role:manage',
	'user:status:manage'
]

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
	member: MEMBER,
	trusted: TRUSTED,
	moderator: MODERATOR,
	admin: ADMIN
}

export function rolePermissions(role: Role): readonly Permission[] {
	return ROLE_PERMISSIONS[role] ?? []
}

export function can(role: Role, permission: Permission): boolean {
	return rolePermissions(role).includes(permission)
}

export function hasPermission(
	session: { role: Role; status: UserStatus } | null | undefined,
	permission: Permission
): boolean {
	return session?.status === 'active' && can(session.role, permission)
}
