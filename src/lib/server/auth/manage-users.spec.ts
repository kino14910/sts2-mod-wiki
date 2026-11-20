import { afterEach, describe, expect, it } from 'vitest'
import { manageUser } from './manage-users'
import { resolveSession } from './session'
import { signSession } from './cookie-session'
import { sqliteDb, seedSection } from '#lib/server/wiki/testing/sqlite-db'

const connections: ReturnType<typeof sqliteDb>[] = []
afterEach(() => { for (const c of connections.splice(0)) c.close() })
const admin = { userId: 'u-admin', username: 'Admin', role: 'admin', status: 'active' } as const
const user = { userId: 'u-member', username: 'Member', role: 'user', status: 'active' } as const
function setup() { const c = sqliteDb(); connections.push(c); seedSection(c.sql); return c }

describe('administrator permissions and role changes', () => {
	it('does not allow a non-admin to change roles or account status', async () => {
		const c = setup()
		await expect(manageUser(c.db, user, 'u-member', 'role', 'trusted')).rejects.toMatchObject({ status: 403 })
		await expect(manageUser(c.db, user, 'u-admin', 'status', 'suspended')).rejects.toMatchObject({ status: 403 })
	})

	it('only allows user/trusted assignments and never admin roles', async () => {
		const c = setup()
		await expect(manageUser(c.db, admin, 'u-member', 'role', 'admin')).rejects.toMatchObject({ code: 'BAD_INPUT' })
		await expect(manageUser(c.db, admin, 'u-admin', 'role', 'user')).rejects.toMatchObject({ code: 'ADMIN_IMMUTABLE' })
		await manageUser(c.db, admin, 'u-member', 'role', 'trusted')
		await manageUser(c.db, admin, 'u-member', 'role', 'user')
		expect(c.sql.prepare("SELECT role FROM users WHERE id='u-member'").get()).toEqual({ role: 'member' })
		const log = c.sql.prepare("SELECT json_extract(metadata_json, '$.from') AS fromRole, json_extract(metadata_json, '$.to') AS toRole FROM wiki_audit_logs WHERE target_id='u-member' ORDER BY created_at").all() as Array<{ fromRole: string; toRole: string }>
		expect(log).toEqual([{ fromRole: 'user', toRole: 'trusted' }, { fromRole: 'trusted', toRole: 'user' }])
	})

	it('preserves the last active administrator, including across serialized concurrent changes', async () => {
		const c = setup()
		await expect(manageUser(c.db, admin, 'u-admin', 'status', 'suspended')).rejects.toMatchObject({ code: 'LAST_ADMIN' })
		c.sql.exec("INSERT INTO users(id,auth_subject,username,email,role) VALUES ('other-admin','other-admin','Other admin','other-admin@qq.com','admin')")
		const attempts = await Promise.allSettled([
			manageUser(c.db, admin, 'u-admin', 'status', 'suspended'),
			manageUser(c.db, admin, 'other-admin', 'status', 'suspended')
		])
		expect(attempts.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
		expect(c.sql.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND status='active'").get()?.n).toBe(1)
	})

	it('applies role and suspension changes on the next authenticated request', async () => {
		const c = setup(), secret = 'test-secret', token = await signSession('member', secret)
		const request = new Request('https://wiki.example', { headers: { cookie: `sts2_wiki_session=${token}` } })
		const env = { WIKI_SESSION_SECRET: secret }
		expect((await resolveSession(request, env, c.db))?.role).toBe('user')
		await manageUser(c.db, admin, 'u-member', 'role', 'trusted')
		expect((await resolveSession(request, env, c.db))?.role).toBe('trusted')
		await manageUser(c.db, admin, 'u-member', 'status', 'suspended')
		expect(await resolveSession(request, env, c.db)).toBeNull()
		expect(c.sql.prepare("SELECT COUNT(*) AS n FROM wiki_audit_logs WHERE target_id='u-member'").get()?.n).toBe(2)
	})
})
