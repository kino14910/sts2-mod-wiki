import { describe, expect, it } from 'vitest'
import {
	clearSessionCookie,
	readSessionCookie,
	SESSION_COOKIE,
	sessionCookie,
	signSession,
	verifySession
} from './cookie-session'

const SECRET = 'unit-test-secret'
const NOW = 1_800_000_000_000

function requestWithCookie(cookie: string): Request {
	return new Request('https://example.test/api/auth/session', { headers: { cookie } })
}

describe('signed wiki session cookies', () => {
	it('round-trips a subject and enforces expiry', async () => {
		const token = await signSession('alice@example.test', SECRET, NOW)
		expect(await verifySession(token, SECRET, NOW)).toMatchObject({ sub: 'alice@example.test' })
		expect(await verifySession(token, SECRET, NOW + 8 * 24 * 3600 * 1000)).toBeNull()
	})

	it('rejects tampering, a wrong secret and malformed tokens', async () => {
		const token = await signSession('alice', SECRET, NOW)
		const [payload, signature] = token.split('.')
		expect(await verifySession(`${payload}.${signature.slice(1)}x`, SECRET, NOW)).toBeNull()
		expect(await verifySession(token, 'another-secret', NOW)).toBeNull()
		for (const malformed of [null, '', 'nodot', '.sig', 'payload.']) {
			expect(await verifySession(malformed, SECRET, NOW)).toBeNull()
		}
	})

	it('never carries a role in the cookie payload', async () => {
		const token = await signSession('member-user', SECRET, NOW)
		const payload = JSON.parse(
			Buffer.from(token.split('.')[0].replaceAll('-', '+').replaceAll('_', '/'), 'base64').toString(
				'utf8'
			)
		)
		expect(Object.keys(payload).sort()).toEqual(['exp', 'sub'])
	})

	it('reads the cookie and emits safe cookie attributes', async () => {
		const token = await signSession('alice', SECRET, NOW)
		const cookie = readSessionCookie(requestWithCookie(`a=1; ${SESSION_COOKIE}=${token}; b=2`))
		expect(cookie).toBe(token)
		expect(readSessionCookie(new Request('https://example.test'))).toBeNull()
		const header = sessionCookie(token)
		expect(header).toContain('HttpOnly')
		expect(header).toContain('Secure')
		expect(header).toContain('SameSite=Lax')
		expect(clearSessionCookie()).toContain('Max-Age=0')
	})
})
