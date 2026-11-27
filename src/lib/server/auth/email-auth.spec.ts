import { afterEach, describe, expect, it } from 'vitest'
import { sqliteDb, seedSection } from '#lib/server/wiki/testing/sqlite-db'
import { changePassword, changeUsername, loginWithEmail, registerWithEmail } from './email-auth'
import { readSessionCookie, verifySession } from './cookie-session'

const connections: ReturnType<typeof sqliteDb>[] = []
afterEach(() => { for (const c of connections.splice(0)) c.close() })
const secret = 'email-auth-test-secret'

function setup() {
	const c = sqliteDb()
	connections.push(c)
	seedSection(c.sql)
	return c
}

function registration(email = 'alice@qq.com', password = 'password123', username = email.slice(0, email.indexOf('@'))) {
	return { email, password, username }
}

describe('email registration', () => {
	it('rejects invalid credentials before creating an account', async () => {
		const c = setup()
		for (const input of [
			{ email: 'alice@example.com', password: 'password123', username: 'Alice' },
			{ email: 'alice@vip.qq.com', password: 'password123', username: 'Alice' },
			{ email: 'alice@qq.com', password: 'short', username: 'Alice' },
			{ email: 'alice@qq.com', password: 12345, username: 'Alice' }
		]) await expect(registerWithEmail(c.db, secret, input)).rejects.toMatchObject({ status: 400 })
		expect(c.sql.prepare("SELECT COUNT(*) AS count FROM users WHERE auth_subject='alice@qq.com'").get()).toEqual({ count: 0 })
	})

	it('creates an ordinary user with the chosen username', async () => {
		const c = setup()
		const result = await registerWithEmail(c.db, secret, registration('alice@qq.com', 'password123', 'Alice'))
		expect(result.session).toMatchObject({ username: 'Alice', role: 'user', status: 'active' })
		expect(c.sql.prepare("SELECT role, status FROM users WHERE auth_subject='alice@qq.com'").get()).toEqual({
			role: 'member', status: 'active'
		})
	})

	it('requires a unique 2-32 character username at registration', async () => {
		const c = setup()
		for (const username of [undefined, '', 'A', 'A'.repeat(33), '<bob>']) {
			await expect(registerWithEmail(c.db, secret, { ...registration(), username }))
				.rejects.toMatchObject({ status: 400, code: 'BAD_USERNAME' })
		}
		await registerWithEmail(c.db, secret, registration('alice@qq.com', 'password123', 'Alice'))
		await expect(registerWithEmail(c.db, secret, registration('bob@qq.com', 'password123', 'Alice')))
			.rejects.toMatchObject({ status: 409, code: 'USERNAME_TAKEN' })
		await expect(registerWithEmail(c.db, secret, registration('alice@qq.com', 'password123', 'Alice Two')))
			.rejects.toMatchObject({ status: 409, code: 'EMAIL_TAKEN' })
	})

	it('stores only a password hash and issues a signed session cookie', async () => {
		const c = setup()
		const result = await registerWithEmail(c.db, secret, registration())
		const row = c.sql.prepare("SELECT email, password_hash FROM users WHERE auth_subject='alice@qq.com'").get() as {
			email: string; password_hash: string
		}
		expect(row.email).toBe('alice@qq.com')
		expect(row.password_hash).toMatch(/^pbkdf2\$/)
		expect(row.password_hash).not.toContain('password123')
		const request = new Request('https://wiki.example', { headers: { cookie: result.cookie.split(';')[0] } })
		expect(await verifySession(readSessionCookie(request), secret)).toMatchObject({ sub: 'alice@qq.com' })
	})

	it('limits repeated duplicate registrations from the same address', async () => {
		const c = setup()
		await registerWithEmail(c.db, secret, registration())
		for (let index = 0; index < 10; index++)
			await expect(registerWithEmail(c.db, secret, registration(), 'flood'))
				.rejects.toMatchObject({ code: 'EMAIL_TAKEN' })
		await expect(registerWithEmail(c.db, secret, registration(), 'flood'))
			.rejects.toMatchObject({ code: 'RATE_LIMITED' })
	})

	it('still rejects wrong passwords and suspended accounts', async () => {
		const c = setup()
		await registerWithEmail(c.db, secret, registration())
		await expect(loginWithEmail(c.db, secret, { email: 'alice@qq.com', password: 'wrong-password' }))
			.rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' })
		expect((await loginWithEmail(c.db, secret, { email: 'alice@qq.com', password: 'password123' })).session.role).toBe('user')
		c.sql.exec("UPDATE users SET status='suspended' WHERE auth_subject='alice@qq.com'")
		await expect(loginWithEmail(c.db, secret, { email: 'alice@qq.com', password: 'password123' }))
			.rejects.toMatchObject({ status: 403 })
	})

	it('changes the password only when the current password matches', async () => {
		const c = setup()
		await registerWithEmail(c.db, secret, registration())
		const userId = (c.sql.prepare("SELECT id FROM users WHERE auth_subject='alice@qq.com'").get() as { id: string }).id
		await expect(changePassword(c.db, userId, { currentPassword: 'wrong-password', newPassword: 'newpassword123' }))
			.rejects.toMatchObject({ status: 401, code: 'INVALID_PASSWORD' })
		await expect(changePassword(c.db, userId, { currentPassword: 'password123', newPassword: 'short' }))
			.rejects.toMatchObject({ status: 400 })
		await changePassword(c.db, userId, { currentPassword: 'password123', newPassword: 'newpassword123' })
		await expect(loginWithEmail(c.db, secret, { email: 'alice@qq.com', password: 'password123' }))
			.rejects.toMatchObject({ status: 401 })
		const result = await loginWithEmail(c.db, secret, { email: 'alice@qq.com', password: 'newpassword123' })
		expect(result.session.username).toBe('alice')
	})

	it('changes the username and keeps existing comments in sync', async () => {
		const c = setup()
		const registered = await registerWithEmail(c.db, secret, registration('alice@qq.com', 'password123', 'Alice'))
		const userId = registered.session.userId
		c.sql.prepare(`INSERT INTO comments (id,target_type,target_id,author_name,author_user_id,author_token_hash,content)
			VALUES (?,?,?,?,?,?,?)`).run('c1', 'card', 'Bash', 'Alice', userId, 'token-hash', 'hello')
		c.sql.exec("INSERT INTO users (id,auth_subject,username) VALUES ('bob','bob@qq.com','Bob')")

		await expect(changeUsername(c.db, userId, { username: 'A' })).rejects.toMatchObject({ status: 400 })
		await expect(changeUsername(c.db, userId, { username: 'Bob' }))
			.rejects.toMatchObject({ status: 409, code: 'USERNAME_TAKEN' })
		await expect(changeUsername(c.db, userId, { username: '  Alice   Renamed  ' }))
			.resolves.toEqual({ username: 'Alice Renamed' })
		expect(c.sql.prepare('SELECT username FROM users WHERE id=?').get(userId)).toEqual({ username: 'Alice Renamed' })
		expect(c.sql.prepare("SELECT author_name FROM comments WHERE id='c1'").get()).toEqual({ author_name: 'Alice Renamed' })
		const login = await loginWithEmail(c.db, secret, { email: 'alice@qq.com', password: 'password123' })
		expect(login.session.username).toBe('Alice Renamed')
	})
})
