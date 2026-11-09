import { localizationFiles } from 'virtual:mods'
import { getLocale } from '#lib/paraglide/runtime'
import { cardHref } from './cards'
import { entryIdFor } from './mod-dependency'
import { CARDS, MOD_BY_ID, RELICS } from './mods'
import raw from './power-wiki.json'
import tooltips from './wiki-tooltips.json'

export interface WikiEntry {
	name: string
	description: string
	tooltip: string
	kind: 'card' | 'relic' | 'potion' | 'power'
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

export interface WikiPage {
	title: string
	stackType: string
	text: string
	sources: WikiDetails[]
	interactions: WikiDetails[]
	order: string[]
	effectsImmune: string[]
}

export const POWER_WIKI = raw as unknown as Record<string, WikiPage>

export const WIKI_ENTRIES: Map<string, WikiEntry> = (() => {
	const map = new Map<string, WikiEntry>()
	for (const page of Object.values(POWER_WIKI)) {
		for (const details of [...page.sources, ...page.interactions]) {
			for (const group of details.groups) {
				for (const entry of group.entries) {
					const key = entry.name.trim().toLowerCase()
					if (!map.has(key)) map.set(key, entry)
				}
			}
		}
	}
	return map
})()

const POWER_TOOLTIPS = tooltips.powers as Record<string, string>
const KEYWORD_TOOLTIPS = tooltips.keywords as Record<string, string>

const POWER_ALIASES: Record<string, string> = {
	易伤: 'Vulnerable',
	虚弱: 'Weak',
	力量: 'Strength',
	活力: 'Vigor',
	中毒: 'Poison',
	末日: 'Doom',
	人工制品: 'Artifact'
}

const KEYWORD_ALIASES: Record<string, string> = {
	消耗: 'Exhaust',
	固有: 'Innate',
	保留: 'Retain',
	虚无: 'Ethereal',
	格挡: 'Block',
	奥斯提: 'Osty'
}

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
	for (const card of CARDS) {
		const localized = zhTitle('card', card.id)
		const entry = localized && WIKI_ENTRIES.get(localized.trim().toLowerCase())
		if (entry) map.set(card.name.trim().toLowerCase(), entry)
	}
	for (const relic of RELICS) {
		const localized = zhTitle('relic', relic.id)
		const entry = localized && WIKI_ENTRIES.get(localized.trim().toLowerCase())
		if (entry) map.set(relic.name.trim().toLowerCase(), entry)
	}
	return map
})()

export function wikiEntity(name: string) {
	return WIKI_ENTITY_ALIASES.get(name.trim().toLowerCase())
}

export const WIKI_TERM_NAMES = [
	...new Set([...WIKI_ENTITY_ALIASES.keys(), ...WIKI_TERMS.keys()])
].sort((a, b) => b.length - a.length)

export interface WikiRelic {
	name: string
	icon: string
	tooltip: string
	aliases: string[]
}

const RELIC_ICONS = new Map(
	RELICS.filter((relic) => relic.image).map((relic) => [compactName(relic.name), relic] as const)
)

export function wikiRelic(name: string): WikiRelic | undefined {
	const relic = RELIC_ICONS.get(compactName(name))
	if (!relic) return undefined
	const localized = zhTitle('relic', relic.id)
	return {
		name: relic.name,
		icon: relic.image ?? '',
		tooltip: wikiEntity(relic.name)?.tooltip ?? '',
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
