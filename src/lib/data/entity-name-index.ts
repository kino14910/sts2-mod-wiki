import { getLocale } from '#lib/paraglide/runtime'
import { entityKey, type EntityRef } from '#lib/entities'
import type { ContentKind } from './mod-dependency'
import { findGameEntity, listEntityRefs, type GameEntity } from './entities'
import { escapeRegExp } from './glossary'
import { KEYWORD_LOCALES, MOD_BY_ID, modContentText } from './mods'
import { GLOSSARY_ZH } from './zh'
import { KEYWORD_ALIASES, POWER_ALIASES } from './wiki-aliases'

export type GameEntityType = GameEntity['kind']

const BASE_LOCALE = 'eng'
const BASE_MOD_ID = 'sts2'

/** 仅匹配阶段的默认消解顺序，调用方可用 EntityMatchContext.prefer 覆盖 */
const DEFAULT_PREFERENCE: readonly GameEntityType[] = [
	'power',
	'keyword',
	'relic',
	'potion',
	'card'
]

export interface EntityNameEntry {
	name: string
	ref: EntityRef
	entity: GameEntity
	source: 'title' | 'alias'
	enemyOnly: boolean
}

export interface EntityNameConflict {
	name: string
	reason: 'cross-type' | 'same-type'
	candidates: EntityRef[]
}

export interface EntityNameIndex {
	locale: string
	candidates: ReadonlyMap<string, readonly EntityNameEntry[]>
	conflicts: readonly EntityNameConflict[]
	terms: readonly string[]
	pattern: RegExp
}

export interface EntityMatchContext {
	locale?: string
	prefer?: readonly GameEntityType[]
	current?: EntityRef | null
}

export interface EntityNameMatch {
	start: number
	end: number
	name: string
	entry: EntityNameEntry
	candidates: readonly EntityNameEntry[]
}

interface Candidate {
	name: string
	ref: EntityRef
	source: 'title' | 'alias'
}

type CandidateMap = Map<string, Candidate[]>

const CONTENT_KINDS = new Set<string>(['card', 'power', 'relic', 'potion'])
const WORD_CHAR = /[A-Za-z0-9_]/
const titleCache = new Map<string, CandidateMap>()
const indexCache = new Map<string, EntityNameIndex>()

function normalize(name: string) {
	return name.trim().toLowerCase()
}

function isContentKind(value: string): value is ContentKind {
	return CONTENT_KINDS.has(value)
}

function addCandidate(map: CandidateMap, name: string, ref: EntityRef, source: Candidate['source']) {
	const key = normalize(name)
	if (!key) return
	const list = map.get(key) ?? []
	list.push({ name: name.trim(), ref, source })
	map.set(key, list)
}

function uniquify(list: Candidate[]): Candidate[] {
	const best = new Map<string, Candidate>()
	for (const candidate of list) {
		const key = entityKey(candidate.ref)
		const existing = best.get(key)
		if (!existing || (existing.source === 'alias' && candidate.source === 'title')) {
			best.set(key, candidate)
		}
	}
	return [...best.values()]
}

function titleFor(ref: EntityRef, locale: string): string | undefined {
	if (ref.type === 'keyword') {
		return KEYWORD_LOCALES[locale]?.[`${ref.id.toUpperCase()}.title`]
	}
	if (!isContentKind(ref.type)) return undefined
	const modId = findGameEntity(ref)?.data.mod ?? BASE_MOD_ID
	const mod = MOD_BY_ID.get(modId)
	return mod ? modContentText(mod, ref.type, ref.id, 'title', locale) : undefined
}

function localizedTitle(ref: EntityRef, locale: string): string | undefined {
	return titleFor(ref, locale) ?? (locale === BASE_LOCALE ? undefined : titleFor(ref, BASE_LOCALE))
}

function getTitleCandidates(locale: string): CandidateMap {
	const cached = titleCache.get(locale)
	if (cached) return cached

	const map: CandidateMap = new Map()
	for (const ref of listEntityRefs()) {
		const title = localizedTitle(ref, locale)
		if (title) addCandidate(map, title, ref, 'title')
	}
	titleCache.set(locale, map)
	return map
}

function aliasesFor(ref: EntityRef, locale: string): string[] {
	const entity = findGameEntity(ref)
	if (!entity || (entity.kind !== 'power' && entity.kind !== 'keyword')) return []
	const aliases = [...(entity.data.aliases ?? [])]
	if (locale !== BASE_LOCALE && ref.type === 'keyword') {
		aliases.push(...(GLOSSARY_ZH[ref.id]?.aliases ?? []))
	}
	return aliases
}

/** Wiki 中文别名指向英文术语名，借 eng 的 .title 反查后保留全部候选 */
function wikiAliasTargets(locale: string): Candidate[] {
	if (locale === BASE_LOCALE) return []
	const english = getTitleCandidates(BASE_LOCALE)
	const result: Candidate[] = []
	for (const [alias, target] of Object.entries({ ...POWER_ALIASES, ...KEYWORD_ALIASES })) {
		for (const candidate of english.get(normalize(target)) ?? []) {
			result.push({ name: alias, ref: candidate.ref, source: 'alias' })
		}
	}
	return result
}

function enemyOnlyOf(entity: GameEntity): boolean {
	return entity.kind === 'power' || entity.kind === 'keyword'
		? entity.data.enemyOnly === true
		: false
}

function buildIndex(locale: string): EntityNameIndex {
	const pool: CandidateMap = new Map()
	for (const list of getTitleCandidates(locale).values()) {
		for (const candidate of list) {
			addCandidate(pool, candidate.name, candidate.ref, 'title')
		}
	}
	for (const ref of listEntityRefs()) {
		for (const alias of aliasesFor(ref, locale)) addCandidate(pool, alias, ref, 'alias')
	}
	for (const candidate of wikiAliasTargets(locale)) {
		addCandidate(pool, candidate.name, candidate.ref, 'alias')
	}

	const candidates = new Map<string, EntityNameEntry[]>()
	const conflicts: EntityNameConflict[] = []

	for (const [key, list] of pool) {
		const entries: EntityNameEntry[] = []
		for (const candidate of uniquify(list)) {
			const entity = findGameEntity(candidate.ref)
			if (!entity) continue
			entries.push({
				name: candidate.name,
				ref: candidate.ref,
				entity,
				source: candidate.source,
				enemyOnly: enemyOnlyOf(entity)
			})
		}
		if (!entries.length) continue
		candidates.set(key, entries)
		if (entries.length > 1) {
			conflicts.push({
				name: entries[0].name,
				reason: new Set(entries.map((entry) => entry.ref.type)).size > 1
					? 'cross-type'
					: 'same-type',
				candidates: entries.map((entry) => entry.ref)
			})
		}
	}

	const terms = [...new Set([...candidates.values()].flat().map((entry) => entry.name))].sort(
		(a, b) => b.length - a.length || a.localeCompare(b)
	)
	const pattern = terms.length
		? new RegExp(terms.map(escapeRegExp).join('|'), 'gi')
		: /(?!)/g

	return { locale, candidates, conflicts, terms, pattern }
}

export function getEntityNameIndex(locale: string = getLocale()): EntityNameIndex {
	let index = indexCache.get(locale)
	if (!index) {
		index = buildIndex(locale)
		indexCache.set(locale, index)
	}
	return index
}

export function findEntityCandidates(
	name: string,
	locale: string = getLocale()
): readonly EntityNameEntry[] {
	return getEntityNameIndex(locale).candidates.get(normalize(name)) ?? []
}

/** 冲突在匹配阶段按上下文消解；无法唯一确定时返回 null，不生成链接 */
export function resolveEntityName(
	name: string,
	context: EntityMatchContext = {}
): EntityNameEntry | null {
	let list = [...findEntityCandidates(name, context.locale ?? getLocale())]
	if (!list.length) return null

	if (list.length > 1 && context.current) {
		const filtered = list.filter(
			(entry) => entityKey(entry.ref) !== entityKey(context.current!)
		)
		if (filtered.length) list = filtered
	}
	if (list.length === 1) return list[0]

	for (const type of context.prefer ?? DEFAULT_PREFERENCE) {
		const group = list.filter((entry) => entry.ref.type === type)
		if (!group.length) continue
		const titled = group.filter((entry) => entry.source === 'title')
		const pool = titled.length ? titled : group
		return new Set(pool.map((entry) => entityKey(entry.ref))).size === 1 ? pool[0] : null
	}
	return null
}

export function findEntityByName(
	name: string,
	locale: string = getLocale()
): EntityNameEntry | null {
	return resolveEntityName(name, { locale })
}

function variableRanges(text: string): Array<[number, number]> {
	const ranges: Array<[number, number]> = []
	let depth = 0
	let start = -1
	for (let i = 0; i < text.length; i++) {
		if (text[i] === '{') {
			if (depth === 0) start = i
			depth++
		} else if (text[i] === '}' && depth > 0) {
			depth--
			if (depth === 0 && start >= 0) {
				ranges.push([start, i + 1])
				start = -1
			}
		}
	}
	return ranges
}

function hasBoundary(text: string, start: number, end: number, value: string): boolean {
	if (WORD_CHAR.test(value[0]) && start > 0 && WORD_CHAR.test(text[start - 1])) return false
	if (WORD_CHAR.test(value[value.length - 1]) && end < text.length && WORD_CHAR.test(text[end])) {
		return false
	}
	return true
}

export function matchEntityNames(
	text: string,
	context: EntityMatchContext = {}
): EntityNameMatch[] {
	const index = getEntityNameIndex(context.locale ?? getLocale())
	const blocked = variableRanges(text)
	const result: EntityNameMatch[] = []

	// pattern 是跨渲染共享的缓存实例，同步遍历前必须重置游标
	index.pattern.lastIndex = 0
	let match: RegExpExecArray | null
	while ((match = index.pattern.exec(text)) !== null) {
		const start = match.index
		const end = start + match[0].length
		const candidates = index.candidates.get(normalize(match[0])) ?? []
		const entry = candidates.length ? resolveEntityName(match[0], context) : null
		if (
			!match[0] ||
			!entry ||
			!hasBoundary(text, start, end, match[0]) ||
			blocked.some(([from, to]) => start >= from && start < to)
		) {
			index.pattern.lastIndex = start + 1
			continue
		}
		result.push({ start, end, name: match[0], entry, candidates })
		index.pattern.lastIndex = end
	}
	return result
}
