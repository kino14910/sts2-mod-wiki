import { entityKey, registerPublicEntityRefs, resolvePublicEntityRef, publicEntityKey, type EntityRef, type EntityType, type ScopedEntityRef } from '#lib/entities'
import type { Card } from './cards'
import type { CollectionEntry } from './collections'
import { KEYWORDS, POWERS, type GlossaryEntry } from './glossary'
import { CARDS, POTIONS, RELICS } from './mods'

export type GameEntity =
	| { kind: 'card'; data: Card }
	| { kind: 'relic'; data: CollectionEntry }
	| { kind: 'potion'; data: CollectionEntry }
	| { kind: 'power'; data: GlossaryEntry }
	| { kind: 'keyword'; data: GlossaryEntry }

export type { ScopedEntityRef } from '#lib/entities'

export function scopedEntityKey(ref: ScopedEntityRef): string {
	return `${ref.modId ?? 'sts2'}:${entityKey(ref)}`
}

export const GAME_ENTITY_TYPES: readonly EntityType[] = [
	'card',
	'relic',
	'potion',
	'power',
	'keyword'
]

// A null entry records an ambiguous public id without choosing a Mod by load order.
const INDEX = new Map<string, GameEntity | null>()
const SCOPED_INDEX = new Map<string, GameEntity>()
export const ENTITY_ID_CONFLICTS = new Map<string, ScopedEntityRef[]>()

function register(ref: EntityRef, entity: GameEntity) {
	const scoped = { ...ref, modId: entity.data.mod ?? 'sts2' }
	const key = entityKey(ref)
	const existing = INDEX.get(key)
	if (INDEX.has(key)) {
		const refs = ENTITY_ID_CONFLICTS.get(key) ?? (existing ? [{ ...ref, modId: existing.data.mod ?? 'sts2' }] : [])
		refs.push(scoped)
		ENTITY_ID_CONFLICTS.set(key, refs)
		INDEX.set(key, null)
	} else INDEX.set(key, entity)
	SCOPED_INDEX.set(scopedEntityKey(scoped), entity)
}

for (const card of CARDS) {
	register({ type: 'card', id: card.id }, { kind: 'card', data: card })
}
for (const relic of RELICS) {
	register({ type: 'relic', id: relic.id }, { kind: 'relic', data: relic })
}
for (const potion of POTIONS) {
	register({ type: 'potion', id: potion.id }, { kind: 'potion', data: potion })
}
for (const power of POWERS) {
	register({ type: 'power', id: power.id }, { kind: 'power', data: power })
}
for (const keyword of KEYWORDS) {
	register({ type: 'keyword', id: keyword.id }, { kind: 'keyword', data: keyword })
}

// All owners are admitted; public IDs encode scope and ambiguous bare IDs reject.
registerPublicEntityRefs(listEntityRefs())

export function findGameEntity(ref: ScopedEntityRef): GameEntity | null {
	const resolved = resolvePublicEntityRef(ref)
	return resolved ? SCOPED_INDEX.get(scopedEntityKey(resolved)) ?? null : null
}

export function hasGameEntity(ref: ScopedEntityRef): boolean {
	return findGameEntity(ref) !== null
}

export function listEntityRefs(): ScopedEntityRef[] {
	const refs: ScopedEntityRef[] = []
	for (const entity of SCOPED_INDEX.values()) {
		refs.push({ type: entity.kind, id: entity.data.id, modId: entity.data.mod ?? 'sts2' })
	}
	return refs
}

export function listEntityKeys(): string[] {
	return listEntityRefs().map((ref) => publicEntityKey(ref)!)
}
