import { requirePermission, WikiCollaborationError, type MaybeActor } from '#lib/server/wiki/access'
import { toDbRole, type DbRole, type Role, type UserStatus } from './permissions'

export async function manageUser(db: WikiDatabase, actorInput: MaybeActor, userId: string,
	field: 'role' | 'status', value: unknown): Promise<{ userId: string; value: Role | UserStatus }> {
	const actor = requirePermission(actorInput, field === 'role' ? 'user:role:manage' : 'user:status:manage')
	if (field === 'role') {
		if (value !== 'user' && value !== 'trusted')
			throw new WikiCollaborationError(400, 'Only user and trusted roles can be assigned', 'BAD_INPUT')
	} else if (value !== 'active' && value !== 'suspended') {
		throw new WikiCollaborationError(400, `Invalid ${field}`, 'BAD_INPUT')
	}
	const row = await db.prepare('SELECT id, role FROM users WHERE id = ?')
		.bind(userId).first<{ id: string; role: DbRole }>()
	if (!row) throw new WikiCollaborationError(404, 'User not found', 'NOT_FOUND')
	if (field === 'role' && row.role === 'admin')
		throw new WikiCollaborationError(409, 'Administrator roles cannot be changed here', 'ADMIN_IMMUTABLE')

	const auditId = crypto.randomUUID()
	const keepsAdmin = field === 'role' || value === 'active'
	const fromExpr = field === 'role' ? "CASE role WHEN 'member' THEN 'user' ELSE role END" : field
	const storedValue = field === 'role' ? toDbRole(value as Role) : value
	const result = await db.batch([
		db.prepare(`INSERT INTO wiki_audit_logs (id, actor_id, action, target_type, target_id, metadata_json)
			SELECT ?, ?, ?, 'user', id, json_object('field', ?, 'from', ${fromExpr}, 'to', ?) FROM users
			WHERE id = ? AND (? OR role != 'admin' OR status != 'active'
			OR (SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active') > 1)`)
			.bind(auditId, actor.userId, `user.${field}.change`, field, value, userId, keepsAdmin ? 1 : 0),
		db.prepare(`UPDATE users SET ${field} = ? WHERE id = ? AND EXISTS (SELECT 1 FROM wiki_audit_logs WHERE id = ?)`)
			.bind(storedValue, userId, auditId)
	])
	if (Number(result[1].meta?.changes ?? 0) !== 1)
		throw new WikiCollaborationError(409, 'The last active administrator cannot be removed', 'LAST_ADMIN')
	return { userId, value: value as Role | UserStatus }
}
