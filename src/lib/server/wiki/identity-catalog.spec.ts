import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializePublicEntityRefs, resolvePublicEntityRef, type ScopedEntityRef } from '#lib/entities'
import { sqliteDb, seedSection } from './testing/sqlite-db'
import { canonicalCommentTarget, ensureCanonicalIdentities } from './identity-catalog'
import { loadWikiPage } from './page-service'
import { createCommentStore } from './repository'
import { createComment, listComments } from './comment-service'
import { syncModWiki } from '../../../../scripts/mod-wiki/sync.mjs'

const fixture = vi.hoisted(() => ({ refs: [] as ScopedEntityRef[] }))
vi.mock('#lib/data/mods', () => ({ MOD_CHARACTERS: [] }))
vi.mock('#lib/data/entities', async () => {
	const { resolvePublicEntityRef } = await import('#lib/entities')
	return {
		listEntityRefs: () => fixture.refs,
		findGameEntity: (ref: ScopedEntityRef) => {
			const resolved = resolvePublicEntityRef(ref)
			return resolved ? { kind: resolved.type, data: { id: resolved.id, mod: resolved.modId } } : null
		}
	}
})
const connections: ReturnType<typeof sqliteDb>[] = []
const base: ScopedEntityRef[] = [
	{ type: 'card', id: 'Bash', modId: 'sts2' },
	{ type: 'card', id: 'AbyssOfDeath', modId: 'fgo' },
	{ type: 'card', id: 'TeslaCoil', modId: 'sts2' },
	{ type: 'card', id: 'TeslaCoil', modId: 'fgo' }
]
function catalog(refs = base) { fixture.refs = refs; initializePublicEntityRefs(refs) }
beforeEach(() => { catalog() })
afterEach(() => { for (const c of connections.splice(0)) c.close() })
function setup() { const c = sqliteDb(); connections.push(c); seedSection(c.sql); return c }
const commentInput = { content: 'new discussion', authorName: 'Anonymous', token: 'owner-token-0123456789abcdef' }

describe('canonical wiki and comment read boundary', () => {
	it('keeps a first discussion visible when a vanilla page is initialized afterwards', async () => {
		const c = setup(); catalog([...base, { type: 'card', id: 'Fresh', modId: 'sts2' }])
		const before = await canonicalCommentTarget(c.db, 'card', 'Fresh')
		expect(before.targetId).toBe('sts2:Fresh')
		const posted = await createComment(createCommentStore(c.db), { ...commentInput, ...before })
		await loadWikiPage(c.db, { type: 'card', id: 'Fresh' })
		const after = await canonicalCommentTarget(c.db, 'card', 'Fresh')
		expect(after).toEqual(before)
		expect((await listComments(createCommentStore(c.db), after)).items.map((c) => c.id)).toEqual([posted.id])
	})
	it('detects a late legacy page without any catalog change or process restart', async () => {
		const c = setup(); await ensureCanonicalIdentities(c.db)
		c.sql.exec("INSERT INTO wiki_pages(id,page_type,entity_type,entity_id,mod_id,slug) VALUES ('late','entity','card','AbyssOfDeath','fgo','card:AbyssOfDeath')")
		await ensureCanonicalIdentities(c.db)
		expect(c.sql.prepare("SELECT entity_id FROM wiki_pages WHERE id='late'").get()?.entity_id).toBe('fgo:AbyssOfDeath')
	})
	it('detects and quarantines late unattributed comments without a catalog change', async () => {
		const c = setup(); await ensureCanonicalIdentities(c.db)
		c.sql.exec(`INSERT INTO comments(id,target_type,target_id,author_name,author_token_hash,content)
			VALUES ('late','card','AbyssOfDeath','Anonymous','original-owner','late legacy import')`)
		await ensureCanonicalIdentities(c.db)
		expect(c.sql.prepare("SELECT target_id,content FROM comments WHERE id='late'").get()).toEqual({ target_id: 'AbyssOfDeath', content: 'late legacy import' })
		expect(c.sql.prepare("SELECT comment_id FROM wiki_comment_identity_archives WHERE comment_id='late'").get()?.comment_id).toBe('late')
	})
	it('normalizes a late direct sync payload and observes the data change after memoized reconciliation', async () => {
		const c = setup(); await ensureCanonicalIdentities(c.db)
		await syncModWiki(c.db, { errors: [], mods: [{ id: 'fgo', version: '1', wikiManifest: 'content/wiki/fgo/manifest.json' }], pages: [], files: [{
			modId: 'fgo', modVersion: '1', pageSlug: 'late', pageType: 'documentation', pageTitle: 'Late',
			entityType: 'card', entityId: 'AbyssOfDeath', sectionKey: 'overview', sectionTitle: 'Overview', sortOrder: 0,
			sourcePath: 'content/wiki/fgo/late.md', contentHash: 'late-hash', content: 'late article'
		}] })
		expect(c.sql.prepare("SELECT entity_id,entity_mod_id FROM wiki_pages WHERE id='modpage:fgo:late'").get()).toEqual({ entity_id: 'fgo:AbyssOfDeath', entity_mod_id: 'fgo' })
		const before = c.sql.prepare('SELECT data_epoch FROM wiki_identity_current WHERE id=1').get()?.data_epoch
		expect(before).not.toBe(c.sql.prepare('SELECT version FROM wiki_identity_data_epoch WHERE id=1').get()?.version)
		await ensureCanonicalIdentities(c.db)
		expect(c.sql.prepare('SELECT data_epoch FROM wiki_identity_current WHERE id=1').get()?.data_epoch).toBe(c.sql.prepare('SELECT version FROM wiki_identity_data_epoch WHERE id=1').get()?.version)
	})
	it('serves a unique Fgo legacy page through its canonical public ID without changing history IDs', async () => {
		const c = setup()
		c.sql.exec("UPDATE wiki_pages SET entity_id='AbyssOfDeath',slug='card:AbyssOfDeath',mod_id='fgo' WHERE id='page'")
		const view = await loadWikiPage(c.db, { type: 'card', id: 'fgo:AbyssOfDeath' })
		expect(view.meta).toMatchObject({ pageId: 'page', key: 'card:fgo:AbyssOfDeath', source: 'd1' })
		expect(view.sections.find((s) => s.key === 'overview')).toMatchObject({ sectionId: 's1', revisionId: 'r1', content: 'baseline' })
		expect(await canonicalCommentTarget(c.db, 'card', 'AbyssOfDeath')).toEqual({ targetType: 'card', targetId: 'fgo:AbyssOfDeath' })
	})
	it('rejects bare collisions and keeps canonical discussions separate from the ambiguous archive', async () => {
		const c = setup()
		c.sql.exec(`UPDATE wiki_pages SET entity_id='TeslaCoil',slug='card:TeslaCoil',mod_id='fgo' WHERE id='page';
			INSERT INTO comments(id,target_type,target_id,author_name,author_token_hash,content)
			VALUES ('legacy','card','TeslaCoil','Anonymous','old-owner','ambiguous old comment')`)
		await expect(canonicalCommentTarget(c.db, 'card', 'TeslaCoil')).rejects.toMatchObject({ status: 404 })
		expect((await loadWikiPage(c.db, { type: 'card', id: 'TeslaCoil' })).game).toBeNull()
		const vanilla = await loadWikiPage(c.db, { type: 'card', id: 'sts2:TeslaCoil' })
		const mod = await loadWikiPage(c.db, { type: 'card', id: 'fgo:TeslaCoil' })
		expect(vanilla.meta.pageId).not.toBe(mod.meta.pageId)
		expect(vanilla.meta.pageId).not.toBe('page')
		for (const id of ['sts2:TeslaCoil', 'fgo:TeslaCoil']) {
			const target = await canonicalCommentTarget(c.db, 'card', id)
			expect((await listComments(createCommentStore(c.db), target)).items).toEqual([])
		}
		expect(c.sql.prepare("SELECT content FROM comments WHERE id='legacy'").get()?.content).toBe('ambiguous old comment')
	})
	it('retains scoped vanilla history and comments when the collision disappears and returns', async () => {
		const c = setup()
		const first = await loadWikiPage(c.db, { type: 'card', id: 'sts2:TeslaCoil' })
		const originalIds = first.sections.map((s) => [s.sectionId, s.revisionId])
		const target = await canonicalCommentTarget(c.db, 'card', 'sts2:TeslaCoil')
		await createComment(createCommentStore(c.db), { ...commentInput, ...target })
		catalog(base.filter((r) => !(r.modId === 'fgo' && r.id === 'TeslaCoil')))
		const without = await loadWikiPage(c.db, { type: 'card', id: 'TeslaCoil' })
		expect(without.meta.pageId).toBe(first.meta.pageId)
		expect(without.sections.map((s) => [s.sectionId, s.revisionId])).toEqual(originalIds)
		const plain = await canonicalCommentTarget(c.db, 'card', 'TeslaCoil')
		expect(plain.targetId).toBe('sts2:TeslaCoil')
		expect((await listComments(createCommentStore(c.db), plain)).total).toBe(1)
		catalog()
		const returned = await loadWikiPage(c.db, { type: 'card', id: 'sts2:TeslaCoil' })
		expect(returned.meta.pageId).toBe(first.meta.pageId)
		expect(returned.sections.map((s) => [s.sectionId, s.revisionId])).toEqual(originalIds)
		expect(c.sql.prepare("SELECT COUNT(*) AS n FROM wiki_pages WHERE entity_id LIKE '%TeslaCoil'").get()?.n).toBe(1)
	})
	it('pins first use before a new conflict arrives, preserving the original bare vanilla history', async () => {
		const c = setup()
		catalog(base.filter((r) => !(r.modId === 'fgo' && r.id === 'TeslaCoil')))
		const first = await loadWikiPage(c.db, { type: 'card', id: 'TeslaCoil' })
		const target = await canonicalCommentTarget(c.db, 'card', 'TeslaCoil')
		await createComment(createCommentStore(c.db), { ...commentInput, ...target })
		catalog()
		const next = await loadWikiPage(c.db, { type: 'card', id: 'sts2:TeslaCoil' })
		expect(next.meta.pageId).toBe(first.meta.pageId)
		expect((await canonicalCommentTarget(c.db, 'card', 'sts2:TeslaCoil')).targetId).toBe('sts2:TeslaCoil')
		expect(c.sql.prepare('SELECT COUNT(*) AS n FROM wiki_comment_identity_archives').get()?.n).toBe(0)
		expect(c.sql.prepare("SELECT target_id FROM comments WHERE content='new discussion'").get()?.target_id).toBe('sts2:TeslaCoil')
	})
	it('fails closed on a legacy alias whose immutable owner differs from the current unique entity', async () => {
		const c = setup()
		c.sql.exec("UPDATE wiki_pages SET entity_id='AbyssOfDeath',slug='card:AbyssOfDeath',mod_id='fgo' WHERE id='page'")
		await ensureCanonicalIdentities(c.db)
		catalog([{ type: 'card', id: 'AbyssOfDeath', modId: 'other' }])
		expect(resolvePublicEntityRef({ type: 'card', id: 'AbyssOfDeath' })?.modId).toBe('other')
		await expect(canonicalCommentTarget(c.db, 'card', 'AbyssOfDeath')).rejects.toMatchObject({ status: 409 })
		expect(await canonicalCommentTarget(c.db, 'card', 'other:AbyssOfDeath')).toEqual({ targetType: 'card', targetId: 'other:AbyssOfDeath' })
	})
})
