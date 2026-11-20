import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const connectionString =
	process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
if (!connectionString) throw new Error('TEST_DATABASE_URL is required for E2E')

function toPostgresSeed(sql) {
	return sql
		.split('\n')
		.map((line) => {
			if (!/^\s*INSERT\s+OR\s+IGNORE\b/i.test(line)) return line
			const insert = line.trimEnd().replace(/;?$/, '').replace(/^INSERT\s+OR\s+IGNORE\b/i, 'INSERT')
			return `${insert} ON CONFLICT DO NOTHING;`
		})
		.join('\n')
}

const client = new Client({ connectionString })
try {
	await client.connect()
	await client.query('BEGIN')
	await client.query(fs.readFileSync(path.join(root, 'postgres/schema.sql'), 'utf8'))
	await client.query(toPostgresSeed(fs.readFileSync(path.join(root, 'migrations/0002_seed_wiki.sql'), 'utf8')))
	await client.query(`
		INSERT INTO users (id, auth_subject, username, email, role, status)
		VALUES
			('user:e2e-member@qq.com', 'e2e-member@qq.com', 'E2E member', 'e2e-member@qq.com', 'member', 'active'),
			('user:e2e-trusted@qq.com', 'e2e-trusted@qq.com', 'E2E trusted', 'e2e-trusted@qq.com', 'trusted', 'active'),
			('user:e2e-moderator@qq.com', 'e2e-moderator@qq.com', 'E2E moderator', 'e2e-moderator@qq.com', 'moderator', 'active'),
			('user:e2e-admin@qq.com', 'e2e-admin@qq.com', 'E2E admin', 'e2e-admin@qq.com', 'admin', 'active')
		ON CONFLICT (auth_subject) DO UPDATE SET role = excluded.role, status = 'active', email = excluded.email
	`)
	await client.query('COMMIT')
	console.log('E2E Postgres fixtures applied')
} catch (error) {
	await client.query('ROLLBACK')
	throw error
} finally {
	await client.end()
}
