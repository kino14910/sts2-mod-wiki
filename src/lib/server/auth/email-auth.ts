import { isAllowedEmail } from '#lib/email-domain'
import { WikiCollaborationError } from '#lib/server/wiki/access'
import { sessionCookie, signSession } from './cookie-session'
import { hashPassword, verifyPassword } from './password'
import { findUserBySubject, findUserRowById, findUserRowBySubject, findUserRowByUsername } from './users'
import { validateInvite } from './invites'
import { assertWithinLimit } from './rate-limit'
import type { AuthSession } from './session'

const LIMIT_WINDOW_MS = 10 * 60 * 1000
const REGISTER_LIMIT = 10
const INVITE_FAILURE_LIMIT = 10
const PASSWORD_CHANGE_LIMIT = 10
const MIN_USERNAME_LENGTH = 2
const MAX_USERNAME_LENGTH = 32

function normalizeUsername(value: unknown): string {
	if (typeof value !== 'string')
		throw new WikiCollaborationError(400, 'Username is required', 'BAD_USERNAME')
	const username = value.replace(/\s+/g, ' ').trim()
	if (username.length < MIN_USERNAME_LENGTH || username.length > MAX_USERNAME_LENGTH)
		throw new WikiCollaborationError(400, 'Username must be 2-32 characters', 'BAD_USERNAME')
	if (/[<>\u0000-\u001f\u007f]/.test(username))
		throw new WikiCollaborationError(400, 'Username contains invalid characters', 'BAD_USERNAME')
	return username
}

function credentials(input: unknown): { email: string; password: string } {
	if (!input || typeof input !== 'object' || Array.isArray(input))
		throw new WikiCollaborationError(400, 'Invalid JSON body', 'BAD_INPUT')
	const body = input as Record<string, unknown>
	if (!isAllowedEmail(body.email))
		throw new WikiCollaborationError(400, 'Only @qq.com email addresses can sign in', 'EMAIL_DOMAIN_NOT_ALLOWED')
	if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128)
		throw new WikiCollaborationError(400, 'Password must be 8-128 characters', 'BAD_PASSWORD')
	return { email: body.email, password: body.password }
}

async function issueSession(db: WikiDatabase, secret: string, email: string) {
	const session = await findUserBySubject(db, email)
	if (!session) throw new WikiCollaborationError(403, 'Account is not active', 'FORBIDDEN')
	return { session, cookie: sessionCookie(await signSession(email, secret)) }
}

export async function registerWithEmail(
	db: WikiDatabase, secret: string, input: unknown, ipHash = 'unknown', now = Date.now()
) {
	const { email, password } = credentials(input)
	const body = input as Record<string, unknown>
	const username = normalizeUsername(body.username)
	const inviteCode = typeof body.inviteCode === 'string' ? body.inviteCode.trim() : ''
	if (!inviteCode)
		throw new WikiCollaborationError(400, 'An invitation code is required', 'INVITE_REQUIRED')
	await assertWithinLimit(db, `register:${ipHash}`, REGISTER_LIMIT, LIMIT_WINDOW_MS, now)
	if (await findUserRowBySubject(db, email))
		throw new WikiCollaborationError(409, 'An account with this email already exists', 'EMAIL_TAKEN')
	if (await findUserRowByUsername(db, username))
		throw new WikiCollaborationError(409, 'This username is already taken', 'USERNAME_TAKEN')

	let invite
	try { invite = await validateInvite(db, secret, inviteCode, now) }
	catch (cause) {
		await assertWithinLimit(db, `invite-fail:${ipHash}`, INVITE_FAILURE_LIMIT, LIMIT_WINDOW_MS, now)
		throw cause
	}

	const passwordHash = await hashPassword(password)
	const userId = `user:${email}`
	let result: WikiResult<unknown>[]
	try {
		result = await db.batch([
			db.prepare(`UPDATE auth_invite_codes SET used_count = used_count + 1
				WHERE id = ? AND revoked_at IS NULL AND expires_at > ? AND used_count < max_uses`)
				.bind(invite.id, now),
			db.prepare(`INSERT INTO users (id, auth_subject, username, email, password_hash, role, status)
				SELECT ?, ?, ?, ?, ?, 'member', 'active' WHERE changes() = 1`)
				.bind(userId, email, username, email, passwordHash),
			db.prepare(`INSERT INTO wiki_audit_logs (id, actor_id, action, target_type, target_id, metadata_json)
				SELECT ?, ?, 'invite.redeem', 'invite', ?, ?
				WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)`)
				.bind(crypto.randomUUID(), userId, invite.id, JSON.stringify({ userId, email }), userId)
		])
	} catch (cause) {
		if (String(cause).includes('UNIQUE')) {
			if (await findUserRowByUsername(db, username))
				throw new WikiCollaborationError(409, 'This username is already taken', 'USERNAME_TAKEN')
			throw new WikiCollaborationError(409, 'An account with this email already exists', 'EMAIL_TAKEN')
		}
		throw cause
	}
	if (Number(result[1].meta?.changes ?? 0) !== 1)
		throw new WikiCollaborationError(409, 'Invitation code has been fully used', 'INVITE_EXHAUSTED')
	return issueSession(db, secret, email)
}

export async function loginWithEmail(db: WikiDatabase, secret: string, input: unknown): Promise<{
	session: AuthSession
	cookie: string
}> {
	const { email, password } = credentials(input)
	const row = await findUserRowBySubject(db, email)
	if (!row || !(await verifyPassword(password, row.password_hash)))
		throw new WikiCollaborationError(401, 'Invalid email or password', 'INVALID_CREDENTIALS')
	return issueSession(db, secret, email)
}

export async function changeUsername(
	db: WikiDatabase,
	userId: string,
	input: unknown
): Promise<{ username: string }> {
	if (!input || typeof input !== 'object' || Array.isArray(input))
		throw new WikiCollaborationError(400, 'Invalid JSON body', 'BAD_INPUT')
	const username = normalizeUsername((input as Record<string, unknown>).username)
	const row = await findUserRowById(db, userId)
	if (!row) throw new WikiCollaborationError(404, 'Account not found', 'NOT_FOUND')
	if (row.username === username) return { username }
	const existing = await findUserRowByUsername(db, username)
	if (existing && existing.id !== userId)
		throw new WikiCollaborationError(409, 'This username is already taken', 'USERNAME_TAKEN')

	let result: WikiResult<unknown>[]
	try {
		result = await db.batch([
			db.prepare('UPDATE users SET username = ? WHERE id = ?').bind(username, userId),
			// Comments keep a display-name snapshot, so existing discussions follow the rename.
			db.prepare('UPDATE comments SET author_name = ? WHERE author_user_id = ?').bind(username, userId)
		])
	} catch (cause) {
		if (String(cause).includes('UNIQUE'))
			throw new WikiCollaborationError(409, 'This username is already taken', 'USERNAME_TAKEN')
		throw cause
	}
	if (Number(result[0].meta?.changes ?? 0) !== 1)
		throw new WikiCollaborationError(404, 'Account not found', 'NOT_FOUND')
	return { username }
}

export async function changePassword(
	db: WikiDatabase,
	userId: string,
	input: unknown,
	now = Date.now()
): Promise<void> {
	if (!input || typeof input !== 'object' || Array.isArray(input))
		throw new WikiCollaborationError(400, 'Invalid JSON body', 'BAD_INPUT')
	const body = input as Record<string, unknown>
	if (typeof body.currentPassword !== 'string' || !body.currentPassword)
		throw new WikiCollaborationError(400, 'Current password is required', 'BAD_PASSWORD')
	if (typeof body.newPassword !== 'string' || body.newPassword.length < 8 || body.newPassword.length > 128)
		throw new WikiCollaborationError(400, 'Password must be 8-128 characters', 'BAD_PASSWORD')
	await assertWithinLimit(db, `password-change:${userId}`, PASSWORD_CHANGE_LIMIT, LIMIT_WINDOW_MS, now)
	const row = await findUserRowById(db, userId)
	if (!row || !(await verifyPassword(body.currentPassword, row.password_hash)))
		throw new WikiCollaborationError(401, 'Current password is incorrect', 'INVALID_PASSWORD')
	await db
		.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
		.bind(await hashPassword(body.newPassword), userId)
		.run()
}
