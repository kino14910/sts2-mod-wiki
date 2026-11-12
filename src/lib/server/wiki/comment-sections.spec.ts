import { describe, expect, it } from 'vitest'
import type { CommentInsert, CommentRow, CommentStore } from './types'
import {
	createComment,
	deleteComment,
	editComment,
	listComments,
	normalizeCommentTarget
} from './comment-service'

const TOKEN = 'wiki-token-0123456789abcdef'
const SECTION = 'modsection:sts2:index:overview'

function memoryStore(sections: string[] = [SECTION]) {
	const rows: CommentRow[] = []
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
			return rows.filter((row) => row.parent_id !== null && parentIds.includes(row.parent_id))
		},
		async countTopLevel(targetType, targetId) {
			return rows.filter(
				(row) => row.target_type === targetType && row.target_id === targetId && row.parent_id === null
			).length
		},
		async findComment(id) {
			return rows.find((row) => row.id === id) ?? null
		},
		async targetExists(targetType, targetId) {
			return targetType === 'card' || sections.includes(targetId)
		},
		async countRecentByToken() {
			return 0
		},
		async countRecentByIp() {
			return 0
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
			return 1
		},
		async insertAuditLog() {}
	}

	return { store, rows }
}

const base = (overrides: Record<string, unknown> = {}) => ({
	targetType: 'wiki_section',
	targetId: SECTION,
	content: 'Needs a clearer example',
	authorName: 'Alice',
	token: TOKEN,
	...overrides
})

describe('wiki section comments reuse the existing comment system', () => {
	it('accepts a wiki_section target and rejects unknown target types', () => {
		expect(normalizeCommentTarget('wiki_section', SECTION)).toEqual({
			targetType: 'wiki_section',
			targetId: SECTION
		})
		expect(() => normalizeCommentTarget('page', SECTION)).toThrow()
	})

	it('creates, lists, edits and deletes a comment on one block', async () => {
		const { store } = memoryStore()
		const comment = await createComment(store, base())
		expect(comment.targetType).toBe('wiki_section')
		expect(comment.targetId).toBe(SECTION)

		const page = await listComments(store, {
			targetType: 'wiki_section',
			targetId: SECTION,
			viewerToken: TOKEN
		})
		expect(page.items).toHaveLength(1)
		expect(page.items[0]?.owned).toBe(true)

		const edited = await editComment(store, {
			commentId: comment.id,
			token: TOKEN,
			content: 'Updated comment'
		})
		expect(edited.content).toBe('Updated comment')
		expect(edited.edited).toBe(true)

		const deleted = await deleteComment(store, { commentId: comment.id, token: TOKEN })
		expect(deleted.status).toBe('deleted')
		expect(deleted.content).toBe('')
	})

	it('refuses comments on a section that does not exist', async () => {
		const { store, rows } = memoryStore()
		await expect(createComment(store, base({ targetId: 'missing-section' }))).rejects.toMatchObject(
			{ status: 404 }
		)
		expect(rows).toHaveLength(0)
	})

	it('keeps block comments separate from card comments and other blocks', async () => {
		const { store } = memoryStore([SECTION, 'modsection:sts2:index:strategy'])
		await createComment(store, base())
		await createComment(store, base({ targetType: 'card', targetId: 'Abrasive' }))
		const cardPage = await listComments(store, { targetType: 'card', targetId: 'Abrasive' })
		const otherBlock = await listComments(store, {
			targetType: 'wiki_section',
			targetId: 'modsection:sts2:index:strategy'
		})
		expect(cardPage.items).toHaveLength(1)
		expect(otherBlock.items).toHaveLength(0)
	})

	it('rejects a reply whose parent belongs to a different target', async () => {
		const { store } = memoryStore()
		const cardComment = await createComment(
			store,
			base({ targetType: 'card', targetId: 'Abrasive' })
		)
		await expect(
			createComment(store, base({ parentId: cardComment.id }))
		).rejects.toMatchObject({ status: 400 })
	})
})
