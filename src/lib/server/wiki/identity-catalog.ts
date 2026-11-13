import { listEntityRefs } from '#lib/data/entities'
import { MOD_CHARACTERS } from '#lib/data/mods'
import { publicEntityId, registerPublicEntityRefs, resolvePublicEntityRef, type ScopedEntityRef } from '#lib/entities'
import { identityCatalogHash, migrateEntityIdentities, type CatalogIdentity } from './entity-identity'
import { CommentError, normalizeCommentTarget } from './comment-service'

/** The catalog helper is the only implementation of public-ID policy. */
export function currentIdentityCatalog(): CatalogIdentity[] {
	const characters = MOD_CHARACTERS.map((c) => ({ type: 'character' as const, id: c.id, modId: c.mod }))
	registerPublicEntityRefs(characters)
	return [...listEntityRefs(), ...characters].flatMap((ref) => {
		const resolved = resolvePublicEntityRef(ref)
		const publicId = resolved && publicEntityId(resolved)
		return resolved && publicId ? [{ type: resolved.type, rawId: resolved.id, modId: resolved.modId, publicId }] : []
	})
}

export function canonicalWikiEntity(ref: ScopedEntityRef) {
	const resolved = resolvePublicEntityRef(ref)
	const id = resolved && publicEntityId(resolved)
	return resolved && id ? { type: resolved.type, id } : null
}

/** Pin first-use bare ownership before later catalog changes can reuse the same raw ID. */
export async function pinEntityOwnership(db: D1Database, ref: ScopedEntityRef) {
	const resolved = resolvePublicEntityRef(ref)
	if (!resolved) return
	const catalog = currentIdentityCatalog()
	const candidates = catalog.filter((c) => c.type === resolved.type && c.rawId === resolved.id)
	const unique = candidates.length === 1 ? candidates[0] : null
	const hash = await identityCatalogHash(catalog)
	const marker = crypto.randomUUID()
	await db.batch([
		db.prepare(`INSERT OR IGNORE INTO wiki_identity_mappings
			(entity_type,legacy_id,resolution,owner_mod_id,canonical_id,candidates_json,catalog_hash)
			VALUES (?,?,?,?,?,?,?)`).bind(resolved.type, resolved.id, unique ? 'unique' : 'ambiguous',
				unique?.modId ?? null, unique?.publicId ?? null, JSON.stringify(candidates), hash),
		db.prepare(`INSERT INTO wiki_audit_logs(id,action,target_type,target_id,metadata_json)
			SELECT ?, 'wiki.identity.first_use', 'entity', ?, ? WHERE changes()=1`)
			.bind(marker, `${resolved.type}:${resolved.id}`, JSON.stringify({ candidates, catalogHash: hash }))
	])
}

export async function canonicalCommentTarget(db: D1Database, type: unknown, inputId: unknown) {
	const target = normalizeCommentTarget(type, inputId)
	await ensureCanonicalIdentities(db)
	if (target.targetType !== 'card') return target
	const resolved = resolvePublicEntityRef({ type: 'card', id: target.targetId })
	const id = resolved && publicEntityId(resolved)
	if (!resolved || !id) throw new CommentError(404, 'card identity is unknown or ambiguous')
	await pinEntityOwnership(db, resolved)
	if (id !== target.targetId) {
		const mapping = await db.prepare(`SELECT resolution,owner_mod_id FROM wiki_identity_mappings
			WHERE entity_type='card' AND legacy_id=?`).bind(target.targetId).first<{ resolution: string; owner_mod_id: string | null }>()
		if (mapping && (mapping.resolution !== 'unique' || mapping.owner_mod_id !== resolved.modId))
			throw new CommentError(409, 'legacy card identity requires explicit namespace')
	}
	const scopedId = `${resolved.modId}:${resolved.id}`
	return { ...target, targetId: scopedId }
}

const pending = new WeakMap<D1Database, { catalog: string; promise: Promise<void> }>()
export async function ensureCanonicalIdentities(db: D1Database): Promise<void> {
	const catalog = currentIdentityCatalog()
	const signature = JSON.stringify(catalog)
	let entry = pending.get(db)
	if (!entry || entry.catalog !== signature) {
		const promise = migrateEntityIdentities(db, catalog)
		entry = { catalog: signature, promise }
		pending.set(db, entry)
	}
	try { await entry.promise }
	finally { if (pending.get(db) === entry) pending.delete(db) }
}
