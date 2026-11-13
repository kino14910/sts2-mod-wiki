import type { WikiPage } from '#lib/data/power-wiki'
import type { RelicWikiPage } from '#lib/data/relic-wiki'

export type WikiDocument =
	| { kind: 'relic'; page: RelicWikiPage }
	| { kind: 'power'; page: WikiPage }
	| { kind: 'card'; page: CardWikiDocument }

export interface CardWikiDocument {
	title: string
	sections: { key: string; content: string }[]
}

export function parseWikiDocument(value: unknown): WikiDocument | null {
	if (typeof value !== 'object' || value === null) return null
	const record = value as { kind?: unknown; page?: unknown }
	if (record.kind !== 'relic' && record.kind !== 'power' && record.kind !== 'card') return null
	if (typeof record.page !== 'object' || record.page === null) return null
	const page = record.page as Record<string, unknown>
	if (typeof page.title !== 'string') return null
	if (record.kind === 'card' && (!Array.isArray(page.sections) || !page.sections.every((s) =>
		s && typeof s === 'object' && typeof s.key === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(s.key) && typeof s.content === 'string'))) return null
	if (record.kind === 'power' && (typeof page.stackType !== 'string' || typeof page.text !== 'string' ||
		!strings(page.order) || !strings(page.effectsImmune))) return null
	if (record.kind === 'relic' && (!Array.isArray(page.gameTabs) || !Array.isArray(page.glossary) ||
		!strings(page.intro) || !Array.isArray(page.sections) || !object(page.infobox) ||
		!object(page.updateHistory) || !object(page.tokens) || !object(page.tooltips))) return null
	if (record.kind === 'relic' && !validRelic(page)) return null
	return { kind: record.kind, page: record.page } as WikiDocument
}

function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every((v) => typeof v === 'string') }
function object(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function optionalString(record: Record<string, unknown>, field: string): boolean { return record[field] === undefined || typeof record[field] === 'string' }
function labeledLink(value: unknown): boolean { return object(value) && typeof value.label === 'string' && optionalString(value, 'href') }
function validRelic(page: Record<string, unknown>): boolean {
	const info = page.infobox, history = page.updateHistory
	if (!object(info) || !strings(info.variants) || !labeledLink(info.rarity) || !labeledLink(info.character) ||
		!object(info.image) || !['backing', 'frame', 'art', 'alt', 'fileHref'].every((key) => typeof info.image === 'object' && info.image !== null && typeof (info.image as Record<string, unknown>)[key] === 'string') ||
		typeof info.description !== 'string' || typeof info.flavor !== 'string') return false
	if (!(page.gameTabs as unknown[]).every(labeledLink)) return false
	if (!(page.glossary as unknown[]).every((g) => object(g) && typeof g.title === 'string' && typeof g.text === 'string' && optionalString(g, 'icon') && optionalString(g, 'infoHref'))) return false
	if (!(page.sections as unknown[]).every((s) => object(s) && typeof s.id === 'string' && typeof s.title === 'string' &&
		(s.level === 2 || s.level === 3) && (s.paragraphs === undefined || strings(s.paragraphs)) &&
		(s.lists === undefined || (Array.isArray(s.lists) && s.lists.every(strings))) &&
		(s.table === undefined || s.table === 'updateHistory'))) return false
	if (!object(history) || !strings(history.columns) || !Array.isArray(history.rows) || !history.rows.every((r) =>
		Array.isArray(r) && r.every((c) => object(c) && optionalString(c, 'text') && optionalString(c, 'subtext') && optionalString(c, 'href') && (c.lines === undefined || strings(c.lines))))) return false
	if (!object(page.tokens) || !Object.values(page.tokens).every((t) => object(t) && ['text', 'icon', 'href', 'tooltip'].every((k) => optionalString(t, k)))) return false
	return object(page.tooltips) && Object.values(page.tooltips).every((t) => typeof t === 'string')
}
