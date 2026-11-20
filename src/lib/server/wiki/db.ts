import { DATABASE_URL, WIKI_DEV_LOGIN, WIKI_SESSION_SECRET } from '$app/env/private'
import { attachDatabasePool } from '@vercel/functions'
import { Pool } from 'pg'
import { createPostgresDatabase } from '#lib/server/db/postgres'
import type { WikiDatabase } from '#lib/server/db/types'

export interface WikiRuntimeEnv {
	WIKI_SESSION_SECRET?: string
	WIKI_DEV_LOGIN?: string
}

let pool: Pool | null = null

export function getRuntimeEnv(): WikiRuntimeEnv | undefined {
	if (!WIKI_SESSION_SECRET) return undefined
	return {
		WIKI_SESSION_SECRET,
		WIKI_DEV_LOGIN: WIKI_DEV_LOGIN || undefined
	}
}

function getPool(): Pool | null {
	if (!DATABASE_URL) return null
	if (!pool) {
		pool = new Pool({
			connectionString: DATABASE_URL,
			max: 5,
			idleTimeoutMillis: 10_000,
			connectionTimeoutMillis: 5_000
		})
		attachDatabasePool(pool)
	}
	return pool
}

export function getWikiDb(): WikiDatabase | null {
	const activePool = getPool()
	return activePool ? createPostgresDatabase(activePool) : null
}
