import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

/** Executes the production SQL, with immediate foreign keys and transactional D1 batches. */
export function sqliteDb(options: { migrations?: boolean } = {}) {
	const sql = new DatabaseSync(':memory:')
	sql.exec('PRAGMA foreign_keys = ON')
	const state: { beforeBatch?: () => void | Promise<void>; afterBatch?: () => void | Promise<void> } = {}
	const db = {
		prepare(query: string) {
			let params: unknown[] = []
			const statement = {
				bind(...values: unknown[]) { params = values; return statement },
				async first(column?: string) {
					const row = sql.prepare(query).get(...params as never[]) ?? null
					return column && row ? row[column] : row
				},
				async all() { return { results: sql.prepare(query).all(...params as never[]), success: true, meta: {} } },
				async run() { return statement.execute() },
				execute() {
					const meta = sql.prepare(query).run(...params as never[])
					return { results: [], success: true, meta: { changes: Number(meta.changes) } }
				}
			}
			return statement
		},
		async batch(statements: { execute(): unknown }[]) {
			const before = state.beforeBatch
			state.beforeBatch = undefined
			if (before) await before()
			sql.exec('BEGIN')
			let results: unknown[]
			try { results = statements.map((s) => s.execute()); sql.exec('COMMIT') }
			catch (cause) { sql.exec('ROLLBACK'); throw cause }
			const after = state.afterBatch
			state.afterBatch = undefined
			if (after) await after()
			return results
		}
	}
	if (options.migrations !== false)
		for (const file of readdirSync(resolve('migrations')).filter((name) => name.endsWith('.sql')).sort())
			sql.exec(readFileSync(resolve('migrations', file), 'utf8'))
	return { db: db as unknown as D1Database, sql, state, close: () => sql.close() }
}

export function seedSection(sql: DatabaseSync) {
	sql.exec(`INSERT INTO users (id, auth_subject, username, role) VALUES ('u-admin', 'admin', 'Admin', 'admin'),
		('u-member', 'member', 'Member', 'member'), ('u-mod', 'moderator', 'Moderator', 'moderator');
		INSERT INTO wiki_pages (id, entity_type, entity_id, slug) VALUES ('page', 'card', 'Bash', 'card:Bash');
		INSERT INTO wiki_sections (id, page_id, section_key) VALUES ('s1', 'page', 'overview');
		INSERT INTO wiki_revisions (id, section_id, revision_no, content) VALUES ('r1', 's1', 1, 'baseline');
		UPDATE wiki_sections SET version = 1, current_revision_id = 'r1' WHERE id = 's1';`)
}
