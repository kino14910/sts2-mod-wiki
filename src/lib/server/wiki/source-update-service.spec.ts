import { afterEach, describe, expect, it } from 'vitest'
import { getSourceUpdateDetail, resolveSourceUpdate } from './source-update-service'
import { sqliteDb, seedSection } from './testing/sqlite-db'

const admin = { userId: 'u-admin', username: 'Admin', role: 'admin', status: 'active' } as const
const member = { userId: 'u-member', username: 'Member', role: 'member', status: 'active' } as const
const connections: ReturnType<typeof sqliteDb>[] = []
afterEach(() => { for (const c of connections.splice(0)) c.close() })
function setup() {
	const c = sqliteDb(); connections.push(c); seedSection(c.sql)
	c.sql.exec(`UPDATE wiki_revisions SET content = 'community edit' WHERE id = 'r1';
		INSERT INTO wiki_section_sources (id, section_id, source_path, source_hash, source_content) VALUES
		('source', 's1', 'content/wiki/sts2/index/overview.md', 'sha256:v1', 'upstream v1');
		INSERT INTO wiki_source_updates (id, source_id, section_id, base_content, current_content, incoming_content, base_hash, incoming_hash, status)
		VALUES ('upd-1', 'source', 's1', 'upstream v1', 'community edit', 'upstream v2', 'sha256:v1', 'sha256:v2', 'conflict');`)
	return c
}
describe('mod upstream conflict resolution', () => {
	it('computes upstream and community-facing diffs', async () => {
		const c = setup(), detail = await getSourceUpdateDetail(c.db, 'upd-1')
		expect(detail).toMatchObject({ hasCommunityDrift: true, currentVersion: 1, sourcePath: 'content/wiki/sts2/index/overview.md' })
		expect(detail?.upstreamDiff.additions).toBe(1)
		expect(detail?.conflictDiff.additions).toBe(1)
	})
	it('requires the source review permission on the server', async () => {
		const c = setup()
		await expect(resolveSourceUpdate(c.db, { id: 'upd-1', decision: 'approve', baseVersion: 1, actor: member })).rejects.toMatchObject({ status: 403 })
		expect(c.sql.prepare("SELECT COUNT(*) AS n FROM wiki_revisions WHERE section_id='s1'").get()?.n).toBe(1)
	})
	it('approval publishes a new revision, refreshes the source and records the reviewer', async () => {
		const c = setup(), detail = await resolveSourceUpdate(c.db, { id: 'upd-1', decision: 'approve', baseVersion: 1, note: 'checked upstream', actor: admin })
		expect(detail).toMatchObject({ status: 'approved', reviewNote: 'checked upstream', currentVersion: 2 })
		expect(detail.publishedRevisionId).toBeTruthy()
		expect(c.sql.prepare("SELECT source_hash FROM wiki_section_sources WHERE id='source'").get()?.source_hash).toBe('sha256:v2')
		expect(c.sql.prepare("SELECT COUNT(*) AS n FROM wiki_audit_logs WHERE action='wiki.source_update.approve'").get()?.n).toBe(1)
	})
	it('rejection keeps published content and the source snapshot untouched', async () => {
		const c = setup(), detail = await resolveSourceUpdate(c.db, { id: 'upd-1', decision: 'reject', actor: admin })
		expect(detail).toMatchObject({ status: 'rejected', publishedRevisionId: null, currentContent: 'community edit' })
		expect(c.sql.prepare("SELECT source_hash FROM wiki_section_sources WHERE id='source'").get()?.source_hash).toBe('sha256:v1')
	})
	it('refuses to resolve an already reviewed update', async () => {
		const c = setup(); c.sql.exec("UPDATE wiki_source_updates SET status='approved' WHERE id='upd-1'")
		await expect(resolveSourceUpdate(c.db, { id: 'upd-1', decision: 'approve', baseVersion: 1, actor: admin })).rejects.toMatchObject({ status: 409 })
	})
	it('requires the browser version on approval', async () => {
		const c = setup()
		await expect(resolveSourceUpdate(c.db, { id: 'upd-1', decision: 'approve', actor: admin })).rejects.toMatchObject({ status: 400 })
	})
})
