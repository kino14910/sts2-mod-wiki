import {
	DEFAULT_COMMENT_PAGE_SIZE,
	MAX_COMMENT_AUTHOR_NAME_LENGTH,
	MAX_COMMENT_LENGTH,
	MAX_COMMENT_PAGE_SIZE,
	MIN_COMMENT_AUTHOR_NAME_LENGTH,
	type CommentPage,
	type CommentTargetType,
	type CommentView
} from '#lib/comments'
import { isValidEntityId } from '#lib/entities'
import type { CommentRow, CommentStore } from './types'

export const COMMENT_RATE_LIMIT_WINDOW_MS = 60_000
export const COMMENT_RATE_LIMIT_PER_TOKEN = 5
export const COMMENT_RATE_LIMIT_PER_IP = 20

const TARGET_TYPES: readonly CommentTargetType[] = ['card', 'wiki_section']
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/
const FORBIDDEN_MARKUP = /<\s*\/?\s*(script|style|iframe|object|embed|link|meta)\b|javascript:/i
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/

export class CommentError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message)
	}
}

export function normalizeCommentTarget(
	targetType: unknown,
	targetId: unknown
): { targetType: CommentTargetType; targetId: string } {
	if (!TARGET_TYPES.includes(targetType as CommentTargetType))
		throw new CommentError(400, 'unsupported comment target type')
	if (typeof targetId !== 'string' || !isValidEntityId(targetId))
		throw new CommentError(400, 'invalid comment target id')
	return { targetType: targetType as CommentTargetType, targetId }
}

export function normalizeCommentContent(value: unknown): string {
	if (typeof value !== 'string') throw new CommentError(400, 'comment content is required')
	const content = value.replace(/\r\n?/g, '\n').trim()
	if (content.length === 0) throw new CommentError(400, 'comment content is required')
	if (content.length > MAX_COMMENT_LENGTH) throw new CommentError(400, 'comment content is too long')
	if (CONTROL_CHARS.test(content)) throw new CommentError(400, 'comment content contains control characters')
	if (FORBIDDEN_MARKUP.test(content)) throw new CommentError(400, 'comment content contains forbidden markup')
	return content
}

export function normalizeCommentAuthorName(value: unknown): string {
	if (typeof value !== 'string') throw new CommentError(400, 'author name is required')
	const name = value.replace(/\s+/g, ' ').trim()
	if (name.length < MIN_COMMENT_AUTHOR_NAME_LENGTH || name.length > MAX_COMMENT_AUTHOR_NAME_LENGTH)
		throw new CommentError(400, 'author name must be between 2 and 32 characters')
	if (/[<>\u0000-\u001f\u007f]/.test(name))
		throw new CommentError(400, 'author name contains invalid characters')
	return name
}

export function normalizeCommentToken(value: unknown): string {
	if (typeof value !== 'string' || !TOKEN_PATTERN.test(value))
		throw new CommentError(400, 'invalid comment token')
	return value
}

export async function hashCommentToken(value: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function hashOptionalToken(value: string | null | undefined): Promise<string | null> {
	if (!value || !TOKEN_PATTERN.test(value)) return null
	return hashCommentToken(value)
}

function normalizePage(value: number | undefined): number {
	if (value === undefined || !Number.isFinite(value)) return 1
	return Math.max(1, Math.trunc(value))
}

function normalizePageSize(value: number | undefined): number {
	if (value === undefined || !Number.isFinite(value)) return DEFAULT_COMMENT_PAGE_SIZE
	return Math.min(MAX_COMMENT_PAGE_SIZE, Math.max(1, Math.trunc(value)))
}

function normalizeParentId(value: unknown): string | null {
	if (value === undefined || value === null || value === '') return null
	if (typeof value !== 'string' || value.length > 64) throw new CommentError(400, 'invalid parent comment')
	return value
}

function toView(
	row: CommentRow,
	viewerTokenHash: string | null,
	replies: CommentView[] = []
): CommentView {
	const deleted = row.status === 'deleted'
	return {
		id: row.id,
		targetType: row.target_type,
		targetId: row.target_id,
		parentId: row.parent_id,
		content: deleted ? '' : row.content,
		status: row.status,
		author: { name: row.author_name },
		owned: viewerTokenHash !== null && row.author_token_hash === viewerTokenHash,
		edited: !deleted && row.updated_at !== row.created_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		replies
	}
}

async function enforceRateLimit(
	store: CommentStore,
	tokenHash: string,
	ipHash: string | null
): Promise<void> {
	const since = new Date(Date.now() - COMMENT_RATE_LIMIT_WINDOW_MS).toISOString()
	if ((await store.countRecentByToken(tokenHash, since)) >= COMMENT_RATE_LIMIT_PER_TOKEN)
		throw new CommentError(429, 'comment rate limit exceeded')
	if (ipHash && (await store.countRecentByIp(ipHash, since)) >= COMMENT_RATE_LIMIT_PER_IP)
		throw new CommentError(429, 'comment rate limit exceeded')
}

export interface ListCommentsInput {
	targetType: unknown
	targetId: unknown
	page?: number
	pageSize?: number
	viewerToken?: string | null
}

export async function listComments(
	store: CommentStore,
	input: ListCommentsInput
): Promise<CommentPage> {
	const { targetType, targetId } = normalizeCommentTarget(input.targetType, input.targetId)
	const page = normalizePage(input.page)
	const pageSize = normalizePageSize(input.pageSize)
	const viewerTokenHash = await hashOptionalToken(input.viewerToken)

	const [rows, total] = await Promise.all([
		store.listTopLevel({ targetType, targetId, limit: pageSize, offset: (page - 1) * pageSize }),
		store.countTopLevel(targetType, targetId)
	])

	const replies = await store.listReplies(rows.map((row) => row.id))
	const repliesByParent = new Map<string, CommentView[]>()
	for (const reply of replies) {
		if (!reply.parent_id) continue
		const list = repliesByParent.get(reply.parent_id) ?? []
		list.push(toView(reply, viewerTokenHash))
		repliesByParent.set(reply.parent_id, list)
	}

	return {
		items: rows.map((row) => toView(row, viewerTokenHash, repliesByParent.get(row.id) ?? [])),
		page,
		pageSize,
		total,
		hasMore: (page - 1) * pageSize + rows.length < total
	}
}

export interface CreateCommentInput {
	targetType: unknown
	targetId: unknown
	parentId?: unknown
	content: unknown
	authorName: unknown
	token: unknown
	ip?: string | null
}

export async function createComment(
	store: CommentStore,
	input: CreateCommentInput
): Promise<CommentView> {
	const target = normalizeCommentTarget(input.targetType, input.targetId)
	// A wiki block comment must point at a real section; card tips keep their entity-id check.
	if (target.targetType === 'wiki_section' && store.targetExists) {
		if (!(await store.targetExists(target.targetType, target.targetId)))
			throw new CommentError(404, 'wiki section not found')
	}
	const content = normalizeCommentContent(input.content)
	const authorName = normalizeCommentAuthorName(input.authorName)
	const tokenHash = await hashCommentToken(normalizeCommentToken(input.token))
	const ipHash = input.ip ? await hashCommentToken(`ip:${input.ip}`) : null
	const parentId = normalizeParentId(input.parentId)

	if (parentId) {
		const parent = await store.findComment(parentId)
		if (!parent) throw new CommentError(404, 'parent comment not found')
		if (parent.status !== 'visible')
			throw new CommentError(409, 'cannot reply to a deleted comment')
		if (parent.parent_id !== null) throw new CommentError(400, 'replies are limited to one level')
		if (parent.target_type !== target.targetType || parent.target_id !== target.targetId)
			throw new CommentError(400, 'replies must belong to the same target')
	}

	await enforceRateLimit(store, tokenHash, ipHash)

	const id = crypto.randomUUID()
	const now = new Date().toISOString()
	await store.insertComment({
		id,
		targetType: target.targetType,
		targetId: target.targetId,
		parentId,
		authorName,
		authorTokenHash: tokenHash,
		authorIpHash: ipHash,
		content
	})

	const stored = await store.findComment(id)
	return toView(
		stored ?? {
			id,
			target_type: target.targetType,
			target_id: target.targetId,
			parent_id: parentId,
			author_name: authorName,
			author_token_hash: tokenHash,
			author_ip_hash: ipHash,
			content,
			status: 'visible',
			created_at: now,
			updated_at: now
		},
		tokenHash
	)
}

export interface EditCommentInput {
	commentId: string
	token: unknown
	content: unknown
	updatedAt?: unknown
}

export async function editComment(
	store: CommentStore,
	input: EditCommentInput
): Promise<CommentView> {
	const tokenHash = await hashCommentToken(normalizeCommentToken(input.token))
	const content = normalizeCommentContent(input.content)
	const existing = await store.findComment(input.commentId)
	if (!existing) throw new CommentError(404, 'comment not found')
	if (existing.status !== 'visible')
		throw new CommentError(409, 'deleted comments cannot be edited')
	if (existing.author_token_hash !== tokenHash) throw new CommentError(403, 'not your comment')
	if (input.updatedAt !== undefined && input.updatedAt !== existing.updated_at)
		throw new CommentError(409, 'comment changed since it was loaded, reload and retry')

	const changes = await store.updateContent(existing.id, tokenHash, content, { updatedAt: existing.updated_at, content: existing.content })
	if (changes === 0) throw new CommentError(409, 'comment changed while editing, reload and retry')

	const updated = await store.findComment(existing.id)
	return toView(updated ?? { ...existing, content }, tokenHash)
}

export interface DeleteCommentInput {
	commentId: string
	token: unknown
}

export async function deleteComment(
	store: CommentStore,
	input: DeleteCommentInput
): Promise<CommentView> {
	const tokenHash = await hashCommentToken(normalizeCommentToken(input.token))
	const existing = await store.findComment(input.commentId)
	if (!existing) throw new CommentError(404, 'comment not found')
	if (existing.author_token_hash !== tokenHash) throw new CommentError(403, 'not your comment')
	if (existing.status === 'deleted') return toView(existing, tokenHash)

	const changes = await store.softDelete(existing.id, tokenHash)
	if (changes === 0) {
		const latest = await store.findComment(existing.id)
		if (latest?.status === 'deleted') return toView(latest, tokenHash)
		throw new CommentError(409, 'comment could not be deleted')
	}

	// The store commits soft deletion, history and audit together.

	const latest = (await store.findComment(existing.id)) ?? existing
	return toView({ ...latest, status: 'deleted' }, tokenHash)
}
