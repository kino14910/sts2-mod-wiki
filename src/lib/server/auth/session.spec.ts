import { describe, expect, it } from 'vitest'
import { sessionCookie, signSession } from './cookie-session'
import { resolveSession } from './session'
import type { UserRow } from './users'

const SECRET = 'session-smoke-secret'
const env = { WIKI_SESSION_SECRET: SECRET }

function fakeDb(user: UserRow | null): WikiDatabase {
	const db = {
		prepare(sql: string) {
			let params: unknown[] = []
			const statement = {
				bind(...values: unknown[]) {
					params = values
					return statement
				},
				async first() {
					if (!sql.includes('FROM users')) return null
					return user && user.auth_subject === params[0] ? user : null
				},
				async run() {
					return { results: [], success: true, meta: { changes: 1 } }
				}
			}
			return statement
		}
	}
	return db as unknown as WikiDatabase
}

const member: UserRow = {
	id: 'u-1',
	auth_subject: 'alice',
	username: 'Alice',
	email: 'alice@qq.com',
	password_hash: null,
	role: 'member',
	status: 'active'
}

function requestWith(token: string): Request {
	const cookie = sessionCookie(token).split(';')[0]
	return new Request('https://example.test/api/auth/session', { headers: { cookie } })
}

describe('default cookie auth provider', () => {
	it('resolves an active user from a signed cookie', async () => {
		const token = await signSession('alice', SECRET)
		const session = await resolveSession(requestWith(token), env, fakeDb(member))
		expect(session).toMatchObject({ userId: 'u-1', role: 'user', username: 'Alice' })
	})

	it('takes the role from the database, never from a forged cookie payload', async () => {
		const forged = await signSession('alice', SECRET)
		const tamperedPayload = Buffer.from(
			JSON.stringify({ sub: 'alice', role: 'admin', exp: Date.now() + 60_000 })
		)
			.toString('base64url')
		const token = `${tamperedPayload}.${forged.split('.')[1]}`
		const session = await resolveSession(requestWith(token), env, fakeDb(member))
		expect(session).toBeNull()
		const valid = await resolveSession(requestWith(forged), env, fakeDb(member))
		expect(valid?.role).toBe('user')
	})

	it('denies accounts without a QQ email on every session resolution', async () => {
		const token = await signSession('alice', SECRET)
		for (const email of [null, 'alice@example.com', 'alice@vip.qq.com'])
			expect(await resolveSession(requestWith(token), env, fakeDb({ ...member, email }))).toBeNull()
	})

	it('denies suspended users, missing users, bad signatures and missing secrets', async () => {
		const token = await signSession('alice', SECRET)
		expect(
			await resolveSession(requestWith(token), env, fakeDb({ ...member, status: 'suspended' }))
		).toBeNull()
		expect(await resolveSession(requestWith(token), env, fakeDb(null))).toBeNull()
		expect(
			await resolveSession(requestWith(`${token}x`), env, fakeDb(member))
		).toBeNull()
		expect(
			await resolveSession(requestWith(token), { WIKI_SESSION_SECRET: undefined }, fakeDb(member))
		).toBeNull()
		expect(await resolveSession(new Request('https://example.test'), env, fakeDb(member))).toBeNull()
	})
})
