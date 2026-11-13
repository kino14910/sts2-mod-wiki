import { requirePermission, WikiCollaborationError, type MaybeActor } from '#lib/server/wiki/access'
import { isRole } from './users'
import type { Role, UserStatus } from './permissions'

export async function manageUser(db: D1Database, actorInput: MaybeActor, userId: string,
	field: 'role' | 'status', value: unknown): Promise<{ userId: string; value: Role | UserStatus }> {
	const actor = requirePermission(actorInput, field === 'role' ? 'user:role:manage' : 'user:status:manage')
	if (field === 'role' ? !isRole(value) : value !== 'active' && value !== 'suspended')
		throw new WikiCollaborationError(400, `Invalid ${field}`, 'BAD_INPUT')
	const row = await db.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first()
	if (!row) throw new WikiCollaborationError(404, 'User not found', 'NOT_FOUND')
	const auditId = crypto.randomUUID()
	const keepsAdmin = field === 'role' ? value === 'admin' : value === 'active'
	const result = await db.batch([
		db.prepare(`INSERT INTO wiki_audit_logs (id, actor_id, action, target_type, target_id, metadata_json)
			SELECT ?, ?, ?, 'user', id, json_object('field', ?, 'from', ${field}, 'to', ?) FROM users
			WHERE id = ? AND (? OR role != 'admin' OR status != 'active'
			OR (SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active') > 1)`)
			.bind(auditId, actor.userId, `user.${field}.change`, field, value, userId, keepsAdmin ? 1 : 0),
		db.prepare(`UPDATE users SET ${field} = ? WHERE id = ? AND EXISTS (SELECT 1 FROM wiki_audit_logs WHERE id = ?)`)
			.bind(value, userId, auditId)
	])
	if (Number(result[1].meta?.changes ?? 0) !== 1)
		throw new WikiCollaborationError(409, 'The last active administrator cannot be removed', 'LAST_ADMIN')
	return { userId, value: value as Role | UserStatus }
}
