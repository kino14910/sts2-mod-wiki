import { describe, expect, it } from 'vitest'
import type { CommentInsert, CommentRow, CommentStore } from './types'
import {
	COMMENT_RATE_LIMIT_PER_IP,
	COMMENT_RATE_LIMIT_PER_TOKEN,
	createComment,
	deleteComment,
	editComment,
	listComments,
	normalizeCommentContent
} from './comment-service'

const TOKEN = 'test-token-0123456789abcdef'
const OTHER_TOKEN = 'other-token-0123456789abcd'

interface MemoryStore {
	store: CommentStore
	rows: CommentRow[]
	audits: unknown[]
}

function memoryStore(): MemoryStore {
	const rows: CommentRow[] = []
	const audits: unknown[] = []
	let tick = Date.now()
	const stamp = () => new Date((tick += 1)).toISOString()

	const store: CommentStore = {
		async listTopLevel({ targetType, targetId, limit, offset }) {
			return rows
				.filter(
					(row) =>
						row.target_type === targetType &&
						row.target_id === targetId &&
						row.parent_id === null
				)
				.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
				.slice(offset, offset + limit)
		},
		async listReplies(parentIds) {
			return rows
				.filter((row) => row.parent_id !== null && parentIds.includes(row.parent_id))
				.sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
		},
		async countTopLevel(targetType, targetId) {
			return rows.filter(
				(row) =>
					row.target_type === targetType &&
					row.target_id === targetId &&
					row.parent_id === null
			).length
		},
		async findComment(id) {
			return rows.find((row) => row.id === id) ?? null
		},
		async countRecentByToken(tokenHash, since) {
			return rows.filter((row) => row.author_token_hash === tokenHash && row.created_at >= since)
				.length
		},
		async countRecentByIp(ipHash, since) {
			return rows.filter((row) => row.author_ip_hash === ipHash && row.created_at >= since)
				.length
		},
		async insertComment(input: CommentInsert) {
			const at = stamp()
			rows.push({
				id: input.id,
				target_type: input.targetType,
				target_id: input.targetId,
				parent_id: input.parentId,
				author_name: input.authorName,
				author_token_hash: input.authorTokenHash,
				author_ip_hash: input.authorIpHash,
				content: input.content,
				status: 'visible',
				created_at: at,
				updated_at: at
			})
		},
		async updateContent(id, tokenHash, content) {
			const row = rows.find((item) => item.id === id)
			if (!row || row.author_token_hash !== tokenHash || row.status !== 'visible') return 0
			row.content = content
			row.updated_at = stamp()
			return 1
		},
		async softDelete(id, tokenHash) {
			const row = rows.find((item) => item.id === id)
			if (!row || row.author_token_hash !== tokenHash || row.status !== 'visible') return 0
			row.status = 'deleted'
			audits.push({ action: 'comment.delete', targetId: id })
			return 1
		},
		async insertAuditLog(input) {
			audits.push(input)
		}
	}

	return { store, rows, audits }
}

function baseInput(overrides: Record<string, unknown> = {}) {
	return {
		targetType: 'card',
		targetId: 'Abrasive',
		content: 'Great card',
		authorName: 'Alice',
		token: TOKEN,
		...overrides
	}
}

describe('comment validation', () => {
	it('normalizes line endings and trims content', () => {
		expect(normalizeCommentContent('  hello\r\nworld  ')).toBe('hello\nworld')
	})

	it('rejects empty, oversized and executable content', async () => {
		const { store } = memoryStore()
		await expect(createComment(store, baseInput({ content: '   ' }))).rejects.toMatchObject({
			status: 400
		})
		await expect(
			createComment(store, baseInput({ content: 'x'.repeat(2001) }))
		).rejects.toMatchObject({ status: 400 })
		await expect(
			createComment(store, baseInput({ content: '<script>alert(1)</script>' }))
		).rejects.toMatchObject({ status: 400 })
	})

	it('rejects invalid author names and tokens', async () => {
		const { store } = memoryStore()
		await expect(createComment(store, baseInput({ authorName: 'A' }))).rejects.toMatchObject({
			status: 400
		})
		await expect(
			createComment(store, baseInput({ authorName: 'A'.repeat(33) }))
		).rejects.toMatchObject({ status: 400 })
		await expect(
			createComment(store, baseInput({ authorName: '<bob>' }))
		).rejects.toMatchObject({ status: 400 })
		await expect(createComment(store, baseInput({ token: 'short' }))).rejects.toMatchObject({
			status: 400
		})
	})

	it('only accepts the card target type', async () => {
		const { store } = memoryStore()
		await expect(
			createComment(store, baseInput({ targetType: 'relic' }))
		).rejects.toMatchObject({ status: 400 })
	})
})

describe('comment creation and listing', () => {
	it('creates a card comment with author and ownership', async () => {
		const { store } = memoryStore()
		const comment = await createComment(store, baseInput())

		expect(comment.targetId).toBe('Abrasive')
		expect(comment.author.name).toBe('Alice')
		expect(comment.content).toBe('Great card')
		expect(comment.status).toBe('visible')
		expect(comment.owned).toBe(true)
		expect(comment.edited).toBe(false)
		expect(comment.createdAt).toBe(comment.updatedAt)
	})

	it('marks ownership only for the matching browser token', async () => {
		const { store } = memoryStore()
		await createComment(store, baseInput())

		const anonymous = await listComments(store, { targetType: 'card', targetId: 'Abrasive' })
		const owner = await listComments(store, {
			targetType: 'card',
			targetId: 'Abrasive',
			viewerToken: TOKEN
		})
		expect(anonymous.items[0]?.owned).toBe(false)
		expect(owner.items[0]?.owned).toBe(true)
	})

	it('paginates top-level comments and nests one level of replies', async () => {
		const { store } = memoryStore()
		const parent = await createComment(store, baseInput({ content: 'parent', token: TOKEN }))
		await createComment(
			store,
			baseInput({ content: 'second', token: OTHER_TOKEN, authorName: 'Bob' })
		)
		await createComment(
			store,
			baseInput({
				content: 'third',
				token: 'third-token-0123456789abcdef',
				authorName: 'Carol'
			})
		)
		await createComment(
			store,
			baseInput({ content: 'reply', parentId: parent.id, token: OTHER_TOKEN, authorName: 'Bob' })
		)

		const firstPage = await listComments(store, {
			targetType: 'card',
			targetId: 'Abrasive',
			page: 1,
			pageSize: 2
		})
		expect(firstPage.total).toBe(3)
		expect(firstPage.items).toHaveLength(2)
		expect(firstPage.hasMore).toBe(true)

		const secondPage = await listComments(store, {
			targetType: 'card',
			targetId: 'Abrasive',
			page: 2,
			pageSize: 2
		})
		expect(secondPage.items).toHaveLength(1)
		expect(secondPage.items[0]?.id).toBe(parent.id)
		expect(secondPage.items[0]?.replies[0]?.content).toBe('reply')
		expect(secondPage.hasMore).toBe(false)
	})

	it('keeps comments scoped to one card', async () => {
		const { store } = memoryStore()
		await createComment(store, baseInput({ targetId: 'Abrasive' }))
		const other = await listComments(store, { targetType: 'card', targetId: 'Strike' })
		expect(other.items).toEqual([])
	})
})

describe('comment replies', () => {
	it('rejects replies to replies and cross-card replies', async () => {
		const { store } = memoryStore()
		const parent = await createComment(store, baseInput())
		const reply = await createComment(
			store,
			baseInput({ parentId: parent.id, token: OTHER_TOKEN, authorName: 'Bob' })
		)

		await expect(
			createComment(store, baseInput({ parentId: reply.id, authorName: 'Carol' }))
		).rejects.toMatchObject({ status: 400 })

		const foreign = await createComment(store, baseInput({ targetId: 'Strike' }))
		await expect(
			createComment(store, baseInput({ parentId: foreign.id }))
		).rejects.toMatchObject({ status: 400 })
	})

	it('rejects replies to missing or deleted comments', async () => {
		const { store } = memoryStore()
		await expect(
			createComment(store, baseInput({ parentId: 'missing' }))
		).rejects.toMatchObject({ status: 404 })

		const parent = await createComment(store, baseInput())
		await deleteComment(store, { commentId: parent.id, token: TOKEN })
		await expect(
			createComment(store, baseInput({ parentId: parent.id }))
		).rejects.toMatchObject({ status: 409 })
	})
})

describe('comment editing and soft deletion', () => {
	it('edits only with the author token and marks the comment as edited', async () => {
		const { store } = memoryStore()
		const comment = await createComment(store, baseInput())

		await expect(
			editComment(store, { commentId: comment.id, token: OTHER_TOKEN, content: 'hijack' })
		).rejects.toMatchObject({ status: 403 })

		const updated = await editComment(store, {
			commentId: comment.id,
			token: TOKEN,
			content: 'Updated text'
		})
		expect(updated.content).toBe('Updated text')
		expect(updated.edited).toBe(true)
		expect(updated.owned).toBe(true)
	})

	it('soft deletes, blanks the public content and keeps an audit record', async () => {
		const { store, rows, audits } = memoryStore()
		const comment = await createComment(store, baseInput())

		await expect(
			deleteComment(store, { commentId: comment.id, token: OTHER_TOKEN })
		).rejects.toMatchObject({ status: 403 })

		const deleted = await deleteComment(store, { commentId: comment.id, token: TOKEN })
		expect(deleted.status).toBe('deleted')
		expect(deleted.content).toBe('')
		expect(rows).toHaveLength(1)
		expect(rows[0]?.content).toBe('Great card')
		expect(audits).toHaveLength(1)

		await deleteComment(store, { commentId: comment.id, token: TOKEN })
		expect(audits).toHaveLength(1)
	})

	it('keeps replies visible after the parent is deleted', async () => {
		const { store } = memoryStore()
		const parent = await createComment(store, baseInput())
		await createComment(
			store,
			baseInput({ parentId: parent.id, token: OTHER_TOKEN, authorName: 'Bob' })
		)
		await deleteComment(store, { commentId: parent.id, token: TOKEN })

		const page = await listComments(store, { targetType: 'card', targetId: 'Abrasive' })
		expect(page.items[0]?.status).toBe('deleted')
		expect(page.items[0]?.content).toBe('')
		expect(page.items[0]?.replies[0]?.content).toContain('Great card')
	})

	it('rejects editing a deleted comment', async () => {
		const { store } = memoryStore()
		const comment = await createComment(store, baseInput())
		await deleteComment(store, { commentId: comment.id, token: TOKEN })

		await expect(
			editComment(store, { commentId: comment.id, token: TOKEN, content: 'later' })
		).rejects.toMatchObject({ status: 409 })
	})
})

describe('comment rate limits', () => {
	it('blocks a token after the per-token window limit', async () => {
		const { store } = memoryStore()
		for (let index = 0; index < COMMENT_RATE_LIMIT_PER_TOKEN; index += 1) {
			await createComment(store, baseInput({ content: `comment ${index}` }))
		}
		await expect(
			createComment(store, baseInput({ content: 'one too many' }))
		).rejects.toMatchObject({ status: 429 })
	})

	it('blocks an address after the per-IP window limit', async () => {
		const { store } = memoryStore()
		for (let index = 0; index < COMMENT_RATE_LIMIT_PER_IP; index += 1) {
			await createComment(
				store,
				baseInput({
					content: `comment ${index}`,
					token: `token-${index}-0123456789abcdef`,
					ip: '203.0.113.7'
				})
			)
		}
		await expect(
			createComment(
				store,
				baseInput({ content: 'blocked', token: 'final-token-0123456789ab', ip: '203.0.113.7' })
			)
		).rejects.toMatchObject({ status: 429 })
	})
})
