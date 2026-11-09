import { cardImageFiles, cardThumbFiles, dataFiles, localizationFiles, manifestFiles } from 'virtual:mods';
import {
	ALL_CARD_KEYWORDS,
	CARD_TYPES,
	COLORS,
	RARITIES,
	type Card,
	type CardAttributes,
	type CardType,
	type CardVariables,
	type ColorId,
	type MotifName,
	type Rarity
} from './cards';
import {
	isCollectionCharacter,
	isPotionRarity,
	isRelicRarity,
	type CollectionCharacter,
	type CollectionEntry,
	type CollectionKind,
	type CollectionRarity,
	type CollectionVariables
} from './collections';
import {
	entryIdFor,
	isModDependency,
	resolveContentText,
	type ContentKind,
	type LocalizedField,
	type ModDependency
} from './mod-dependency';
import type { GlossaryEntry, StackType, TurnBehavior } from './glossary';
import { resolveCollectionText } from '../text/collection-text';
import { stripBBCode } from '../text/bbcode';

/**
 * 模组清单：static/mods/{modid}/manifest.json 即注册一个模组。
 * 卡牌结构数据来自清单声明的 cards 文件；
 * 卡牌与 Buff 的名称/描述根据清单的前置依赖自动生成本地化 Key，
 * 并从 static/mods/{modid}/localization/{locale}/*.json 读取。
 * 清单中声明的相对路径资源统一解析为 /mods/{modid}/...。
 */
/** 角色资源：颜色 id -> 图片路径 */
export interface CharacterAssets {
	/** 角色筛选图标 */
	char: string;
	/** 卡面费用图标 */
	cardEnergy?: string;
	/** 卡牌文本中的能量图标 */
	textEnergy?: string;
	/** 卡面第二费用（星）图标 */
	secondCardEnergy?: string;
	/** 卡牌文本中的第二费用（星）图标 */
	secondTextEnergy?: string;
	/** 角色主题色（卡面艺术窗渐变） */
	accent?: string;
	/** 角色能量描边色（费用数字描边） */
	energyOutline?: string;
	/** 卡框图片：卡牌类型 -> 图片路径（已按 /mods/{id}/... 解析） */
	cardFrame?: Partial<Record<CardType, string>>;
	/** 卡框 HSV 着色（对应 tools/card-frame-preview 的 HSV 渲染法），可省略表示不染色 */
	shader?: { h: number; s: number; v: number };
}

export interface ModManifest {
	id: string;
	name: string;
	author: string;
	version?: string;
	blurb: string;
	/** 前置依赖，决定 Entry ID 与本地化 Key 的生成方式 */
	dependency?: ModDependency;
	/** 卡牌数据文件 */
	cards?: string;
	/** Buff 数据文件 */
	powers?: string;
	/** 遗物数据文件 */
	relics?: string;
	/** 药水数据文件 */
	potions?: string;
	/** 颜色 id -> 角色资源 */
	cardPool?: Record<string, CharacterAssets>;
}

export interface LocalizedModText {
	name?: string;
	blurb?: string;
}

/** Buff 结构数据，名称与描述由本地化 Key 提供 */
export interface ModPowerData {
	id: string;
	group?: string;
	stack?: StackType;
	behavior?: TurnBehavior;
	cap?: string;
	icon?: string;
	motif?: MotifName;
	enemyOnly?: boolean;
	aliases?: string[];
}

/** 卡牌结构数据，名称与文本由本地化文件提供；pool 为权威卡池字段，color 由 pool 派生 */
type CardData = CardAttributes & {
	id: string;
	color?: ColorId;
	pool?: string | string[];
	type: CardType;
	rarity: Rarity;
	image?: string;
	upgrade?: Partial<CardAttributes>;
};

interface LoadedMod {
	manifest: ModManifest;
	cards: Card[];
	powers: GlossaryEntry[];
	relics: CollectionEntry[];
	potions: CollectionEntry[];
}

const BASE_MOD_ID = 'sts2';
const BASE_LOCALE = 'eng';

/** locale -> modId -> 合并后的内容本地化键值 */
export const MOD_CONTENT_LOCALES: Record<string, Record<string, Record<string, string>>> = {};

/** locale -> modId -> 模组名称与简介 */
export const MOD_LOCALES: Record<string, Record<string, LocalizedModText>> = {};

/** locale -> card_keywords.json 的扁平键值 */
export const KEYWORD_LOCALES: Record<string, Record<string, string>> = {};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
	return typeof value === 'string';
}

function isCharacterAssets(value: unknown): value is CharacterAssets {
	if (!isRecord(value)) return false;
	return (
		isString(value.char) &&
		(value.cardEnergy === undefined || isString(value.cardEnergy)) &&
		(value.textEnergy === undefined || isString(value.textEnergy)) &&
		(value.secondCardEnergy === undefined || isString(value.secondCardEnergy)) &&
		(value.secondTextEnergy === undefined || isString(value.secondTextEnergy)) &&
		(value.accent === undefined || isString(value.accent)) &&
		(value.energyOutline === undefined || isString(value.energyOutline)) &&
		(value.cardFrame === undefined ||
			(isRecord(value.cardFrame) &&
				Object.entries(value.cardFrame).every(
					([type, path]) => typeof type === 'string' && isString(path)
				))) &&
		(value.shader === undefined ||
			(isRecord(value.shader) &&
				typeof value.shader.h === 'number' &&
				typeof value.shader.s === 'number' &&
				typeof value.shader.v === 'number'))
	);
}

function isManifest(value: unknown): value is ModManifest {
	if (!isRecord(value)) return false;

	const declaresContent =
		value.cards !== undefined ||
		value.powers !== undefined ||
		value.relics !== undefined ||
		value.potions !== undefined;

	return (
		isString(value.id) &&
		isString(value.name) &&
		isString(value.author) &&
		isString(value.blurb) &&
		(value.dependency === undefined || isModDependency(value.dependency)) &&
		(!declaresContent || value.dependency !== undefined) &&
		(value.cards === undefined || isString(value.cards)) &&
		(value.powers === undefined || isString(value.powers)) &&
		(value.relics === undefined || isString(value.relics)) &&
		(value.potions === undefined || isString(value.potions)) &&
		(value.cardPool === undefined ||
			(isRecord(value.cardPool) && Object.values(value.cardPool).every(isCharacterAssets)))
	);
}

function isVariables(value: unknown): value is CardVariables {
	return (
		isRecord(value) &&
		Object.values(value).every((entry) => typeof entry === 'string' || typeof entry === 'number')
	);
}

const isCardCost = (value: unknown) =>
	typeof value === 'number' || value === 'X' || value === null;
const isOptional =
	(validate: (value: unknown) => boolean) => (value: unknown) =>
		value === undefined || validate(value);
const isKeywords = (value: unknown) =>
	Array.isArray(value) &&
	value.every((keyword) => isString(keyword) && (ALL_CARD_KEYWORDS as string[]).includes(keyword));

const CARD_ATTRIBUTE_VALIDATORS: Record<keyof CardAttributes, (value: unknown) => boolean> = {
	cost: isCardCost,
	secondEnergy: isOptional(isCardCost),
	variables: isOptional(isVariables),
	keywords: isKeywords
};

function isCardUpgrade(value: unknown): value is Partial<CardAttributes> {
	return (
		isRecord(value) &&
		Object.entries(value).every(([key, entry]) => {
			const validate = CARD_ATTRIBUTE_VALIDATORS[key as keyof CardAttributes];
			return validate !== undefined && validate(entry);
		})
	);
}

function poolTokens(value: unknown): string[] | undefined {
	if (!isRecord(value)) return undefined;
	const p = value.pool;
	if (p === undefined) return undefined;
	if (isString(p)) return [p];
	if (Array.isArray(p) && p.every(isString)) return p as string[];
	return undefined;
}

function poolOf(value: unknown): string[] {
	if (!isRecord(value)) return [];
	const fromPool = poolTokens(value);
	if (fromPool) return fromPool;
	const c = value.color;
	if (isString(c)) return [c];
	return [];
}

function cardColorOf(value: unknown): ColorId {
	if (!isRecord(value)) return 'colorless';
	const c = value.color;
	if (isString(c) && c in COLORS) return c as ColorId;
	const tokens = poolTokens(value);
	if (tokens) {
		for (const t of tokens) {
			if (t in COLORS) return t as ColorId;
		}
	}
	return 'colorless';
}

function isCardData(value: unknown): value is CardData {
	if (!isRecord(value)) return false;
	const { type, rarity, image, upgrade } = value;
	const hasPool = poolTokens(value) !== undefined;
	const hasColor = isString(value.color) && value.color in COLORS;
	return (
		isString(value.id) &&
		value.id.trim().length > 0 &&
		(hasPool || hasColor) &&
		isString(type) &&
		type in CARD_TYPES &&
		isString(rarity) &&
		rarity in RARITIES &&
		(image === undefined || isString(image)) &&
		Object.entries(CARD_ATTRIBUTE_VALIDATORS).every(([key, validate]) => validate(value[key])) &&
		(upgrade === undefined || isCardUpgrade(upgrade))
	);
}

function isModPowerData(value: unknown): value is ModPowerData {
	if (!isRecord(value)) return false;
	return (
		isString(value.id) &&
		value.id.trim().length > 0 &&
		(value.group === undefined || isString(value.group)) &&
		(value.stack === undefined || isString(value.stack)) &&
		(value.behavior === undefined || isString(value.behavior)) &&
		(value.cap === undefined || isString(value.cap)) &&
		(value.icon === undefined || isString(value.icon)) &&
		(value.motif === undefined || isString(value.motif)) &&
		(value.enemyOnly === undefined || typeof value.enemyOnly === 'boolean') &&
		(value.aliases === undefined ||
			(Array.isArray(value.aliases) && value.aliases.every(isString)))
	);
}

/** 遗物 / 药水结构数据，名称与描述由本地化文件提供 */
interface CollectionData {
	id: string;
	rarity: CollectionRarity;
	character: CollectionCharacter;
	tags: string[];
	image?: string;
	upgraded?: boolean;
	ancient?: string;
	variables?: CollectionVariables;
	variablesZh?: CollectionVariables;
}

function isCollectionData(value: unknown, kind: CollectionKind): value is CollectionData {
	if (!isRecord(value)) return false;
	const { id, rarity, character, tags, image, upgraded, ancient, variables, variablesZh } = value;
	return (
		isString(id) &&
		id.trim().length > 0 &&
		isString(rarity) &&
		(kind === 'relic' ? isRelicRarity(rarity) : isPotionRarity(rarity)) &&
		isString(character) &&
		isCollectionCharacter(character) &&
		Array.isArray(tags) &&
		tags.every(isString) &&
		(image === undefined || isString(image)) &&
		(upgraded === undefined || typeof upgraded === 'boolean') &&
		(ancient === undefined || isString(ancient)) &&
		(variables === undefined || isVariables(variables)) &&
		(variablesZh === undefined || isVariables(variablesZh))
	);
}

function loadGlobalLocalization() {
	for (const [path, data] of Object.entries(localizationFiles)) {
		const match = path.match(/^\/static\/localization\/([^/]+)\/([^/]+)$/);
		if (!match || !isRecord(data)) continue;

		const [, locale, file] = match;
		if (file === 'mods.json') {
			MOD_LOCALES[locale] = data as Record<string, LocalizedModText>;
		} else if (file === 'card_keywords.json') {
			KEYWORD_LOCALES[locale] = data as Record<string, string>;
		}
	}
}

function loadModLocalization() {
	for (const [path, data] of Object.entries(localizationFiles)) {
		const match = path.match(/^\/static\/mods\/([^/]+)\/localization\/([^/]+)\/[^/]+$/);
		if (!match || !isRecord(data)) continue;

		const [, modId, locale] = match;
		const texts = (MOD_CONTENT_LOCALES[locale] ??= {})[modId] ??= {};

		for (const [key, value] of Object.entries(data)) {
			if (!isString(value)) continue;
			if (key in texts) {
				console.warn(`[mods] 重复的内容本地化键，后者覆盖前者：${modId}/${locale}/${key}`);
			}
			texts[key] = value;
		}
	}
}

function resolveAsset(modId: string, path: string) {
	return path.startsWith('/') ? path : `/mods/${modId}/${path}`;
}

/** 按前置依赖生成的 Key 读取某个模组内容字段 */
export function modContentText(
	mod: ModManifest,
	kind: ContentKind,
	id: string,
	field: LocalizedField,
	locale: string = BASE_LOCALE
): string | undefined {
	return resolveContentText(
		MOD_CONTENT_LOCALES[locale]?.[mod.id],
		mod.dependency,
		kind,
		id,
		field
	);
}

function loadCards(dir: string, manifest: ModManifest): Card[] {
	const file = manifest.cards;
	if (!file) return [];

	const data = dataFiles[`${dir}/${file}`];
	if (!Array.isArray(data)) {
		console.warn(`[mods] 卡牌数据缺失或格式无效：${dir}/${file}`);
		return [];
	}

	const cards: Card[] = [];

	for (const value of data) {
		if (!isCardData(value)) {
			const id = isRecord(value) && isString(value.id) ? value.id : '?';
			console.warn(`[mods] 已跳过无效卡牌：${dir}/${file}（${id}）`);
			continue;
		}

		const pool = poolOf(value);
		const color = cardColorOf(value);
		const name = modContentText(manifest, 'card', value.id, 'title');
		const text = modContentText(manifest, 'card', value.id, 'description');
		if (name === undefined || text === undefined) {
			const entryId = manifest.dependency
				? entryIdFor(manifest.dependency, 'card', value.id)
				: '(未声明前置依赖)';
			console.warn(
				`[mods] 卡牌缺少 ${BASE_LOCALE} 本地化文本（${entryId}.title/description），已跳过：${manifest.id}/${value.id}`
			);
			continue;
		}

		const cardKey = value.id.toLowerCase().replace(/[^a-z0-9]/g, '');
		cards.push({
			...value,
			pool,
			color,
			mod: manifest.id,
			image: value.image
				? resolveAsset(manifest.id, value.image)
				: cardImageFiles[manifest.id]?.[cardKey],
			thumb: cardThumbFiles[manifest.id]?.[cardKey],
			name,
			text
		});
	}

	return cards;
}

function loadPowers(dir: string, manifest: ModManifest): GlossaryEntry[] {
	const file = manifest.powers;
	if (!file) return [];

	const data = dataFiles[`${dir}/${file}`];
	if (!Array.isArray(data)) {
		console.warn(`[mods] Buff 数据缺失或格式无效：${dir}/${file}`);
		return [];
	}

	const powers: GlossaryEntry[] = [];

	for (const value of data) {
		if (!isModPowerData(value)) {
			console.warn(`[mods] 已跳过无效 Buff：${dir}/${file}`);
			continue;
		}

		const name = modContentText(manifest, 'power', value.id, 'title');
		const summary = modContentText(manifest, 'power', value.id, 'description');
		if (name === undefined || summary === undefined) {
			const entryId = manifest.dependency
				? entryIdFor(manifest.dependency, 'power', value.id)
				: '(未声明前置依赖)';
			console.warn(
				`[mods] Buff 缺少 ${BASE_LOCALE} 本地化文本（${entryId}.title/description），已跳过：${manifest.id}/${value.id}`
			);
			continue;
		}

		powers.push({
			id: value.id,
			name,
			kind: 'power',
			group: value.group ?? 'Other',
			summary: stripBBCode(summary),
			aliases: value.aliases,
			stack: value.stack,
			behavior: value.behavior,
			cap: value.cap,
			motif: value.motif,
			icon: value.icon ? resolveAsset(manifest.id, value.icon) : undefined,
			enemyOnly: value.enemyOnly,
			mod: manifest.id
		});
	}

	return powers;
}

function loadCollection(
	dir: string,
	manifest: ModManifest,
	kind: CollectionKind
): CollectionEntry[] {
	const file = kind === 'relic' ? manifest.relics : manifest.potions;
	if (!file) return [];

	const data = dataFiles[`${dir}/${file}`];
	if (!Array.isArray(data)) {
		console.warn(`[mods] ${kind === 'relic' ? '遗物' : '药水'}数据缺失或格式无效：${dir}/${file}`);
		return [];
	}

	const entries: CollectionEntry[] = [];

	for (const value of data) {
		if (!isCollectionData(value, kind)) {
			console.warn(`[mods] 已跳过无效${kind === 'relic' ? '遗物' : '药水'}：${dir}/${file}`);
			continue;
		}

		const name = modContentText(manifest, kind, value.id, 'title');
		const template = modContentText(manifest, kind, value.id, 'description');
		if (name === undefined || template === undefined) {
			const entryId = manifest.dependency
				? entryIdFor(manifest.dependency, kind, value.id)
				: '(未声明前置依赖)';
			console.warn(
				`[mods] ${kind === 'relic' ? '遗物' : '药水'}缺少 ${BASE_LOCALE} 本地化文本（${entryId}.title/description），已跳过：${manifest.id}/${value.id}`
			);
			continue;
		}

		entries.push({
			id: value.id,
			name,
			mod: manifest.id,
			kind,
			rarity: value.rarity,
			character: value.character,
			tags: value.tags,
			text: resolveCollectionText(template, value.variables),
			image: value.image ? resolveAsset(manifest.id, value.image) : undefined,
			upgraded: value.upgraded,
			ancient: value.ancient,
			variables: value.variables,
			variablesZh: value.variablesZh
		});
	}

	return entries;
}

function loadMod(path: string, value: unknown): LoadedMod | undefined {
	const dir = path.slice(0, path.lastIndexOf('/'));
	const folder = dir.slice(dir.lastIndexOf('/') + 1);

	if (!isManifest(value)) {
		console.warn(`[mods] 清单格式无效，已跳过：${path}`);
		return undefined;
	}

	if (folder !== value.id) {
		console.warn(`[mods] 清单 id 与所在目录不一致，已跳过：${path}（id: ${value.id}）`);
		return undefined;
	}

	return {
		manifest: value,
		cards: loadCards(dir, value),
		powers: loadPowers(dir, value),
		relics: loadCollection(dir, value, 'relic'),
		potions: loadCollection(dir, value, 'potion')
	};
}

loadGlobalLocalization();
loadModLocalization();

const loaded: LoadedMod[] = [];

for (const path of Object.keys(manifestFiles).sort()) {
	const mod = loadMod(path, manifestFiles[path]);
	if (!mod) continue;

	if (loaded.some((entry) => entry.manifest.id === mod.manifest.id)) {
		console.warn(`[mods] 重复的模组 id，已跳过：${mod.manifest.id}`);
		continue;
	}

	loaded.push(mod);
}

loaded.sort((a, b) => {
	const aBase = a.manifest.id === BASE_MOD_ID;
	const bBase = b.manifest.id === BASE_MOD_ID;
	if (aBase !== bBase) return aBase ? -1 : 1;
	return a.manifest.id.localeCompare(b.manifest.id);
});

export const MODS: ModManifest[] = loaded.map((entry) => entry.manifest);
export const MOD_BY_ID = new Map(MODS.map((mod) => [mod.id, mod]));
export const CARDS: Card[] = loaded.flatMap((entry) => entry.cards);
export const MOD_POWERS: GlossaryEntry[] = loaded.flatMap((entry) => entry.powers);
export const RELICS: CollectionEntry[] = loaded.flatMap((entry) => entry.relics);
export const POTIONS: CollectionEntry[] = loaded.flatMap((entry) => entry.potions);

/** 颜色 id -> 角色资源；基础游戏优先，其余模组只补充缺失颜色 */
export const CHARACTER_ASSETS: Record<string, CharacterAssets> = {};

for (const entry of loaded) {
	for (const [color, assets] of Object.entries(entry.manifest.cardPool ?? {})) {
		if (color in CHARACTER_ASSETS) continue;
		CHARACTER_ASSETS[color] = {
			char: resolveAsset(entry.manifest.id, assets.char),
			cardEnergy: assets.cardEnergy
				? resolveAsset(entry.manifest.id, assets.cardEnergy)
				: undefined,
			textEnergy: assets.textEnergy
				? resolveAsset(entry.manifest.id, assets.textEnergy)
				: undefined,
			secondCardEnergy: assets.secondCardEnergy
				? resolveAsset(entry.manifest.id, assets.secondCardEnergy)
				: undefined,
			secondTextEnergy: assets.secondTextEnergy
				? resolveAsset(entry.manifest.id, assets.secondTextEnergy)
				: undefined,
			accent: assets.accent,
			energyOutline: assets.energyOutline,
			cardFrame: assets.cardFrame
				? Object.fromEntries(
						Object.entries(assets.cardFrame).map(([type, path]) => [
							type,
							resolveAsset(entry.manifest.id, path)
						])
					)
				: undefined,
			shader: assets.shader
		};
	}
}

/** 颜色 id -> 角色筛选图标 */
export const CHARACTER_ICONS: Record<string, string> = Object.fromEntries(
	Object.entries(CHARACTER_ASSETS).map(([color, assets]) => [color, assets.char])
);

/** 无色（其他角色）筛选图标，供卡牌页使用 */
export const COLORLESS_ICON = resolveAsset(BASE_MOD_ID, 'images/energy_colorless.png');
