import { afterEach, describe, expect, it, vi } from 'vitest'
import { completeGithubLogin, safeReturnTo, startGithubLogin, isLocalHost } from './github'
import { readSessionCookie, verifySession } from './cookie-session'
import { sqliteDb } from '#lib/server/wiki/testing/sqlite-db'

const env = { GITHUB_CLIENT_ID: 'test-client', GITHUB_CLIENT_SECRET: 'test-secret', WIKI_SESSION_SECRET: 'test-session-key', WIKI_PUBLIC_ORIGIN: 'https://wiki.example' } as Env
const connections: ReturnType<typeof sqliteDb>[] = []
afterEach(() => { for (const c of connections.splice(0)) c.close() })
function setup() { const c = sqliteDb(); connections.push(c); return c }
async function login(c: ReturnType<typeof setup>) {
	const initial = await startGithubLogin(c.db, env, new URL('https://wiki.example/api/auth/login?returnTo=%2Fcards%2FBash%23Notes'))
	const auth = new URL(initial.location), state = auth.searchParams.get('state')!
	const cookie = decodeURIComponent(initial.cookie.split(';')[0].slice(initial.cookie.indexOf('=') + 1))
	return { auth, cookie, callback: new URL(`https://wiki.example/api/auth/callback/github?code=verified-code&state=${state}`) }
}
function provider() { return vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: 'verified-token', token_type: 'bearer' }))
	.mockResolvedValueOnce(Response.json({ id: 123, login: 'Alice', role: 'admin' })) }

describe('production GitHub identity flow', () => {
	it('uses one-time state, S256 PKCE and the provider ID, never the claimed profile role', async () => {
		const c = setup(), flow = await login(c), fetcher = provider()
		expect(flow.auth.searchParams.get('code_challenge_method')).toBe('S256')
		expect(flow.auth.searchParams.get('code_challenge')?.length).toBe(43)
		const result = await completeGithubLogin(c.db, env, flow.callback, flow.cookie, fetcher)
		expect(result.location).toBe('/cards/Bash#Notes')
		const request = new Request('https://wiki.example', { headers: { cookie: result.cookie.split(';')[0] } })
		expect(await verifySession(readSessionCookie(request), env.WIKI_SESSION_SECRET!)).toMatchObject({ sub: 'github:123' })
		expect(c.sql.prepare("SELECT auth_subject,role FROM users WHERE auth_subject='github:123'").get()).toEqual({ auth_subject: 'github:123', role: 'member' })
		const exchange = fetcher.mock.calls[0][1]!
		expect(String(exchange.body)).toContain('code_verifier=')
		expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({ authorization: 'Bearer verified-token' })
		await expect(completeGithubLogin(c.db, env, flow.callback, flow.cookie, provider())).rejects.toMatchObject({ code: 'BAD_OAUTH_STATE' })
	})
	it('rejects missing, tampered, mismatched and expired state before contacting the provider', async () => {
		const c = setup(), flow = await login(c), fetcher = provider()
		await expect(completeGithubLogin(c.db, env, flow.callback, undefined, fetcher)).rejects.toMatchObject({ code: 'BAD_OAUTH_STATE' })
		await expect(completeGithubLogin(c.db, env, flow.callback, flow.cookie + 'x', fetcher)).rejects.toMatchObject({ code: 'BAD_OAUTH_STATE' })
		const wrong = new URL(flow.callback); wrong.searchParams.set('state', 'wrong')
		await expect(completeGithubLogin(c.db, env, wrong, flow.cookie, fetcher)).rejects.toMatchObject({ code: 'BAD_OAUTH_STATE' })
		c.sql.exec('UPDATE auth_oauth_states SET expires_at=0')
		await expect(completeGithubLogin(c.db, env, flow.callback, flow.cookie, fetcher)).rejects.toMatchObject({ code: 'BAD_OAUTH_STATE' })
		expect(fetcher).not.toHaveBeenCalled()
	})
	it('uses the existing DB role and refuses suspended identities', async () => {
		const c = setup()
		c.sql.exec("INSERT INTO users(id,auth_subject,username,role,status) VALUES ('existing','github:123','Existing','admin','suspended')")
		const flow = await login(c)
		await expect(completeGithubLogin(c.db, env, flow.callback, flow.cookie, provider())).rejects.toMatchObject({ status: 403 })
		expect(c.sql.prepare("SELECT role,status FROM users WHERE id='existing'").get()).toEqual({ role: 'admin', status: 'suspended' })
	})
	it('requires configured credentials and the public HTTPS origin', async () => {
		const c = setup()
		await expect(startGithubLogin(c.db, {} as Env, new URL('https://wiki.example'))).rejects.toMatchObject({ status: 503 })
		await expect(startGithubLogin(c.db, env, new URL('https://attacker.example'))).rejects.toMatchObject({ status: 503 })
		expect(isLocalHost(new URL('https://localhost'))).toBe(true)
		expect(isLocalHost(new URL('https://localhost.attacker.example'))).toBe(false)
	})
	it('allows only same-origin return paths', () => {
		for (const value of ['https://attacker.example', '//attacker.example', '/\\attacker.example', '/\u0000bad', 'relative'])
			expect(safeReturnTo(value)).toBe('/')
		expect(safeReturnTo('/cards/Bash?q=1#Notes')).toBe('/cards/Bash?q=1#Notes')
	})
})
