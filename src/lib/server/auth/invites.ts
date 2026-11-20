import { requirePermission, WikiCollaborationError, type Actor, type MaybeActor } from '#lib/server/wiki/access'
import { constantTimeEquals, hmacBase64Url } from './crypto'

const DAY_MS = 24 * 60 * 60 * 1000
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{16,64}$/
const MAX_BATCH = 50

export type InviteStatus = 'active' | 'used' | 'expired' | 'revoked'

export interface InviteRow {
	id: string
	code_hash: string
	created_by: string
	created_at: number
	expires_at: number
	max_uses: number
	used_count: number
	revoked_at: number | null
}

export interface InviteView {
	id: string
	createdBy: string
	createdAt: number
	expiresAt: number
	maxUses: number
	usedCount: number
	revokedAt: number | null
	status: InviteStatus
}

export interface IssuedInvite {
	id: string
	code: string
	expiresAt: number
	maxUses: number
}

export interface InviteRedemption {
	userId: string
	username: string | null
	email: string | null
	createdAt: string
}

export function generateInviteCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(24))
	return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('')
}

export function hashInvite(secret: string, code: string): Promise<string> {
	return hmacBase64Url(secret, `invite:${code}`)
}

function inviteStatus(row: InviteRow, now: number): InviteStatus {
	if (row.revoked_at !== null) return 'revoked'
	if (row.used_count >= row.max_uses) return 'used'
	if (row.expires_at <= now) return 'expired'
	return 'active'
}

function toView(row: InviteRow, now: number): InviteView {
	return {
		id: row.id,
		createdBy: row.created_by,
		createdAt: row.created_at,
		expiresAt: row.expires_at,
		maxUses: row.max_uses,
		usedCount: row.used_count,
		revokedAt: row.revoked_at,
		status: inviteStatus(row, now)
	}
}

function badInput(message: string): WikiCollaborationError {
	return new WikiCollaborationError(400, message, 'BAD_INPUT')
}

export async function createInvites(
	db: WikiDatabase, secret: string, actorInput: MaybeActor, input: unknown, now = Date.now()
): Promise<{ invites: IssuedInvite[] }> {
	const actor: Actor = requirePermission(actorInput, 'invite:manage')
	if (!input || typeof input !== 'object' || Array.isArray(input)) throw badInput('Invalid JSON body')
	const body = input as Record<string, unknown>
	const integerInput = (value: unknown, fallback: number): number =>
		value === undefined ? fallback : typeof value === 'number' ? value : NaN
	const count = integerInput(body.count, 1)
	const maxUses = integerInput(body.maxUses, 1)
	const ttlDays = integerInput(body.ttlDays, 7)
	if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH) throw badInput(`Count must be 1-${MAX_BATCH}`)
	if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100) throw badInput('maxUses must be 1-100')
	if (!Number.isInteger(ttlDays) || ttlDays < 1 || ttlDays > 365) throw badInput('ttlDays must be 1-365')
	const expiresAt = typeof body.expiresAt === 'number' && Number.isFinite(body.expiresAt)
		? body.expiresAt : now + ttlDays * DAY_MS
	if (!Number.isInteger(expiresAt) || expiresAt <= now || expiresAt > now + 366 * DAY_MS)
		throw badInput('Invalid expiration time')

	const invites: IssuedInvite[] = []
	const statements: WikiStatement[] = []
	for (let index = 0; index < count; index++) {
		const code = generateInviteCode()
		const id = crypto.randomUUID()
		statements.push(
			db.prepare(`INSERT INTO auth_invite_codes
				(id, code_hash, created_by, created_at, expires_at, max_uses, used_count, revoked_at)
				VALUES (?, ?, ?, ?, ?, ?, 0, NULL)`)
				.bind(id, await hashInvite(secret, code), actor.userId, now, expiresAt, maxUses),
			db.prepare(`INSERT INTO wiki_audit_logs (id, actor_id, action, target_type, target_id, metadata_json)
				VALUES (?, ?, 'invite.create', 'invite', ?, ?)`)
				.bind(crypto.randomUUID(), actor.userId, id,
					JSON.stringify({ maxUses, expiresAt }))
		)
		invites.push({ id, code, expiresAt, maxUses })
	}
	await db.batch(statements)
	return { invites }
}

export async function validateInvite(
	db: WikiDatabase, secret: string, code: unknown, now = Date.now()
): Promise<InviteRow> {
	if (typeof code !== 'string' || !CODE_PATTERN.test(code))
		throw new WikiCollaborationError(400, 'Invalid invitation code', 'INVALID_INVITE')
	const hash = await hashInvite(secret, code)
	const row = await db.prepare(`SELECT id, code_hash, created_by, created_at, expires_at,
		max_uses, used_count, revoked_at FROM auth_invite_codes WHERE code_hash = ?`)
		.bind(hash).first<InviteRow>()
	if (!row || !constantTimeEquals(row.code_hash, hash))
		throw new WikiCollaborationError(400, 'Invalid invitation code', 'INVALID_INVITE')
	if (row.revoked_at !== null)
		throw new WikiCollaborationError(400, 'Invitation code has been revoked', 'INVITE_REVOKED')
	if (row.expires_at <= now)
		throw new WikiCollaborationError(400, 'Invitation code has expired', 'INVITE_EXPIRED')
	if (row.used_count >= row.max_uses)
		throw new WikiCollaborationError(400, 'Invitation code has been fully used', 'INVITE_EXHAUSTED')
	return row
}

export async function listInvites(db: WikiDatabase, now = Date.now()): Promise<InviteView[]> {
	const result = await db.prepare(`SELECT id, code_hash, created_by, created_at, expires_at,
		max_uses, used_count, revoked_at FROM auth_invite_codes ORDER BY created_at DESC LIMIT 200`).all()
	return (result.results as unknown as InviteRow[]).map((row) => toView(row, now))
}

export async function getInvite(db: WikiDatabase, id: string): Promise<InviteView | null> {
	const row = await db.prepare(`SELECT id, code_hash, created_by, created_at, expires_at,
		max_uses, used_count, revoked_at FROM auth_invite_codes WHERE id = ?`).bind(id).first<InviteRow>()
	return row ? toView(row, Date.now()) : null
}

export async function listInviteRedemptions(db: WikiDatabase, id: string): Promise<InviteRedemption[]> {
	const result = await db.prepare(`SELECT json_extract(l.metadata_json, '$.userId') AS userId,
		u.username AS username, json_extract(l.metadata_json, '$.email') AS email,
		l.created_at AS createdAt
		FROM wiki_audit_logs l LEFT JOIN users u ON u.id = json_extract(l.metadata_json, '$.userId')
		WHERE l.action = 'invite.redeem' AND l.target_type = 'invite' AND l.target_id = ?
		ORDER BY l.created_at DESC LIMIT 200`).bind(id).all()
	return result.results as unknown as InviteRedemption[]
}

export async function revokeInvite(
	db: WikiDatabase, actorInput: MaybeActor, id: string, now = Date.now()
): Promise<InviteView> {
	const actor: Actor = requirePermission(actorInput, 'invite:manage')
	const row = await db.prepare(`SELECT id, code_hash, created_by, created_at, expires_at,
		max_uses, used_count, revoked_at FROM auth_invite_codes WHERE id = ?`).bind(id).first<InviteRow>()
	if (!row) throw new WikiCollaborationError(404, 'Invitation code not found', 'NOT_FOUND')
	if (row.revoked_at !== null)
		throw new WikiCollaborationError(409, 'Invitation code is already revoked', 'INVITE_REVOKED')
	if (row.used_count >= row.max_uses || row.expires_at <= now)
		throw new WikiCollaborationError(409, 'Invitation code is no longer active', 'INVITE_INACTIVE')
	const auditId = crypto.randomUUID()
	const result = await db.batch([
		db.prepare(`INSERT INTO wiki_audit_logs (id, actor_id, action, target_type, target_id, metadata_json)
			SELECT ?, ?, 'invite.revoke', 'invite', id, json_object('at', ?)
			FROM auth_invite_codes WHERE id = ? AND revoked_at IS NULL AND expires_at > ? AND used_count < max_uses`)
			.bind(auditId, actor.userId, now, id, now),
		db.prepare(`UPDATE auth_invite_codes SET revoked_at = ? WHERE id = ?
			AND EXISTS (SELECT 1 FROM wiki_audit_logs WHERE id = ?)`)
			.bind(now, id, auditId)
	])
	if (Number(result[1].meta?.changes ?? 0) !== 1)
		throw new WikiCollaborationError(409, 'Invitation code is no longer active', 'INVITE_INACTIVE')
	return toView({ ...row, revoked_at: now }, now)
}
