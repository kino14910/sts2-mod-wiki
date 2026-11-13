import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { migrateEntityIdentities, type CatalogIdentity } from './entity-identity'
import { sqliteDb, seedSection } from './testing/sqlite-db'
import { ensureCardSections } from './card-initialization'
import { createCommentStore, findPageByEntity } from './repository'
import { listComments } from './comment-service'
import { createWikiEditStore } from './collaboration-repository'
import { publishRevision } from './publish-service'

const catalog: CatalogIdentity[] = [
	{ type: 'card', rawId: 'Bash', modId: 'sts2', publicId: 'Bash' },
	{ type: 'card', rawId: 'AbyssOfDeath', modId: 'fgo', publicId: 'fgo:AbyssOfDeath' },
	{ type: 'card', rawId: 'TeslaCoil', modId: 'sts2', publicId: 'sts2:TeslaCoil' },
	{ type: 'card', rawId: 'TeslaCoil', modId: 'fgo', publicId: 'fgo:TeslaCoil' }
]
const connections: ReturnType<typeof sqliteDb>[] = []
afterEach(() => { for (const c of connections.splice(0)) c.close() })
function setup(id: string) {
	const c = sqliteDb(); connections.push(c); seedSection(c.sql)
	c.sql.prepare("UPDATE wiki_pages SET entity_id=?,slug=?,mod_id='fgo' WHERE id='page'").run(id, `card:${id}`)
	c.sql.exec(`INSERT INTO comments(id,target_type,target_id,author_name,author_token_hash,content)
		SELECT 'comment','card',entity_id,'Anonymous','original-owner','old discussion' FROM wiki_pages WHERE id='page';
		INSERT INTO comments(id,target_type,target_id,parent_id,author_name,author_token_hash,content)
		SELECT 'reply','card',entity_id,'comment','Anonymous','reply-owner','old reply' FROM wiki_pages WHERE id='page';
		INSERT INTO wiki_section_sources(id,section_id,source_path,source_hash,source_content)
		VALUES ('source','s1','static/mods/fgo/wiki/card.md','baseline','baseline');
		INSERT INTO wiki_source_paths(source_path,source_id) VALUES ('static/mods/fgo/wiki/card.md','source');`)
	return c
}

describe('catalog-based non-destructive identity migration', () => {
	it('archives orphan bare comments without inferring their owner from the current catalog', async () => {
		const c = sqliteDb(); connections.push(c)
		c.sql.exec(`INSERT INTO comments(id,target_type,target_id,author_name,author_token_hash,content)
			VALUES ('orphan','card','AbyssOfDeath','Anonymous','original-owner','unattributed content')`)
		await migrateEntityIdentities(c.db, catalog)
		expect(c.sql.prepare("SELECT target_id FROM comments WHERE id='orphan'").get()?.target_id).toBe('AbyssOfDeath')
		expect(c.sql.prepare("SELECT comment_id FROM wiki_comment_identity_archives WHERE comment_id='orphan'").get()?.comment_id).toBe('orphan')
		expect((await listComments(createCommentStore(c.db), { targetType: 'card', targetId: 'fgo:AbyssOfDeath' })).items).toEqual([])
	})
	it('retains page, section, revision, source, anonymous ownership and replies on a unique migration', async () => {
		const c = setup('AbyssOfDeath')
		await migrateEntityIdentities(c.db, catalog); await migrateEntityIdentities(c.db, catalog)
		expect(c.sql.prepare("SELECT id,entity_id,slug FROM wiki_pages WHERE id='page'").get()).toEqual({ id: 'page', entity_id: 'fgo:AbyssOfDeath', slug: 'card:fgo:AbyssOfDeath' })
		expect(c.sql.prepare("SELECT id,page_id,current_revision_id FROM wiki_sections WHERE id='s1'").get()).toEqual({ id: 's1', page_id: 'page', current_revision_id: 'r1' })
		expect(c.sql.prepare("SELECT id,content FROM wiki_revisions WHERE id='r1'").get()).toEqual({ id: 'r1', content: 'baseline' })
		expect(c.sql.prepare('SELECT id,target_id,parent_id,author_token_hash FROM comments ORDER BY id').all()).toEqual([
			{ id: 'comment', target_id: 'fgo:AbyssOfDeath', parent_id: null, author_token_hash: 'original-owner' },
			{ id: 'reply', target_id: 'fgo:AbyssOfDeath', parent_id: 'comment', author_token_hash: 'reply-owner' }
		])
		expect(c.sql.prepare("SELECT section_id,source_path FROM wiki_section_sources WHERE id='source'").get()).toEqual({ section_id: 's1', source_path: 'static/mods/fgo/wiki/card.md' })
		expect(c.sql.prepare("SELECT COUNT(*) AS n FROM wiki_identity_archives WHERE page_id='page'").get()?.n).toBe(0)
		expect(c.sql.prepare('PRAGMA foreign_key_check').all()).toEqual([])
	})
	it('quarantines ambiguous TeslaCoil despite legacy mod metadata and creates two independent empty pages', async () => {
		const c = setup('TeslaCoil')
		await migrateEntityIdentities(c.db, catalog)
		expect(c.sql.prepare("SELECT entity_id FROM wiki_pages WHERE id='page'").get()?.entity_id).toBe('TeslaCoil')
		expect(c.sql.prepare("SELECT reason FROM wiki_identity_archives WHERE page_id='page'").get()?.reason).toBe('ambiguous')
		expect(c.sql.prepare('SELECT COUNT(*) AS n FROM wiki_comment_identity_archives').get()?.n).toBe(2)
		await ensureCardSections(c.db, { id: 'sts2:TeslaCoil', mod: 'sts2' })
		await ensureCardSections(c.db, { id: 'fgo:TeslaCoil', mod: 'fgo' })
		expect(c.sql.prepare("SELECT COUNT(*) AS n FROM wiki_pages WHERE entity_type='card'").get()?.n).toBe(3)
		expect(c.sql.prepare("SELECT COUNT(*) AS n FROM wiki_sections WHERE page_id IN (SELECT id FROM wiki_pages WHERE entity_id IN ('sts2:TeslaCoil','fgo:TeslaCoil'))").get()?.n).toBe(14)
		expect(c.sql.prepare("SELECT target_id FROM comments WHERE id='comment'").get()?.target_id).toBe('TeslaCoil')
		expect(c.sql.prepare("SELECT candidates_json FROM wiki_identity_mappings WHERE entity_type='card' AND legacy_id='TeslaCoil'").get()?.candidates_json).toContain('sts2:TeslaCoil')
		expect(c.sql.prepare('PRAGMA foreign_key_check').all()).toEqual([])
	})
	it('does not merge or overwrite a canonical destination that already has independent history', async () => {
		const c = setup('AbyssOfDeath')
		await ensureCardSections(c.db, { id: 'fgo:AbyssOfDeath', mod: 'fgo' })
		c.sql.exec(`INSERT INTO comments(id,target_type,target_id,author_name,author_token_hash,content)
			VALUES ('canonical','card','fgo:AbyssOfDeath','New author','new-owner','independent new discussion')`)
		await migrateEntityIdentities(c.db, catalog)
		expect(c.sql.prepare("SELECT reason FROM wiki_identity_archives WHERE page_id='page'").get()?.reason).toBe('canonical_destination_exists')
		expect(c.sql.prepare("SELECT content FROM wiki_revisions WHERE id='r1'").get()?.content).toBe('baseline')
		expect(c.sql.prepare("SELECT target_id FROM comments WHERE id='comment'").get()?.target_id).toBe('AbyssOfDeath')
		expect(c.sql.prepare('SELECT COUNT(*) AS n FROM wiki_comment_identity_archives').get()?.n).toBe(2)
		expect((await listComments(createCommentStore(c.db), { targetType: 'card', targetId: 'fgo:AbyssOfDeath' })).items.map((c) => c.id)).toEqual(['canonical'])
		expect(c.sql.prepare("SELECT parent_id,author_token_hash FROM comments WHERE id='reply'").get()).toEqual({ parent_id: 'comment', author_token_hash: 'reply-owner' })
	})
	it('moves confirmed legacy vanilla comments and replies to fixed scoped storage atomically', async () => {
		const c = setup('Fresh'); c.sql.exec("UPDATE wiki_pages SET mod_id='sts2' WHERE id='page'")
		const fresh = [{ type: 'card' as const, rawId: 'Fresh', modId: 'sts2', publicId: 'Fresh' }]
		await migrateEntityIdentities(c.db, fresh)
		expect(c.sql.prepare('SELECT DISTINCT target_id FROM comments').all()).toEqual([{ target_id: 'sts2:Fresh' }])
		await ensureCardSections(c.db, { id: 'Fresh', mod: 'sts2' })
		expect((await listComments(createCommentStore(c.db), { targetType: 'card', targetId: 'sts2:Fresh' })).items[0]).toMatchObject({ id: 'comment', replies: [{ id: 'reply' }] })
		expect(c.sql.prepare('SELECT COUNT(*) AS n FROM comment_revisions').get()?.n).toBe(2)
		expect(c.sql.prepare('PRAGMA foreign_key_check').all()).toEqual([])
	})
	it('rolls back page, comment and audit changes if any transaction statement fails', async () => {
		const c = setup('AbyssOfDeath')
		c.sql.exec("CREATE TRIGGER fail_identity BEFORE INSERT ON wiki_identity_runs BEGIN SELECT RAISE(ABORT,'simulated failure'); END;")
		await expect(migrateEntityIdentities(c.db, catalog)).rejects.toThrow('simulated failure')
		expect(c.sql.prepare("SELECT entity_id FROM wiki_pages WHERE id='page'").get()?.entity_id).toBe('AbyssOfDeath')
		expect(c.sql.prepare("SELECT target_id FROM comments WHERE id='comment'").get()?.target_id).toBe('AbyssOfDeath')
		expect(c.sql.prepare("SELECT COUNT(*) AS n FROM wiki_audit_logs WHERE action LIKE 'wiki.identity.%'").get()?.n).toBe(0)
	})
	it('does not override an ownership decision committed immediately before reconciliation', async () => {
		const c = setup('AbyssOfDeath')
		c.sql.exec("UPDATE wiki_pages SET mod_id=NULL WHERE id='page'")
		c.state.beforeBatch = () => { c.sql.exec(`INSERT INTO wiki_identity_mappings
			(entity_type,legacy_id,resolution,owner_mod_id,canonical_id,candidates_json,catalog_hash)
			VALUES ('card','AbyssOfDeath','unique','fgo','fgo:AbyssOfDeath','[]','earlier-snapshot')`) }
		await migrateEntityIdentities(c.db, [{ type: 'card', rawId: 'AbyssOfDeath', modId: 'other', publicId: 'other:AbyssOfDeath' }])
		expect(c.sql.prepare("SELECT entity_id,identity_status FROM wiki_pages WHERE id='page'").get()).toEqual({ entity_id: 'AbyssOfDeath', identity_status: 'archived' })
		expect(c.sql.prepare("SELECT target_id FROM comments WHERE id='comment'").get()?.target_id).toBe('AbyssOfDeath')
		expect(c.sql.prepare("SELECT owner_mod_id FROM wiki_identity_mappings WHERE entity_type='card' AND legacy_id='AbyssOfDeath'").get()?.owner_mod_id).toBe('fgo')
	})
	it('keeps quarantined history quarantined after one of the conflicting mods disappears', async () => {
		const c = setup('TeslaCoil'); await migrateEntityIdentities(c.db, catalog)
		await migrateEntityIdentities(c.db, catalog.filter((e) => !(e.modId === 'fgo' && e.rawId === 'TeslaCoil')))
		expect(c.sql.prepare("SELECT entity_id FROM wiki_pages WHERE id='page'").get()?.entity_id).toBe('TeslaCoil')
		expect(c.sql.prepare("SELECT target_id FROM comments WHERE id='comment'").get()?.target_id).toBe('TeslaCoil')
		expect(c.sql.prepare('SELECT COUNT(*) AS n FROM wiki_comment_identity_archives').get()?.n).toBe(2)
		expect(c.sql.prepare("SELECT resolution FROM wiki_identity_mappings WHERE entity_type='card' AND legacy_id='TeslaCoil'").get()?.resolution).toBe('ambiguous')
	})
	it('does not transfer a retired Fgo page or its comments to a new sole owner', async () => {
		const c = setup('AbyssOfDeath')
		const replacement = [{ type: 'card' as const, rawId: 'AbyssOfDeath', modId: 'other', publicId: 'other:AbyssOfDeath' }]
		await migrateEntityIdentities(c.db, replacement)
		expect(c.sql.prepare("SELECT entity_id,mod_id,identity_status FROM wiki_pages WHERE id='page'").get()).toEqual({ entity_id: 'AbyssOfDeath', mod_id: 'fgo', identity_status: 'archived' })
		expect(c.sql.prepare("SELECT resolution,owner_mod_id FROM wiki_identity_mappings WHERE entity_type='card' AND legacy_id='AbyssOfDeath'").get()).toEqual({ resolution: 'owner_mismatch', owner_mod_id: 'fgo' })
		expect(c.sql.prepare("SELECT target_id FROM comments WHERE id='comment'").get()?.target_id).toBe('AbyssOfDeath')
		expect((await listComments(createCommentStore(c.db), { targetType: 'card', targetId: 'AbyssOfDeath' })).items).toEqual([])
		expect(await findPageByEntity(c.db, { type: 'card', id: 'AbyssOfDeath' })).toBeNull()
	})
	it('pins a first unique ownership decision and never redirects it after future ID reuse', async () => {
		const c = setup('AbyssOfDeath'); await migrateEntityIdentities(c.db, catalog)
		const first = c.sql.prepare("SELECT * FROM wiki_identity_mappings WHERE entity_type='card' AND legacy_id='AbyssOfDeath'").get()
		await migrateEntityIdentities(c.db, [{ type: 'card', rawId: 'AbyssOfDeath', modId: 'other', publicId: 'other:AbyssOfDeath' }])
		expect(c.sql.prepare("SELECT * FROM wiki_identity_mappings WHERE entity_type='card' AND legacy_id='AbyssOfDeath'").get()).toEqual(first)
		expect(c.sql.prepare("SELECT entity_id FROM wiki_pages WHERE id='page'").get()?.entity_id).toBe('fgo:AbyssOfDeath')
		expect(c.sql.prepare("SELECT target_id FROM comments WHERE id='comment'").get()?.target_id).toBe('fgo:AbyssOfDeath')
	})
	it('preserves an archived bare ID when a new vanilla entity later needs that same public ID', async () => {
		const c = setup('AbyssOfDeath')
		await migrateEntityIdentities(c.db, [{ type: 'card', rawId: 'AbyssOfDeath', modId: 'sts2', publicId: 'AbyssOfDeath' }])
		await ensureCardSections(c.db, { id: 'AbyssOfDeath', mod: 'sts2' })
		expect(c.sql.prepare("SELECT COUNT(*) AS n FROM wiki_pages WHERE entity_id IN ('AbyssOfDeath','sts2:AbyssOfDeath')").get()?.n).toBe(2)
		expect((await findPageByEntity(c.db, { type: 'card', id: 'sts2:AbyssOfDeath' }))?.mod_id).toBe('sts2')
		expect((await listComments(createCommentStore(c.db), { targetType: 'card', targetId: 'AbyssOfDeath' })).items).toEqual([])
		expect(c.sql.prepare("SELECT content FROM wiki_revisions WHERE id='r1'").get()?.content).toBe('baseline')
	})
	it('allows history reads while preventing publication into a quarantined section', async () => {
		const c = setup('TeslaCoil'); await migrateEntityIdentities(c.db, catalog)
		const store = createWikiEditStore(c.db)
		expect(await store.listRevisions('s1', 10, 0)).toHaveLength(1)
		await expect(publishRevision(store, { sectionId: 's1', expectedVersion: 1, content: 'misattributed', summary: '', editorId: null,
			sourceType: 'community', sourceReference: null })).rejects.toMatchObject({ code: 'IDENTITY_ARCHIVED' })
		expect(c.sql.prepare("SELECT content FROM wiki_revisions WHERE id='r1'").get()?.content).toBe('baseline')
	})
	it('confirms the real vanilla and built Fgo catalogs contain different TeslaCoil data', () => {
		const base = JSON.parse(readFileSync('static/mods/sts2/cards.json', 'utf8')) as { id: string; cost: number }[]
		const mod = JSON.parse(readFileSync('generated/mods/fgo/bundle.json', 'utf8')) as { data: { cards: { id: string; cost: number }[] } }
		expect(base.find((e) => e.id === 'TeslaCoil')?.cost).toBe(0)
		expect(mod.data.cards.find((e) => e.id === 'TeslaCoil')?.cost).toBe(1)
	})
})
