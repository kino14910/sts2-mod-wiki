export type SqlValue = any

export interface WikiResult<T = unknown> {
	results: T[]
	success: boolean
	meta: {
		changes: number
		last_row_id?: number
	}
}

export interface WikiStatement<T = unknown> {
	readonly sql: string
	readonly params: SqlValue[]
	bind(...values: SqlValue[]): WikiStatement<T>
	first<U = T>(): Promise<U | null>
	all<U = T>(): Promise<WikiResult<U>>
	run(): Promise<WikiResult<T>>
}

export interface WikiDatabase {
	prepare(sql: string): WikiStatement
	batch(statements: WikiStatement[]): Promise<WikiResult<unknown>[]>
}
