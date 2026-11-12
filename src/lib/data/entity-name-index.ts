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
const INDEX_LOCALES = ['eng', 'zhs'] as const

/**
 * 游戏文本（gold 段）的消解顺序：本地化数据里金色高亮绝大多数指向 Power / Keyword。
 * 只是 GameText 的默认策略，不是所有调用方的强制规则；WikiText 显式传入自己的 prefer。
 */
export const GAME_ENTITY_PREFERENCE: readonly GameEntityType[] = [
	'power',
	'keyword',
	'relic',
	'potion',
	'card'
]

/** Wiki 正文以实体页面为主，同名时优先卡牌；由 WikiText 显式传入 */
export const WIKI_ENTITY_PREFERENCE: readonly GameEntityType[] = [
	'card',
	'relic',
	'potion',
	'power',
	'keyword'
]

/** game = 仅游戏文本可见名称；wiki = 全部候选（含跨语言标题与实体 id） */
export type EntityNameScope = 'game' | 'wiki'
export type EntityMatchStrategy = 'game' | 'wiki'

export interface EntityNameEntry {
	name: string
	ref: EntityRef
	entity: GameEntity
	/** title: 当前语言标题；alias: 别名 / 跨语言标题；id: 结构 id */
	source: 'title' | 'alias' | 'id'
	scope: EntityNameScope
	enemyOnly: boolean
}

export interface EntityNameConflict {
	name: string
	reason: 'cross-type' | 'same-type'
	candidates: EntityRef[]
}

export interface EntityNameIndex {
	locale: string
	/** 归一化名称 → 全部候选，构建期不做任何消解或丢弃 */
	candidates: ReadonlyMap<string, readonly EntityNameEntry[]>
	conflicts: readonly EntityNameConflict[]
	/** 仅游戏文本可见的名称（GameText 用） */
	terms: readonly string[]
	/** 全部名称（WikiText 用） */
	wikiTerms: readonly string[]
	pattern: RegExp
	wikiPattern: RegExp
}

export interface EntityMatchContext {
	locale?: string
	/** 显式消解顺序；不传时 game 策略用游戏默认顺序，wiki 策略不按类型优先 */
	prefer?: readonly GameEntityType[]
	/** 名称可见范围，默认 game */
	scope?: EntityNameScope
	/** 消解策略，默认 game（歧义不生成链接）；wiki 保留歧义候选 */
	strategy?: EntityMatchStrategy
	current?: EntityRef | null
}

export interface EntityNameMatch {
	start: number
	end: number
	name: string
	entry: EntityNameEntry
	candidates: readonly EntityNameEntry[]
}

export type EntityResolutionStatus = 'none' | 'resolved' | 'ambiguous'

export interface EntityResolution {
	status: EntityResolutionStatus
	entry: EntityNameEntry | null
	candidates: readonly EntityNameEntry[]
}

export interface ScannedEntityMatch {
	start: number
	end: number
	name: string
	status: Exclude<EntityResolutionStatus, 'none'>
	entry: EntityNameEntry | null
	candidates: readonly EntityNameEntry[]
}

interface Candidate {
	name: string
	ref: EntityRef
	source: EntityNameEntry['source']
	scope: EntityNameScope
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

function addCandidate(
	map: CandidateMap,
	name: string,
	ref: EntityRef,
	source: Candidate['source'],
	scope: EntityNameScope = 'game'
) {
	const key = normalize(name)
	if (!key) return
	const list = map.get(key) ?? []
	list.push({ name: name.trim(), ref, source, scope })
	map.set(key, list)
}

/** 同一 ref 只保留一条；game 范围优先于 wiki，title 优先于 alias / id */
function uniquify(list: Candidate[]): Candidate[] {
	const rank = (candidate: Candidate) =>
		(candidate.scope === 'game' ? 2 : 0) +
		(candidate.source === 'title' ? 2 : candidate.source === 'alias' ? 1 : 0)
	const best = new Map<string, Candidate>()
	for (const candidate of list) {
		const key = entityKey(candidate.ref)
		const existing = best.get(key)
		if (!existing || rank(candidate) > rank(existing)) best.set(key, candidate)
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
			result.push({ name: alias, ref: candidate.ref, source: 'alias', scope: 'game' })
		}
	}
	return result
}

function enemyOnlyOf(entity: GameEntity): boolean {
	return entity.kind === 'power' || entity.kind === 'keyword'
		? entity.data.enemyOnly === true
		: false
}

function buildPattern(terms: readonly string[]): RegExp {
	return terms.length ? new RegExp(terms.map(escapeRegExp).join('|'), 'gi') : /(?!)/g
}

function buildIndex(locale: string): EntityNameIndex {
	const pool: CandidateMap = new Map()
	for (const list of getTitleCandidates(locale).values()) {
		for (const candidate of list) {
			addCandidate(pool, candidate.name, candidate.ref, 'title', 'game')
		}
	}
	// 跨语言标题与结构 id 只供 Wiki 正文使用，不扩大 GameText 的匹配范围。
	for (const other of INDEX_LOCALES) {
		if (other === locale) continue
		for (const ref of listEntityRefs()) {
			const title = titleFor(ref, other)
			if (title) addCandidate(pool, title, ref, 'alias', 'wiki')
		}
	}
	for (const ref of listEntityRefs()) {
		if (ref.id.length >= 3) addCandidate(pool, ref.id, ref, 'id', 'wiki')
		for (const alias of aliasesFor(ref, locale)) {
			addCandidate(pool, alias, ref, 'alias', 'game')
		}
	}
	for (const candidate of wikiAliasTargets(locale)) {
		addCandidate(pool, candidate.name, candidate.ref, 'alias', 'game')
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
				scope: candidate.scope,
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

	const all = [...new Set([...candidates.values()].flat().map((entry) => entry.name))]
	const sortTerms = (a: string, b: string) => b.length - a.length || a.localeCompare(b)
	const terms = all
		.filter((name) => candidates.get(normalize(name))?.some((entry) => entry.scope === 'game'))
		.sort(sortTerms)
	const wikiTerms = all.sort(sortTerms)

	return {
		locale,
		candidates,
		conflicts,
		terms,
		wikiTerms,
		pattern: buildPattern(terms),
		wikiPattern: buildPattern(wikiTerms)
	}
}

export function getEntityNameIndex(locale: string = getLocale()): EntityNameIndex {
	let index = indexCache.get(locale)
	if (!index) {
		index = buildIndex(locale)
		indexCache.set(locale, index)
	}
	return index
}

/** 原始候选表不做范围过滤；需要按范围消解时用 resolveEntityNameDetailed */
export function findEntityCandidates(
	name: string,
	locale: string = getLocale()
): readonly EntityNameEntry[] {
	return getEntityNameIndex(locale).candidates.get(normalize(name)) ?? []
}

function inScope(list: readonly EntityNameEntry[], scope: EntityNameScope) {
	return scope === 'wiki' ? list : list.filter((entry) => entry.scope === 'game')
}

function resolveList(
	list: readonly EntityNameEntry[],
	context: EntityMatchContext
): EntityResolution {
	if (!list.length) return { status: 'none', entry: null, candidates: [] }

	let pool = [...list]
	if (pool.length > 1 && context.current) {
		const filtered = pool.filter((entry) => entityKey(entry.ref) !== entityKey(context.current!))
		if (filtered.length) pool = filtered
	}
	if (pool.length === 1) {
		return { status: 'resolved', entry: pool[0], candidates: list }
	}

	const prefer =
		context.prefer ??
		(context.strategy === 'wiki' ? [] : GAME_ENTITY_PREFERENCE)
	for (const type of prefer) {
		const group = pool.filter((entry) => entry.ref.type === type)
		if (!group.length) continue
		const titled = group.filter((entry) => entry.source === 'title')
		const chosen = titled.length ? titled : group
		if (new Set(chosen.map((entry) => entityKey(entry.ref))).size === 1) {
			return { status: 'resolved', entry: chosen[0], candidates: list }
		}
		return { status: 'ambiguous', entry: null, candidates: list }
	}
	return { status: 'ambiguous', entry: null, candidates: list }
}

/** 消解结果保留歧义候选；调用方可据此生成歧义节点而不静默丢弃 */
export function resolveEntityNameDetailed(
	name: string,
	context: EntityMatchContext = {}
): EntityResolution {
	const candidates = findEntityCandidates(name, context.locale ?? getLocale())
	return resolveList(inScope(candidates, context.scope ?? 'game'), context)
}

/** 冲突在匹配阶段按上下文消解；无法唯一确定时返回 null，不生成链接 */
export function resolveEntityName(
	name: string,
	context: EntityMatchContext = {}
): EntityNameEntry | null {
	return resolveEntityNameDetailed(name, context).entry
}

export function findEntityByName(
	name: string,
	locale: string = getLocale()
): EntityNameEntry | null {
	return resolveEntityName(name, { locale, strategy: 'game' })
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

/** 单一扫描器：GameText / WikiText 共用，仅策略与可见范围不同 */
export function scanEntityNames(
	text: string,
	context: EntityMatchContext = {}
): ScannedEntityMatch[] {
	const index = getEntityNameIndex(context.locale ?? getLocale())
	const scope = context.scope ?? 'game'
	const pattern = scope === 'wiki' ? index.wikiPattern : index.pattern
	const blocked = variableRanges(text)
	const result: ScannedEntityMatch[] = []

	// pattern 是跨渲染共享的缓存实例，同步遍历前必须重置游标
	pattern.lastIndex = 0
	let match: RegExpExecArray | null
	while ((match = pattern.exec(text)) !== null) {
		const start = match.index
		const end = start + match[0].length
		const candidates = index.candidates.get(normalize(match[0])) ?? []
		const resolution = resolveList(inScope(candidates, scope), context)
		if (
			!match[0] ||
			resolution.status === 'none' ||
			!hasBoundary(text, start, end, match[0]) ||
			blocked.some(([from, to]) => start >= from && start < to)
		) {
			pattern.lastIndex = start + 1
			continue
		}
		result.push({
			start,
			end,
			name: match[0],
			status: resolution.status,
			entry: resolution.entry,
			candidates: resolution.candidates
		})
		pattern.lastIndex = end
	}
	return result
}

/** 游戏文本入口：只返回可唯一确定的实体，歧义与 wiki-only 名称都不生成链接 */
export function matchEntityNames(
	text: string,
	context: EntityMatchContext = {}
): EntityNameMatch[] {
	return scanEntityNames(text, context)
		.filter((match) => match.status === 'resolved' && match.entry)
		.map((match) => ({
			start: match.start,
			end: match.end,
			name: match.name,
			entry: match.entry!,
			candidates: match.candidates
		}))
}
