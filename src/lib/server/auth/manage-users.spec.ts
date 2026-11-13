import { afterEach, describe, expect, it } from 'vitest'
import { manageUser } from './manage-users'
import { resolveSession } from './session'
import { signSession } from './cookie-session'
import { sqliteDb, seedSection } from '#lib/server/wiki/testing/sqlite-db'

const connections: ReturnType<typeof sqliteDb>[] = []
afterEach(() => { for (const c of connections.splice(0)) c.close() })
const admin = { userId: 'u-admin', username: 'Admin', role: 'admin', status: 'active' } as const
const member = { userId: 'u-member', username: 'Member', role: 'member', status: 'active' } as const
function setup() { const c = sqliteDb(); connections.push(c); seedSection(c.sql); return c }
describe('administrator permissions and account status', () => {
	it('does not allow a member to promote users or suspend accounts', async () => {
		const c = setup()
		await expect(manageUser(c.db, member, 'u-member', 'role', 'admin')).rejects.toMatchObject({ status: 403 })
		await expect(manageUser(c.db, member, 'u-admin', 'status', 'suspended')).rejects.toMatchObject({ status: 403 })
	})
	it('preserves the last active administrator, including across serialized concurrent changes', async () => {
		const c = setup()
		await expect(manageUser(c.db, admin, 'u-admin', 'role', 'member')).rejects.toMatchObject({ code: 'LAST_ADMIN' })
		await expect(manageUser(c.db, admin, 'u-admin', 'status', 'suspended')).rejects.toMatchObject({ code: 'LAST_ADMIN' })
		c.sql.exec("INSERT INTO users(id,auth_subject,username,role) VALUES ('other-admin','other-admin','Other admin','admin')")
		const attempts = await Promise.allSettled([
			manageUser(c.db, admin, 'u-admin', 'role', 'member'), manageUser(c.db, admin, 'other-admin', 'status', 'suspended')
		])
		expect(attempts.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
		expect(c.sql.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND status='active'").get()?.n).toBe(1)
	})
	it('applies role and suspension changes on the next authenticated request', async () => {
		const c = setup(), secret = 'test-secret', token = await signSession('member', secret)
		const request = new Request('https://wiki.example', { headers: { cookie: `sts2_wiki_session=${token}` } })
		const env = { DB: c.db, WIKI_SESSION_SECRET: secret } as Env
		await manageUser(c.db, admin, 'u-member', 'role', 'trusted')
		expect((await resolveSession(request, env))?.role).toBe('trusted')
		await manageUser(c.db, admin, 'u-member', 'status', 'suspended')
		expect(await resolveSession(request, env)).toBeNull()
		expect(c.sql.prepare("SELECT COUNT(*) AS n FROM wiki_audit_logs WHERE target_id='u-member'").get()?.n).toBe(2)
	})
})
