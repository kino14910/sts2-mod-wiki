import type { WikiPage } from '#lib/data/power-wiki'
import type { RelicWikiPage } from '#lib/data/relic-wiki'

export type WikiDocument =
	| { kind: 'relic'; page: RelicWikiPage }
	| { kind: 'power'; page: WikiPage }

export function parseWikiDocument(value: unknown): WikiDocument | null {
	if (typeof value !== 'object' || value === null) return null
	const record = value as { kind?: unknown; page?: unknown }
	if (record.kind !== 'relic' && record.kind !== 'power') return null
	if (typeof record.page !== 'object' || record.page === null) return null
	const page = record.page as { title?: unknown }
	if (typeof page.title !== 'string') return null
	return { kind: record.kind, page: record.page } as WikiDocument
}
