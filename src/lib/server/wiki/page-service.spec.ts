import { describe, expect, it } from 'vitest'
import { loadModWikiPage, loadWikiPage } from './page-service'
import { linkCurrentRevision } from './repository'
import type { WikiPageRow, WikiRevisionRow, WikiSectionRow } from './types'

interface FakeDbOptions {
	pages?: WikiPageRow[]
	sections?: WikiSectionRow[]
	revisions?: WikiRevisionRow[]
	fail?: boolean
	changes?: number
}

function fakeDb(options: FakeDbOptions = {}): D1Database {
	const prepare = (sql: string) => {
		let params: unknown[] = []
		const statement = {
			bind(...values: unknown[]) {
				params = values
				return statement
			},
			async first() {
				if (options.fail) throw new Error('D1 unavailable')
				if (!sql.includes('FROM wiki_pages')) return null
				const pages = options.pages ?? []
				if (sql.includes("page_type = 'mod'"))
					return pages.find((row) => row.mod_id === params[0] && row.slug === params[1]) ?? null
				return pages.find((row) => row.entity_type === params[0] && row.entity_id === params[1]) ?? null
			},
			async all() {
				if (options.fail) throw new Error('D1 unavailable')
				if (sql.includes('FROM wiki_sections'))
					return { results: options.sections ?? [], success: true, meta: {} }
				if (sql.includes('FROM wiki_revisions')) {
					const ids = new Set(params.map(String))
					return {
						results: (options.revisions ?? []).filter((row) => ids.has(row.id)),
						success: true,
						meta: {}
					}
				}
				return { results: [], success: true, meta: {} }
			},
			async run() {
				return { results: [], success: true, meta: { changes: options.changes ?? 0 } }
			}
		}
		return statement
	}
	return { prepare } as unknown as D1Database
}

const relicRef = { type: 'relic', id: 'CrackedCore' } as const
const pageRow: WikiPageRow = {
	id: 'page-1',
	mod_id: 'sts2',
	entity_type: 'relic',
	entity_id: 'CrackedCore',
	slug: 'relic:CrackedCore',
	page_type: 'entity',
	created_at: '2026-01-01T00:00:00.000Z'
}
const modPageRow = (modId: string, id: string): WikiPageRow => ({
	id,
	mod_id: modId,
	entity_type: null,
	entity_id: null,
	slug: 'index',
	page_type: 'mod',
	created_at: '2026-01-01T00:00:00.000Z'
})
const sectionRow: WikiSectionRow = {
	id: 'section-1',
	page_id: 'page-1',
	section_key: 'document',
	content_type: 'structured',
	sort_order: 0,
	current_revision_id: 'revision-1',
	version: 1,
	updated_at: '2026-01-01T00:00:00.000Z'
}
const revisionRow = (content: string): WikiRevisionRow => ({
	id: 'revision-1',
	section_id: 'section-1',
	revision_no: 1,
	parent_revision_id: null,
	content,
	summary: 'published',
	editor_id: null,
	source_type: 'mod_seed',
	source_reference: 'src/lib/data/relic-wiki.json#CrackedCore',
	created_at: '2026-01-01T00:00:00.000Z'
})

const storedDocument = (title: string) =>
	JSON.stringify({
		kind: 'relic',
		page: { title, sections: [] }
	})

describe('game data and wiki content separation', () => {
	it('combines read-only game data with D1 wiki sections under one stable key', async () => {
		const view = await loadWikiPage(
			fakeDb({ pages: [pageRow], sections: [sectionRow], revisions: [revisionRow(storedDocument('Cracked Core'))] }),
			relicRef
		)
		expect(view.meta.key).toBe('relic:CrackedCore')
		expect(view.meta.source).toBe('d1')
		expect(view.game?.kind).toBe('relic')
		expect(view.document?.kind).toBe('relic')
		expect(view.sections[0]?.sourceType).toBe('mod_seed')
		expect(view.sections[0]?.sourceReference).toContain('relic-wiki.json')
	})

	it('reads published content from D1 instead of any packaged seed', async () => {
		const view = await loadWikiPage(
			fakeDb({
				pages: [pageRow],
				sections: [sectionRow],
				revisions: [revisionRow(storedDocument('Edited by community'))]
			}),
			relicRef
		)
		expect(view.meta.pageId).toBe('page-1')
		expect(view.sections[0]?.version).toBe(1)
		if (view.document?.kind !== 'relic') throw new Error('expected a relic document')
		expect(view.document.page.title).toBe('Edited by community')
	})

	it('D1 is the only runtime content source', async () => {
		for (const db of [null, fakeDb(), fakeDb({ fail: true })]) {
			const view = await loadWikiPage(db, relicRef)
			expect(view.sections).toEqual([])
			expect(view.document).toBeNull()
			expect(view.game?.kind).toBe('relic')
			expect(view.meta.source).not.toBe('d1')
		}
	})

	it('does not store raw game data inside wiki sections', async () => {
		const view = await loadWikiPage(
			fakeDb({ pages: [pageRow], sections: [sectionRow], revisions: [revisionRow(storedDocument('Cracked Core'))] }),
			relicRef
		)
		const parsed = JSON.parse(view.sections[0]?.content ?? '{}')
		expect(parsed.cost).toBeUndefined()
		expect(parsed.rarity).toBeUndefined()
		expect(parsed.keywords).toBeUndefined()
		expect(view.game?.kind).toBe('relic')
	})

	it('returns no wiki sections for entities without a D1 page', async () => {
		const view = await loadWikiPage(fakeDb({ pages: [pageRow] }), { type: 'card', id: 'Abrasive' })
		expect(view.sections).toEqual([])
		expect(view.meta.source).toBe('none')
	})

	it('rejects invalid entity refs before any lookup', async () => {
		const view = await loadWikiPage(fakeDb(), { type: 'card', id: '' })
		expect(view.game).toBeNull()
		expect(view.sections).toEqual([])
	})

	it('resolves mod wiki pages by mod_id + slug', async () => {
		const db = fakeDb({
			pages: [modPageRow('fgo', 'page-fgo'), modPageRow('other', 'page-other')]
		})
		const fgo = await loadModWikiPage(db, 'fgo', 'index')
		const other = await loadModWikiPage(db, 'other', 'index')
		expect(fgo.meta.pageId).toBe('page-fgo')
		expect(other.meta.pageId).toBe('page-other')
		expect(fgo.meta.key).toBe('mod:fgo:index')
		expect(other.meta.key).toBe('mod:other:index')
	})

	it('exposes affected row counts for optimistic locking', async () => {
		expect(await linkCurrentRevision(fakeDb({ changes: 1 }), 'section-1', 1, 'revision-2')).toBe(1)
		expect(await linkCurrentRevision(fakeDb({ changes: 0 }), 'section-1', 1, 'revision-2')).toBe(0)
	})
})
