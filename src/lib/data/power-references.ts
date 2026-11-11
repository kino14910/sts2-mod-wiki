import { dataFiles, localizationFiles } from 'virtual:mods'
import { entityHref } from '#lib/entities'
import { stripBBCode } from '#lib/text/bbcode'
import { cardTextToPlain } from '#lib/text/card-text'
import { cardTextToWiki } from '#lib/text/card-wiki-text'
import { collectionTextToPlain, resolveCollectionText } from '#lib/text/collection-text'
import { POWERS } from './glossary'
import { CARDS, MOD_BY_ID, POTIONS, RELICS, modContentText } from './mods'

/**
 * Power wiki pages only declare which game entities they link to. The links live in
 * static/mods/{modId}/powers.json; every visible string is resolved from the mod
 * localization files (eng / zhs) and the structural game data, never stored inline.
 */

export type PowerReferenceKind = 'card' | 'relic' | 'potion' | 'power'
export type WikiLocale = 'eng' | 'zhs'

export interface PowerEntityRef {
	type: PowerReferenceKind
	id: string
	/** Machine tag for variant links such as MadScience (Sapping); not display text. */
	variant?: string
}

export interface PowerReferenceGroup {
	kind: PowerReferenceKind
	partition: string
	refs: PowerEntityRef[]
}

export interface PowerReferenceSection {
	key: string
	groups: PowerReferenceGroup[]
}

export interface PowerReferences {
	sources: PowerReferenceSection[]
	interactions: PowerReferenceSection[]
}

/** Render-ready entry. `name`, `description` and `tooltip` are always localized. */
export interface WikiEntry {
	name: string
	description: string
	/** Sources / Interactions 列表文本：基础文案 + 括号内升级值 */
	wikiText?: string
	tooltip: string
	kind: PowerReferenceKind
	/** Canonical entity id, used as a stable key in lists. */
	id?: string
	/** Link derived from entityHref; null when the entity has no page. */
	href?: string | null
}

export interface WikiGroup {
	heading: string
	subheading: string | null
	entries: WikiEntry[]
}

export interface WikiDetails {
	summary: string
	groups: WikiGroup[]
}

export interface WikiReferences {
	sources: WikiDetails[]
	interactions: WikiDetails[]
}

const REFERENCE_KINDS: readonly string[] = ['card', 'relic', 'potion', 'power']

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isReferenceKind(value: unknown): value is PowerReferenceKind {
	return typeof value === 'string' && REFERENCE_KINDS.includes(value)
}

function parseRef(value: unknown): PowerEntityRef | null {
	if (!isRecord(value) || !isReferenceKind(value.type) || typeof value.id !== 'string') return null
	const ref: PowerEntityRef = { type: value.type, id: value.id }
	if (typeof value.variant === 'string') ref.variant = value.variant
	return ref
}

function parseGroup(value: unknown): PowerReferenceGroup | null {
	if (!isRecord(value) || !isReferenceKind(value.kind) || typeof value.partition !== 'string') {
		return null
	}
	if (!Array.isArray(value.refs)) return null
	const refs = value.refs.map(parseRef).filter((ref): ref is PowerEntityRef => ref !== null)
	if (!refs.length || refs.some((ref) => ref.type !== value.kind)) return null
	return { kind: value.kind, partition: value.partition, refs }
}

function parseSection(value: unknown): PowerReferenceSection | null {
	if (!isRecord(value) || typeof value.key !== 'string' || !Array.isArray(value.groups)) {
		return null
	}
	const groups = value.groups
		.map(parseGroup)
		.filter((group): group is PowerReferenceGroup => group !== null)
	if (!groups.length) return null
	return { key: value.key, groups }
}

function parseSectionList(value: unknown): PowerReferenceSection[] {
	if (!Array.isArray(value)) return []
	return value.map(parseSection).filter((section): section is PowerReferenceSection => section !== null)
}

/** powerId -> reference sections declared in any mod's powers.json */
export const POWER_REFERENCES: Record<string, PowerReferences> = (() => {
	const result: Record<string, PowerReferences> = {}
	for (const [path, raw] of Object.entries(dataFiles)) {
		if (!path.endsWith('/powers.json') || !Array.isArray(raw)) continue
		for (const value of raw) {
			if (!isRecord(value) || typeof value.id !== 'string') continue
			const sources = parseSectionList(value.sources)
			const interactions = parseSectionList(value.interactions)
			if (sources.length || interactions.length) {
				result[value.id] = { sources, interactions }
			}
		}
	}
	return result
})()

function readLabels(locale: WikiLocale): Record<string, string> {
	const result: Record<string, string> = {}
	for (const [path, raw] of Object.entries(localizationFiles)) {
		if (!path.endsWith(`/localization/${locale}/wiki.json`) || !isRecord(raw)) continue
		for (const [key, value] of Object.entries(raw)) {
			if (typeof value === 'string') result[key] = value
		}
	}
	return result
}

const WIKI_LABELS: Record<WikiLocale, Record<string, string>> = {
	eng: readLabels('eng'),
	zhs: readLabels('zhs')
}

function upperSnake(value: string) {
	return value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()
}

function wikiLabel(locale: WikiLocale, key: string) {
	return WIKI_LABELS[locale]?.[key] ?? WIKI_LABELS.eng[key] ?? key
}

const CARD_BY_ID = new Map(CARDS.map((card) => [card.id, card] as const))
const RELIC_BY_ID = new Map(RELICS.map((relic) => [relic.id, relic] as const))
const POTION_BY_ID = new Map(POTIONS.map((potion) => [potion.id, potion] as const))
const POWER_BY_ID = new Map(POWERS.map((power) => [power.id, power] as const))

function localizedField(
	modId: string,
	kind: PowerReferenceKind,
	id: string,
	field: 'title' | 'description',
	locale: WikiLocale
) {
	const mod = MOD_BY_ID.get(modId)
	return mod ? modContentText(mod, kind, id, field, locale) : undefined
}

function escapeHtml(value: string) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

/** Build a hover tooltip from localized text; no scraped or hardcoded HTML. */
function entryTooltip(name: string, description: string) {
	const lines = description
		.split('\n')
		.filter(Boolean)
		.map((line) => `<div>${escapeHtml(line)}</div>`)
		.join('')
	return `<div class="tooltip tooltip-text" style="margin:5px"><div class="tooltip-header"><span class="tooltip-title">${escapeHtml(name)}</span></div><div class="tooltip-text">${lines}</div></div>`
}

/** Resolve one reference into a localized, linkable wiki entry. */
export function resolvePowerReference(
	ref: PowerEntityRef,
	locale: WikiLocale = 'eng'
): WikiEntry | null {
	let modId: string
	let name: string
	let description: string
	let wikiText: string | undefined

	if (ref.type === 'card') {
		const card = CARD_BY_ID.get(ref.id)
		if (!card) return null
		modId = card.mod
		name = localizedField(modId, 'card', ref.id, 'title', locale) ?? card.name
		const template = localizedField(modId, 'card', ref.id, 'description', locale) ?? card.text
		description = cardTextToPlain(template, { variables: card.variables })
		wikiText = card.upgrade?.variables
			? cardTextToWiki(template, card.variables ?? {}, card.upgrade.variables)
			: undefined
	} else if (ref.type === 'relic' || ref.type === 'potion') {
		const item =
			ref.type === 'relic' ? RELIC_BY_ID.get(ref.id) : POTION_BY_ID.get(ref.id)
		if (!item) return null
		modId = item.mod
		name = localizedField(modId, ref.type, ref.id, 'title', locale) ?? item.name
		const template = localizedField(modId, ref.type, ref.id, 'description', locale) ?? item.text
		const variables = { ...item.variables, ...(locale === 'zhs' ? item.variablesZh : {}) }
		description = collectionTextToPlain(resolveCollectionText(template, variables))
		wikiText = undefined
	} else {
		const power = POWER_BY_ID.get(ref.id)
		if (!power) return null
		modId = power.mod ?? 'sts2'
		name = localizedField(modId, 'power', ref.id, 'title', locale) ?? power.name
		const template = localizedField(modId, 'power', ref.id, 'description', locale)
		description = template ? stripBBCode(template) : stripBBCode(power.summary)
		wikiText = undefined
	}

	if (ref.variant) {
		const key = `WIKI_VARIANT_${upperSnake(ref.variant)}`
		const variant = wikiLabel(locale, key)
		if (variant !== key) {
			name = locale === 'zhs' ? `${name}（${variant}）` : `${name} (${variant})`
		}
	}

	return {
		id: ref.id,
		name,
		description,
		wikiText,
		tooltip: entryTooltip(name, description),
		kind: ref.type,
		href: entityHref({ type: ref.type, id: ref.id })
	}
}

/** All references declared by a power, in declaration order. */
export function listPowerReferences(powerId: string): PowerEntityRef[] {
	const refs = POWER_REFERENCES[powerId]
	if (!refs) return []
	return [...refs.sources, ...refs.interactions].flatMap((section) =>
		section.groups.flatMap((group) => group.refs)
	)
}

/** Render-ready sources / interactions for one power in the requested locale. */
export function powerReferenceDetails(powerId: string, locale: WikiLocale = 'eng'): WikiReferences {
	const refs = POWER_REFERENCES[powerId]
	if (!refs) return { sources: [], interactions: [] }

	const build = (sections: PowerReferenceSection[]): WikiDetails[] =>
		sections.map((section) => ({
			summary: wikiLabel(locale, `WIKI_SECTION_${upperSnake(section.key)}`),
			groups: section.groups.map((group) => ({
				heading: wikiLabel(locale, `WIKI_GROUP_${upperSnake(group.kind)}`),
				subheading: wikiLabel(locale, `WIKI_PARTITION_${upperSnake(group.partition)}`),
				entries: group.refs
					.map((ref) => resolvePowerReference(ref, locale))
					.filter((entry): entry is WikiEntry => entry !== null)
			}))
		}))

	return { sources: build(refs.sources), interactions: build(refs.interactions) }
}
