import { error } from '@sveltejs/kit'
import { WikiCollaborationError, type MaybeActor } from './access'

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
	const body: unknown = await request.json().catch(() => null)
	if (!body || typeof body !== 'object' || Array.isArray(body)) error(400, 'Invalid JSON body')
	return body as Record<string, unknown>
}
