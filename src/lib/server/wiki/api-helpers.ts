import { error } from '@sveltejs/kit'
import { WikiCollaborationError, type MaybeActor } from './access'
import { hasPermission } from '#lib/server/auth/permissions'

export function collaborationDb(locals: App.Locals): D1Database {
	if (!locals.wikiDb) error(503, 'Wiki database unavailable')
	return locals.wikiDb
}

export function collaborationActor(locals: App.Locals): MaybeActor {
	return locals.session
}

export function collaborationFail(cause: unknown): never {
	if (cause instanceof WikiCollaborationError) error(cause.status, cause.message)
	throw cause
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
	assertSameOrigin(request)
	const body: unknown = await request.json().catch(() => null)
	if (!body || typeof body !== 'object' || Array.isArray(body)) error(400, 'Invalid JSON body')
	return body as Record<string, unknown>
}

export function assertSameOrigin(request: Request): void {
	const origin = request.headers.get('origin')
	if (origin && origin !== new URL(request.url).origin) error(403, 'Cross-origin mutation denied')
}

export function proposalViewer(locals: App.Locals) {
	if (!locals.session) error(401, 'Sign in required')
	if (locals.session.status !== 'active') error(403, 'Account is not active')
	return { actor: locals.session, reviewer: hasPermission(locals.session, 'wiki:proposal:review') }
}
