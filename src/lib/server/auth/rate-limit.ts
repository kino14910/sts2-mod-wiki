import { WikiCollaborationError } from '#lib/server/wiki/access'
import { sha256Hex } from './crypto'

export async function clientIpHash(request: Request, secret: string): Promise<string> {
	const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
	const ip = request.headers.get('cf-connecting-ip') || forwarded || 'unknown'
	return sha256Hex(`${secret}:${ip}`)
}

export async function assertWithinLimit(
	db: WikiDatabase, key: string, limit: number, windowMs: number, now = Date.now()
): Promise<void> {
	await db.prepare(`INSERT INTO auth_rate_limits (key, attempts, window_start) VALUES (?, 1, ?)
		ON CONFLICT(key) DO UPDATE SET
			attempts = CASE WHEN auth_rate_limits.window_start <= ? THEN 1 ELSE auth_rate_limits.attempts + 1 END,
			window_start = CASE WHEN auth_rate_limits.window_start <= ? THEN excluded.window_start ELSE auth_rate_limits.window_start END`)
		.bind(key, now, now - windowMs, now - windowMs).run()
	const row = await db.prepare('SELECT attempts FROM auth_rate_limits WHERE key = ?')
		.bind(key).first<{ attempts: number }>()
	if (Number(row?.attempts ?? 0) > limit)
		throw new WikiCollaborationError(429, 'Too many attempts. Try again later.', 'RATE_LIMITED')
}
