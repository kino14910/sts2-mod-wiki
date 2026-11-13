import { error, redirect } from '@sveltejs/kit'
import { findGameEntity, type GameEntity } from '#lib/data/entities'
import { entityHref, entityKey, resolvePublicEntityRef, toPublicEntityRef } from '#lib/entities'

/** Resolve route input before loading community content or selecting game data. */
export function resolveEntityRoute<T extends GameEntity['kind']>(type: T, id: string, url?: Pick<URL, 'search'>) {
	const resolved = resolvePublicEntityRef({ type, id })
	const game = resolved ? findGameEntity(resolved) : null
	const entityRef = resolved ? toPublicEntityRef(resolved) : null
	if (!resolved || !game || game.kind !== type || !entityRef) {
		error(404, 'Entity not found or ambiguous; use a Mod-qualified ID')
	}
	if (id !== entityRef.id) {
		const href = entityHref(resolved)
		if (!href) error(404, 'Entity not found')
		// Importing another Mod can make today's unique legacy ID ambiguous.
		// SvelteKit load URLs prohibit reading hash; fragments are not sent in HTTP requests.
		redirect(307, `${href}${url?.search ?? ''}`)
	}
	return {
		game: game as Extract<GameEntity, { kind: T }>,
		entityRef,
		entityKey: entityKey(entityRef)
	}
}
