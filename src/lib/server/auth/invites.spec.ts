import { afterEach, describe, expect, it } from 'vitest'
import { sqliteDb, seedSection } from '#lib/server/wiki/testing/sqlite-db'
import { createInvites, getInvite, hashInvite, listInviteRedemptions, listInvites, revokeInvite, validateInvite } from './invites'

const connections: ReturnType<typeof sqliteDb>[] = []
afterEach(() => { for (const c of connections.splice(0)) c.close() })
const secret = 'invite-test-secret'
const admin = { userId: 'u-admin', username: 'Admin', role: 'admin', status: 'active' } as const
const user = { userId: 'u-member', username: 'Member', role: 'user', status: 'active' } as const

function setup() {
	const c = sqliteDb()
	connections.push(c)
	seedSection(c.sql)
	return c
}

describe('invitation codes', () => {
	it('only lets administrators generate codes', async () => {
		const c = setup()
		await expect(createInvites(c.db, secret, user, {})).rejects.toMatchObject({ status: 403 })
		await expect(revokeInvite(c.db, user, 'anything')).rejects.toMatchObject({ status: 403 })
		await expect(createInvites(c.db, secret, admin, { count: 51 })).rejects.toMatchObject({ code: 'BAD_INPUT' })
	})

	it('stores only hashes, returns plaintext once with seven-day defaults', async () => {
		const c = setup()
		const now = Date.now()
		const { invites } = await createInvites(c.db, secret, admin, {}, now)
		expect(invites).toHaveLength(1)
		expect(invites[0].code).toMatch(/^[A-HJ-NP-Z2-9]{24}$/)
		expect(invites[0].maxUses).toBe(1)
		expect(invites[0].expiresAt).toBe(now + 7 * 24 * 60 * 60 * 1000)
		const row = c.sql.prepare('SELECT code_hash FROM auth_invite_codes WHERE id = ?').get(invites[0].id) as { code_hash: string }
		expect(row.code_hash).toBe(await hashInvite(secret, invites[0].code))
		expect(JSON.stringify(row)).not.toContain(invites[0].code)
		expect(await validateInvite(c.db, secret, invites[0].code, now)).toMatchObject({ id: invites[0].id })
	})

	it('generates batches with configured limits and reports each status', async () => {
		const c = setup()
		const now = Date.now()
		const { invites } = await createInvites(c.db, secret, admin,
			{ count: 3, maxUses: 2, ttlDays: 1 }, now)
		expect(invites).toHaveLength(3)
		expect(new Set(invites.map((i) => i.code)).size).toBe(3)
		expect((await listInvites(c.db, now)).every((i) => i.status === 'active')).toBe(true)

		c.sql.exec(`UPDATE auth_invite_codes SET used_count = max_uses WHERE id = '${invites[0].id}'`)
		c.sql.exec(`UPDATE auth_invite_codes SET expires_at = ${now - 1} WHERE id = '${invites[1].id}'`)
		await revokeInvite(c.db, admin, invites[2].id, now)
		const states = (await listInvites(c.db, now)).map((i) => i.status).sort()
		expect(states).toEqual(['expired', 'revoked', 'used'])
		expect(await getInvite(c.db, invites[2].id)).toMatchObject({ status: 'revoked', revokedAt: now })
	})

	it('records redemptions without exposing the code', async () => {
		const c = setup()
		const { invites } = await createInvites(c.db, secret, admin, {})
		c.sql.exec(`INSERT INTO wiki_audit_logs (id, actor_id, action, target_type, target_id, metadata_json)
			VALUES ('redeem-1', 'u-member', 'invite.redeem', 'invite', '${invites[0].id}',
			json_object('userId', 'u-member', 'email', 'member@qq.com'))`)
		const records = await listInviteRedemptions(c.db, invites[0].id)
		expect(records).toHaveLength(1)
		expect(records[0]).toMatchObject({ userId: 'u-member', username: 'Member', email: 'member@qq.com' })
		expect(JSON.stringify(records)).not.toContain(invites[0].code)
	})
})
