import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPlatformProxy } from 'wrangler'
import { scanModWiki } from './scan.mjs'
import {
	actionForSyncCase,
	classifySourceState
} from '../../src/lib/server/wiki/source-sync-service.ts'

const projectRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
const PERSIST_PATH = '.wrangler/state/v3'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const assumeFresh = args.includes('--emit-initial')
const emitIndex = args.indexOf('--emit-sql')
const emitPath = emitIndex >= 0 ? args[emitIndex + 1] : null
if (emitIndex >= 0 && !emitPath) {
	console.error('[mod-wiki] --emit-sql requires an output path')
	process.exit(1)
}
if (assumeFresh && !emitPath) {
	console.error('[mod-wiki] --emit-initial requires --emit-sql <path>')
	process.exit(1)
}

function sqlLiteral(value) {
	if (value === null || value === undefined) return 'NULL'
	if (typeof value === 'number') return String(value)
	return `'${String(value).replaceAll("'", "''")}'`
}

function renderSql(sql, params) {
	let index = 0
	return `${sql.replace(/\?/g, () => sqlLiteral(params[index++]))};`
}

async function loadState(db) {
	const readAll = async (sql) => (await db.prepare(sql).all()).results
	const [pages, sections, revisions, sources, updates] = await Promise.all([
		readAll('SELECT * FROM wiki_pages'),
		readAll('SELECT * FROM wiki_sections'),
		readAll('SELECT * FROM wiki_revisions'),
		readAll('SELECT * FROM wiki_section_sources'),
		readAll("SELECT * FROM wiki_source_updates WHERE status IN ('pending', 'conflict')")
	])
	return { pages, sections, revisions, sources, updates }
}

async function main() {
	const scan = scanModWiki(projectRoot)
	if (scan.errors.length) {
		for (const error of scan.errors) console.error(`[mod-wiki] ${error}`)
		throw new Error('Scan validation failed; no database writes were performed')
	}

	const proxy = await getPlatformProxy({ persist: { path: PERSIST_PATH } })
	const db = proxy.env.DB
	const emitted = []
	const plan = []

	const run = async (sql, params = []) => {
		if (dryRun || emitPath) {
			if (emitPath) emitted.push(renderSql(sql, params))
			return { meta: { changes: 1 } }
		}
		return db.prepare(sql).bind(...params).run()
	}

	try {
		const state = assumeFresh
			? { pages: [], sections: [], revisions: [], sources: [], updates: [] }
			: await loadState(db)
		const pageByKey = new Map(
			state.pages
				.filter((row) => row.page_type === 'mod')
				.map((row) => [`${row.mod_id}\u0000${row.slug}`, row])
		)
		const sectionByKey = new Map(
			state.sections.map((row) => [`${row.page_id}\u0000${row.section_key}`, row])
		)
		const revisionById = new Map(state.revisions.map((row) => [row.id, row]))
		const pageById = new Map(state.pages.map((row) => [row.id, row]))
		const sourceBySection = new Map(state.sources.map((row) => [row.section_id, row]))
		const openUpdate = new Map(
			state.updates.map((row) => [`${row.source_id}\u0000${row.incoming_hash}`, row])
		)

		const pageId = (modId, slug) => `modpage:${modId}:${slug}`
		const sectionId = (modId, slug, key) => `modsection:${modId}:${slug}:${key}`
		const sourceId = (modId, slug, key) => `modsource:${modId}:${slug}:${key}`
		const revisionId = (sid, no) => `modrevision:${sid}:${no}`
		const updateId = (sid, hash) => `modupdate:${sid}:${hash}`

		const maxRevisionNo = (sid) =>
			state.revisions.filter((row) => row.section_id === sid).reduce((max, row) => Math.max(max, row.revision_no), 0)

		const audit = async (action, targetId, metadata) => {
			await run(
				'INSERT OR IGNORE INTO wiki_audit_logs (id, actor_id, action, target_type, target_id, metadata_json) VALUES (?, NULL, ?, ?, ?, ?)',
				[
					`modaudit:${action}:${targetId}:${metadata?.hash ?? metadata?.contentHash ?? ''}`,
					action,
					'mod_wiki',
					targetId,
					JSON.stringify(metadata ?? {})
				]
			)
		}

		const insertRevision = async (sid, no, parent, content, sourceType, sourcePath) => {
			const rid = revisionId(sid, no)
			await run(
				'INSERT OR IGNORE INTO wiki_revisions (id, section_id, revision_no, parent_revision_id, content, summary, editor_id, source_type, source_reference) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)',
				[
					rid,
					sid,
					no,
					parent,
					content,
					sourceType === 'mod_seed' ? 'Initial import from mod wiki' : 'Mod upstream update',
					sourceType,
					sourcePath
				]
			)
			return rid
		}

		const link = async (sid, expectedVersion, rid) => {
			const result = await run(
				"UPDATE wiki_sections SET current_revision_id = ?, version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND version = ? AND (current_revision_id IS NULL OR current_revision_id != ?)",
				[rid, sid, expectedVersion, rid]
			)
			return Number(result.meta?.changes ?? 0)
		}

		const closeOpenUpdates = async (srcId, reason) => {
			await run(
				"UPDATE wiki_source_updates SET status = 'withdrawn', review_note = ?, reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE source_id = ? AND status IN ('pending', 'conflict')",
				[reason, srcId]
			)
		}

		const closeStaleUpdates = async (srcId, currentHash, reason) => {
			await run(
				"UPDATE wiki_source_updates SET status = 'withdrawn', review_note = ?, reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE source_id = ? AND incoming_hash != ? AND status IN ('pending', 'conflict')",
				[reason, srcId, currentHash]
			)
		}

		const upsertSource = async (sid, file, status = 'active') => {
			const id = sourceId(file.modId, file.pageSlug, file.sectionKey)
			await run(
				`INSERT OR IGNORE INTO wiki_section_sources (id, section_id, source_path, source_hash, source_content, source_mod_version, source_status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
				[id, sid, file.sourcePath, file.contentHash, file.content, file.modVersion, status]
			)
			await run(
				"UPDATE wiki_section_sources SET source_path = ?, source_hash = ?, source_content = ?, source_mod_version = ?, source_status = ?, last_synced_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
				[file.sourcePath, file.contentHash, file.content, file.modVersion, status, id]
			)
			return id
		}

		const sourceByIdentity = new Map()
		for (const source of state.sources) {
			const section = state.sections.find((row) => row.id === source.section_id)
			const page = section ? pageById.get(section.page_id) : null
			if (!page || !section) continue
			sourceByIdentity.set(`${page.mod_id}\u0000${page.slug}\u0000${section.section_key}`, {
				source,
				section,
				page
			})
		}

		const scannedIdentities = new Set()

		for (const file of scan.files) {
			const identity = `${file.modId}\u0000${file.pageSlug}\u0000${file.sectionKey}`
			scannedIdentities.add(identity)
			const existingPage = pageByKey.get(`${file.modId}\u0000${file.pageSlug}`)
			const pid = existingPage?.id ?? pageId(file.modId, file.pageSlug)
			const existingSection = sectionByKey.get(`${pid}\u0000${file.sectionKey}`)
			const sid = existingSection?.id ?? sectionId(file.modId, file.pageSlug, file.sectionKey)
			const existingSource = sourceBySection.get(sid) ?? sourceByIdentity.get(identity)?.source
			const pathOwner = state.sources.find(
				(row) => row.source_path === file.sourcePath && row.id !== existingSource?.id
			)
			if (pathOwner) {
				plan.push({ source: file.sourcePath, case: 'SKIP', reason: 'Source path already bound to another section' })
				await audit('mod_sync_failed', sid, { sourcePath: file.sourcePath, reason: 'duplicate source path' })
				continue
			}

			if (existingSection && !existingSource) {
				plan.push({ source: file.sourcePath, case: 'SKIP', reason: 'Section exists without a mod source; community content preserved' })
				await audit('mod_sync_failed', sid, { sourcePath: file.sourcePath, reason: 'orphan section' })
				continue
			}

			const currentRevision = existingSection?.current_revision_id
				? revisionById.get(existingSection.current_revision_id)
				: null
			const sourceState = {
				exists: Boolean(existingSource),
				baseContent: existingSource?.source_content ?? '',
				baseHash: existingSource?.source_hash ?? '',
				currentContent: currentRevision?.content ?? '',
				sourceStatus: existingSource?.source_status ?? 'active'
			}
			const incoming = { content: file.content, hash: file.contentHash }
			const syncCase = classifySourceState(sourceState, incoming)
			const action = actionForSyncCase(syncCase)
			plan.push({ source: file.sourcePath, case: syncCase, reason: action.reason })

			if (syncCase === 'NEW') {
				if (!existingPage) {
					await run(
						'INSERT OR IGNORE INTO wiki_pages (id, mod_id, entity_type, entity_id, slug, page_type) VALUES (?, ?, ?, ?, ?, ?)',
						[pid, file.modId, file.entityType, file.entityId, file.pageSlug, 'mod']
					)
					pageByKey.set(`${file.modId}\u0000${file.pageSlug}`, { id: pid })
				}
				if (!existingSection) {
					await run(
						'INSERT OR IGNORE INTO wiki_sections (id, page_id, section_key, content_type, sort_order) VALUES (?, ?, ?, ?, ?)',
						[sid, pid, file.sectionKey, 'markdown', file.sortOrder]
					)
					sectionByKey.set(`${pid}\u0000${file.sectionKey}`, {
						id: sid,
						version: 0,
						current_revision_id: null
					})
				}
				const rid = await insertRevision(sid, maxRevisionNo(sid) + 1, null, file.content, 'mod_seed', file.sourcePath)
				const changes = await link(sid, 0, rid)
				if (changes === 0) throw new Error(`Failed to link initial revision for ${file.sourcePath}`)
				await upsertSource(sid, file)
				await audit('mod_seed_import', sid, { sourcePath: file.sourcePath, hash: file.contentHash, modVersion: file.modVersion })
				continue
			}

			if (syncCase === 'A') {
				const section = existingSection
				const rid = await insertRevision(
					sid,
					maxRevisionNo(sid) + 1,
					section.current_revision_id,
					file.content,
					'mod_update',
					file.sourcePath
				)
				const changes = await link(sid, section.version, rid)
				if (changes === 0) {
					// The revision was never published, so removing it does not alter formal history.
					await run('DELETE FROM wiki_revisions WHERE id = ? AND section_id = ?', [rid, sid])
					plan.push({ source: file.sourcePath, case: 'C', reason: 'Concurrent publish detected during sync' })
					await audit('mod_sync_failed', sid, { sourcePath: file.sourcePath, reason: 'version conflict' })
					continue
				}
				await upsertSource(sid, file)
				await closeOpenUpdates(existingSource.id, 'Superseded by an automatic upstream publish')
				await audit('mod_update_publish', sid, { sourcePath: file.sourcePath, hash: file.contentHash, revisionId: rid })
				continue
			}

			if (syncCase === 'C') {
				const srcId = existingSource?.id ?? sourceId(file.modId, file.pageSlug, file.sectionKey)
				const uid = updateId(srcId, file.contentHash)
				await closeStaleUpdates(srcId, file.contentHash, 'Superseded by a newer upstream version')
				if (!openUpdate.has(`${srcId}\u0000${file.contentHash}`)) {
					await run(
						'INSERT OR IGNORE INTO wiki_source_updates (id, source_id, section_id, base_content, current_content, incoming_content, base_hash, incoming_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
						[
							uid,
							srcId,
							sid,
							sourceState.baseContent,
							sourceState.currentContent,
							file.content,
							sourceState.baseHash,
							file.contentHash,
							'conflict'
						]
					)
					openUpdate.set(`${srcId}\u0000${file.contentHash}`, { id: uid })
					await audit('mod_update_conflict', sid, { sourcePath: file.sourcePath, baseHash: sourceState.baseHash, hash: file.contentHash })
				}
				continue
			}

			if (syncCase === 'D') {
				await upsertSource(sid, file)
				await closeOpenUpdates(existingSource.id, 'Current content already matches the incoming upstream content')
				await audit('mod_update_noop', sid, { sourcePath: file.sourcePath, hash: file.contentHash })
				continue
			}

			if (syncCase === 'B') {
				const versionChanged = existingSource?.source_mod_version !== file.modVersion
				const needsReactivation = existingSource?.source_status === 'deleted'
				await closeStaleUpdates(
					existingSource.id,
					file.contentHash,
					'Upstream returned to the synced baseline'
				)
				if (versionChanged || needsReactivation) {
					await upsertSource(sid, file)
					await audit(needsReactivation ? 'mod_source_restored' : 'mod_version_change', sid, {
						sourcePath: file.sourcePath,
						modVersion: file.modVersion
					})
				}
				continue
			}
		}

		await run(
			`UPDATE wiki_source_updates SET status = 'withdrawn', review_note = 'Published content already matches the incoming upstream content', reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE status IN ('pending', 'conflict') AND EXISTS (SELECT 1 FROM wiki_sections s JOIN wiki_revisions r ON r.id = s.current_revision_id WHERE s.id = wiki_source_updates.section_id AND r.content = wiki_source_updates.incoming_content)`,
			[]
		)

		for (const [identity, { source, section }] of sourceByIdentity) {
			if (scannedIdentities.has(identity) || source.source_status === 'deleted') continue
			plan.push({ source: source.source_path, case: 'E', reason: actionForSyncCase('E').reason })
			await run(
				"UPDATE wiki_section_sources SET source_status = 'deleted', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
				[source.id]
			)
			await audit('mod_source_deleted', section.id, { sourcePath: source.source_path })
		}

		if (emitPath) {
			const target = path.resolve(projectRoot, emitPath)
			fs.writeFileSync(
				target,
				[
					'-- Generated by scripts/mod-wiki/sync.mjs. Apply with wrangler d1 execute --file.',
					'-- Statements are idempotent; review before applying to a remote database.',
					...emitted
				].join('\n'),
				'utf8'
			)
			console.log(`[mod-wiki] wrote ${emitted.length} statements to ${target}`)
		}

		const counts = plan.reduce((acc, item) => ({ ...acc, [item.case]: (acc[item.case] ?? 0) + 1 }), {})
		console.log(`[mod-wiki] ${dryRun ? 'dry-run' : emitPath ? 'emit-sql' : 'sync'} complete`, JSON.stringify(counts))
		for (const item of plan) console.log(`  ${item.case.padEnd(4)} ${item.source} — ${item.reason}`)
	} finally {
		await proxy.dispose()
	}
}

main().catch((error) => {
	console.error(`[mod-wiki] ${error.message}`)
	process.exitCode = 1
})
