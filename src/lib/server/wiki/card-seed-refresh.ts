import { createHash, randomUUID } from 'node:crypto'

/**
 * Refresh card seed sections from the Markdown editorial source.
 *
 * Safety rules:
 * - only the current revision of an untouched seed line is replaced;
 * - community / moderation / rollback revisions are never touched;
 * - sections with pending or conflicting proposals are skipped;
 * - every write is guarded by the version and revision read above;
 * - a dry run performs no writes and is the default in the CLI.
 */

export const CARD_SEED_REFERENCE_PREFIX = 'wiki-seed:card:'

export interface CardSeedRefreshOptions {
	modId: string
	cardId: string
	sections: Record<string, string>
	dryRun?: boolean
}

export type CardSeedRefreshStatus =
	| 'updated'
	| 'would-update'
	| 'unchanged'
	| 'missing'
	| 'edited'
	| 'pending'
	| 'unsupported'
	| 'conflict'

export interface CardSeedRefreshItem {
	key: string
	sectionId: string | null
	status: CardSeedRefreshStatus
	fromVersion?: number
	toVersion?: number
}

export interface CardSeedRefreshResult {
	pageId: string | null
	entityId: string | null
	items: CardSeedRefreshItem[]
}

interface SeedSectionRow {
	section_id: string
	content_type: string
	version: number
	current_revision_id: string | null
	revision_content: string | null
	revision_source_type: string | null
	revision_source_reference: string | null
}

function seedOwned(row: SeedSectionRow): boolean {
	/* Initial seeds always belong to the seed line; refreshed seeds keep the same reference prefix. */
	if (row.revision_source_type === 'mod_seed') return true
	return row.revision_source_type === 'mod_update' &&
		(row.revision_source_reference ?? '').startsWith(CARD_SEED_REFERENCE_PREFIX)
}

export async function refreshCardSeedSections(
	db: WikiDatabase,
	options: CardSeedRefreshOptions
): Promise<CardSeedRefreshResult> {
	const scopedId = `${options.modId}:${options.cardId}`
	const page = await db.prepare(`SELECT id, entity_id FROM wiki_pages
		WHERE page_type = 'entity' AND identity_status = 'active' AND entity_type = 'card'
		AND entity_id IN (?, ?)
		ORDER BY CASE WHEN entity_id = ? THEN 0 ELSE 1 END LIMIT 1`)
		.bind(options.cardId, scopedId, scopedId)
		.first<{ id: string; entity_id: string }>()

	const keys = Object.keys(options.sections)
	if (!page) {
		return {
			pageId: null,
			entityId: null,
			items: keys.map((key) => ({ key, sectionId: null, status: 'missing' as const }))
		}
	}

	const items: CardSeedRefreshItem[] = []
	for (const [key, content] of Object.entries(options.sections)) {
		const row = await db.prepare(`SELECT s.id AS section_id, s.content_type, s.version, s.current_revision_id,
			r.content AS revision_content, r.source_type AS revision_source_type,
			r.source_reference AS revision_source_reference
			FROM wiki_sections s LEFT JOIN wiki_revisions r ON r.id = s.current_revision_id
			WHERE s.page_id = ? AND s.section_key = ?`)
			.bind(page.id, key)
			.first<SeedSectionRow>()

		if (!row?.current_revision_id || row.revision_content === null) {
			items.push({ key, sectionId: row?.section_id ?? null, status: 'missing' })
			continue
		}
		if (row.revision_content === content) {
			items.push({ key, sectionId: row.section_id, status: 'unchanged', fromVersion: Number(row.version), toVersion: Number(row.version) })
			continue
		}
		if (row.content_type !== 'markdown') {
			items.push({ key, sectionId: row.section_id, status: 'unsupported' })
			continue
		}
		if (!seedOwned(row)) {
			items.push({ key, sectionId: row.section_id, status: 'edited' })
			continue
		}
		const pending = await db.prepare(`SELECT COUNT(*) AS count FROM wiki_edit_proposals
			WHERE section_id = ? AND status IN ('pending', 'conflict')`)
			.bind(row.section_id)
			.first<{ count: number }>()
		if (Number(pending?.count ?? 0) > 0) {
			items.push({ key, sectionId: row.section_id, status: 'pending' })
			continue
		}

		const fromVersion = Number(row.version)
		const toVersion = fromVersion + 1
		if (options.dryRun) {
			items.push({ key, sectionId: row.section_id, status: 'would-update', fromVersion, toVersion })
			continue
		}

		const revisionId = `seed:refresh:${randomUUID()}`
		const auditId = `audit:seed:refresh:${randomUUID()}`
		const reference = `${CARD_SEED_REFERENCE_PREFIX}${page.entity_id}:${key}`
		const metadata = JSON.stringify({
			modId: options.modId,
			cardId: options.cardId,
			entityId: page.entity_id,
			sectionKey: key,
			fromVersion,
			toVersion,
			revisionId,
			contentHash: createHash('sha256').update(content, 'utf8').digest('hex')
		})

		const results = await db.batch([
			db.prepare(`INSERT INTO wiki_revisions
				(id, section_id, revision_no, parent_revision_id, content, summary, source_type, source_reference)
				SELECT ?, s.id, ?, ?, ?, ?, 'mod_update', ?
				FROM wiki_sections s
				WHERE s.id = ? AND s.version = ? AND s.current_revision_id = ?`)
				.bind(revisionId, toVersion, row.current_revision_id, content,
					'Card seed refreshed from Markdown source', reference,
					row.section_id, fromVersion, row.current_revision_id),
			db.prepare(`UPDATE wiki_sections SET current_revision_id = ?, version = version + 1,
				updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
				WHERE id = ? AND version = ? AND current_revision_id = ?
				AND EXISTS (SELECT 1 FROM wiki_revisions WHERE id = ?)`)
				.bind(revisionId, row.section_id, fromVersion, row.current_revision_id, revisionId),
			db.prepare(`INSERT INTO wiki_audit_logs (id, actor_id, action, target_type, target_id, metadata_json)
				SELECT ?, NULL, 'card_seed_refresh', 'card_seed', ?, ?
				WHERE EXISTS (SELECT 1 FROM wiki_revisions WHERE id = ?)`)
				.bind(auditId, row.section_id, metadata, revisionId)
		])

		/* A concurrent edit wins: the guarded insert/update changed nothing. */
		if (Number(results[0]?.meta?.changes ?? 0) === 0) {
			items.push({ key, sectionId: row.section_id, status: 'conflict' })
			continue
		}
		items.push({ key, sectionId: row.section_id, status: 'updated', fromVersion, toVersion })
	}

	return { pageId: page.id, entityId: page.entity_id, items }
}
