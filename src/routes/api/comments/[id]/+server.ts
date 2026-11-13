import { error, json } from '@sveltejs/kit'
import { CommentError, deleteComment, editComment } from '#lib/server/wiki/comment-service'
import { createCommentStore } from '#lib/server/wiki/repository'
import type { RequestHandler } from './$types'

function fail(cause: unknown): never {
	if (cause instanceof CommentError) error(cause.status, cause.message)
	throw cause
}

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.wikiDb) error(503, 'Comment database unavailable')
	const body: unknown = await request.json().catch(() => null)
	if (!body || typeof body !== 'object') error(400, 'Invalid JSON body')
	const input = body as Record<string, unknown>

	try {
		const comment = await editComment(createCommentStore(locals.wikiDb), {
			commentId: params.id,
			token: request.headers.get('x-comment-token'),
			content: input.content,
			updatedAt: input.updatedAt
		})
		return json(comment)
	} catch (cause) {
		fail(cause)
	}
}

export const DELETE: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.wikiDb) error(503, 'Comment database unavailable')
	try {
		const comment = await deleteComment(createCommentStore(locals.wikiDb), {
			commentId: params.id,
			token: request.headers.get('x-comment-token')
		})
		return json(comment)
	} catch (cause) {
		fail(cause)
	}
}
