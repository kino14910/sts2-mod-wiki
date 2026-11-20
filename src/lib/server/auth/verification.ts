import { WikiCollaborationError } from '#lib/server/wiki/access'
import { constantTimeEquals, hmacBase64Url } from './crypto'

const CODE_TTL_MS = 5 * 60 * 1000
const SEND_COOLDOWN_MS = 60 * 1000
const MAX_SENDS_PER_HOUR = 3
const MAX_ATTEMPTS = 5

function digest(secret: string, email: string, code: string): Promise<string> {
	return hmacBase64Url(secret, `${email}:${code}`)
}

function generateCode(): string {
	let code = ''
	for (let i = 0; i < 6; i++) code += String(crypto.getRandomValues(new Uint8Array(1))[0] % 10)
	return code
}

export async function issueEmailCode(
	db: WikiDatabase, secret: string, email: string, now = Date.now()
): Promise<{ email: string; code: string }> {
	const recent = await db.prepare(
		'SELECT COUNT(*) AS n FROM auth_email_codes WHERE email = ? AND created_at > ?'
	).bind(email, now - SEND_COOLDOWN_MS).first<{ n: number }>()
	if (Number(recent?.n ?? 0) > 0)
		throw new WikiCollaborationError(429, 'Please wait before requesting another code', 'CODE_COOLDOWN')
	const hourly = await db.prepare(
		'SELECT COUNT(*) AS n FROM auth_email_codes WHERE email = ? AND created_at > ?'
	).bind(email, now - 60 * 60 * 1000).first<{ n: number }>()
	if (Number(hourly?.n ?? 0) >= MAX_SENDS_PER_HOUR)
		throw new WikiCollaborationError(429, 'Too many code requests. Try again later.', 'CODE_LIMIT')

	const code = generateCode()
	await db.prepare(`INSERT INTO auth_email_codes
		(id, email, code_hash, expires_at, attempts, consumed_at, created_at)
		VALUES (?, ?, ?, ?, 0, NULL, ?)`)
		.bind(crypto.randomUUID(), email, await digest(secret, email, code), now + CODE_TTL_MS, now).run()
	return { email, code }
}

export async function verifyEmailCode(
	db: WikiDatabase, secret: string, email: string, code: unknown
): Promise<void> {
	if (typeof code !== 'string' || !/^\d{6}$/.test(code))
		throw new WikiCollaborationError(400, 'Invalid verification code', 'INVALID_CODE')
	const row = await db.prepare(`SELECT id, code_hash, attempts FROM auth_email_codes
		WHERE email = ? AND consumed_at IS NULL AND expires_at > ?
		ORDER BY created_at DESC LIMIT 1`)
		.bind(email, Date.now()).first<{ id: string; code_hash: string; attempts: number }>()
	if (!row || Number(row.attempts) >= MAX_ATTEMPTS)
		throw new WikiCollaborationError(400, 'Verification code expired or unavailable', 'INVALID_CODE')
	if (!constantTimeEquals(row.code_hash, await digest(secret, email, code))) {
		await db.prepare('UPDATE auth_email_codes SET attempts = attempts + 1 WHERE id = ?').bind(row.id).run()
		throw new WikiCollaborationError(400, 'Invalid verification code', 'INVALID_CODE')
	}
	const result = await db.prepare(
		'UPDATE auth_email_codes SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL AND attempts < ?'
	).bind(Date.now(), row.id, MAX_ATTEMPTS).run()
	if (Number(result.meta?.changes ?? 0) !== 1)
		throw new WikiCollaborationError(400, 'Invalid verification code', 'INVALID_CODE')
}
