import { entityKey, type EntityRef } from '#lib/entities'

export interface CrossModEntityIdConflict {
	key: string
	modIds: string[]
}

export class EntityIdConflictError extends Error {
	constructor(readonly conflicts: CrossModEntityIdConflict[]) {
		super(`Cross-Mod entity ID conflicts: ${conflicts.map(({ key, modIds }) => `${key} [${modIds.join(', ')}]`).join('; ')}. `
			+ 'Public URLs and community history use type:id without a Mod namespace. '
			+ 'Rename the conflicting IDs or migrate URLs and history before publishing this catalog.')
		this.name = 'EntityIdConflictError'
	}
}

/** Admission check for catalogs served through unscoped routes and community keys. */
export function assertNoCrossModEntityIdConflicts(refs: Iterable<EntityRef & { modId?: string }>): void {
	const owners = new Map<string, Set<string>>()
	for (const ref of refs) {
		const key = entityKey(ref)
		const modIds = owners.get(key) ?? new Set<string>()
		modIds.add(ref.modId ?? 'sts2')
		owners.set(key, modIds)
	}
	const conflicts = [...owners.entries()]
		.filter(([, modIds]) => modIds.size > 1)
		.map(([key, modIds]) => ({ key, modIds: [...modIds].sort() }))
		.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
	if (conflicts.length) throw new EntityIdConflictError(conflicts)
}
