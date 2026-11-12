import { getLocale } from '#lib/paraglide/runtime';
import {
	ANCIENTS_ZH,
	type CollectionCharacter,
	type CollectionEntry,
	type CollectionRarity
} from './collections';
import {
	CARD_KEYWORDS_AFTER,
	CARD_KEYWORDS_BEFORE,
	CARD_TYPES,
	COLORS,
	isBuiltinRarity,
	rarityInfo,
	RARITIES,
	type Card,
	type CardKeyword,
	type CardType,
	type ColorId
} from './cards';
import { KEYWORD_LOCALES, MOD_BY_ID, MOD_LOCALES, modContentText } from './mods';
import {
	ALL_ENTRIES,
	TERM_INDEX,
	TERM_PATTERN,
	escapeRegExp,
	entryHref,
	type GlossaryEntry,
	type GlossaryKind,
	type GlossaryLink,
	type StackType,
	type TurnBehavior
} from './glossary';
import { resolveCollectionText } from '../text/collection-text';
import { stripBBCode } from '../text/bbcode';
import {
	BEHAVIOR_ZH,
	CARD_TYPE_ZH,
	COLOR_ZH,
	GLOSSARY_ZH,
	GROUP_ZH,
	RARITY_ZH,
	STACK_ZH
} from './zh';

export function isZh() {
	return getLocale() === 'zhs';
}

export function localizedCard(card: Card): Card {
	const mod = MOD_BY_ID.get(card.mod);
	if (!mod) return card;

	const name = modContentText(mod, 'card', card.id, 'title', getLocale());
	const text = modContentText(mod, 'card', card.id, 'description', getLocale());
	if (name === undefined && text === undefined) return card;

	return {
		...card,
		name: name ?? card.name,
		text: text ?? card.text
	};
}

export function localizedCards(cards: Card[]) {
	return cards.map(localizedCard);
}

/** 当前语言下的遗物 / 药水条目；中文描述里的变量同时合并 variablesZh */
export function localizedCollection(entry: CollectionEntry): CollectionEntry {
	if (!isZh()) return entry;

	const mod = MOD_BY_ID.get(entry.mod);
	if (!mod) return entry;

	const name = modContentText(mod, entry.kind, entry.id, 'title', getLocale());
	const template = modContentText(mod, entry.kind, entry.id, 'description', getLocale());
	if (name === undefined && template === undefined) return entry;

	return {
		...entry,
		name: name ?? entry.name,
		text: template
			? resolveCollectionText(template, { ...entry.variables, ...entry.variablesZh })
			: entry.text
	};
}

export function localizedCollections(entries: CollectionEntry[]) {
	return entries.map(localizedCollection);
}

const COLLECTION_RARITY_ZH: Record<CollectionRarity, string> = {
	starter: '基础',
	common: '普通',
	uncommon: '罕见',
	rare: '稀有',
	ancient: '先古',
	shop: '商店',
	event: '事件',
	special: '特殊'
};

const COLLECTION_RARITY_EN: Record<CollectionRarity, string> = {
	starter: 'Starter',
	common: 'Common',
	uncommon: 'Uncommon',
	rare: 'Rare',
	ancient: 'Ancient',
	shop: 'Shop',
	event: 'Event',
	special: 'Special'
};

export function collectionRarityName(rarity: CollectionRarity) {
	return isZh() ? COLLECTION_RARITY_ZH[rarity] : COLLECTION_RARITY_EN[rarity];
}

const COLLECTION_CHARACTER_EN: Record<CollectionCharacter, string> = {
	any: 'Any',
	ironclad: 'Ironclad',
	silent: 'Silent',
	regent: 'Regent',
	necrobinder: 'Necrobinder',
	defect: 'Defect'
};

export function collectionCharacterName(character: CollectionCharacter) {
	if (isZh()) return character === 'any' ? '通用' : COLOR_ZH[character];
	return COLLECTION_CHARACTER_EN[character];
}

/** 先古遗物来源；未知来源直接回退英文名 */
export function ancientName(ancient: string) {
	return isZh() ? (ANCIENTS_ZH[ancient] ?? ancient) : ancient;
}

export function colorName(id: string) {
	if (isZh()) return COLOR_ZH[id as ColorId] ?? id.charAt(0).toUpperCase() + id.slice(1);
	const info = (COLORS as Record<string, (typeof COLORS)[ColorId] | undefined>)[id];
	return info?.name ?? id.charAt(0).toUpperCase() + id.slice(1);
}

export function typeName(type: CardType) {
	return isZh() ? CARD_TYPE_ZH[type].name : CARD_TYPES[type].name;
}

export function rarityName(rarity: string) {
	if (isBuiltinRarity(rarity)) return isZh() ? RARITY_ZH[rarity] : RARITIES[rarity].name;
	const info = rarityInfo(rarity);
	return info.labels[getLocale()] ?? info.labels.eng ?? info.name;
}

export function modName(id: string) {
	const locale = MOD_LOCALES[getLocale()]?.[id];
	return locale?.name ?? MOD_BY_ID.get(id)?.name ?? id;
}

export function modBlurb(id: string) {
	const locale = MOD_LOCALES[getLocale()]?.[id];
	return locale?.blurb ?? MOD_BY_ID.get(id)?.blurb ?? '';
}

function keywordText() {
	return KEYWORD_LOCALES[getLocale()] ?? KEYWORD_LOCALES.eng ?? {};
}

/** 关键词标题，不含句号 */
export function localizedKeyword(keyword: CardKeyword) {
	return keywordText()[`${keyword.toUpperCase()}.title`] ?? keyword;
}

/** 关键词行：标题默认金色，末尾补句号 */
export function localizedKeywordLine(keyword: CardKeyword) {
	return `[gold]${localizedKeyword(keyword)}[/gold]${keywordText().PERIOD ?? '.'}`;
}

/**
 * 按游戏 CardKeywordOrder 分组：描述前与描述后的关键词行。
 */
export function keywordPlacement(keywords: CardKeyword[]) {
	return {
		before: CARD_KEYWORDS_BEFORE.filter((keyword) => keywords.includes(keyword)).map(
			localizedKeywordLine
		),
		after: CARD_KEYWORDS_AFTER.filter((keyword) => keywords.includes(keyword)).map(
			localizedKeywordLine
		)
	};
}

export function localizedEntry(entry: GlossaryEntry): GlossaryEntry {
	if (entry.mod) {
		const mod = MOD_BY_ID.get(entry.mod);
		const name = mod ? modContentText(mod, 'power', entry.id, 'title', getLocale()) : undefined;
		const summary = mod
			? modContentText(mod, 'power', entry.id, 'description', getLocale())
			: undefined;
		if (name !== undefined || summary !== undefined) {
			return {
				...entry,
				name: name ?? entry.name,
				summary: summary === undefined ? entry.summary : stripBBCode(summary)
			};
		}
	}

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

const KIND_PRIORITY: Record<GlossaryKind, number> = { power: 2, keyword: 1 };

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
				href: entryHref(entry),
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
