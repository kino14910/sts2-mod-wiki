import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { syncModWiki } from '../../../../scripts/mod-wiki/sync.mjs'
import { scanModWiki as scan } from '../../../../scripts/mod-wiki/scan.mjs'
import { sqliteDb } from './testing/sqlite-db'
import { createWikiEditStore } from './collaboration-repository'
import { publishRevision } from './publish-service'

const roots: string[] = [], connections: ReturnType<typeof sqliteDb>[] = []
afterEach(() => { for (const c of connections.splice(0)) c.close(); for (const r of roots.splice(0)) fs.rmSync(r, { recursive: true, force: true }) })
function fixture() { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-source-import-')); roots.push(root); const c = sqliteDb(); connections.push(c); return { root, ...c } }
function write(root: string, relative: string, value: unknown) {
	const target = path.join(root, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value))
}
function content(root: string, text: string, modern = true, version = '1.0') {
	const dir = modern ? 'content/wiki/fgo' : 'static/mods/fgo/wiki'
	write(root, modern ? 'generated/mods/fgo/bundle.json' : 'static/mods/fgo/manifest.json', modern ? { manifest: { id: 'fgo', version } } : { id: 'fgo', version })
	write(root, `${dir}/manifest.json`, { pages: [{ slug: 'index', sections: [{ key: 'overview', file: 'overview.md' }] }] })
	write(root, `${dir}/overview.md`, text)
}
async function edit(c: ReturnType<typeof fixture>, text: string) {
	c.sql.exec("INSERT OR IGNORE INTO users (id,auth_subject,username,role) VALUES ('editor','editor','Editor','trusted')")
	return publishRevision(createWikiEditStore(c.db), { sectionId: 'modsection:fgo:index:overview', expectedVersion: 1, content: text,
		summary: 'community', editorId: 'editor', sourceType: 'community', sourceReference: null })
}

describe('wiki content scanner and transactional synchronization', () => {
	it('rejects an invalid direct source namespace before any section in the batch writes', async () => {
		const c = fixture(); content(c.root, 'baseline')
		const scanned = scan(c.root)
		const first = scanned.files[0]
		await expect(syncModWiki(c.db, { ...scanned, files: [first, { ...first, pageSlug: 'invalid', entityType: 'card', entityId: 'sts2:Bash', entityModId: 'fgo' }] })).rejects.toThrow('Invalid source entity namespace')
		expect(c.sql.prepare("SELECT COUNT(*) AS n FROM wiki_pages WHERE mod_id='fgo'").get()?.n).toBe(0)
	})
	it('uses canonical namespaced source entity references without replacing page/section/source IDs', async () => {
		const c = fixture(); content(c.root, 'baseline')
		write(c.root, 'generated/mods/fgo/bundle.json', { manifest: { id: 'fgo', version: '1' }, data: { cards: [{ id: 'TeslaCoil' }] } })
		write(c.root, 'static/mods/sts2/cards.json', [{ id: 'TeslaCoil' }])
		write(c.root, 'content/wiki/fgo/manifest.json', { pages: [{ slug: 'index', entity: { type: 'card', id: 'TeslaCoil' }, sections: [{ key: 'overview', file: 'overview.md' }] }] })
		const scanned = scan(c.root)
		expect(scanned.files[0].entityId).toBe('fgo:TeslaCoil')
		await syncModWiki(c.db, scanned)
		c.sql.exec("UPDATE wiki_pages SET entity_id='TeslaCoil' WHERE id='modpage:fgo:index'")
		await syncModWiki(c.db, scanned)
		expect(c.sql.prepare("SELECT id,entity_id FROM wiki_pages WHERE id='modpage:fgo:index'").get()).toEqual({ id: 'modpage:fgo:index', entity_id: 'fgo:TeslaCoil' })
		expect(c.sql.prepare("SELECT id,section_id FROM wiki_section_sources WHERE id='modsource:fgo:index:overview'").get()).toEqual({ id: 'modsource:fgo:index:overview', section_id: 'modsection:fgo:index:overview' })
		expect(c.sql.prepare("SELECT COUNT(*) AS n FROM wiki_revisions WHERE section_id='modsection:fgo:index:overview'").get()?.n).toBe(1)
	})
	it('keeps the referenced entity namespace separate from the editorial Mod for cross-mod articles', async () => {
		const c = fixture(); content(c.root, 'cross-mod article')
		write(c.root, 'static/mods/sts2/cards.json', [{ id: 'Bash' }])
		write(c.root, 'content/wiki/fgo/manifest.json', { pages: [{ slug: 'index', entity: { type: 'card', id: 'sts2:Bash' }, sections: [{ key: 'overview', file: 'overview.md' }] }] })
		await syncModWiki(c.db, scan(c.root))
		expect(c.sql.prepare("SELECT mod_id,entity_id,entity_mod_id FROM wiki_pages WHERE id='modpage:fgo:index'").get()).toEqual({ mod_id: 'fgo', entity_id: 'Bash', entity_mod_id: 'sts2' })
		const { migrateEntityIdentities } = await import('./entity-identity')
		await migrateEntityIdentities(c.db, [{ type: 'card', rawId: 'Bash', modId: 'sts2', publicId: 'Bash' }])
		expect(c.sql.prepare("SELECT identity_status,mod_id,entity_mod_id FROM wiki_pages WHERE id='modpage:fgo:index'").get()).toEqual({ identity_status: 'active', mod_id: 'fgo', entity_mod_id: 'sts2' })
	})
	it('prioritizes content/wiki over legacy content and uses generated mod metadata', () => {
		const c = fixture(); content(c.root, 'legacy', false); content(c.root, 'modern', true, '2.5')
		const result = scan(c.root)
		expect(result.errors).toEqual([])
		expect(result.files).toHaveLength(1)
		expect(result.files[0]).toMatchObject({ sourcePath: 'content/wiki/fgo/overview.md', content: 'modern', modVersion: '2.5' })
	})
	it('imports repeatably, preserves a renamed source ID and retains both source paths', async () => {
		const c = fixture(); content(c.root, 'baseline', false)
		await syncModWiki(c.db, scan(c.root)); const before = c.sql.prepare('SELECT id FROM wiki_section_sources').get()?.id
		content(c.root, 'baseline', true)
		await syncModWiki(c.db, scan(c.root)); await syncModWiki(c.db, scan(c.root))
		expect(c.sql.prepare('SELECT id,source_path FROM wiki_section_sources').get()).toEqual({ id: before, source_path: 'content/wiki/fgo/overview.md' })
		expect(c.sql.prepare('SELECT source_path FROM wiki_source_paths ORDER BY source_path').all()).toEqual([
			{ source_path: 'content/wiki/fgo/overview.md' }, { source_path: 'static/mods/fgo/wiki/overview.md' }
		])
		expect(c.sql.prepare("SELECT COUNT(*) AS n FROM wiki_revisions WHERE section_id='modsection:fgo:index:overview'").get()?.n).toBe(1)
	})
	it('publishes an unchanged community baseline and advances upstream metadata atomically', async () => {
		const c = fixture(); content(c.root, 'baseline'); await syncModWiki(c.db, scan(c.root))
		content(c.root, 'upstream v2', true, '2.0'); await syncModWiki(c.db, scan(c.root))
		expect(c.sql.prepare('SELECT source_content,source_mod_version FROM wiki_section_sources').get()).toEqual({ source_content: 'upstream v2', source_mod_version: '2.0' })
		expect(c.sql.prepare("SELECT version FROM wiki_sections WHERE id='modsection:fgo:index:overview'").get()?.version).toBe(2)
	})
	it('preserves a concurrent community publication with no orphan revision and creates a conflict on retry', async () => {
		const c = fixture(); content(c.root, 'baseline'); await syncModWiki(c.db, scan(c.root)); content(c.root, 'incoming')
		c.state.beforeBatch = async () => { await edit(c, 'community') }
		const result = await syncModWiki(c.db, scan(c.root))
		expect(result.plan[0].case).toBe('RETRY')
		expect(c.sql.prepare("SELECT COUNT(*) AS n FROM wiki_revisions WHERE section_id='modsection:fgo:index:overview'").get()?.n).toBe(2)
		expect(c.sql.prepare('SELECT source_content FROM wiki_section_sources').get()?.source_content).toBe('baseline')
		await syncModWiki(c.db, scan(c.root)); await syncModWiki(c.db, scan(c.root))
		expect(c.sql.prepare("SELECT COUNT(*) AS n FROM wiki_source_updates WHERE status='conflict'").get()?.n).toBe(1)
	})
	it('can present a previously withdrawn incoming hash again without primary-key collisions', async () => {
		const c = fixture(); content(c.root, 'baseline'); await syncModWiki(c.db, scan(c.root)); await edit(c, 'community')
		content(c.root, 'v2'); await syncModWiki(c.db, scan(c.root)); content(c.root, 'v3'); await syncModWiki(c.db, scan(c.root))
		content(c.root, 'v2'); await syncModWiki(c.db, scan(c.root))
		expect(c.sql.prepare("SELECT COUNT(*) AS n FROM wiki_source_updates WHERE status='conflict' AND incoming_content='v2'").get()?.n).toBe(1)
		expect(c.sql.prepare("SELECT COUNT(*) AS n FROM wiki_source_updates WHERE status='withdrawn'").get()?.n).toBe(2)
	})
	it('does not interpret a missing source checkout as deletion and withdraws candidates on explicit removal', async () => {
		const c = fixture(); content(c.root, 'baseline'); await syncModWiki(c.db, scan(c.root)); await edit(c, 'community')
		content(c.root, 'v2'); await syncModWiki(c.db, scan(c.root))
		await syncModWiki(c.db, { mods: [], pages: [], files: [], errors: [] })
		expect(c.sql.prepare('SELECT source_status FROM wiki_section_sources').get()?.source_status).toBe('active')
		write(c.root, 'content/wiki/fgo/manifest.json', { pages: [] }); await syncModWiki(c.db, scan(c.root))
		expect(c.sql.prepare('SELECT source_status FROM wiki_section_sources').get()?.source_status).toBe('deleted')
		expect(c.sql.prepare('SELECT status FROM wiki_source_updates').get()?.status).toBe('withdrawn')
		expect(c.sql.prepare('PRAGMA foreign_key_check').all()).toEqual([])
	})
	it('rolls back a complete import when audit insertion fails', async () => {
		const c = fixture(); content(c.root, 'baseline')
		c.sql.exec("CREATE TRIGGER fail_import_audit BEFORE INSERT ON wiki_audit_logs BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END")
		await expect(syncModWiki(c.db, scan(c.root))).rejects.toThrow('audit unavailable')
		expect(c.sql.prepare("SELECT COUNT(*) AS n FROM wiki_pages WHERE mod_id='fgo'").get()?.n).toBe(0)
		expect(c.sql.prepare('SELECT COUNT(*) AS n FROM wiki_section_sources').get()?.n).toBe(0)
	})
})
