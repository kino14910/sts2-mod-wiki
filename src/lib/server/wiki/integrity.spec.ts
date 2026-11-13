import { afterEach, describe, expect, it } from 'vitest'
import { sqliteDb, seedSection } from './testing/sqlite-db'
import { createWikiEditStore } from './collaboration-repository'
import { publishRevision } from './publish-service'
import { submitSectionEdit } from './edit-service'
import { reviewProposal, withdrawProposal } from './review-service'
import { revertToRevision } from './history-service'
import { resolveSourceUpdate } from './source-update-service'
import { ensureCardSections } from './card-initialization'

const connections: ReturnType<typeof sqliteDb>[] = []
const admin = { userId: 'u-admin', username: 'Admin', role: 'admin', status: 'active' } as const
const member = { userId: 'u-member', username: 'Member', role: 'member', status: 'active' } as const
function setup() { const c = sqliteDb(); connections.push(c); seedSection(c.sql); return { ...c, store: createWikiEditStore(c.db) } }
afterEach(() => { for (const c of connections.splice(0)) c.close() })
const publication = (content: string, version = 1) => ({ sectionId: 's1', expectedVersion: version, content, summary: '', editorId: admin.userId, sourceType: 'community' as const, sourceReference: null, actorId: admin.userId })
async function proposal(c: ReturnType<typeof setup>) { return submitSectionEdit(c.store, { sectionId: 's1', baseVersion: 1, content: 'proposed', actor: member }) }
function source(c: ReturnType<typeof setup>) {
	c.sql.exec(`INSERT INTO wiki_section_sources (id, section_id, source_path, source_hash, source_content) VALUES
		('source', 's1', 'content/wiki/fgo/a.md', 'h1', 'baseline');
		INSERT INTO wiki_source_updates (id, source_id, section_id, base_content, current_content, incoming_content, base_hash, incoming_hash, incoming_mod_version, status)
		VALUES ('update', 'source', 's1', 'baseline', 'baseline', 'incoming', 'h1', 'h2', '2.0', 'conflict');`)
}

describe('collaboration integrity with real SQL', () => {
	it('does not store a proposal against a section which changed during submission', async () => {
		const c = setup()
		c.state.beforeBatch = async () => { await publishRevision(c.store, publication('new community revision')) }
		await expect(proposal(c)).rejects.toMatchObject({ status: 409, code: 'VERSION_CONFLICT' })
		expect(c.sql.prepare('SELECT COUNT(*) AS n FROM wiki_edit_proposals').get()?.n).toBe(0)
		expect(c.sql.prepare("SELECT COUNT(*) AS n FROM wiki_audit_logs WHERE action='wiki.proposal.create'").get()?.n).toBe(0)
	})
	it('never publishes a proposal rejected immediately before the approval transaction', async () => {
		const c = setup(), p = await proposal(c)
		c.state.beforeBatch = () => { c.sql.prepare("UPDATE wiki_edit_proposals SET status = 'rejected' WHERE id = ?").run(p.proposalId!) }
		await expect(reviewProposal(c.store, { proposalId: p.proposalId!, decision: 'approve', actor: admin })).rejects.toMatchObject({ status: 409 })
		expect(c.sql.prepare('SELECT content FROM wiki_revisions WHERE section_id = ?').all('s1')).toEqual([{ content: 'baseline' }])
		expect(c.sql.prepare('SELECT status FROM wiki_edit_proposals WHERE id = ?').get(p.proposalId!)?.status).toBe('rejected')
	})
	it('reports a successful commit even when another writer publishes before the response', async () => {
		const c = setup()
		c.state.afterBatch = async () => { await publishRevision(c.store, publication('second', 2)) }
		const first = await publishRevision(c.store, publication('first'))
		expect(first.version).toBe(2)
		expect(c.sql.prepare('SELECT content FROM wiki_revisions WHERE section_id = ? ORDER BY revision_no').all('s1')).toEqual([
			{ content: 'baseline' }, { content: 'first' }, { content: 'second' }
		])
	})
	it('source rejection wins without changing the published text or baseline', async () => {
		const c = setup(); source(c)
		c.state.beforeBatch = () => { c.sql.exec("UPDATE wiki_source_updates SET status = 'rejected' WHERE id = 'update'") }
		await expect(resolveSourceUpdate(c.db, { id: 'update', decision: 'approve', baseVersion: 1, actor: admin })).rejects.toMatchObject({ status: 409 })
		expect(c.sql.prepare("SELECT source_hash FROM wiki_section_sources WHERE id='source'").get()?.source_hash).toBe('h1')
		expect((await c.store.findSection('s1'))?.currentContent).toBe('baseline')
	})
	it('commits source publication, baseline, review state and audit together', async () => {
		const c = setup(); source(c)
		const detail = await resolveSourceUpdate(c.db, { id: 'update', decision: 'approve', baseVersion: 1, actor: admin })
		expect(detail).toMatchObject({ status: 'approved', currentVersion: 2 })
		expect(c.sql.prepare("SELECT source_hash,source_mod_version FROM wiki_section_sources WHERE id='source'").get()).toEqual({ source_hash: 'h2', source_mod_version: '2.0' })
		expect(c.sql.prepare("SELECT COUNT(*) AS n FROM wiki_audit_logs WHERE action='wiki.source_update.approve'").get()?.n).toBe(1)
	})
	it('rejects a source whose baseline changed during review', async () => {
		const c = setup(); source(c)
		c.state.beforeBatch = () => { c.sql.exec("UPDATE wiki_section_sources SET source_hash='h3' WHERE id='source'") }
		await expect(resolveSourceUpdate(c.db, { id: 'update', decision: 'approve', baseVersion: 1, actor: admin })).rejects.toMatchObject({ status: 409 })
		expect((await c.store.findSection('s1'))?.currentContent).toBe('baseline')
	})
	it('stale rollback cannot overwrite a revision published after the history page was read', async () => {
		const c = setup(); await publishRevision(c.store, publication('first')); await publishRevision(c.store, publication('second', 2))
		await expect(revertToRevision(c.store, { sectionId: 's1', revisionId: 'r1', baseVersion: 2, actor: admin })).rejects.toMatchObject({ status: 409 })
		expect((await c.store.findSection('s1'))?.currentContent).toBe('second')
		await revertToRevision(c.store, { sectionId: 's1', revisionId: 'r1', baseVersion: 3, actor: admin })
		expect(await c.store.listRevisions('s1', 100, 0)).toHaveLength(4)
	})
	it('only an author can withdraw a proposal and an approval cannot revive it', async () => {
		const c = setup(), p = await proposal(c)
		await expect(withdrawProposal(c.store, p.proposalId!, admin)).rejects.toMatchObject({ status: 403 })
		await withdrawProposal(c.store, p.proposalId!, member)
		await expect(reviewProposal(c.store, { proposalId: p.proposalId!, decision: 'approve', actor: admin })).rejects.toMatchObject({ status: 409 })
		expect((await c.store.findSection('s1'))?.version).toBe(1)
	})
	it('initializes missing card sections repeatedly while preserving existing IDs, text and history', async () => {
		const c = setup(); await publishRevision(c.store, publication('community intro'))
		await ensureCardSections(c.db, { id: 'Bash', mod: 'sts2' }); await ensureCardSections(c.db, { id: 'Bash', mod: 'sts2' })
		expect((await c.store.findSection('s1'))?.currentContent).toBe('community intro')
		expect(c.sql.prepare("SELECT COUNT(*) AS n FROM wiki_sections WHERE page_id='page'").get()?.n).toBe(7)
		expect(await c.store.listRevisions('s1', 100, 0)).toHaveLength(2)
		expect(c.sql.prepare('PRAGMA foreign_key_check').all()).toEqual([])
	})
	it('validates structured content before creating either a proposal or a revision', async () => {
		const c = setup(); c.sql.exec("UPDATE wiki_sections SET section_key='document',content_type='structured' WHERE id='s1'")
		await expect(submitSectionEdit(c.store, { sectionId: 's1', baseVersion: 1, content: 'not JSON', actor: member })).rejects.toMatchObject({ status: 400 })
		expect(c.sql.prepare('SELECT COUNT(*) AS n FROM wiki_edit_proposals').get()?.n).toBe(0)
	})
})
