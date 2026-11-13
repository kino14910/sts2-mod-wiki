import { entityKey, isEntityType, type EntityType } from '#lib/entities'

/** The catalog helper owns public-ID policy; persistence receives its resolved IDs. */
export interface CatalogIdentity {
	type: EntityType
	rawId: string
	modId: string
	publicId: string
}

export async function identityCatalogHash(catalog: readonly CatalogIdentity[]): Promise<string> {
	const text = JSON.stringify([...catalog].sort((a, b) => entityKey({ type: a.type, id: `${a.modId}:${a.rawId}` }).localeCompare(entityKey({ type: b.type, id: `${b.modId}:${b.rawId}` }))))
	const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
	return [...new Uint8Array(bytes)].map((n) => n.toString(16).padStart(2, '0')).join('')
}

/** All remapping, quarantine metadata and audit records commit in one transaction. */
export async function migrateEntityIdentities(db: D1Database, catalog: readonly CatalogIdentity[]) {
	const hash = await identityCatalogHash(catalog)
	if (await db.prepare(`SELECT 1 AS present FROM wiki_identity_current c JOIN wiki_identity_data_epoch e ON e.id=c.id
		WHERE c.id=1 AND c.catalog_hash=? AND c.data_epoch=e.version`).bind(hash).first()) return
	const groups = new Map<string, CatalogIdentity[]>()
	for (const item of catalog) {
		const key = entityKey({ type: item.type, id: item.rawId })
		const group = groups.get(key) ?? []
		if (!group.some((v) => v.modId === item.modId)) group.push(item)
		groups.set(key, group)
	}
	const { results: pages } = await db.prepare(`SELECT id, page_type, entity_type, entity_id, entity_mod_id, mod_id, slug FROM wiki_pages
		WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM wiki_identity_archives a WHERE a.page_id = wiki_pages.id)`)
		.all<{ id: string; page_type: string; entity_type: string; entity_id: string; entity_mod_id: string | null; mod_id: string | null; slug: string }>()
	const { results: comments } = await db.prepare("SELECT DISTINCT target_id FROM comments WHERE target_type = 'card'")
		.all<{ target_id: string }>()
	const { results: previous } = await db.prepare('SELECT entity_type,legacy_id,resolution,owner_mod_id FROM wiki_identity_mappings')
		.all<{ entity_type: string; legacy_id: string; resolution: string; owner_mod_id: string | null }>()
	const previousMappings = new Map(previous.map((p) => [`${p.entity_type}:${p.legacy_id}`, p]))
	const legacy = new Map<string, { type: EntityType; id: string }>()
	for (const p of pages) if (isEntityType(p.entity_type) && !p.entity_id.includes(':'))
		legacy.set(`${p.entity_type}:${p.entity_id}`, { type: p.entity_type, id: p.entity_id })
	for (const c of comments) if (!c.target_id.includes(':')) legacy.set(`card:${c.target_id}`, { type: 'card', id: c.target_id })
	const statements: D1PreparedStatement[] = []
	for (const [key, ref] of legacy) {
		const candidates = (groups.get(key) ?? []).sort((a, b) => a.modId.localeCompare(b.modId))
		const prior = previousMappings.get(key)
		const matchingPages = pages.filter((p) => p.entity_type === ref.type && p.entity_id === ref.id)
		const originalOwners = new Set(matchingPages.filter((p) => p.page_type === 'entity' && p.mod_id).map((p) => p.mod_id!))
		const candidate = prior
			? prior.resolution === 'unique' ? candidates.find((c) => c.modId === prior.owner_mod_id) ?? null : null
			: candidates.length === 1 && originalOwners.size === 1 ? candidates[0] : null
		const ownerMismatch = candidate && originalOwners.size > 0 && !originalOwners.has(candidate.modId)
		const unique = ownerMismatch ? null : candidate
		const resolution = ownerMismatch ? 'owner_mismatch' : unique ? 'unique' : candidates.length > 1 ? 'ambiguous' : 'missing'
		const evidence = JSON.stringify(candidates)
		statements.push(db.prepare(`INSERT INTO wiki_identity_mappings
			(entity_type, legacy_id, resolution, owner_mod_id, canonical_id, candidates_json, catalog_hash)
			VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(entity_type,legacy_id) DO NOTHING`)
			.bind(ref.type, ref.id, resolution, unique?.modId ?? [...originalOwners][0] ?? null, unique?.publicId ?? null, evidence, hash))
		for (const p of matchingPages) {
			// A mod documentation page has an explicit namespace supplied by its own manifest.
			const scoped = p.page_type === 'mod' ? candidates.find((c) => c.modId === (p.entity_mod_id ?? p.mod_id))
				: unique && (!p.mod_id || p.mod_id === unique.modId) ? unique : null
			if (scoped && scoped.publicId === ref.id) continue
			if (scoped) {
				const canonicalSlug = p.page_type === 'entity' ? `${ref.type}:${scoped.publicId}` : p.slug
				statements.push(db.prepare(`UPDATE wiki_pages SET entity_id = ?, slug = ?, entity_mod_id = ?, mod_id = CASE WHEN page_type='entity' THEN ? ELSE mod_id END WHERE id = ? AND entity_id = ?
					AND NOT EXISTS (SELECT 1 FROM wiki_identity_archives a WHERE a.page_id = wiki_pages.id)
					AND (?='mod' OR EXISTS (SELECT 1 FROM wiki_identity_mappings m WHERE m.entity_type=wiki_pages.entity_type
					AND m.legacy_id=wiki_pages.entity_id AND m.resolution='unique' AND m.owner_mod_id=?))
					AND NOT EXISTS (SELECT 1 FROM wiki_pages other WHERE other.page_type = 'entity' AND other.identity_status = 'active' AND ? = 'entity'
					AND other.entity_type = ? AND other.entity_id = ? AND other.id != wiki_pages.id)
					AND NOT EXISTS (SELECT 1 FROM wiki_pages other WHERE other.page_type = 'entity' AND other.identity_status = 'active' AND ? = 'entity'
					AND other.slug = ? AND other.id != wiki_pages.id)`)
					.bind(scoped.publicId, canonicalSlug, scoped.modId, scoped.modId, p.id, ref.id, p.page_type, scoped.modId, p.page_type, ref.type, scoped.publicId, p.page_type, canonicalSlug))
			}
			const reason = scoped ? 'canonical_destination_exists' : resolution
			statements.push(db.prepare(`INSERT OR IGNORE INTO wiki_identity_archives
				(page_id,entity_type,legacy_id,original_mod_id,original_entity_mod_id,original_slug,reason,candidates_json)
				SELECT id,entity_type,entity_id,mod_id,entity_mod_id,slug,?,? FROM wiki_pages WHERE id = ? AND entity_id = ?`)
				.bind(reason, evidence, p.id, ref.id))
			statements.push(db.prepare(`UPDATE wiki_pages SET identity_status = 'archived' WHERE id = ?
				AND EXISTS (SELECT 1 FROM wiki_identity_archives a WHERE a.page_id = wiki_pages.id)`)
				.bind(p.id))
			statements.push(db.prepare(`INSERT OR IGNORE INTO wiki_audit_logs (id,action,target_type,target_id,metadata_json)
				SELECT ?, 'wiki.identity.page', 'wiki_page', id, ? FROM wiki_pages WHERE id = ?`)
				.bind(`identity:${hash}:page:${p.id}`, JSON.stringify({ from: ref.id, to: scoped?.publicId ?? null, candidates, catalogHash: hash }), p.id))
		}
		if (ref.type === 'card') {
			// A duplicate/ambiguous page's raw discussion stays with that archive, not with
			// an independently created canonical page which merely shares the same identity.
			statements.push(db.prepare(`INSERT OR IGNORE INTO wiki_comment_identity_archives
				(comment_id,legacy_target_id,reason,candidates_json) SELECT id,target_id,'legacy_page_archived',?
				FROM comments WHERE target_type='card' AND target_id=? AND EXISTS (
				SELECT 1 FROM wiki_identity_archives a WHERE a.entity_type='card' AND a.legacy_id=comments.target_id)`)
				.bind(evidence, ref.id))
			if (unique) {
				const storageId = `${unique.modId}:${unique.rawId}`
				statements.push(db.prepare(`UPDATE comments SET target_id = ?
					WHERE target_type = 'card' AND target_id = ? AND NOT EXISTS (
					SELECT 1 FROM wiki_comment_identity_archives a WHERE a.comment_id = comments.id)
					AND EXISTS (SELECT 1 FROM wiki_identity_mappings m WHERE m.entity_type='card' AND m.legacy_id=comments.target_id
					AND m.resolution='unique' AND m.owner_mod_id=?)`)
					.bind(storageId, ref.id, unique.modId))
				statements.push(db.prepare(`INSERT OR IGNORE INTO wiki_comment_identity_archives
					(comment_id,legacy_target_id,reason,candidates_json) SELECT id,target_id,'immutable_owner_conflict',?
					FROM comments WHERE target_type='card' AND target_id=?`)
					.bind(evidence, ref.id))
			}
			else if (!unique) statements.push(db.prepare(`INSERT OR IGNORE INTO wiki_comment_identity_archives
				(comment_id, legacy_target_id, reason, candidates_json)
				SELECT id,target_id,?,? FROM comments WHERE target_type = 'card' AND target_id = ?`)
				.bind(resolution, evidence, ref.id))
		}
		statements.push(db.prepare(`INSERT OR IGNORE INTO wiki_audit_logs (id,action,target_type,target_id,metadata_json)
			VALUES (?, 'wiki.identity.map', 'entity', ?, ?)`)
			.bind(`identity:${hash}:${key}`, key, JSON.stringify({ resolution, canonicalId: unique?.publicId ?? null, candidates, catalogHash: hash })))
	}
	statements.push(db.prepare('INSERT OR IGNORE INTO wiki_identity_runs(catalog_hash) VALUES (?)').bind(hash))
	statements.push(db.prepare(`INSERT INTO wiki_identity_current(id,catalog_hash,data_epoch)
		SELECT 1,?,version FROM wiki_identity_data_epoch WHERE id=1
		ON CONFLICT(id) DO UPDATE SET catalog_hash=excluded.catalog_hash,data_epoch=excluded.data_epoch`).bind(hash))
	await db.batch(statements)
}
