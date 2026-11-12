import type { Role, UserStatus } from './permissions'
import type { AuthSession } from './session'

const ROLES: readonly Role[] = ['member', 'trusted', 'moderator', 'admin']
const USER_COLUMNS = 'id, auth_subject, username, role, status'

export interface UserRow {
	id: string
	auth_subject: string
	username: string
	role: Role
	status: UserStatus
}

export const SUBJECT_PATTERN = /^[a-zA-Z0-9._@-]{1,64}$/

export function isRole(value: unknown): value is Role {
	return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

function toSession(row: UserRow | null): AuthSession | null {
	if (!row || row.status !== 'active' || !isRole(row.role)) return null
	return {
		userId: row.id,
		authSubject: row.auth_subject,
		username: row.username,
		role: row.role,
		status: row.status
	}
}

export async function findUserBySubject(
	db: D1Database,
	subject: string
): Promise<AuthSession | null> {
	const row = await db
		.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE auth_subject = ? LIMIT 1`)
		.bind(subject)
		.first<UserRow>()
	return toSession(row)
}

/** Local development login only. Never creates anything except an ordinary 'member' account. */
export async function ensureDevUser(
	db: D1Database,
	subject: string,
	username: string
): Promise<AuthSession | null> {
	await db
		.prepare(
			"INSERT OR IGNORE INTO users (id, auth_subject, username, role, status) VALUES (?, ?, ?, 'member', 'active')"
		)
		.bind(`user:${subject}`, subject, username)
		.run()
	return findUserBySubject(db, subject)
}

export async function setUserRole(db: D1Database, userId: string, role: Role): Promise<boolean> {
	const result = await db
		.prepare('UPDATE users SET role = ? WHERE id = ?')
		.bind(role, userId)
		.run()
	return Number(result.meta?.changes ?? 0) > 0
}
