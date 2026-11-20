import { error, json } from '@sveltejs/kit'
import { isAllowedEmail } from '#lib/email-domain'
import { clearSessionCookie, sessionCookie, signSession } from '#lib/server/auth/cookie-session'
import { isLocalHost } from '#lib/server/auth/local'
import { rolePermissions } from '#lib/server/auth/permissions'
import { publicSession } from '#lib/server/auth/public-session'
import { ensureDevUser, SUBJECT_PATTERN } from '#lib/server/auth/users'
import { getRuntimeEnv } from '#lib/server/wiki/db'
import { assertSameOrigin } from '#lib/server/wiki/api-helpers'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals }) => {
	return json({
		session: publicSession(locals.session),
		permissions: locals.session ? rolePermissions(locals.session.role) : []
	}, { headers: { 'cache-control': 'no-store' } })
}

/**
 * Local development subject picker for testing elevated roles. Disabled unless
 * WIKI_DEV_LOGIN=1 is explicitly set on a loopback hostname.
 */
export const POST: RequestHandler = async ({ request, locals, url }) => {
	assertSameOrigin(request)
	const env = getRuntimeEnv()
	if (!isLocalHost(url) || env?.WIKI_DEV_LOGIN !== '1' || !env.WIKI_SESSION_SECRET)
		error(404, 'Development login is disabled')
	if (!locals.wikiDb) error(503, 'Wiki database unavailable')

	const body: unknown = await request.json().catch(() => null)
	const subject = (body as { subject?: unknown } | null)?.subject
	if (typeof subject !== 'string' || !SUBJECT_PATTERN.test(subject) || !isAllowedEmail(subject))
		error(400, 'Only @qq.com email addresses can sign in')

	const session = await ensureDevUser(locals.wikiDb, subject)
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
