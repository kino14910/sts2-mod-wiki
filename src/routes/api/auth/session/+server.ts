import { error, json } from '@sveltejs/kit'
import { clearSessionCookie, sessionCookie, signSession } from '#lib/server/auth/cookie-session'
import { rolePermissions } from '#lib/server/auth/permissions'
import { ensureDevUser, SUBJECT_PATTERN } from '#lib/server/auth/users'
import { getPlatformEnv } from '#lib/server/wiki/db'
import { assertSameOrigin } from '#lib/server/wiki/api-helpers'
import { isLocalHost } from '#lib/server/auth/github'
import type { RequestHandler } from './$types'

function publicSession(session: App.Locals['session']) {
	if (!session) return null
	return {
		userId: session.userId,
		username: session.username,
		role: session.role,
		status: session.status
	}
}

export const GET: RequestHandler = async ({ locals }) => {
	return json({
		session: publicSession(locals.session),
		permissions: locals.session ? rolePermissions(locals.session.role) : []
	}, { headers: { 'cache-control': 'no-store' } })
}

/**
 * Local development subject picker. Disabled unless WIKI_DEV_LOGIN=1 is explicitly set.
 * Production deployments are expected to mint the same signed cookie from a real IdP
 * (e.g. Cloudflare Access) or to provision users directly in D1.
 */
export const POST: RequestHandler = async ({ request, platform, locals, url }) => {
	assertSameOrigin(request)
	const env = getPlatformEnv(platform)
	if (!isLocalHost(url) || env?.WIKI_DEV_LOGIN !== '1' || !env.WIKI_SESSION_SECRET)
		error(404, 'Development login is disabled')
	if (!locals.wikiDb) error(503, 'Wiki database unavailable')

	const body: unknown = await request.json().catch(() => null)
	const subject = (body as { subject?: unknown } | null)?.subject
	const rawName = (body as { username?: unknown } | null)?.username
	if (typeof subject !== 'string' || !SUBJECT_PATTERN.test(subject))
		error(400, 'Invalid subject')
	const username = typeof rawName === 'string' && rawName.trim() ? rawName.trim().slice(0, 64) : subject

	const session = await ensureDevUser(locals.wikiDb, subject, username)
	if (!session) error(403, 'Account is not active')

	const token = await signSession(subject, env.WIKI_SESSION_SECRET)
	return json(
		{ session: publicSession(session), permissions: rolePermissions(session.role) },
		{ headers: { 'set-cookie': sessionCookie(token) } }
	)
}

export const DELETE: RequestHandler = async ({ request }) => {
	assertSameOrigin(request)
	return json({ ok: true }, { headers: { 'set-cookie': clearSessionCookie() } })
}
