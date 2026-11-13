import { describe, expect, it } from 'vitest'
import { createWikiEditStore } from './collaboration-repository'
import type { PublishInput } from './collaboration-types'

interface Recorded {
	sql: string
	params: unknown[]
}

function fakeDb(linkedVersion: number | null = 4) {
	const batchCalls: Recorded[][] = []
	const runCalls: Recorded[] = []
	const firstCalls: Recorded[] = []
	let linked = linkedVersion

	const db = {
		prepare(sql: string) {
			const record: Recorded = { sql, params: [] }
			const statement = {
				bind(...values: unknown[]) {
					record.params = values
					return statement
				},
				async first() {
					firstCalls.push({ sql, params: [...record.params] })
					if (sql.includes('SELECT version FROM wiki_sections'))
						return linked === null ? null : { version: linked }
					return null
				},
				async all() {
					return { results: [], success: true, meta: {} }
				},
				async run() {
					runCalls.push({ sql, params: [...record.params] })
					return { results: [], success: true, meta: { changes: 1 } }
				},
				__record: record
			}
			return statement
		},
		async batch(statements: { __record: Recorded }[]) {
			batchCalls.push(
				statements.map((item) => ({ sql: item.__record.sql, params: [...item.__record.params] }))
			)
			return statements.map(() => ({ results: [], success: true, meta: { changes: linked === null ? 0 : 1 } }))
		}
	}

	return {
		db: db as unknown as D1Database,
		batchCalls,
		runCalls,
		firstCalls,
		setLinked(version: number | null) {
			linked = version
		}
	}
}

const input = (overrides: Partial<PublishInput> = {}): PublishInput => ({
	revisionId: 'rev-new',
	sectionId: 's1',
	revisionNo: 4,
	parentRevisionId: 'rev-3',
	content: 'new content',
	summary: 'edit',
	editorId: 'u-trusted',
	sourceType: 'community',
	sourceReference: null,
	expectedVersion: 3,
	createdAt: '2026-02-02T00:00:00.000Z',
	actorId: 'u-trusted',
	...overrides
})

describe('D1 publish transaction', () => {
	it('guards every statement with the section version', async () => {
		const fake = fakeDb(4)
		const result = await createWikiEditStore(fake.db).publish(input())
		expect(result).toEqual({ published: true, version: 4, conflict: false })
		expect(fake.batchCalls).toHaveLength(1)
		const statements = fake.batchCalls[0]!
		expect(statements).toHaveLength(3)
		expect(statements[0].sql).toContain('MAX(revision_no)')
		expect(statements[0].sql).toContain('WHERE EXISTS')
		expect(statements[0].params).toContain(3)
		expect(statements[1].sql).toContain('AND version = ?')
		expect(statements[1].params).toEqual([
			'rev-new',
			'2026-02-02T00:00:00.000Z',
			's1',
			3,
			'rev-new'
		])
		// The audit row is only written if the publish actually landed.
		expect(statements[2].sql).toContain('current_revision_id = ? AND version = ?')
		expect(statements[2].params).toContain(4)
	})

	it('closes the proposal inside the same transaction when approving', async () => {
		const fake = fakeDb(4)
		await createWikiEditStore(fake.db).publish(input({ proposalId: 'p1', reviewNote: 'ok' }))
		const statements = fake.batchCalls[0]!
		expect(statements).toHaveLength(4)
		expect(statements[2].sql).toContain("status = 'approved'")
		expect(statements[2].sql).toContain("status = 'pending'")
		expect(statements[2].params).toContain('p1')
	})

	it('reports a transaction conflict without reading the later head or deleting history', async () => {
		const fake = fakeDb(null)
		const result = await createWikiEditStore(fake.db).publish(input())
		expect(result.conflict).toBe(true)
		expect(result.published).toBe(false)
		expect(fake.firstCalls.some((call) => call.sql.includes('SELECT version'))).toBe(false)
		expect(
			fake.runCalls.some(
				(call) =>
					call.sql.includes('DELETE FROM wiki_revisions') && call.sql.includes('NOT EXISTS')
			)
		).toBe(false)
	})

	it('aliases D1 columns to the camelCase store contract', async () => {
		const fake = fakeDb(4)
		const store = createWikiEditStore(fake.db)
		await store.findSection('s1')
		const sql = fake.firstCalls[0]?.sql ?? ''
		for (const alias of [
			'AS pageId',
			'AS sectionKey',
			'AS contentType',
			'AS currentRevisionId',
			'AS currentContent'
		]) {
			expect(sql).toContain(alias)
		}
		await store.findRevision('rev-1')
		expect(fake.firstCalls[1]?.sql).toContain('AS editorName')
	})

	it('never binds undefined values to D1', async () => {
		const fake = fakeDb(4)
		await createWikiEditStore(fake.db).publish(
			input({ actorId: undefined, reviewNote: undefined })
		)
		for (const statement of fake.batchCalls[0] ?? []) {
			expect(statement.params.every((param) => param !== undefined)).toBe(true)
		}
	})

	it('only updates a proposal that is still pending', async () => {
		const fake = fakeDb(4)
		const changes = await createWikiEditStore(fake.db).setProposalStatus('p1', {
			status: 'rejected',
			reviewedBy: 'u-mod',
			onlyIfStatus: 'pending'
		})
		expect(changes).toBe(1)
		const sql = fake.runCalls[0]?.sql ?? ''
		expect(sql).toContain('status = ?')
		expect(sql).toContain('AND status = ?')
		expect(fake.runCalls[0]?.params).toContain('pending')
	})
})
