import { localizationFiles } from 'virtual:mods'
import { getLocale } from '#lib/paraglide/runtime'
import { cardHref } from './cards'
import { entryIdFor } from './mod-dependency'
import { POWERS } from './glossary'
import { CARDS, MOD_BY_ID, POTIONS, RELICS, modContentText } from './mods'
import {
	POWER_REFERENCES,
	listPowerReferences,
	resolvePowerReference,
	type PowerEntityRef,
	type WikiEntry
} from './power-references'
import { powerHrefByName } from './wiki-links'
import raw from './power-wiki.json'
import zhMirror from './power-wiki.zh.json'
import tooltips from './wiki-tooltips.json'
import { KEYWORD_ALIASES, POWER_ALIASES } from './wiki-aliases'

export type { WikiDetails, WikiEntry, WikiGroup } from './power-references'

const POWER_WIKI_ZH = zhMirror as Record<string, Partial<WikiPage>>

/** Overlay the Chinese mirror onto an English wiki page when the locale is zhs. */
export function localizePowerWiki(page: WikiPage, id: string, locale: string): WikiPage {
	if (locale !== 'zhs') return page
	const zh = POWER_WIKI_ZH[id]
	if (!zh) return page
	return {
		title: zh.title ?? page.title,
		stackType: zh.stackType ?? page.stackType,
		text: zh.text ?? page.text,
		order: zh.order ?? page.order,
		effectsImmune: zh.effectsImmune ?? page.effectsImmune
	}
}

/** Narrative-only wiki page; sources / interactions live in each mod's powers.json. */
export interface WikiPage {
	title: string
	stackType: string
	text: string
	order: string[]
	effectsImmune: string[]
}

export const POWER_WIKI = raw as unknown as Record<string, WikiPage>

/** English-name index of every entity reachable from a power reference. */
export const WIKI_ENTRIES: Map<string, WikiEntry> = (() => {
	const map = new Map<string, WikiEntry>()
	for (const powerId of Object.keys(POWER_REFERENCES)) {
		for (const ref of listPowerReferences(powerId)) {
			const entry = resolvePowerReference(ref, 'eng')
			if (!entry) continue
			const key = entry.name.trim().toLowerCase()
			if (!map.has(key)) map.set(key, entry)
		}
	}
	return map
})()

const POWER_TOOLTIPS = tooltips.powers as Record<string, string>
const KEYWORD_TOOLTIPS = tooltips.keywords as Record<string, string>

export interface WikiTerm {
	name: string
	tooltip: string
	icon: string
}

export const WIKI_TERMS: Map<string, WikiTerm> = (() => {
	const map = new Map<string, WikiTerm>()
	for (const [name, html] of Object.entries(POWER_TOOLTIPS)) {
		map.set(name.toLowerCase(), { name, tooltip: html, icon: name })
	}
	for (const [name, html] of Object.entries(KEYWORD_TOOLTIPS)) {
		const key = name.toLowerCase()
		if (!map.has(key)) map.set(key, { name, tooltip: html, icon: '' })
	}
	for (const [alias, name] of Object.entries({ ...POWER_ALIASES, ...KEYWORD_ALIASES })) {
		const term = map.get(name.toLowerCase())
		if (term) map.set(alias.toLowerCase(), term)
	}
	return map
})()

export function wikiTerm(name: string) {
	return WIKI_TERMS.get(name.trim().toLowerCase())
}

const GAME_ENTITIES: Array<{ ref: PowerEntityRef; name: string; mod: string }> = [
	...CARDS.map((card) => ({ ref: { type: 'card', id: card.id } as const, name: card.name, mod: card.mod })),
	...RELICS.map((relic) => ({ ref: { type: 'relic', id: relic.id } as const, name: relic.name, mod: relic.mod })),
	...POTIONS.map((potion) => ({ ref: { type: 'potion', id: potion.id } as const, name: potion.name, mod: potion.mod })),
	...POWERS.map((power) => ({ ref: { type: 'power', id: power.id } as const, name: power.name, mod: power.mod ?? 'sts2' }))
]

function entityNames(entity: (typeof GAME_ENTITIES)[number]) {
	const names = [entity.name]
	const mod = MOD_BY_ID.get(entity.mod)
	const zh = mod ? modContentText(mod, entity.ref.type, entity.ref.id, 'title', 'zhs') : undefined
	if (zh) names.push(zh)
	return names
}

const NAME_IDS = new Map<string, Set<string>>()
for (const entity of GAME_ENTITIES) {
	for (const name of entityNames(entity)) {
		const slot = `${entity.ref.type}:${name.trim().toLowerCase()}`
		const ids = NAME_IDS.get(slot) ?? new Set<string>()
		ids.add(entity.ref.id)
		NAME_IDS.set(slot, ids)
	}
}

/** Short or same-kind duplicate names would link ordinary words or the wrong card. */
function isSafeGlobalName(name: string, kind: PowerEntityRef['type']) {
	const key = name.trim().toLowerCase()
	if (!key || NAME_IDS.get(`${kind}:${key}`)?.size !== 1) return false
	return !/^[\x20-\x7e]+$/.test(name) || name.replace(/\s/g, '').length >= 6
}

const GAME_REFS = new Map<string, PowerEntityRef>()
const GAME_EXACT_NAMES = new Set<string>()
for (const entity of GAME_ENTITIES) {
	for (const name of entityNames(entity)) {
		if (!isSafeGlobalName(name, entity.ref.type)) continue
		GAME_EXACT_NAMES.add(name.trim())
		const key = name.trim().toLowerCase()
		if (!GAME_REFS.has(key)) GAME_REFS.set(key, entity.ref)
	}
}

const WIKI_TEXTS_EN = localizationFiles['/static/mods/sts2/localization/eng/powers.json'] as
	| Record<string, string>
	| undefined

const WIKI_TEXTS_ZH = localizationFiles['/static/mods/sts2/localization/zhs/powers.json'] as
	| Record<string, string>
	| undefined

const ZH_CARD_TITLES = localizationFiles['/static/mods/sts2/localization/zhs/cards.json'] as
	| Record<string, string>
	| undefined

const ZH_RELIC_TITLES = localizationFiles['/static/mods/sts2/localization/zhs/relics.json'] as
	| Record<string, string>
	| undefined

const STS2_DEPENDENCY = MOD_BY_ID.get('sts2')?.dependency

function zhTitle(kind: 'card' | 'relic', id: string) {
	if (!STS2_DEPENDENCY) return undefined
	const texts = kind === 'card' ? ZH_CARD_TITLES : ZH_RELIC_TITLES
	return texts?.[`${entryIdFor(STS2_DEPENDENCY, kind, id)}.title`]
}

function compactName(value: string) {
	return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '')
}

export const WIKI_ENTITY_ALIASES: Map<string, WikiEntry> = (() => {
	const map = new Map(WIKI_ENTRIES)
	for (const powerId of Object.keys(POWER_REFERENCES)) {
		for (const ref of listPowerReferences(powerId)) {
			const entry = resolvePowerReference(ref, 'eng')
			if (!entry) continue
			const zh = resolvePowerReference(ref, 'zhs')
			const aliases = [ref.id, ...(zh && zh.name !== entry.name ? [zh.name] : [])]
			for (const alias of aliases) {
				const key = alias.trim().toLowerCase()
				if (!map.has(key)) map.set(key, entry)
			}
		}
	}
	return map
})()

export function wikiEntity(name: string) {
	return WIKI_ENTITY_ALIASES.get(name.trim().toLowerCase())
}

export const WIKI_TERM_NAMES = [
	...new Set([...WIKI_ENTITY_ALIASES.keys(), ...WIKI_TERMS.keys(), ...GAME_REFS.keys()])
].sort((a, b) => b.length - a.length)

const RESOLVED_ENTRIES = new Map<string, WikiEntry>()

const EXACT_NAMES = new Set<string>()
for (const entry of WIKI_ENTRIES.values()) {
	EXACT_NAMES.add(entry.name)
	if (entry.id) EXACT_NAMES.add(entry.id)
}
for (const name of GAME_EXACT_NAMES) EXACT_NAMES.add(name)

/** One lookup for every inline wiki token: referenced entries, tooltip terms, game entities. */
export function wikiEntryFor(name: string): WikiEntry | null {
	const value = name.trim()
	const key = value.toLowerCase()
	const ascii = /^[\x20-\x7e]+$/.test(value)
	const referenced = WIKI_ENTITY_ALIASES.get(key)
	if (referenced) return ascii && !EXACT_NAMES.has(value) ? null : referenced

	const term = wikiTerm(key)
	if (term) {
		return {
			name: term.name,
			description: '',
			tooltip: term.tooltip,
			kind: 'power',
			href: powerHrefByName(term.name)
		}
	}

	if (!EXACT_NAMES.has(value)) return null
	const ref = GAME_REFS.get(key)
	if (!ref) return null
	const cached = RESOLVED_ENTRIES.get(key)
	if (cached) return cached
	const entry = resolvePowerReference(ref, 'eng')
	if (!entry) return null
	RESOLVED_ENTRIES.set(key, entry)
	return entry
}

export interface WikiRelic {
	name: string
	icon: string
	tooltip: string
	aliases: string[]
}

const RELIC_ICONS = new Map(
	RELICS.filter((relic) => relic.image).map((relic) => [compactName(relic.name), relic] as const)
)

const RELIC_ICONS_BY_ID = new Map(
	RELICS.filter((relic) => relic.image).map((relic) => [relic.id.toLowerCase(), relic] as const)
)

export function wikiRelic(name: string): WikiRelic | undefined {
	const relic =
		RELIC_ICONS_BY_ID.get(name.trim().toLowerCase()) ?? RELIC_ICONS.get(compactName(name))
	if (!relic) return undefined
	const localized = zhTitle('relic', relic.id)
	return {
		name: relic.name,
		icon: relic.image ?? '',
		tooltip: wikiEntryFor(relic.name)?.tooltip ?? '',
		aliases: [relic.name, ...(localized ? [localized] : []), relic.id].sort(
			(a, b) => b.length - a.length
		)
	}
}

const CARD_HREFS = (() => {
	const map = new Map<string, string>()
	for (const card of CARDS) {
		const href = cardHref(card)
		map.set(card.name.trim().toLowerCase(), href)
		const zh = zhTitle('card', card.id)
		if (zh) map.set(zh.trim().toLowerCase(), href)
	}
	return map
})()

export function cardWikiHref(name: string) {
	const normalized = name.replace(/[（(].*$/, '').trim().toLowerCase()
	return CARD_HREFS.get(normalized) ?? null
}

export function powerWikiIntro(id: string): string[] {
	const mod = MOD_BY_ID.get('sts2')
	if (!mod?.dependency) return []
	const key = `${entryIdFor(mod.dependency, 'power', id)}.wikiIntro`
	const texts = getLocale() === 'zhs' ? WIKI_TEXTS_ZH : WIKI_TEXTS_EN
	return texts?.[key]?.split('\n\n').filter(Boolean) ?? []
}
