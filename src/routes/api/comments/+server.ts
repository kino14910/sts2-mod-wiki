import { error, json } from '@sveltejs/kit'
import {
	CommentError,
	createComment,
	listComments
} from '#lib/server/wiki/comment-service'
import { createCommentStore } from '#lib/server/wiki/repository'
import { canonicalCommentTarget } from '#lib/server/wiki/identity-catalog'
import type { RequestHandler } from './$types'

function fail(cause: unknown): never {
	if (cause instanceof CommentError) error(cause.status, cause.message)
	throw cause
}

function optionalNumber(value: string | null): number | undefined {
	if (value === null || value === '') return undefined
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : undefined
}

function clientIp(request: Request): string | null {
	const direct = request.headers.get('cf-connecting-ip')
	if (direct) return direct
	const forwarded = request.headers.get('x-forwarded-for')
	return forwarded?.split(',')[0]?.trim() || null
}

export const GET: RequestHandler = async ({ url, request, locals }) => {
	if (!locals.wikiDb) error(503, 'Comment database unavailable')
	try {
		const target = await canonicalCommentTarget(locals.wikiDb, url.searchParams.get('targetType'), url.searchParams.get('targetId'))
		const page = await listComments(createCommentStore(locals.wikiDb), {
			...target,
			page: optionalNumber(url.searchParams.get('page')),
			pageSize: optionalNumber(url.searchParams.get('pageSize')),
			viewerToken: request.headers.get('x-comment-token')
		})
		return json(page)
	} catch (cause) {
		fail(cause)
	}
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.wikiDb) error(503, 'Comment database unavailable')
	const body: unknown = await request.json().catch(() => null)
	if (!body || typeof body !== 'object') error(400, 'Invalid JSON body')
	const input = body as Record<string, unknown>

	try {
		const target = await canonicalCommentTarget(locals.wikiDb, input.targetType, input.targetId)
		const comment = await createComment(createCommentStore(locals.wikiDb), {
			...target,
			parentId: input.parentId,
			content: input.content,
			authorName: input.authorName,
			token: request.headers.get('x-comment-token'),
			ip: clientIp(request)
		})
		return json(comment, { status: 201 })
	} catch (cause) {
		fail(cause)
	}
}
