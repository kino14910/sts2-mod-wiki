import { isAllowedEmail } from '#lib/email-domain'
import { toDbRole, toPublicRole, type DbRole, type Role, type UserStatus } from './permissions'
import type { AuthSession } from './session'

const ROLES: readonly DbRole[] = ['member', 'trusted', 'moderator', 'admin']
const PUBLIC_ROLES: readonly Role[] = ['user', 'trusted', 'moderator', 'admin']
const USER_COLUMNS = 'id, auth_subject, username, email, password_hash, role, status'

export interface UserRow {
	id: string
	auth_subject: string
	username: string
	email: string | null
	password_hash: string | null
	role: DbRole
	status: UserStatus
}

export const SUBJECT_PATTERN = /^[a-zA-Z0-9._@-]{1,64}$/

export function isRole(value: unknown): value is Role {
	return typeof value === 'string' && (PUBLIC_ROLES as readonly string[]).includes(value)
}

export function isDbRole(value: unknown): value is DbRole {
	return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

function toSession(row: UserRow | null): AuthSession | null {
	if (!row || row.status !== 'active' || !isDbRole(row.role) || !isAllowedEmail(row.email)) return null
	const qqNumber = /^([0-9]+)@qq\.com$/i.exec(row.email)?.[1]
	return {
		userId: row.id,
		authSubject: row.auth_subject,
		username: row.username,
		avatarUrl: qqNumber
			? `https://q.qlogo.cn/headimg_dl?dst_uin=${qqNumber}&spec=640&img_type=webp`
			: null,
		role: toPublicRole(row.role),
		status: row.status
	}
}

export async function findUserRowBySubject(db: WikiDatabase, subject: string): Promise<UserRow | null> {
	return db
		.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE auth_subject = ? LIMIT 1`)
		.bind(subject)
		.first<UserRow>()
}

export async function findUserBySubject(
	db: WikiDatabase,
	subject: string
): Promise<AuthSession | null> {
	return toSession(await findUserRowBySubject(db, subject))
}

export async function findUserRowById(db: WikiDatabase, userId: string): Promise<UserRow | null> {
	return db
		.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`)
		.bind(userId)
		.first<UserRow>()
}

export async function findUserRowByUsername(db: WikiDatabase, username: string): Promise<UserRow | null> {
	return db
		.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE username = ? LIMIT 1`)
		.bind(username)
		.first<UserRow>()
}

/** Local development login only. Resolves existing accounts; it never creates them. */
export async function ensureDevUser(db: WikiDatabase, subject: string): Promise<AuthSession | null> {
	if (!isAllowedEmail(subject)) return null
	return findUserBySubject(db, subject)
}

export async function setUserRole(db: WikiDatabase, userId: string, role: Role): Promise<boolean> {
	const result = await db
		.prepare('UPDATE users SET role = ? WHERE id = ?')
		.bind(toDbRole(role), userId)
		.run()
	return Number(result.meta?.changes ?? 0) > 0
}
