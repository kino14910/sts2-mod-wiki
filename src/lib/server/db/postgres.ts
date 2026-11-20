import type { Pool, PoolClient } from 'pg'
import type { SqlValue, WikiDatabase, WikiResult, WikiStatement } from './types'

const UTC_FORMAT = 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>

function isInsideString(sql: string, index: number): boolean {
	let quote = false
	for (let i = 0; i < index; i++) {
		if (sql[i] === '\\') { i++; continue }
		if (sql[i] === "'") quote = !quote
	}
	return quote
}

function countPlaceholders(sql: string): number {
	let count = 0
	for (let i = 0; i < sql.length; i++) {
		if (sql[i] === '?' && !isInsideString(sql, i)) count++
	}
	return count
}

function replacePlaceholders(sql: string): string {
	let index = 0
	let output = ''
	for (let i = 0; i < sql.length; i++) {
		const char = sql[i]
		if (char === "'") {
			output += char
			i++
			while (i < sql.length) {
				output += sql[i]
				if (sql[i] === '\\' && i + 1 < sql.length) { output += sql[++i]; i++; continue }
				if (sql[i] === "'") break
				i++
			}
			continue
		}
		output += char === '?' ? `$${++index}` : char
	}
	return output
}

export function translate(sql: string, previousChanges: number): { sql: string; params: SqlValue[] } {
	let translated = sql
		.replace(/json_extract\(([^,]+),\s*'\$\.([A-Za-z0-9_]+)'\)/g, (_match, expression: string, path: string) => `(${expression} ->> '${path}')`)
		.replace(/json_object\(/g, 'jsonb_build_object(')
		.replace(/strftime\('%Y-%m-%dT%H:%M:%fZ',\s*'now',\s*'-60 seconds'\)/g, `to_char((now() - interval '60 seconds') AT TIME ZONE 'UTC', '${UTC_FORMAT}')`)
		.replace(/strftime\('%Y-%m-%dT%H:%M:%fZ',\s*updated_at,\s*'\+0\.001 seconds'\)/g, `to_char((updated_at::timestamp + interval '1 millisecond') AT TIME ZONE 'UTC', '${UTC_FORMAT}')`)
		.replace(/strftime\('%Y-%m-%dT%H:%M:%fZ',\s*'now'\)/g, `to_char(now() AT TIME ZONE 'UTC', '${UTC_FORMAT}')`)
		.replace(/ IS \?/g, ' IS NOT DISTINCT FROM ?')
		.replace(/WHERE \(\? OR role != 'admin'/g, "WHERE (?::boolean OR role != 'admin'")

	let conflictIgnored = false
	translated = translated.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/g, () => {
		conflictIgnored = true
		return 'INSERT INTO'
	})
	if (conflictIgnored && !/\bON\s+CONFLICT\b/i.test(translated)) {
		translated = `${translated.trimEnd()} ON CONFLICT DO NOTHING`
	}

	const baseParameterCount = countPlaceholders(translated)
	const changeParams: SqlValue[] = []
	let changeIndex = 0
	translated = translated.replace(/\bchanges\(\)/g, () => {
		changeParams.push(previousChanges)
		return `$${baseParameterCount + ++changeIndex}`
	})

	return { sql: replacePlaceholders(translated), params: changeParams }
}

async function executeQuery<T>(
	pool: Queryable,
	query: { sql: string; params: SqlValue[] },
	map: (rows: unknown[], rowCount: number) => T
): Promise<T> {
	const result = await pool.query(query.sql, query.params)
	return map(result.rows, result.rowCount ?? 0)
}

class PostgresStatement<T = unknown> implements WikiStatement<T> {
	constructor(
		private readonly pool: Queryable,
		readonly sql: string,
		readonly params: SqlValue[]
	) {}

	bind(...values: SqlValue[]): WikiStatement<T> {
		return new PostgresStatement<T>(this.pool, this.sql, [...this.params, ...values])
	}

	private translated(previousChanges = 0): { sql: string; params: SqlValue[] } {
		const query = translate(this.sql, previousChanges)
		return { sql: query.sql, params: [...this.params, ...query.params] }
	}

	first<U = T>(): Promise<U | null> {
		return executeQuery<U | null>(this.pool, this.translated(), (rows) => (rows[0] as U) ?? null)
	}

	all<U = T>(): Promise<WikiResult<U>> {
		return executeQuery(this.pool, this.translated(), (rows, rowCount) => ({
			results: rows as U[],
			success: true,
			meta: { changes: Math.max(rowCount, 0) }
		}))
	}

	run(): Promise<WikiResult<T>> {
		return executeQuery(this.pool, this.translated(), (_rows, rowCount) => ({
			results: [],
			success: true,
			meta: { changes: Math.max(rowCount, 0) }
		}))
	}
}

export function createPostgresDatabase(pool: Pool): WikiDatabase {
	const statement = (sql: string, params: SqlValue[] = []) => new PostgresStatement(pool, sql, params)

	return {
		prepare: (sql) => statement(sql),
		async batch(statements) {
			const client = await pool.connect()
			let previousChanges = 0
			const results: WikiResult<unknown>[] = []
			try {
				await client.query('BEGIN')
				for (const item of statements) {
					const query = translate(item.sql, previousChanges)
					const result = await client.query(query.sql, [...item.params, ...query.params])
					previousChanges = Math.max(result.rowCount ?? 0, 0)
					results.push({
						results: result.rows,
						success: true,
						meta: { changes: previousChanges }
					})
				}
				await client.query('COMMIT')
				return results
			} catch (error) {
				await client.query('ROLLBACK')
				throw error
			} finally {
				client.release()
			}
		}
	}
}
