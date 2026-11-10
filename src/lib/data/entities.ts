import { entityKey, type EntityRef, type EntityType } from '#lib/entities'
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

export const GAME_ENTITY_TYPES: readonly EntityType[] = [
	'card',
	'relic',
	'potion',
	'power',
	'keyword'
]

const INDEX = new Map<string, GameEntity>()

for (const card of CARDS) {
	INDEX.set(entityKey({ type: 'card', id: card.id }), { kind: 'card', data: card })
}
for (const relic of RELICS) {
	INDEX.set(entityKey({ type: 'relic', id: relic.id }), { kind: 'relic', data: relic })
}
for (const potion of POTIONS) {
	INDEX.set(entityKey({ type: 'potion', id: potion.id }), { kind: 'potion', data: potion })
}
for (const power of POWERS) {
	INDEX.set(entityKey({ type: 'power', id: power.id }), { kind: 'power', data: power })
}
for (const keyword of KEYWORDS) {
	INDEX.set(entityKey({ type: 'keyword', id: keyword.id }), { kind: 'keyword', data: keyword })
}

export function findGameEntity(ref: EntityRef): GameEntity | null {
	return INDEX.get(entityKey(ref)) ?? null
}

export function hasGameEntity(ref: EntityRef): boolean {
	return INDEX.has(entityKey(ref))
}

export function listEntityRefs(): EntityRef[] {
	const refs: EntityRef[] = []
	for (const key of INDEX.keys()) {
		const separator = key.indexOf(':')
		const type = key.slice(0, separator) as EntityType
		refs.push({ type, id: key.slice(separator + 1) })
	}
	return refs
}

export function listEntityKeys(): string[] {
	return [...INDEX.keys()]
}
