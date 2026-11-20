import { toPublicRole, type DbRole, type Role, type UserStatus } from './permissions'

export interface DirectoryUser {
	id: string
	username: string
	email: string | null
	role: Role
	status: UserStatus
	createdAt: string
}

export async function listUsers(db: WikiDatabase, query = ''): Promise<DirectoryUser[]> {
	const term = query.trim().toLowerCase().slice(0, 100)
	const pattern = `%${term}%`
	const result = await db.prepare(`SELECT id, username, email, role, status, created_at AS createdAt
		FROM users WHERE ? = '' OR lower(username) LIKE ? OR lower(COALESCE(email, '')) LIKE ?
		ORDER BY created_at DESC LIMIT 200`).bind(term, pattern, pattern).all()
	return (result.results as Array<Omit<DirectoryUser, 'role'> & { role: DbRole }>).map((row) => ({
		...row,
		role: toPublicRole(row.role)
	}))
}
