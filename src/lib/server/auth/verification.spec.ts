import { afterEach, describe, expect, it } from 'vitest'
import { sqliteDb } from '#lib/server/wiki/testing/sqlite-db'
import { issueEmailCode, verifyEmailCode } from './verification'

const connections: ReturnType<typeof sqliteDb>[] = []
afterEach(() => { for (const c of connections.splice(0)) c.close() })
const secret = 'verification-test-secret'

function setup() {
	const c = sqliteDb()
	connections.push(c)
	return c
}

describe('registration email codes', () => {
	it('stores only a digest and allows a code to be used once', async () => {
		const c = setup()
		const { email, code } = await issueEmailCode(c.db, secret, 'alice@qq.com')
		const row = c.sql.prepare('SELECT code_hash FROM auth_email_codes').get() as { code_hash: string }
		expect(row.code_hash).not.toContain(code)
		expect(row.code_hash).toMatch(/^[A-Za-z0-9_-]+$/)
		await expect(verifyEmailCode(c.db, secret, email, code)).resolves.toBeUndefined()
		await expect(verifyEmailCode(c.db, secret, email, code)).rejects.toMatchObject({ code: 'INVALID_CODE' })
		expect(c.sql.prepare('SELECT consumed_at FROM auth_email_codes').get()?.consumed_at).not.toBeNull()
	})

	it('counts failed attempts and locks the code', async () => {
		const c = setup()
		const { email, code } = await issueEmailCode(c.db, secret, 'alice@qq.com')
		const wrong = code === '000000' ? '111111' : '000000'
		for (let i = 0; i < 5; i++)
			await expect(verifyEmailCode(c.db, secret, email, wrong)).rejects.toMatchObject({ status: 400 })
		await expect(verifyEmailCode(c.db, secret, email, code)).rejects.toMatchObject({ code: 'INVALID_CODE' })
	})

	it('rejects malformed and expired codes', async () => {
		const c = setup()
		const now = Date.now() - 6 * 60 * 1000
		const { email } = await issueEmailCode(c.db, secret, 'alice@qq.com', now)
		await expect(verifyEmailCode(c.db, secret, email, '12345')).rejects.toMatchObject({ status: 400 })
		await expect(verifyEmailCode(c.db, secret, email, '123456')).rejects.toMatchObject({ status: 400 })
	})

	it('limits resend cooldown and hourly requests', async () => {
		const c = setup()
		const now = Date.now()
		const email = 'alice@qq.com'
		await expect(issueEmailCode(c.db, secret, email, now)).resolves.toMatchObject({ email })
		await expect(issueEmailCode(c.db, secret, email, now + 1_000)).rejects.toMatchObject({ code: 'CODE_COOLDOWN' })
		await expect(issueEmailCode(c.db, secret, email, now + 61_000)).resolves.toMatchObject({ email })
		await expect(issueEmailCode(c.db, secret, email, now + 121_000)).resolves.toMatchObject({ email })
		await expect(issueEmailCode(c.db, secret, email, now + 181_000)).rejects.toMatchObject({ code: 'CODE_LIMIT' })
	})
})
