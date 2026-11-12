import { describe, expect, it } from 'vitest'
import { sessionCookie, signSession } from './cookie-session'
import { resolveSession } from './session'
import type { UserRow } from './users'

const SECRET = 'session-smoke-secret'

function fakeEnv(user: UserRow | null) {
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
	return {
		DB: db,
		ASSETS: {},
		WIKI_SESSION_SECRET: SECRET
	} as unknown as Env
}

const member: UserRow = {
	id: 'u-1',
	auth_subject: 'alice',
	username: 'Alice',
	role: 'member',
	status: 'active'
}

function requestWith(token: string): Request {
	const cookie = sessionCookie(token).split(';')[0]
	return new Request('https://example.test/api/auth/session', { headers: { cookie } })
}

describe('default D1 auth provider', () => {
	it('resolves an active user from a signed cookie', async () => {
		const token = await signSession('alice', SECRET)
		const session = await resolveSession(requestWith(token), fakeEnv(member))
		expect(session).toMatchObject({ userId: 'u-1', role: 'member', username: 'Alice' })
	})

	it('takes the role from D1, never from a forged cookie payload', async () => {
		// Even a payload that claims admin cannot change the server-side role.
		const forged = await signSession('alice', SECRET)
		const tamperedPayload = Buffer.from(
			JSON.stringify({ sub: 'alice', role: 'admin', exp: Date.now() + 60_000 })
		)
			.toString('base64url')
		const token = `${tamperedPayload}.${forged.split('.')[1]}`
		const session = await resolveSession(requestWith(token), fakeEnv(member))
		expect(session).toBeNull()
		const valid = await resolveSession(requestWith(forged), fakeEnv(member))
		expect(valid?.role).toBe('member')
	})

	it('denies suspended users, missing users, bad signatures and missing secrets', async () => {
		const token = await signSession('alice', SECRET)
		expect(
			await resolveSession(requestWith(token), fakeEnv({ ...member, status: 'suspended' }))
		).toBeNull()
		expect(await resolveSession(requestWith(token), fakeEnv(null))).toBeNull()
		expect(
			await resolveSession(requestWith(`${token}x`), fakeEnv(member))
		).toBeNull()
		expect(
			await resolveSession(requestWith(token), { ...fakeEnv(member), WIKI_SESSION_SECRET: undefined })
		).toBeNull()
		expect(await resolveSession(new Request('https://example.test'), fakeEnv(member))).toBeNull()
	})
})
