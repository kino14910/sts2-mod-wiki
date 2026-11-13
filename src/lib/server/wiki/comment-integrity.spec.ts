import { afterEach, describe, expect, it } from 'vitest'
import { sqliteDb, seedSection } from './testing/sqlite-db'
import { createCommentStore } from './repository'
import { createComment, editComment, deleteComment } from './comment-service'
import { moderateComment } from './comment-moderation'

const connections: ReturnType<typeof sqliteDb>[] = []
afterEach(() => { for (const c of connections.splice(0)) c.close() })
const token = 'anonymous-token-0123456789abcdef'
const input = { targetType: 'wiki_section', targetId: 's1', content: 'original', authorName: 'Anonymous', token, ip: '203.0.113.1' }
const moderator = { userId: 'u-mod', username: 'Moderator', role: 'moderator', status: 'active' } as const
const member = { userId: 'u-member', username: 'Member', role: 'member', status: 'active' } as const
function setup() { const c = sqliteDb(); connections.push(c); seedSection(c.sql); return { ...c, store: createCommentStore(c.db) } }
describe('anonymous comments with actual SQL and history', () => {
	it('enforces per-token limits even when many requests pass the preliminary check together', async () => {
		const c = setup()
		const attempts = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => createComment(c.store, { ...input, content: `comment ${i}` })))
		expect(attempts.filter((v) => v.status === 'fulfilled')).toHaveLength(5)
		expect(attempts.filter((v) => v.status === 'rejected' && v.reason.status === 429)).toHaveLength(7)
		expect(c.sql.prepare('SELECT COUNT(*) AS n FROM comments').get()?.n).toBe(5)
	})
	it('enforces the IP limit across independent anonymous tokens', async () => {
		const c = setup()
		const attempts = await Promise.allSettled(Array.from({ length: 25 }, (_, i) => createComment(c.store, { ...input, token: `anonymous-token-${i}-0123456789` })))
		expect(attempts.filter((v) => v.status === 'fulfilled')).toHaveLength(20)
		expect(attempts.filter((v) => v.status === 'rejected' && v.reason.status === 429)).toHaveLength(5)
	})
	it('keeps every comment version and allows moderators to hide and restore without the author token', async () => {
		const c = setup(), comment = await createComment(c.store, input)
		await editComment(c.store, { commentId: comment.id, token, content: 'edited' })
		await expect(moderateComment(c.db, member, comment.id, { status: 'deleted', reason: 'spam' })).rejects.toMatchObject({ status: 403 })
		await moderateComment(c.db, moderator, comment.id, { status: 'deleted', reason: 'spam' })
		await moderateComment(c.db, moderator, comment.id, { status: 'visible', reason: 'reviewed' })
		expect(c.sql.prepare('SELECT content,status FROM comment_revisions WHERE comment_id=? ORDER BY rowid').all(comment.id)).toEqual([
			{ content: 'original', status: 'visible' }, { content: 'edited', status: 'visible' },
			{ content: 'edited', status: 'deleted' }, { content: 'edited', status: 'visible' }
		])
		await deleteComment(c.store, { commentId: comment.id, token })
		expect(c.sql.prepare('SELECT content FROM comments WHERE id=?').get(comment.id)?.content).toBe('edited')
	})
	it('rejects a second concurrent edit instead of silently overwriting the first', async () => {
		const c = setup(), comment = await createComment(c.store, input)
		let reads = 0, release!: () => void
		const bothRead = new Promise<void>((resolve) => { release = resolve })
		const concurrentStore = { ...c.store, async findComment(id: string) {
			const row = await c.store.findComment(id)
			if (reads < 2) { reads += 1; if (reads === 2) release(); await bothRead }
			return row
		} }
		const attempts = await Promise.allSettled([
			editComment(concurrentStore, { commentId: comment.id, token, content: 'first' }),
			editComment(concurrentStore, { commentId: comment.id, token, content: 'second' })
		])
		expect(attempts.filter((v) => v.status === 'fulfilled')).toHaveLength(1)
		expect(attempts.filter((v) => v.status === 'rejected' && v.reason.status === 409)).toHaveLength(1)
		await expect(editComment(c.store, { commentId: comment.id, token, content: 'stale browser', updatedAt: comment.updatedAt })).rejects.toMatchObject({ status: 409 })
	})
})
