import { BASH_SECTIONS, CARD_SECTION_KEYS, SEED_SUMMARY } from '#lib/data/wiki-seed'

/** Insert missing sections only. Existing heads, history and source bindings are untouched. */
export async function ensureCardSections(db: D1Database, input: { id: string; mod?: string; rawId?: string }): Promise<void> {
	const rawId = input.rawId ?? input.id.slice(input.id.indexOf(':') + 1)
	const scopedId = `${input.mod ?? 'sts2'}:${rawId}`
	const stored = await db.prepare(`SELECT entity_id FROM wiki_pages WHERE page_type='entity' AND identity_status='active'
		AND entity_type='card' AND entity_id IN (?,?) ORDER BY CASE WHEN entity_id=? THEN 0 ELSE 1 END LIMIT 1`)
		.bind(input.id, scopedId, scopedId).first<{ entity_id: string }>()
	// New storage identities retain their namespace even if a vanilla URL is currently bare.
	const card = { ...input, id: stored?.entity_id ?? scopedId }
	const existing = await db.prepare(`SELECT COUNT(*) AS count FROM wiki_sections s JOIN wiki_pages p ON p.id = s.page_id
		WHERE p.page_type = 'entity' AND p.identity_status = 'active' AND p.entity_type = 'card' AND p.entity_id = ? AND s.section_key IN (${CARD_SECTION_KEYS.map(() => '?').join(',')})
		AND (s.current_revision_id IS NOT NULL OR s.version > 0 OR EXISTS (SELECT 1 FROM wiki_revisions r WHERE r.section_id = s.id))`)
		.bind(card.id, ...CARD_SECTION_KEYS).first<{ count: number }>()
	if (Number(existing?.count) === CARD_SECTION_KEYS.length) return
	const statements: D1PreparedStatement[] = [
		db.prepare(`INSERT OR IGNORE INTO wiki_pages (id, mod_id, entity_type, entity_id, slug, page_type)
			VALUES (?, ?, 'card', ?, ?, 'entity')`)
			.bind(`seed:page:card:${card.id}:${crypto.randomUUID()}`, card.mod ?? null, card.id, `card:${card.id}`)
	]
	for (const [order, key] of CARD_SECTION_KEYS.entries()) {
		const revisionId = `seed:revision:card:${card.id}:${key}:${crypto.randomUUID()}`
		const content = rawId === 'Bash' && card.mod === 'sts2' ? BASH_SECTIONS[key] : ''
		statements.push(
			db.prepare(`INSERT OR IGNORE INTO wiki_sections (id, page_id, section_key, content_type, sort_order)
				SELECT ?, id, ?, 'markdown', ? FROM wiki_pages WHERE page_type = 'entity' AND identity_status = 'active' AND entity_type = 'card' AND entity_id = ?`)
				.bind(`seed:section:card:${card.id}:${key}:${crypto.randomUUID()}`, key, order, card.id),
			db.prepare(`INSERT OR IGNORE INTO wiki_revisions
				(id, section_id, revision_no, content, summary, source_type, source_reference)
				SELECT ?, s.id, 1, ?, ?, 'mod_seed', ? FROM wiki_sections s JOIN wiki_pages p ON p.id = s.page_id
				WHERE p.page_type = 'entity' AND p.identity_status = 'active' AND p.entity_type = 'card' AND p.entity_id = ? AND s.section_key = ?
				AND s.current_revision_id IS NULL AND s.version = 0 AND NOT EXISTS (SELECT 1 FROM wiki_revisions r WHERE r.section_id = s.id)`)
				.bind(revisionId, content, SEED_SUMMARY, `wiki-seed:card:${card.id}:${key}`, card.id, key),
			db.prepare(`UPDATE wiki_sections SET current_revision_id = ?, version = 1
				WHERE current_revision_id IS NULL AND version = 0 AND EXISTS (
					SELECT 1 FROM wiki_revisions r WHERE r.id = ? AND r.section_id = wiki_sections.id)`)
				.bind(revisionId, revisionId)
		)
	}
	await db.batch(statements)
}
