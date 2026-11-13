import { requirePermission, WikiCollaborationError, type MaybeActor } from './access'

export async function moderateComment(db: D1Database, actorInput: MaybeActor, id: string, input: {
	status: unknown; reason?: unknown
}) {
	const actor = requirePermission(actorInput, 'comment:moderate')
	if (input.status !== 'deleted' && input.status !== 'visible')
		throw new WikiCollaborationError(400, 'status must be visible or deleted', 'BAD_INPUT')
	if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 500)
		throw new WikiCollaborationError(400, 'A moderation reason of at most 500 characters is required', 'BAD_INPUT')
	const auditId = crypto.randomUUID()
	const result = await db.batch([
		db.prepare(`INSERT INTO wiki_audit_logs (id, actor_id, action, target_type, target_id, metadata_json)
			SELECT ?, ?, 'comment.moderate', 'comment', id, json_object('from', status, 'to', ?, 'reason', ?)
			FROM comments WHERE id = ?`)
			.bind(auditId, actor.userId, input.status, input.reason.trim(), id),
		db.prepare(`UPDATE comments SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
			WHERE id = ? AND EXISTS (SELECT 1 FROM wiki_audit_logs WHERE id = ?)`)
			.bind(input.status, id, auditId)
	])
	if (!Number(result[1].meta?.changes ?? 0))
		throw new WikiCollaborationError(404, 'Comment not found', 'NOT_FOUND')
	return { id, status: input.status }
}
