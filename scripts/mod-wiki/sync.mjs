import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { scanModWiki } from './scan.mjs'
import { classifySourceState, actionForSyncCase } from '../../src/lib/server/wiki/source-sync-service.ts'
import { publicEntityId } from '../../src/lib/entity-identity.ts'

const projectRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
const sqlLiteral = (v) => v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replaceAll("'", "''")}'`
const renderSql = (sql, values) => { let index = 0; return `${sql.replace(/\?/g, () => sqlLiteral(values[index++]))};` }

/** A repeatable import transaction for each section; CLI and real-SQL tests use this path. */
export async function syncModWiki(db, scan, options = {}) {
	if (scan.errors.length) throw new Error(`Scan validation failed: ${scan.errors.join('; ')}`)
	// Callers can bypass the filesystem scanner; validate/normalize the entire batch
	// before its first write rather than assuming every ScannedModWiki was produced there.
	const files = scan.files.map((file) => {
		if (file.entityId == null && file.entityType == null) return { ...file, entityId: null, entityType: null, entityModId: null }
		if (typeof file.entityId !== 'string' || typeof file.entityType !== 'string' ||
			(file.entityModId != null && typeof file.entityModId !== 'string')) throw new Error(`Invalid source entity: ${file.sourcePath}`)
		const separator = file.entityId.indexOf(':')
		const scope = file.entityModId ?? (separator < 0 ? file.modId : file.entityId.slice(0, separator))
		const entityId = publicEntityId({ type: file.entityType, id: file.entityId, modId: scope })
		if (!entityId) throw new Error(`Invalid source entity namespace: ${file.sourcePath}`)
		return { ...file, entityId, entityModId: scope }
	})
	const emitted = [], plan = [], identities = new Set()
	const read = async (sql, ...params) => options.assumeFresh ? null : db.prepare(sql).bind(...params).first()
	const all = async (sql, ...params) => options.assumeFresh ? [] : (await db.prepare(sql).bind(...params).all()).results
	const run = async (statements) => {
		if (options.dryRun || options.emitSql) {
			for (const [sql, params] of statements) emitted.push(renderSql(sql, params))
			return statements.map(() => ({ meta: { changes: 1 } }))
		}
		return db.batch(statements.map(([sql, params]) => db.prepare(sql).bind(...params)))
	}
	const audit = (action, sectionId, metadata, guardSql, guardParams) => [
		`INSERT INTO wiki_audit_logs (id, actor_id, action, target_type, target_id, metadata_json)
		 SELECT ?, NULL, ?, 'mod_wiki', ?, ? WHERE ${guardSql}`,
		[crypto.randomUUID(), action, sectionId, JSON.stringify(metadata), ...guardParams]
	]
	const sourceIdentity = (mod, slug, key) => `${mod}\u0000${slug}\u0000${key}`
	const preservePath = (sourceId, sourcePath) => [
		`INSERT OR IGNORE INTO wiki_source_paths (source_path, source_id)
		 SELECT ?, id FROM wiki_section_sources WHERE id = ?`, [sourcePath, sourceId]
	]

	for (const file of files) {
		identities.add(sourceIdentity(file.modId, file.pageSlug, file.sectionKey))
		const page = await read("SELECT id,identity_status FROM wiki_pages WHERE page_type = 'mod' AND mod_id = ? AND slug = ?", file.modId, file.pageSlug)
		if (page?.identity_status === 'archived') {
			plan.push({ source: file.sourcePath, case: 'SKIP', reason: 'Legacy entity identity is archived pending attribution review' })
			continue
		}
		const pid = page?.id ?? `modpage:${file.modId}:${file.pageSlug}`
		const section = await read(`SELECT s.*, COALESCE(r.content, '') AS current_content FROM wiki_sections s
			LEFT JOIN wiki_revisions r ON r.id = s.current_revision_id WHERE s.page_id = ? AND s.section_key = ?`, pid, file.sectionKey)
		const sid = section?.id ?? `modsection:${file.modId}:${file.pageSlug}:${file.sectionKey}`
		const source = section ? await read('SELECT * FROM wiki_section_sources WHERE section_id = ?', sid) : null
		const srcId = source?.id ?? `modsource:${file.modId}:${file.pageSlug}:${file.sectionKey}`
		const owner = await read(`SELECT source_id FROM wiki_source_paths WHERE source_path = ?`, file.sourcePath)
		if ((owner && owner.source_id !== srcId) || (section && !source)) {
			plan.push({ source: file.sourcePath, case: 'SKIP', reason: owner ? 'Path belongs to another source' : 'Existing community section has no source binding' })
			continue
		}
		const syncCase = classifySourceState({ exists: !!source, baseContent: source?.source_content ?? '',
			baseHash: source?.source_hash ?? '', currentContent: section?.current_content ?? '', sourceStatus: source?.source_status ?? 'active' },
			{ content: file.content, hash: file.contentHash })
		const statements = [], rid = `modrevision:${crypto.randomUUID()}`
		const revGuard = 'EXISTS (SELECT 1 FROM wiki_revisions WHERE id = ?)'
		const consistent = `EXISTS (SELECT 1 FROM wiki_sections sec JOIN wiki_section_sources src ON src.section_id = sec.id
			WHERE sec.id = ? AND sec.version = ? AND src.id = ? AND src.source_hash = ?)`
		const consistentParams = [sid, section?.version ?? 0, srcId, source?.source_hash ?? '']
		const snapshot = (guard, params) => [
			`UPDATE wiki_section_sources SET source_path = ?, source_hash = ?, source_content = ?, source_mod_version = ?,
			 source_status = 'active', last_synced_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
			 WHERE id = ? AND ${guard}`, [file.sourcePath, file.contentHash, file.content, file.modVersion, srcId, ...params]
		]
		if (syncCase === 'NEW') {
			statements.push(
				['INSERT OR IGNORE INTO wiki_pages (id, mod_id, entity_type, entity_id, entity_mod_id, slug, page_type) VALUES (?, ?, ?, ?, ?, ?, \'mod\')',
				 [pid, file.modId, file.entityType, file.entityId, file.entityId ? file.entityModId ?? file.modId : null, file.pageSlug]],
				["INSERT OR IGNORE INTO wiki_sections (id, page_id, section_key, content_type, sort_order) VALUES (?, ?, ?, 'markdown', ?)",
				 [sid, pid, file.sectionKey, file.sortOrder]],
				[`INSERT INTO wiki_revisions (id, section_id, revision_no, parent_revision_id, content, summary, source_type, source_reference)
				 SELECT ?, id, 1, NULL, ?, 'Initial import from mod wiki', 'mod_seed', ? FROM wiki_sections
				 WHERE id = ? AND version = 0 AND current_revision_id IS NULL
				 AND NOT EXISTS (SELECT 1 FROM wiki_revisions WHERE section_id = ?)`, [rid, file.content, file.sourcePath, sid, sid]],
				[`UPDATE wiki_sections SET current_revision_id = ?, version = 1 WHERE id = ? AND ${revGuard}`, [rid, sid, rid]],
				[`INSERT INTO wiki_section_sources (id, section_id, source_path, source_hash, source_content, source_mod_version)
				 SELECT ?, ?, ?, ?, ?, ? WHERE ${revGuard}`, [srcId, sid, file.sourcePath, file.contentHash, file.content, file.modVersion, rid]],
				preservePath(srcId, file.sourcePath),
				audit('mod_seed_import', sid, { sourcePath: file.sourcePath, hash: file.contentHash }, revGuard, [rid])
			)
		} else {
			// The source/page/section IDs survive a canonical entity reference update.
			statements.push([`UPDATE wiki_pages SET entity_type = ?, entity_id = ?, entity_mod_id = ? WHERE id = ? AND page_type = 'mod'`,
				[file.entityType, file.entityId, file.entityId ? file.entityModId ?? file.modId : null, pid]])
			// Retain all historic paths and the existing source ID, including after a directory move.
			statements.push(preservePath(srcId, source.source_path), preservePath(srcId, file.sourcePath))
			if (syncCase === 'A') {
				statements.push(
					[`INSERT INTO wiki_revisions (id, section_id, revision_no, parent_revision_id, content, summary, source_type, source_reference)
					 SELECT ?, s.id, (SELECT COALESCE(MAX(revision_no), 0) + 1 FROM wiki_revisions WHERE section_id = s.id),
					 s.current_revision_id, ?, 'Mod upstream update', 'mod_update', ? FROM wiki_sections s
					 JOIN wiki_revisions r ON r.id = s.current_revision_id JOIN wiki_section_sources src ON src.section_id = s.id
					 WHERE s.id = ? AND s.version = ? AND src.id = ? AND src.source_hash = ? AND r.content = src.source_content`,
					 [rid, file.content, file.sourcePath, ...consistentParams]],
					[`UPDATE wiki_sections SET current_revision_id = ?, version = version + 1,
					 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND ${revGuard}`, [rid, sid, rid]],
					snapshot(revGuard, [rid]),
					[`UPDATE wiki_source_updates SET status = 'withdrawn', review_note = 'Superseded by automatic upstream publication',
					 reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE source_id = ? AND status IN ('pending', 'conflict') AND ${revGuard}`, [srcId, rid]],
					audit('mod_update_publish', sid, { sourcePath: file.sourcePath, hash: file.contentHash, revisionId: rid }, revGuard, [rid])
				)
			} else if (syncCase === 'C') {
				const uid = `modupdate:${crypto.randomUUID()}`
				statements.push(
					[`UPDATE wiki_source_updates SET status = 'withdrawn', review_note = 'Superseded by newer upstream content',
					 reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE source_id = ? AND incoming_hash != ?
					 AND status IN ('pending', 'conflict') AND ${consistent}`, [srcId, file.contentHash, ...consistentParams]],
					[`INSERT OR IGNORE INTO wiki_source_updates
					 (id, source_id, section_id, base_content, current_content, incoming_content, base_hash, incoming_hash, incoming_mod_version, status)
					 SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 'conflict' WHERE ${consistent}
					 AND NOT EXISTS (SELECT 1 FROM wiki_source_updates WHERE source_id = ? AND base_hash = ? AND incoming_hash = ? AND status = 'rejected')`,
					 [uid, srcId, sid, source.source_content, section.current_content, file.content, source.source_hash, file.contentHash, file.modVersion,
					 ...consistentParams, srcId, source.source_hash, file.contentHash]],
					[`UPDATE wiki_section_sources SET source_path = ?, source_status = 'active' WHERE id = ? AND ${consistent}`, [file.sourcePath, srcId, ...consistentParams]],
					audit('mod_update_conflict', sid, { incomingHash: file.contentHash }, 'EXISTS (SELECT 1 FROM wiki_source_updates WHERE id = ?)', [uid])
				)
			} else {
				// B refreshes metadata/path even when only the file moved. D adopts matching content.
				statements.push(snapshot(consistent, consistentParams),
					[`UPDATE wiki_source_updates SET status = 'withdrawn', review_note = 'Upstream matches the published content or baseline',
					 reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE source_id = ? AND status IN ('pending', 'conflict')
					 AND EXISTS (SELECT 1 FROM wiki_section_sources WHERE id = ? AND source_hash = ?)`, [srcId, srcId, file.contentHash]])
			}
		}
		const results = await run(statements)
		const revisionInsertIndex = syncCase === 'NEW' ? 2 : syncCase === 'A' ? 2 : -1
		const lostRace = revisionInsertIndex >= 0 && !Number(results[revisionInsertIndex].meta?.changes ?? 0)
		plan.push({ source: file.sourcePath, case: lostRace ? 'RETRY' : syncCase,
			reason: lostRace ? 'Concurrent change preserved; run sync again' : actionForSyncCase(syncCase).reason })
	}

	// An absent checkout/mod manifest is not proof that an upstream author deleted a section.
	const scopedMods = new Set(scan.mods.map((m) => m.id))
	const sources = await all(`SELECT src.*, s.section_key, p.mod_id, p.slug FROM wiki_section_sources src
		JOIN wiki_sections s ON s.id = src.section_id JOIN wiki_pages p ON p.id = s.page_id WHERE p.page_type = 'mod'`)
	for (const source of sources) {
		if (!scopedMods.has(source.mod_id) || source.source_status === 'deleted' || identities.has(sourceIdentity(source.mod_id, source.slug, source.section_key))) continue
		await run([
			["UPDATE wiki_section_sources SET source_status = 'deleted', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?", [source.id]],
			["UPDATE wiki_source_updates SET status = 'withdrawn', review_note = 'Upstream section was removed', reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE source_id = ? AND status IN ('pending', 'conflict')", [source.id]],
			audit('mod_source_deleted', source.section_id, { sourcePath: source.source_path }, '1', [])
		])
		plan.push({ source: source.source_path, case: 'E', reason: actionForSyncCase('E').reason })
	}
	return { plan, statements: emitted }
}

async function main() {
	const args = process.argv.slice(2), emitIndex = args.indexOf('--emit-sql')
	const emitPath = emitIndex >= 0 ? args[emitIndex + 1] : null
	if (emitIndex >= 0 && !emitPath) throw new Error('--emit-sql requires an output path')
	if (args.includes('--emit-initial') && !emitPath) throw new Error('--emit-initial requires --emit-sql')
	const scan = scanModWiki(projectRoot)
	if (scan.errors.length) throw new Error(scan.errors.join('\n'))
	const { getPlatformProxy } = await import('wrangler')
	const proxy = await getPlatformProxy({ persist: { path: '.wrangler/state/v3' } })
	try {
		const result = await syncModWiki(proxy.env.DB, scan, { dryRun: args.includes('--dry-run'), emitSql: !!emitPath, assumeFresh: args.includes('--emit-initial') })
		if (emitPath) fs.writeFileSync(path.resolve(projectRoot, emitPath), ['-- Generated mod wiki synchronization SQL. Apply as one transaction.', ...result.statements].join('\n'), 'utf8')
		for (const row of result.plan) console.log(`${row.case.padEnd(5)} ${row.source}: ${row.reason}`)
	} finally { await proxy.dispose() }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
	main().catch((error) => { console.error(`[mod-wiki] ${error.message}`); process.exitCode = 1 })
