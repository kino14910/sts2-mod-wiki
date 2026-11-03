import { getLocale } from '#lib/paraglide/runtime';
import {
	CARD_TYPES,
	COLORS,
	MOD_BY_ID,
	RARITIES,
	type Card,
	type CardType,
	type ColorId,
	type Rarity
} from './cards';
import {
	ALL_ENTRIES,
	TERM_INDEX,
	TERM_PATTERN,
	escapeRegExp,
	glossaryHref,
	type GlossaryEntry,
	type GlossaryKind,
	type GlossaryLink,
	type StackType,
	type TurnBehavior
} from './glossary';
import {
	BEHAVIOR_ZH,
	CARD_TYPE_ZH,
	CARD_ZH,
	COLOR_ZH,
	GLOSSARY_ZH,
	GROUP_ZH,
	MOD_ZH,
	RARITY_ZH,
	STACK_ZH
} from './zh';

export function isZh() {
	return getLocale() === 'zhs';
}

export function localizedCard(card: Card): Card {
	if (!isZh()) return card;
	const zh = CARD_ZH[card.id];
	if (!zh) return card;
	return {
		...card,
		name: zh.name,
		text: zh.text,
		upgradedText: zh.upgradedText,
		flavor: zh.flavor
	};
}

export function localizedCards(cards: Card[]) {
	return cards.map(localizedCard);
}

export function colorName(id: ColorId) {
	return isZh() ? COLOR_ZH[id] : COLORS[id].name;
}

export function typeName(type: CardType) {
	return isZh() ? CARD_TYPE_ZH[type].name : CARD_TYPES[type].name;
}

export function rarityName(rarity: Rarity) {
	return isZh() ? RARITY_ZH[rarity] : RARITIES[rarity].name;
}

export function modName(id: string) {
	const zh = MOD_ZH[id];
	if (isZh() && zh) return zh.name;
	return MOD_BY_ID.get(id)?.name ?? id;
}

export function modBlurb(id: string) {
	const zh = MOD_ZH[id];
	if (isZh() && zh) return zh.blurb;
	return MOD_BY_ID.get(id)?.blurb ?? '';
}

export function localizedEntry(entry: GlossaryEntry): GlossaryEntry {
	if (!isZh()) return entry;
	const zh = GLOSSARY_ZH[entry.id];
	if (!zh) return entry;
	return {
		...entry,
		name: zh.name,
		summary: zh.summary ?? entry.summary,
		detail: zh.detail ?? entry.detail,
		aliases: zh.aliases
	};
}

export function localizedEntries(entries: GlossaryEntry[]) {
	return entries.map(localizedEntry);
}

export function groupName(group: string) {
	return isZh() ? (GROUP_ZH[group] ?? group) : group;
}

export function stackName(stack: StackType) {
	return isZh() ? STACK_ZH[stack] : STACK_EN[stack];
}

export function behaviorName(behavior: TurnBehavior) {
	return isZh() ? BEHAVIOR_ZH[behavior] : behavior;
}

const KIND_PRIORITY: Record<GlossaryKind, number> = { debuff: 3, buff: 2, keyword: 1 };

const STACK_EN: Record<StackType, string> = {
	Intensity: 'Intensity',
	Duration: 'Duration',
	Counter: 'Counter',
	Passive: 'Passive',
	NoStack: 'Does not stack',
	IntensityDuration: 'Intensity + Duration',
	IntensityCounter: 'Intensity + Counter',
	CounterDuration: 'Counter + Duration',
	DurationStacks: 'Duration (separate stacks)'
};

let zhLinkCache: { index: Map<string, GlossaryLink>; pattern: RegExp } | undefined;

function buildZhLinks() {
	const map = new Map<string, GlossaryLink>();

	for (const entry of localizedEntries(ALL_ENTRIES)) {
		if (entry.enemyOnly) continue;
		for (const term of [entry.name, ...(entry.aliases ?? [])]) {
			const key = term.toLowerCase();
			const existing = map.get(key);
			if (existing && KIND_PRIORITY[existing.kind] >= KIND_PRIORITY[entry.kind]) continue;
			map.set(key, {
				term,
				href: glossaryHref(entry),
				kind: entry.kind,
				name: entry.name,
				summary: entry.summary,
				entryId: entry.id
			});
		}
	}

	const links = [...map.values()].sort((a, b) => b.term.length - a.term.length);
	const pattern = new RegExp(`(${links.map((link) => escapeRegExp(link.term)).join('|')})`, 'gi');

	return { index: map, pattern };
}

export function termIndex() {
	if (!isZh()) return TERM_INDEX;
	zhLinkCache ??= buildZhLinks();
	return zhLinkCache.index;
}

export function termPattern() {
	if (!isZh()) return TERM_PATTERN;
	zhLinkCache ??= buildZhLinks();
	return zhLinkCache.pattern;
}
