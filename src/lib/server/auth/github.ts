import { WikiCollaborationError } from '#lib/server/wiki/access'
import { sessionCookie, signSession, verifySession } from './cookie-session'
import { findUserBySubject } from './users'

export const OAUTH_COOKIE = 'sts2_wiki_oauth'
const STATE_TTL = 600
const encoder = new TextEncoder()
type Fetch = typeof fetch

function base64(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export function isLocalHost(url: URL): boolean {
	return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
}

export function safeReturnTo(value: string | null | undefined): string {
	if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return '/'
	const parsed = new URL(value, 'https://wiki.invalid')
	return parsed.origin === 'https://wiki.invalid' ? parsed.pathname + parsed.search + parsed.hash : '/'
}

function configuration(env: Env, requestUrl: URL) {
	if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.WIKI_SESSION_SECRET || !env.WIKI_PUBLIC_ORIGIN)
		throw new WikiCollaborationError(503, 'GitHub login is not configured', 'LOGIN_UNAVAILABLE')
	let origin: URL
	try { origin = new URL(env.WIKI_PUBLIC_ORIGIN) } catch {
		throw new WikiCollaborationError(503, 'Invalid login origin configuration', 'LOGIN_UNAVAILABLE')
	}
	if (origin.protocol !== 'https:' || origin.origin !== requestUrl.origin || origin.username || origin.password)
		throw new WikiCollaborationError(503, 'Login origin must match the public HTTPS origin', 'LOGIN_UNAVAILABLE')
	return {
		clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET,
		secret: env.WIKI_SESSION_SECRET, redirectUri: `${origin.origin}/api/auth/callback/github`
	}
}

export async function startGithubLogin(db: D1Database, env: Env, url: URL) {
	const config = configuration(env, url)
	const nonce = base64(crypto.getRandomValues(new Uint8Array(32)))
	const verifier = base64(crypto.getRandomValues(new Uint8Array(48)))
	const challenge = base64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))))
	const state = await signSession(JSON.stringify({ nonce, verifier, returnTo: safeReturnTo(url.searchParams.get('returnTo')) }), config.secret, Date.now(), STATE_TTL)
	const now = Date.now()
	await db.batch([
		db.prepare('DELETE FROM auth_oauth_states WHERE expires_at <= ?').bind(now),
		db.prepare('INSERT INTO auth_oauth_states (id, expires_at) VALUES (?, ?)').bind(nonce, now + STATE_TTL * 1000)
	])
	const authorization = new URL('https://github.com/login/oauth/authorize')
	authorization.search = new URLSearchParams({
		client_id: config.clientId, redirect_uri: config.redirectUri, state: nonce,
		code_challenge: challenge, code_challenge_method: 'S256'
	}).toString()
	return { location: authorization.href,
		cookie: `${OAUTH_COOKIE}=${encodeURIComponent(state)}; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=${STATE_TTL}` }
}

export function clearOAuthCookie(): string {
	return `${OAUTH_COOKIE}=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}

export async function completeGithubLogin(db: D1Database, env: Env, url: URL, stateCookie: string | undefined, fetcher: Fetch = fetch) {
	const config = configuration(env, url)
	const token = await verifySession(stateCookie, config.secret)
	let state: { nonce?: unknown; verifier?: unknown; returnTo?: unknown } | null = null
	try { state = token ? JSON.parse(token.sub) : null } catch { /* malformed state is untrusted */ }
	const nonce = url.searchParams.get('state')
	const code = url.searchParams.get('code')
	if (!state || typeof state.nonce !== 'string' || state.nonce !== nonce || typeof state.verifier !== 'string' || !code || code.length > 512)
		throw new WikiCollaborationError(400, 'OAuth state or authorization code is invalid', 'BAD_OAUTH_STATE')
	const consumed = await db.prepare('DELETE FROM auth_oauth_states WHERE id = ? AND expires_at > ? RETURNING id')
		.bind(nonce, Date.now()).first()
	if (!consumed) throw new WikiCollaborationError(400, 'OAuth state expired or was already used', 'BAD_OAUTH_STATE')

	const exchange = await fetcher('https://github.com/login/oauth/access_token', {
		method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret,
			code, redirect_uri: config.redirectUri, code_verifier: state.verifier })
	})
	const access = await exchange.json() as { access_token?: unknown; token_type?: unknown }
	if (!exchange.ok || typeof access.access_token !== 'string' || access.token_type !== 'bearer')
		throw new WikiCollaborationError(502, 'GitHub authorization failed', 'IDP_ERROR')
	const response = await fetcher('https://api.github.com/user', {
		headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${access.access_token}`,
			'user-agent': 'sts2-mod-wiki', 'X-GitHub-Api-Version': '2022-11-28' }
	})
	const profile = await response.json() as { id?: unknown; login?: unknown }
	if (!response.ok || !Number.isSafeInteger(profile.id) || Number(profile.id) <= 0 || typeof profile.login !== 'string')
		throw new WikiCollaborationError(502, 'GitHub identity could not be verified', 'IDP_ERROR')
	const subject = `github:${profile.id}`
	// Stable provider ID is the identity. A changed GitHub handle never changes permissions.
	await db.prepare(`INSERT OR IGNORE INTO users (id, auth_subject, username, role, status)
		VALUES (?, ?, ?, 'member', 'active')`)
		.bind(`user:${subject}`, subject, `${profile.login.slice(0, 40)} (gh:${profile.id})`).run()
	const session = await findUserBySubject(db, subject)
	if (!session) throw new WikiCollaborationError(403, 'Account is suspended or unavailable', 'FORBIDDEN')
	return { location: safeReturnTo(typeof state.returnTo === 'string' ? state.returnTo : '/'),
		cookie: sessionCookie(await signSession(subject, config.secret)) }
}
