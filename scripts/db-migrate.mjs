import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))

function loadEnvFile() {
	const file = path.join(root, '.env')
	if (!fs.existsSync(file)) return
	for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
		const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
		if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
	}
}

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

loadEnvFile()

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL or DATABASE_URL_UNPOOLED is not configured')

const client = new Client({ connectionString })
try {
	await client.connect()
	await client.query('BEGIN')
	await client.query(fs.readFileSync(path.join(root, 'postgres/schema.sql'), 'utf8'))
	const seed = path.join(root, 'migrations/0002_seed_wiki.sql')
	if (fs.existsSync(seed)) await client.query(toPostgresSeed(fs.readFileSync(seed, 'utf8')))
	await client.query('COMMIT')
	console.log('Postgres schema applied')
} catch (error) {
	await client.query('ROLLBACK')
	throw error
} finally {
	await client.end()
}
