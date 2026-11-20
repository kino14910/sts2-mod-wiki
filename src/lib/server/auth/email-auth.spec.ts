import { afterEach, describe, expect, it } from 'vitest'
import { sqliteDb, seedSection } from '#lib/server/wiki/testing/sqlite-db'
import { loginWithEmail, registerWithEmail } from './email-auth'
import { createInvites, revokeInvite } from './invites'
import { readSessionCookie, verifySession } from './cookie-session'

const connections: ReturnType<typeof sqliteDb>[] = []
afterEach(() => { for (const c of connections.splice(0)) c.close() })
const secret = 'email-auth-test-secret'
const admin = { userId: 'u-admin', username: 'Admin', role: 'admin', status: 'active' } as const

type DB = ReturnType<typeof sqliteDb>['db']

function setup() {
	const c = sqliteDb()
	connections.push(c)
	seedSection(c.sql)
	return c
}

async function newInvite(db: DB, input: Record<string, unknown> = {}, now = Date.now()) {
	const { invites } = await createInvites(db, secret, admin, input, now)
	return invites[0]
}

function registration(inviteCode: string, email = 'alice@qq.com', password = 'password123', username?: string) {
	return { email, password, username, inviteCode }
}

describe('invite-only registration', () => {
	it('rejects invalid credentials before consuming an invitation', async () => {
		const c = setup()
		for (const input of [
			{ email: 'alice@example.com', password: 'password123', inviteCode: 'X' },
			{ email: 'alice@vip.qq.com', password: 'password123', inviteCode: 'X' },
			{ email: 'alice@qq.com', password: 'short', inviteCode: 'X' },
			{ email: 'alice@qq.com', password: 12345, inviteCode: 'X' }
		]) await expect(registerWithEmail(c.db, secret, input)).rejects.toMatchObject({ status: 400 })
		expect(c.sql.prepare("SELECT COUNT(*) AS count FROM users WHERE auth_subject='alice@qq.com'").get()).toEqual({ count: 0 })
	})

	it('requires a valid invitation code and defaults to the user role', async () => {
		const c = setup()
		const invite = await newInvite(c.db)
		await expect(registerWithEmail(c.db, secret, { email: 'alice@qq.com', password: 'password123' }))
			.rejects.toMatchObject({ code: 'INVITE_REQUIRED' })
		await expect(registerWithEmail(c.db, secret, registration('INVALIDINVALIDINVALID')))
			.rejects.toMatchObject({ code: 'INVALID_INVITE' })
		const result = await registerWithEmail(c.db, secret, registration(invite.code, 'alice@qq.com', 'password123', 'Alice'))
		expect(result.session).toMatchObject({ username: 'Alice', role: 'user', status: 'active' })
		expect(c.sql.prepare('SELECT used_count FROM auth_invite_codes').get()).toEqual({ used_count: 1 })
		const redemption = c.sql.prepare("SELECT target_id, json_extract(metadata_json, '$.email') AS email FROM wiki_audit_logs WHERE action = 'invite.redeem'").get() as {
			target_id: string; email: string
		}
		expect(redemption.target_id).toBe(invite.id)
		expect(redemption.email).toBe('alice@qq.com')
	})

	it('stores only a password hash and issues a signed session cookie', async () => {
		const c = setup()
		const invite = await newInvite(c.db)
		const result = await registerWithEmail(c.db, secret, registration(invite.code))
		const row = c.sql.prepare("SELECT email, password_hash FROM users WHERE auth_subject='alice@qq.com'").get() as {
			email: string; password_hash: string
		}
		expect(row.email).toBe('alice@qq.com')
		expect(row.password_hash).toMatch(/^pbkdf2\$/)
		expect(row.password_hash).not.toContain('password123')
		const request = new Request('https://wiki.example', { headers: { cookie: result.cookie.split(';')[0] } })
		expect(await verifySession(readSessionCookie(request), secret)).toMatchObject({ sub: 'alice@qq.com' })
	})

	it('refuses expired, revoked, exhausted and reused codes', async () => {
		const c = setup()
		const now = Date.now()
		const expired = await newInvite(c.db, { expiresAt: now + 1000 }, now)
		await expect(registerWithEmail(c.db, secret, registration(expired.code), 'unknown', now + 2000))
			.rejects.toMatchObject({ code: 'INVITE_EXPIRED' })

		const revoked = await newInvite(c.db)
		await revokeInvite(c.db, admin, revoked.id)
		await expect(registerWithEmail(c.db, secret, registration(revoked.code)))
			.rejects.toMatchObject({ code: 'INVITE_REVOKED' })

		const single = await newInvite(c.db)
		await registerWithEmail(c.db, secret, registration(single.code))
		await expect(registerWithEmail(c.db, secret, registration(single.code, 'bob@qq.com')))
			.rejects.toMatchObject({ code: 'INVITE_EXHAUSTED' })
	})

	it('never lets concurrent registrations exceed the usage limit', async () => {
		const c = setup()
		const invite = await newInvite(c.db, { maxUses: 3 })
		const attempts = await Promise.allSettled(
			Array.from({ length: 6 }, (_, index) =>
				registerWithEmail(c.db, secret, registration(invite.code, `user${index}@qq.com`), `ip-${index}`))
		)
		expect(attempts.filter((r) => r.status === 'fulfilled')).toHaveLength(3)
		expect(c.sql.prepare('SELECT used_count FROM auth_invite_codes').get()).toEqual({ used_count: 3 })
		expect((c.sql.prepare("SELECT COUNT(*) AS n FROM users WHERE email LIKE 'user%@qq.com'").get() as { n: number }).n).toBe(3)
	})

	it('limits repeated failed codes and duplicate registrations', async () => {
		const c = setup()
		const invite = await newInvite(c.db)
		await registerWithEmail(c.db, secret, registration(invite.code))
		await expect(registerWithEmail(c.db, secret, {
			email: 'alice@qq.com', password: 'password123', inviteCode: 'ANOTHERINVALIDCODE'
		})).rejects.toMatchObject({ code: 'EMAIL_TAKEN' })
		expect(c.sql.prepare('SELECT used_count FROM auth_invite_codes').get()).toEqual({ used_count: 1 })
		await expect(loginWithEmail(c.db, secret, { email: 'alice@qq.com', password: 'wrong-password' }))
			.rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' })
		expect((await loginWithEmail(c.db, secret, { email: 'alice@qq.com', password: 'password123' })).session.role).toBe('user')

		for (let index = 0; index < 10; index++)
			await expect(registerWithEmail(c.db, secret, registration('ANOTHERINVALIDCODE', `x${index}@qq.com`), 'flood'))
				.rejects.toMatchObject({ code: 'INVALID_INVITE' })
		await expect(registerWithEmail(c.db, secret, registration('ANOTHERINVALIDCODE', 'flood@qq.com'), 'flood'))
			.rejects.toMatchObject({ code: 'RATE_LIMITED' })
	})

	it('refuses suspended accounts', async () => {
		const c = setup()
		const invite = await newInvite(c.db)
		await registerWithEmail(c.db, secret, registration(invite.code))
		c.sql.exec("UPDATE users SET status='suspended' WHERE auth_subject='alice@qq.com'")
		await expect(loginWithEmail(c.db, secret, { email: 'alice@qq.com', password: 'password123' }))
			.rejects.toMatchObject({ status: 403 })
	})
})
