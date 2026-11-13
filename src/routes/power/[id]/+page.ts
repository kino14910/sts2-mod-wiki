import { resolveEntityRoute } from '#lib/entity-route'
import { POWERS, escapeRegExp, type GlossaryEntry } from '#lib/data/glossary'
import type { ContentKind } from '#lib/data/mod-dependency'
import { CARDS, MOD_BY_ID, POTIONS, RELICS, modContentText } from '#lib/data/mods'
import { powerReferenceDetails } from '#lib/data/power-references'
import { localizePowerWiki, powerWikiIntro } from '#lib/data/power-wiki'
import { GLOSSARY_ZH } from '#lib/data/zh'
import { getLocale } from '#lib/paraglide/runtime'
import { stripBBCode } from '#lib/text/bbcode'
import { cardTextToPlain } from '#lib/text/card-text'
import { collectionTextToPlain } from '#lib/text/collection-text'
import type { PageLoad } from './$types'

const LOCALES = ['eng', 'zhs'] as const

function localizedText(modId: string | undefined, kind: ContentKind, id: string, locale: string) {
	const mod = modId ? MOD_BY_ID.get(modId) : undefined
	if (!mod) return undefined
	const value = modContentText(mod, kind, id, 'description', locale)
	return value === undefined ? undefined : stripBBCode(value)
}

function textVariants(modId: string | undefined, kind: ContentKind, id: string, base: string) {
	const parts = [base]
	for (const locale of LOCALES) {
		const value = localizedText(modId, kind, id, locale)
		if (value) parts.push(value)
	}
	return parts.join(' ')
}

function nameVariants(entry: GlossaryEntry) {
	const names = new Set<string>([entry.name, ...(entry.aliases ?? [])])
	const mod = entry.mod ? MOD_BY_ID.get(entry.mod) : undefined
	if (mod) {
		for (const locale of LOCALES) {
			const value = modContentText(mod, 'power', entry.id, 'title', locale)
			if (value) names.add(stripBBCode(value))
		}
	}
	const zh = (entry.mod ?? 'sts2') === 'sts2' ? GLOSSARY_ZH[entry.id] : undefined
	if (zh) {
		names.add(zh.name)
		for (const alias of zh.aliases ?? []) names.add(alias)
	}
	return [...names].filter(Boolean)
}

function matcher(names: string[]) {
	const ascii = names.filter((name) => /^[\x20-\x7e]+$/.test(name))
	const wide = names.filter((name) => !/^[\x20-\x7e]+$/.test(name))
	const pattern = ascii.length
		? new RegExp(`\\b(?:${ascii.map(escapeRegExp).join('|')})\\b`, 'i')
		: undefined
	return (text: string) =>
		(pattern?.test(text) ?? false) || wide.some((name) => text.includes(name))
}

export const load: PageLoad = ({ params, data, url }) => {
	const route = resolveEntityRoute('power', params.id, url)
	const entry = route.game.data
	const isBaseGame = (entry.mod ?? 'sts2') === 'sts2'
	const matches = matcher(nameVariants(entry))

	const cards = CARDS.filter((card) =>
		matches(
			textVariants(
				card.mod,
				'card',
				card.id,
				cardTextToPlain(card.text, { variables: card.variables })
			)
		)
	)
	const relics = RELICS.filter((item) =>
		matches(textVariants(item.mod, 'relic', item.id, collectionTextToPlain(item.text)))
	)
	const potions = POTIONS.filter((item) =>
		matches(textVariants(item.mod, 'potion', item.id, collectionTextToPlain(item.text)))
	)
	const powers = POWERS.filter(
		(item) => item !== entry && matches(textVariants(item.mod, 'power', item.id, item.summary))
	)

	const mod = entry.mod ? MOD_BY_ID.get(entry.mod) : undefined
	const names = mod
		? LOCALES.map((locale) => ({
				locale,
				name: stripBBCode(modContentText(mod, 'power', entry.id, 'title', locale) ?? '')
			})).filter((item) => item.name)
		: []

	const references = isBaseGame ? powerReferenceDetails(
		entry.id,
		getLocale() === 'zhs' ? 'zhs' : 'eng'
	) : { sources: [], interactions: [] }

	const wiki = data.wiki && isBaseGame ? localizePowerWiki(data.wiki, entry.id, getLocale()) : data.wiki

	return {
		...data,
		entityRef: route.entityRef,
		entityKey: route.entityKey,
		wiki,
		entry,
		intro: isBaseGame ? powerWikiIntro(entry.id) : [],
		sources: references.sources,
		interactions: references.interactions,
		names,
		cards,
		relics,
		potions,
		powers
	}
}
