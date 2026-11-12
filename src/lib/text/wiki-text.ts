import { getLocale } from '#lib/paraglide/runtime'
import { entityHref, type EntityRef } from '#lib/entities'
import {
	ALIGN_TAGS,
	EFFECT_TAGS,
	KNOWN_TAGS,
	NAMED_COLORS,
	parseArg,
	sizeToUnit
} from './bbcode'
import { ICON_PATTERN } from './game-text/icon-syntax'
import {
	WIKI_ENTITY_PREFERENCE,
	getEntityNameIndex,
	scanEntityNames,
	type EntityNameEntry
} from '#lib/data/entity-name-index'
import {
	WIKI_TERM_NAMES,
	WIKI_TERMS,
	wikiEntity,
	wikiEntryFor,
	wikiRelic,
	wikiTerm,
	type WikiEntry,
	type WikiTerm
} from '#lib/data/power-wiki'
import { resolvePowerReference, type PowerEntityRef } from '#lib/data/power-references'
import {
	cardById,
	cardByName,
	cardIcon,
	potionImageByName,
	relicHrefByName
} from '#lib/data/wiki-links'

export interface WikiInlineIcon {
	kind: 'power' | 'relic' | 'card' | 'potion'
	src: string
	name: string
	label: string
}

export interface WikiStyle {
	color?: string
	font?: string
	fontSize?: string
	bold?: boolean
	italic?: boolean
	underline?: boolean
	align?: 'center' | 'left' | 'right'
}

export interface WikiTagNode {
	type: 'tag'
	name: string
	arg: string | null
	style: WikiStyle
	children: WikiNode[]
}

export type WikiNode =
	| { type: 'text'; value: string }
	| WikiTagNode
	| { type: 'break' }
	| { type: 'upgraded'; value: string }
	| {
			type: 'entity'
			value: string
			entry: WikiEntry
			ref?: EntityRef
			href?: string | null
			tooltip?: string
			icon?: WikiInlineIcon
	  }
	/** 同名实体无法唯一确定：保留候选，不生成确定链接 */
	| {
			type: 'ambiguous'
			value: string
			refs: readonly EntityRef[]
			candidates: readonly EntityNameEntry[]
	  }

export interface WikiTextOptions {
	locale?: string
	current?: EntityRef | null
}

/** [[type:id|label]] 属于 Wiki 显式引用，必须先于 BBCode 解析 */
export const WIKI_REF_PATTERN = /\[\[(card|relic|potion|power):([^\]|]+)(?:\|([^\]]+))?\]\]/g
const TAG_RE = /\[(\/?)([a-zA-Z_]+)([^\]]*)\]/g
/** 能量 / 星图标属于游戏文本，Wiki 正文按原样保留字面量 */
const GAME_ONLY_TAGS = new Set(['energy_icons', 'star_icons', 'energy', 'star'])

function escapeRegex(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeName(value: string) {
	return value.trim().toLowerCase()
}

/**
 * 只保留「没有对应 GameEntity」的 Wiki tooltip 词条。
 * 实体名称一律由 EntityNameIndex 匹配，避免两套名称表与重叠链接。
 */
const TOOLTIP_NAMES: string[] = [...WIKI_TERMS.keys()]
	.filter(
		(name) =>
			!getEntityNameIndex('eng').candidates.has(normalizeName(name)) &&
			!getEntityNameIndex('zhs').candidates.has(normalizeName(name))
	)
	.sort((a, b) => b.length - a.length)

const TOOLTIP_PATTERN = TOOLTIP_NAMES.length
	? new RegExp(`(?<![\\w])(${TOOLTIP_NAMES.map(escapeRegex).join('|')})(?![\\w])`, 'gi')
	: null

function placeholder(name: string, tooltip = ''): WikiEntry {
	return { name, description: '', tooltip, kind: 'power' }
}

function compactName(value: string) {
	return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '')
}

function wikiLocale(locale: string): 'eng' | 'zhs' {
	return locale === 'zhs' ? 'zhs' : 'eng'
}

/** 图标后的实体名标签合并：只用于显式图标语法，不是实体名称匹配 */
function captureLabel(value: string, from: number, term: WikiTerm | undefined, entry: WikiEntry) {
	const rest = value.slice(from)
	const start = from + (/^\s*/.exec(rest)?.[0].length ?? 0)
	const tail = value.slice(start)
	if (!tail) return { label: '', next: from }

	const accepted = new Set(
		[term?.name, entry.name, entry.id]
			.filter((name): name is string => !!name)
			.map(compactName)
	)
	const first = tail[0].toLowerCase()
	let label = ''
	for (const name of WIKI_TERM_NAMES) {
		if (!name || name.length <= label.length || name[0].toLowerCase() !== first) continue
		if (tail.slice(0, name.length).toLowerCase() !== name.toLowerCase()) continue
		if (/[a-z0-9_]/i.test(tail.slice(name.length, name.length + 1))) continue
		const candidateTerm = wikiTerm(name)
		const candidateEntry = candidateTerm ? null : wikiEntity(name)
		if (
			!accepted.has(compactName(name)) &&
			!(term && candidateTerm === term) &&
			!(entry.id && candidateEntry?.id === entry.id)
		) continue
		label = tail.slice(0, name.length)
		break
	}
	if (!label) return { label: '', next: from }
	return { label, next: start + label.length }
}

function captureAlias(value: string, from: number, aliases: string[]) {
	const leading = /^\s*/.exec(value.slice(from))?.[0] ?? ''
	const start = from + leading.length
	for (const alias of aliases) {
		if (!alias) continue
		if (value.slice(start, start + alias.length).toLowerCase() === alias.toLowerCase()) {
			return { label: value.slice(start, start + alias.length), next: start + alias.length }
		}
	}
	return { label: '', next: from }
}

function inlineIconFor(word: string, entry: WikiEntry, skipTerm = false): WikiInlineIcon | undefined {
	const term = skipTerm ? undefined : wikiTerm(word)
	if (term?.icon) return { kind: 'power', src: '', name: term.icon, label: word }
	if (entry.kind === 'relic') {
		const relic = wikiRelic(entry.name)
		if (relic?.icon) return { kind: 'relic', src: relic.icon, name: '', label: word }
	}
	if (entry.kind === 'potion') {
		const src = potionImageByName(entry.name)
		if (src) return { kind: 'potion', src, name: '', label: word }
	}
	if (entry.kind === 'card') {
		const card = (entry.id ? cardById(entry.id) : undefined) ?? cardByName(entry.name)
		const src = card ? cardIcon(card) : null
		if (src) return { kind: 'card', src, name: '', label: word }
	}
	return undefined
}

/** 统一实体数据：EntityRef → 已本地化的 WikiEntry（tooltip / href / 图标） */
function entryForRef(name: string, ref: EntityRef, locale: string): WikiEntry {
	const reference =
		ref.type === 'keyword'
			? null
			: resolvePowerReference({ type: ref.type as PowerEntityRef['type'], id: ref.id }, wikiLocale(locale))
	const term = wikiTerm(name)
	return (
		reference ??
		wikiEntryFor(name) ?? {
			name,
			description: '',
			tooltip: term?.tooltip ?? '',
			kind: 'power',
			href: entityHref(ref)
		}
	)
}

/** 普通英文名词大小写敏感：小写出现不应当成专有实体名 */
function canonicalCase(name: string, candidates: readonly EntityNameEntry[]) {
	if (!/[A-Za-z]/.test(name)) return true
	return candidates.some((entry) => entry.name === name)
}

function splitTooltipTerms(value: string): WikiNode[] {
	if (!TOOLTIP_PATTERN || !value) return [{ type: 'text', value }]
	const nodes: WikiNode[] = []
	let last = 0
	TOOLTIP_PATTERN.lastIndex = 0
	for (const match of value.matchAll(TOOLTIP_PATTERN)) {
		const start = match.index ?? 0
		if (start > last) nodes.push({ type: 'text', value: value.slice(last, start) })
		const word = match[0]
		const entry = wikiEntryFor(word)
		if (entry) nodes.push({ type: 'entity', value: word, entry, icon: inlineIconFor(word, entry) })
		else nodes.push({ type: 'text', value: word })
		last = start + word.length
	}
	if (last < value.length) nodes.push({ type: 'text', value: value.slice(last) })
	return nodes
}

/**
 * 可见文本层的实体匹配：共用 EntityNameIndex 扫描器，Wiki 显式传入自己的策略。
 * 歧义保留为单独节点，非实体 tooltip 词条只在剩余文本片段上匹配。
 */
function matchVisibleText(value: string, options: WikiTextOptions): WikiNode[] {
	if (!value) return []
	const locale = options.locale ?? getLocale()
	const matches = scanEntityNames(value, {
		locale,
		scope: 'wiki',
		strategy: 'wiki',
		prefer: WIKI_ENTITY_PREFERENCE,
		current: options.current
	})
	const nodes: WikiNode[] = []
	let cursor = 0
	for (const match of matches) {
		if (!canonicalCase(match.name, match.candidates)) continue
		if (match.start > cursor) {
			nodes.push(...splitTooltipTerms(value.slice(cursor, match.start)))
		}
		if (match.status === 'ambiguous' || !match.entry) {
			nodes.push({
				type: 'ambiguous',
				value: match.name,
				refs: match.candidates.map((candidate) => candidate.ref),
				candidates: match.candidates
			})
		} else {
			const ref = match.entry.ref
			const entry = entryForRef(match.name, ref, locale)
			nodes.push({
				type: 'entity',
				value: match.name,
				entry,
				ref,
				tooltip: entry.tooltip,
				icon: inlineIconFor(match.name, entry)
			})
		}
		cursor = match.end
	}
	if (cursor < value.length) nodes.push(...splitTooltipTerms(value.slice(cursor)))
	return nodes
}

/** 显式引用 / 图标 / 升级值先解析；剩余纯文本才进入实体匹配 */
function tokenizePlain(value: string, options: WikiTextOptions): WikiNode[] {
	const base: WikiNode[] = []
	let last = 0
	ICON_PATTERN.lastIndex = 0
	for (const match of value.matchAll(ICON_PATTERN)) {
		const start = match.index ?? 0
		const end = start + match[0].length
		if (start > last) base.push({ type: 'text', value: value.slice(last, start) })
		if (match[3]) {
			base.push({ type: 'text', value: '(' })
			base.push({ type: 'upgraded', value: match[3] })
			base.push({ type: 'text', value: ')' })
			last = end
			continue
		}

		const isFile = match[1] !== undefined
		const raw = (match[1] ?? match[2] ?? '').trim()

		if (isFile && !/^Icon/i.test(raw)) {
			const relic = wikiRelic(raw)
			if (relic) {
				const { label, next } = captureAlias(value, end, relic.aliases)
				const entry = wikiEntryFor(relic.name) ?? placeholder(relic.name, relic.tooltip)
				base.push({
					type: 'entity',
					value: label || relic.name,
					entry,
					ref: entry.id ? { type: entry.kind, id: entry.id } : undefined,
					href: relicHrefByName(relic.name) ?? entry.href ?? null,
					tooltip: relic.tooltip || entry.tooltip,
					icon: { kind: 'relic', src: relic.icon, name: '', label }
				})
				last = label ? next : end
				continue
			}
			base.push({ type: 'text', value: match[0] })
			last = end
			continue
		}

		const name = isFile ? raw.replace(/^Icon\s*/i, '').trim() : raw
		const short = name.replace(/_.*$/, '')
		const term = wikiTerm(short) ?? wikiTerm(name)
		const entry = wikiEntryFor(short) ?? wikiEntryFor(name) ?? placeholder(name, term?.tooltip)
		const { label, next } = captureLabel(value, end, term, entry)
		const sameLabel = !!label
		base.push({
			type: 'entity',
			value: sameLabel ? label : name,
			entry,
			ref: entry.id ? { type: entry.kind, id: entry.id } : undefined,
			tooltip: term?.tooltip ?? entry.tooltip,
			icon: {
				kind: 'power',
				src: '',
				name: term?.icon || (entry.kind === 'power' ? entry.name : ''),
				label: sameLabel ? label : ''
			}
		})
		last = sameLabel ? next : end
	}
	if (last < value.length) base.push({ type: 'text', value: value.slice(last) })

	const result: WikiNode[] = []
	for (const node of base) {
		if (node.type === 'text') result.push(...matchVisibleText(node.value, options))
		else result.push(node)
	}
	return result
}

function tokenizeInline(value: string, options: WikiTextOptions): WikiNode[] {
	const nodes: WikiNode[] = []
	let last = 0
	WIKI_REF_PATTERN.lastIndex = 0
	for (const match of value.matchAll(WIKI_REF_PATTERN)) {
		const start = match.index ?? 0
		if (start > last) nodes.push(...tokenizePlain(value.slice(last, start), options))
		const entry = resolvePowerReference(
			{ type: match[1] as PowerEntityRef['type'], id: match[2].trim() },
			wikiLocale(options.locale ?? getLocale())
		)
		if (entry) {
			const label = match[3]?.trim() || entry.name
			nodes.push({
				type: 'entity',
				value: label,
				entry,
				ref: { type: match[1] as PowerEntityRef['type'], id: match[2].trim() },
				icon: inlineIconFor(label, entry, true)
			})
		} else {
			nodes.push({ type: 'text', value: match[0] })
		}
		last = start + match[0].length
	}
	if (last < value.length) nodes.push(...tokenizePlain(value.slice(last), options))
	return nodes
}

type Segment =
	| { kind: 'text'; value: string }
	| { kind: 'tag'; name: string; arg: string | null; close: boolean }
	| { kind: 'break' }

interface Hit {
	start: number
	end: number
	segment: Segment
}

/** BBCode 只拆结构；标签名 / 参数 / 显式引用与图标范围都不进入可见文本 */
function tokenizeSegments(src: string): Segment[] {
	const protectedRanges: Array<[number, number]> = []
	WIKI_REF_PATTERN.lastIndex = 0
	for (const match of src.matchAll(WIKI_REF_PATTERN)) {
		protectedRanges.push([match.index ?? 0, (match.index ?? 0) + match[0].length])
	}
	ICON_PATTERN.lastIndex = 0
	for (const match of src.matchAll(ICON_PATTERN)) {
		protectedRanges.push([match.index ?? 0, (match.index ?? 0) + match[0].length])
	}

	const overlaps = (start: number, end: number) =>
		protectedRanges.some(([from, to]) => start < to && end > from)

	const hits: Hit[] = []
	TAG_RE.lastIndex = 0
	for (const match of src.matchAll(TAG_RE)) {
		const start = match.index ?? 0
		const end = start + match[0].length
		if (overlaps(start, end)) continue
		const name = match[2].toLowerCase()
		const close = match[1] === '/'
		if (!KNOWN_TAGS.has(name) || GAME_ONLY_TAGS.has(name)) continue
		if (close) hits.push({ start, end, segment: { kind: 'tag', name, arg: null, close: true } })
		else if (name === 'br') hits.push({ start, end, segment: { kind: 'break' } })
		else hits.push({ start, end, segment: { kind: 'tag', name, arg: parseArg(match[3]), close: false } })
	}
	hits.sort((a, b) => a.start - b.start)

	const segments: Segment[] = []
	let last = 0
	for (const hit of hits) {
		if (hit.start > last) segments.push({ kind: 'text', value: src.slice(last, hit.start) })
		segments.push(hit.segment)
		last = hit.end
	}
	if (last < src.length) segments.push({ kind: 'text', value: src.slice(last) })

	const merged: Segment[] = []
	for (const segment of segments) {
		const previous = merged[merged.length - 1]
		if (segment.kind === 'text' && previous?.kind === 'text') previous.value += segment.value
		else merged.push(segment)
	}
	return merged
}

function styleOf(name: string, arg: string | null): WikiStyle {
	if (name === 'color' && arg) return { color: arg }
	if (NAMED_COLORS[name]) return { color: NAMED_COLORS[name] }
	if (name === 'font' && arg) return { font: arg }
	if (name === 'font_size' && arg) return { fontSize: sizeToUnit(arg, 'px') }
	if (name === 'b') return { bold: true }
	if (name === 'i') return { italic: true }
	if (name === 'u') return { underline: true }
	if (ALIGN_TAGS.has(name)) return { align: name as WikiStyle['align'] }
	if (EFFECT_TAGS.has(name)) return {}
	return {}
}

/** Wiki 正文 AST：BBCode 结构 + 可见文本节点上的实体 / 图标 / 歧义节点 */
export function parseWikiText(text: string, options: WikiTextOptions = {}): WikiNode[] {
	const root: WikiNode[] = []
	const stack: Array<{ name: string; children: WikiNode[] }> = []
	const current = () => (stack.length ? stack[stack.length - 1].children : root)

	for (const segment of tokenizeSegments(text)) {
		if (segment.kind === 'text') {
			current().push(...tokenizeInline(segment.value, options))
			continue
		}
		if (segment.kind === 'break') {
			current().push({ type: 'break' })
			continue
		}
		if (segment.close) {
			let index = -1
			for (let i = stack.length - 1; i >= 0; i--) {
				if (stack[i].name === segment.name) {
					index = i
					break
				}
			}
			if (index >= 0) stack.splice(index)
			continue
		}
		const tag: WikiTagNode = {
			type: 'tag',
			name: segment.name,
			arg: segment.arg,
			style: styleOf(segment.name, segment.arg),
			children: []
		}
		current().push(tag)
		stack.push({ name: tag.name, children: tag.children })
	}
	return root
}
