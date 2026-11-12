import { describe, expect, it } from 'vitest'
import type { WikiSourceUpdateRow } from './types'
import {
	getSourceUpdateDetail,
	resolveSourceUpdate
} from './source-update-service'

interface Recorded {
	sql: string
	params: unknown[]
}

const UPDATE: WikiSourceUpdateRow = {
	id: 'upd-1',
	source_id: 'src-1',
	section_id: 's1',
	base_content: 'upstream v1',
	current_content: 'community edit',
	incoming_content: 'upstream v2',
	base_hash: 'sha256:v1',
	incoming_hash: 'sha256:v2',
	status: 'conflict',
	reviewed_by: null,
	review_note: null,
	created_at: '2026-02-01T00:00:00.000Z',
	reviewed_at: null,
	published_revision_id: null
}

const SECTION = {
	id: 's1',
	page_id: 'page-1',
	section_key: 'overview',
	content_type: 'markdown',
	sort_order: 0,
	version: 2,
	current_revision_id: 'rev-2',
	current_content: 'community edit',
	updated_at: '2026-02-01T00:00:00.000Z'
}

const SOURCE = {
	id: 'src-1',
	section_id: 's1',
	source_type: 'mod',
	source_path: 'static/mods/sts2/wiki/index/overview.md',
	source_hash: 'sha256:v1',
	source_content: 'upstream v1',
	source_mod_version: '1.0.0',
	source_status: 'active',
	last_synced_at: '2026-02-01T00:00:00.000Z',
	created_at: '2026-02-01T00:00:00.000Z',
	updated_at: '2026-02-01T00:00:00.000Z'
}

function fakeDb(initial: WikiSourceUpdateRow = UPDATE) {
	const runs: Recorded[] = []
	let batchCount = 0
	let update = { ...initial }
	let source = { ...SOURCE }

	const db = {
		prepare(sql: string) {
			const record: Recorded = { sql, params: [] }
			const statement = {
				bind(...values: unknown[]) {
					record.params = values
					return statement
				},
				async first() {
					if (sql.includes('FROM wiki_source_updates WHERE id')) return { ...update }
					if (sql.includes('FROM wiki_sections s')) return { ...SECTION }
					if (sql.includes('FROM wiki_section_sources WHERE section_id')) return { ...source }
					if (sql.includes('MAX(revision_no)')) return { value: 2 }
					if (sql.includes('SELECT version FROM wiki_sections')) return { version: 3 }
					return null
				},
				async all() {
					return { results: [], success: true, meta: {} }
				},
				async run() {
					runs.push({ sql, params: [...record.params] })
					if (sql.includes('SET status = ?, reviewed_by')) {
						update = {
							...update,
							status: record.params[0] as WikiSourceUpdateRow['status'],
							reviewed_by: record.params[1] as string,
							review_note: record.params[2] as string | null,
							published_revision_id: record.params[3] as string | null
						}
					}
					if (sql.includes('SET source_hash')) {
						source = { ...source, source_hash: record.params[0] as string }
					}
					return { results: [], success: true, meta: { changes: 1 } }
				},
				__record: record
			}
			return statement
		},
		async batch(statements: unknown[]) {
			batchCount += 1
			return statements.map(() => ({ results: [], success: true, meta: { changes: 1 } }))
		}
	}

	return {
		db: db as unknown as D1Database,
		runs,
		get batches() {
			return batchCount
		},
		get status() {
			return update.status
		}
	}
}

const admin = { userId: 'u-admin', username: 'Admin', role: 'admin', status: 'active' } as const
const member = { userId: 'u-member', username: 'Member', role: 'member', status: 'active' } as const

describe('mod upstream conflict resolution', () => {
	it('computes upstream and community-facing diffs', async () => {
		const fake = fakeDb()
		const detail = await getSourceUpdateDetail(fake.db, 'upd-1')
		expect(detail?.hasCommunityDrift).toBe(true)
		expect(detail?.upstreamDiff.additions).toBe(1)
		expect(detail?.conflictDiff.additions).toBe(1)
		expect(detail?.sourcePath).toBe(SOURCE.source_path)
	})

	it('requires the source review permission on the server', async () => {
		const fake = fakeDb()
		await expect(
			resolveSourceUpdate(fake.db, { id: 'upd-1', decision: 'approve', actor: member })
		).rejects.toMatchObject({ status: 403 })
		expect(fake.batches).toBe(0)
	})

	it('approval publishes a new revision, refreshes the source and records the reviewer', async () => {
		const fake = fakeDb()
		const detail = await resolveSourceUpdate(fake.db, {
			id: 'upd-1',
			decision: 'approve',
			note: 'checked upstream',
			actor: admin
		})
		expect(fake.batches).toBe(1)
		expect(detail.status).toBe('approved')
		expect(detail.publishedRevisionId).toBeTruthy()
		expect(
			fake.runs.some((run) => run.sql.includes('SET source_hash') && run.params[0] === 'sha256:v2')
		).toBe(true)
		expect(
			fake.runs.some((run) => run.params.includes('wiki.source_update.approve'))
		).toBe(true)
	})

	it('rejection keeps published content and the source snapshot untouched', async () => {
		const fake = fakeDb()
		const detail = await resolveSourceUpdate(fake.db, {
			id: 'upd-1',
			decision: 'reject',
			actor: admin
		})
		expect(fake.batches).toBe(0)
		expect(detail.status).toBe('rejected')
		expect(detail.publishedRevisionId).toBeNull()
		expect(fake.runs.some((run) => run.sql.includes('SET source_hash'))).toBe(false)
	})

	it('refuses to resolve an already reviewed update', async () => {
		const fake = fakeDb({ ...UPDATE, status: 'approved' })
		await expect(
			resolveSourceUpdate(fake.db, { id: 'upd-1', decision: 'approve', actor: admin })
		).rejects.toMatchObject({ status: 409 })
		expect(fake.batches).toBe(0)
	})
})
