import type { EntityRef, ScopedEntityRef, ResolvedEntityRef } from './entities.ts'

const TYPES = new Set(['card', 'relic', 'potion', 'power', 'keyword', 'character'])
const MOD_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/
let owners = new Map<string, Set<string>>()

function unpack(ref: ScopedEntityRef): { type: EntityRef['type']; id: string; modId?: string } | null {
	if (!TYPES.has(ref.type) || !ref.id || ref.id.length > 191 || /[\u0000-\u001f\u007f]/.test(ref.id)) return null
	const separator = ref.id.indexOf(':')
	const prefix = separator < 0 ? undefined : ref.id.slice(0, separator)
	const id = separator < 0 ? ref.id : ref.id.slice(separator + 1)
	if (!id || id.includes(':') || (prefix !== undefined && !MOD_ID.test(prefix))) return null
	if (ref.modId !== undefined && (!MOD_ID.test(ref.modId) || (prefix !== undefined && prefix !== ref.modId))) return null
	return { type: ref.type, id, modId: ref.modId ?? prefix }
}

/** Add static catalog owners; repeated registration of the same owner is harmless. */
export function registerPublicEntityRefs(refs: Iterable<ScopedEntityRef>): void {
	for (const ref of refs) {
		const parsed = unpack(ref)
		if (!parsed) throw new Error(`Invalid catalog entity reference: ${ref.type}:${ref.id}`)
		const key = `${parsed.type}:${parsed.id}`
		const mods = owners.get(key) ?? new Set<string>()
		mods.add(parsed.modId ?? 'sts2')
		owners.set(key, mods)
	}
}

/** Replace the catalog at the loading boundary (including when data is reloaded). */
export function initializePublicEntityRefs(refs: Iterable<ScopedEntityRef>): void {
	const previous = owners
	owners = new Map()
	try { registerPublicEntityRefs(refs) } catch (error) { owners = previous; throw error }
}

/** Resolve external/public or legacy IDs to a verified raw ID and explicit Mod. */
export function resolvePublicEntityRef(ref: ScopedEntityRef): ResolvedEntityRef | null {
	const parsed = unpack(ref)
	if (!parsed) return null
	const mods = owners.get(`${parsed.type}:${parsed.id}`)
	if (!mods) return null
	if (parsed.modId) return mods.has(parsed.modId) ? { ...parsed, modId: parsed.modId } : null
	return mods.size === 1 ? { ...parsed, modId: [...mods][0] } : null
}

/** Generate identity; external input must first pass resolvePublicEntityRef. */
export function publicEntityId(ref: ScopedEntityRef): string | null {
	const parsed = unpack(ref)
	if (!parsed) return null
	const mods = owners.get(`${parsed.type}:${parsed.id}`)
	if (!parsed.modId && mods && mods.size !== 1) return null
	const modId = parsed.modId ?? (mods?.size === 1 ? [...mods][0] : 'sts2')
	return modId !== 'sts2' || (mods?.size ?? 0) > 1 ? `${modId}:${parsed.id}` : parsed.id
}

export function toPublicEntityRef(ref: ScopedEntityRef): EntityRef | null {
	const id = publicEntityId(ref)
	return id === null ? null : { type: ref.type, id }
}

export function publicEntityKey(ref: ScopedEntityRef): string | null {
	const id = publicEntityId(ref)
	return id === null ? null : `${ref.type}:${id}`
}
