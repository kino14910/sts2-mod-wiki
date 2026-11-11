export const ENTITY_TYPES = ['card', 'relic', 'potion', 'power', 'keyword', 'character'] as const

export type EntityType = (typeof ENTITY_TYPES)[number]

export interface EntityRef {
	type: EntityType
	id: string
}

const ENTITY_TYPE_SET = new Set<string>(ENTITY_TYPES)
const MAX_ID_LENGTH = 191

export function isEntityType(value: string): value is EntityType {
	return ENTITY_TYPE_SET.has(value)
}

export function isValidEntityId(id: string): boolean {
	return id.length > 0 && id.length <= MAX_ID_LENGTH && !/[\u0000-\u001f\u007f]/.test(id)
}

export function isValidEntityRef(ref: EntityRef): boolean {
	return isEntityType(ref.type) && isValidEntityId(ref.id)
}

export function entityKey(ref: EntityRef): string {
	return `${ref.type}:${ref.id}`
}

export function entitySlug(ref: EntityRef): string {
	return entityKey(ref)
}

export function parseEntityKey(key: string): EntityRef | null {
	const separator = key.indexOf(':')
	if (separator < 1) return null
	const type = key.slice(0, separator)
	const id = key.slice(separator + 1)
	if (!isEntityType(type) || !isValidEntityId(id)) return null
	return { type, id }
}

export function entityHref(ref: EntityRef): string {
	const id = encodeURIComponent(ref.id)
	switch (ref.type) {
		case 'card':
			return `/cards/${id}`
		case 'relic':
			return `/relic/${id}`
		case 'power':
			return `/power/${id}`
		case 'potion':
			return `/potions#potion-${id}`
		case 'keyword':
			return `/keywords#${id}`
		case 'character':
			return `/cards?color=${id}`
	}
}

export type PageType = 'entity' | 'mod'
export type RevisionSourceType =
	| 'mod_seed'
	| 'mod_update'
	| 'community'
	| 'moderation'
	| 'rollback'

export interface ModPageRef {
	modId: string
	slug: string
	entityType?: EntityType
	entityId?: string
}

export type WikiPageRef =
	| { kind: 'entity'; ref: EntityRef }
	| { kind: 'mod'; modId: string; slug: string }

export function isValidModId(value: string): boolean {
	return /^[a-z0-9][a-z0-9._-]{0,63}$/.test(value)
}

export function modPageKey(ref: ModPageRef): string {
	return `mod:${ref.modId}:${ref.slug}`
}

export function parseModPageKey(key: string): ModPageRef | null {
	if (!key.startsWith('mod:')) return null
	const rest = key.slice(4)
	const separator = rest.indexOf(':')
	if (separator < 1) return null
	const modId = rest.slice(0, separator)
	const slug = rest.slice(separator + 1)
	if (!isValidModId(modId) || slug.length === 0) return null
	return { modId, slug }
}

export function modPageHref(ref: ModPageRef): string {
	const segments = ref.slug.split('/').map(encodeURIComponent).join('/')
	return `/mods/${encodeURIComponent(ref.modId)}/wiki/${segments}`
}

export function wikiPageKey(page: WikiPageRef): string {
	return page.kind === 'entity' ? entityKey(page.ref) : modPageKey(page)
}
