import { error } from '@sveltejs/kit'
import { POWERS, escapeRegExp, type GlossaryEntry } from '#lib/data/glossary'
import type { ContentKind } from '#lib/data/mod-dependency'
import { CARDS, MOD_BY_ID, POTIONS, RELICS, modContentText } from '#lib/data/mods'
import { POWER_WIKI, powerWikiIntro } from '#lib/data/power-wiki'
import { GLOSSARY_ZH } from '#lib/data/zh'
import { m } from '#lib/paraglide/messages'
import { stripBBCode } from '#lib/text/bbcode'
import { cardTextToPlain } from '#lib/text/card-text'
import { collectionTextToPlain } from '#lib/text/collection-text'

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
	const zh = GLOSSARY_ZH[entry.id]
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

export function load({ params }: { params: { id: string } }) {
	const index = POWERS.findIndex((entry) => entry.id === params.id)
	if (index === -1) error(404, m.power_not_found())

	const entry = POWERS[index]
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
		(item) => item.id !== entry.id && matches(textVariants(item.mod, 'power', item.id, item.summary))
	)

	const mod = entry.mod ? MOD_BY_ID.get(entry.mod) : undefined
	const names = mod
		? LOCALES.map((locale) => ({
				locale,
				name: stripBBCode(modContentText(mod, 'power', entry.id, 'title', locale) ?? '')
			})).filter((item) => item.name)
		: []

	return {
		entry,
		wiki: POWER_WIKI[params.id] ?? null,
		intro: powerWikiIntro(params.id),
		names,
		cards,
		relics,
		potions,
		powers
	}
}
