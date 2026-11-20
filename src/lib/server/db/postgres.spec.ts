import { describe, expect, it } from 'vitest'
import { createPostgresDatabase, translate } from './postgres'
import type { Pool } from 'pg'

describe('Postgres database compatibility translation', () => {
	it('numbers placeholders outside string literals only', () => {
		const result = translate("SELECT '?' AS literal, id FROM users WHERE id = ?", 0)
		expect(result.sql).toBe("SELECT '?' AS literal, id FROM users WHERE id = $1")
		expect(result.params).toEqual([])
	})

	it('sends bound values with translated placeholders', async () => {
		const calls: Array<{ sql: string; params: unknown[] }> = []
		const pool = {
			query: async (sql: string, params: unknown[]) => {
				calls.push({ sql, params })
				return { rows: [{ id: 'u-1' }], rowCount: 1 }
			}
		} as unknown as Pool
		const db = createPostgresDatabase(pool)
		const row = await db.prepare('SELECT id FROM users WHERE auth_subject = ?').bind('alice@qq.com').first()
		expect(row).toEqual({ id: 'u-1' })
		expect(calls).toEqual([{
			sql: 'SELECT id FROM users WHERE auth_subject = $1',
			params: ['alice@qq.com']
		}])
	})

	it('translates SQLite time and JSON helpers', () => {
		const now = translate("UPDATE users SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')", 0)
		expect(now.sql).toContain("to_char(now() AT TIME ZONE 'UTC'")

		const recent = translate("SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-60 seconds')", 0)
		expect(recent.sql).toContain("now() - interval '60 seconds'")

		const monotonic = translate("SELECT strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0.001 seconds')", 0)
		expect(monotonic.sql).toContain("updated_at::timestamp + interval '1 millisecond'")

		const json = translate(
			"SELECT json_object('userId', u.id), json_extract(l.metadata_json, '$.userId') FROM logs l JOIN users u ON u.id = json_extract(l.metadata_json, '$.userId')",
			0
		)
		expect(json.sql).toContain('jsonb_build_object(')
		expect(json.sql).toContain("(l.metadata_json ->> 'userId')")
	})

	it('turns INSERT OR IGNORE into a conflict-safe insert', () => {
		const result = translate('INSERT OR IGNORE INTO users (id) VALUES (?)', 0)
		expect(result.sql).toBe('INSERT INTO users (id) VALUES ($1) ON CONFLICT DO NOTHING')
	})

	it('uses previous batch row count for changes() guards', () => {
		const result = translate('INSERT INTO users (id) SELECT ? WHERE changes() = 1', 3)
		expect(result.sql).toBe('INSERT INTO users (id) SELECT $1 WHERE $2 = 1')
		expect(result.params).toEqual([3])
	})

	it('preserves null-safe comparison and boolean role guards', () => {
		const nullSafe = translate('UPDATE wiki_sections SET current_revision_id = ? WHERE current_revision_id IS ?', 0)
		expect(nullSafe.sql).toContain('current_revision_id IS NOT DISTINCT FROM $2')

		const roleGuard = translate(
			"INSERT INTO wiki_audit_logs (id) SELECT ? FROM users WHERE (? OR role != 'admin' OR status != 'active')",
			0
		)
		expect(roleGuard.sql).toContain('$2::boolean OR role')
	})
})
