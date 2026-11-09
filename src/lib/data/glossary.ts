import { MOD_POWERS } from './mods';
import type { MotifName } from './cards';

export type GlossaryKind = 'keyword' | 'power';
export type StackType =
	| 'Intensity'
	| 'Duration'
	| 'Counter'
	| 'Passive'
	| 'NoStack'
	| 'IntensityDuration'
	| 'IntensityCounter'
	| 'CounterDuration'
	| 'DurationStacks';
export type TurnBehavior =
	| 'Permanent'
	| 'Conserved'
	| 'Decremented'
	| 'Removed'
	| 'Consumed'
	| 'Reset'
	| 'Special';

export type StackKind = 'Intensity' | 'Duration' | 'Counter'

export const STACK_KINDS: Record<StackType, readonly StackKind[]> = {
	Intensity: ['Intensity'],
	Duration: ['Duration'],
	Counter: ['Counter'],
	Passive: [],
	NoStack: [],
	IntensityDuration: ['Intensity', 'Duration'],
	IntensityCounter: ['Intensity', 'Counter'],
	CounterDuration: ['Counter', 'Duration'],
	DurationStacks: ['Duration']
}

export function matchesStackFilter(stack: StackType | undefined, selected: readonly StackKind[]) {
	if (!selected.length) return true
	const kinds = stack ? STACK_KINDS[stack] : undefined
	return kinds?.some((kind) => selected.includes(kind)) ?? false
}

export interface GlossaryEntry {
	id: string;
	name: string;
	kind: GlossaryKind;
	group: string;
	summary: string;
	detail?: string;
	aliases?: string[];
	stack?: StackType;
	behavior?: TurnBehavior;
	cap?: string;
	motif?: MotifName;
	icon?: string;
	/** Monster-only powers are excluded from card-text term linking. */
	enemyOnly?: boolean;
	/** 来源模组；存在时名称与描述由该模组的本地化 Key 解析 */
	mod?: string;
}

/** 各模组（含基础游戏 sts2）声明的 Buff；名称与描述由本地化文件提供 */
export const POWERS: GlossaryEntry[] = MOD_POWERS;

export const ROUTES: Record<GlossaryKind, string> = {
	keyword: '/keywords',
	power: '/powers'
};

export const POWER_ROUTE = '/power'

export function powerHref(entry: GlossaryEntry) {
	return `${POWER_ROUTE}/${encodeURIComponent(entry.id)}`
}

export function glossaryHref(entry: GlossaryEntry) {
	return `${ROUTES[entry.kind]}#${entry.id}`
}

export function entryHref(entry: GlossaryEntry) {
	return entry.kind === 'power' ? powerHref(entry) : glossaryHref(entry)
}

export const KEYWORDS: GlossaryEntry[] = [
	{
		id: 'eternal',
		name: 'Eternal',
		kind: 'keyword',
		group: 'Card',
		summary: 'Cannot be removed or transformed from your Deck.',
		motif: 'spiral'
	},
	{
		id: 'ethereal',
		name: 'Ethereal',
		kind: 'keyword',
		group: 'Card',
		summary: 'If this card is in your Hand at the end of this turn, it is Exhausted.',
		motif: 'moon'
	},
	{
		id: 'exhaust',
		name: 'Exhaust',
		kind: 'keyword',
		group: 'Card',
		summary: 'Removed until the end of combat.',
		motif: 'flame'
	},
	{
		id: 'innate',
		name: 'Innate',
		kind: 'keyword',
		group: 'Card',
		summary: 'Start each combat with this card in your Hand.',
		motif: 'star'
	},
	{
		id: 'retain',
		name: 'Retain',
		kind: 'keyword',
		group: 'Card',
		summary: 'Retained cards are not discarded at the end of turn.',
		motif: 'thorn'
	},
	{
		id: 'sly',
		name: 'Sly',
		kind: 'keyword',
		group: 'Card',
		summary: 'If this card is discarded from your Hand before the end of your turn, play it for free.',
		motif: 'feather'
	},
	{
		id: 'unplayable',
		name: 'Unplayable',
		kind: 'keyword',
		group: 'Card',
		summary: 'Unplayable cards cannot be played.',
		motif: 'spiral'
	}
];

export const ALL_ENTRIES: GlossaryEntry[] = [...KEYWORDS, ...POWERS];

export const ENTRY_BY_ID = new Map(ALL_ENTRIES.map((entry) => [entry.id, entry]));

export function entriesForKind(kind: GlossaryKind) {
	return ALL_ENTRIES.filter((entry) => entry.kind === kind);
}

export interface GlossaryLink {
	term: string;
	href: string;
	kind: GlossaryKind;
	name: string;
	summary: string;
	entryId: string;
}

const KIND_PRIORITY: Record<GlossaryKind, number> = { power: 2, keyword: 1 };

const linkMap = new Map<string, GlossaryLink>();

for (const entry of ALL_ENTRIES) {
	if (entry.enemyOnly) continue;
	for (const term of [entry.name, ...(entry.aliases ?? [])]) {
		const key = term.toLowerCase();
		const existing = linkMap.get(key);
		if (existing && KIND_PRIORITY[existing.kind] >= KIND_PRIORITY[entry.kind]) continue;
		linkMap.set(key, {
			term,
			href: entryHref(entry),
			kind: entry.kind,
			name: entry.name,
			summary: entry.summary,
			entryId: entry.id
		});
	}
}

export const GLOSSARY_LINKS: GlossaryLink[] = [...linkMap.values()].sort(
	(a, b) => b.term.length - a.term.length
);

export function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const TERM_PATTERN = new RegExp(
	`\\b(${GLOSSARY_LINKS.map((link) => escapeRegExp(link.term)).join('|')})\\b`,
	'gi'
);

export const TERM_INDEX = new Map(GLOSSARY_LINKS.map((link) => [link.term.toLowerCase(), link]));
