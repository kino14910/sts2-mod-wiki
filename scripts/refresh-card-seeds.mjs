import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import { CARD_SECTION_KEYS } from '../src/lib/data/card-section-keys.ts'
import { createPostgresDatabase } from '../src/lib/server/db/postgres.ts'
import { refreshCardSeedSections } from '../src/lib/server/wiki/card-seed-refresh.ts'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))

function loadEnvFile() {
	const file = path.join(root, '.env')
	if (!fs.existsSync(file)) return
	for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
		const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
		if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
	}
}

function argument(name, fallback) {
	const index = process.argv.indexOf(name)
	if (index < 0) return fallback
	const value = process.argv[index + 1]
	if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`)
	return value
}

function readSections(cardId) {
	const dir = path.join(root, 'src/lib/data/card-articles', cardId.toLowerCase(), 'en')
	if (!fs.existsSync(dir)) throw new Error(`No English Markdown directory for "${cardId}": ${path.relative(root, dir)}`)
	const missing = CARD_SECTION_KEYS.filter((key) => !fs.existsSync(path.join(dir, `${key}.md`)))
	if (missing.length) throw new Error(`Missing Markdown files in ${path.relative(root, dir)}: ${missing.join(', ')}`)
	return Object.fromEntries(CARD_SECTION_KEYS.map((key) => [
		key,
		fs.readFileSync(path.join(dir, `${key}.md`), 'utf8').replaceAll('\r\n', '\n')
	]))
}

function printReport({ cardId, modId, pageId, entityId, items }, apply) {
	const label = `${cardId} (${modId}:${cardId})`
	console.log(apply ? `${label} — seed refresh` : `${label} — dry run (no changes written)`)
	if (!pageId) {
		console.log('  page not found; nothing to refresh.')
		return
	}
	const width = Math.max(...items.map((item) => item.key.length))
	for (const item of items) {
		const version = item.fromVersion === undefined
			? ''
			: item.fromVersion === item.toVersion ? `v${item.fromVersion}` : `v${item.fromVersion} -> v${item.toVersion}`
		console.log(`  ${item.key.padEnd(width)}  ${item.status.padEnd(12)} ${version}`)
	}
	const counts = items.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] ?? 0) + 1 }), {})
	console.log(`  summary: ${Object.entries(counts).map(([status, count]) => `${status}=${count}`).join(', ')}`)
	if (!apply && (counts['would-update'] ?? 0) > 0) console.log('  run with --apply to write these revisions.')
	if ((counts.edited ?? 0) > 0) console.log('  skipped sections with community/moderator revisions.')
	if ((counts.pending ?? 0) > 0) console.log('  skipped sections with pending proposals.')
	if ((counts.conflict ?? 0) > 0) console.log('  conflicts detected; re-run after refreshing the page.')
	if ((counts.missing ?? 0) > 0) console.log('  missing sections were not created; open the card page once to initialize them.')
	console.log(`  entity: ${entityId ?? cardId}`)
}

async function main() {
	if (process.argv.includes('--help')) {
		console.log('Usage: npm run card-seed:refresh -- [--apply] [--card Bash] [--mod sts2]')
		console.log('Without --apply the script only reports what would change.')
		return
	}
	const apply = process.argv.includes('--apply')
	const cardId = argument('--card', 'Bash')
	const modId = argument('--mod', 'sts2')
	const sections = readSections(cardId)

	loadEnvFile()
	const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
	if (!connectionString) throw new Error('DATABASE_URL or DATABASE_URL_UNPOOLED is not configured')

	const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5_000 })
	try {
		const result = await refreshCardSeedSections(createPostgresDatabase(pool), { modId, cardId, sections, dryRun: !apply })
		printReport({ cardId, modId, ...result }, apply)
		const failed = !result.pageId || result.items.some((item) => item.status === 'conflict')
		if (failed) process.exitCode = 1
	} finally {
		await pool.end()
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error)
	process.exitCode = 1
})
