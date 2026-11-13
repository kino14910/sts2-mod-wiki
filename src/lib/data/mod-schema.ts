/** Shared ingestion contract: used by artifact validation and runtime loading. */
import { ALL_CARD_KEYWORDS, CARD_TYPES, COLORS, isValidRarityId, type CardAttributes, type CardRarityManifest, type CardType, type CardVariables, type MotifName } from './cards.ts';
import { isCollectionCharacter, isPotionRarity, isRelicRarity, type CollectionCharacter, type CollectionKind, type CollectionRarity, type CollectionVariables } from './collections.ts';
import { isModDependency, type ModDependency } from './mod-dependency.ts';
import type { StackType, TurnBehavior } from './glossary.ts';

/** 角色资源：颜色 id -> 图片路径 */
export interface CharacterAssets {
	/** 卡池筛选和卡牌归属的展示名称，按游戏 locale（eng / zhs 等）映射。 */
	labels?: Record<string, string>;
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
	/** 卡框图片：卡牌类型 -> 图片路径（已按 /mods/{id}/... 解析）。空对象 {} 表示不使用任何卡框 */
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
	characters?: string;
	/** 颜色 id -> 角色资源 */
	cardPool?: Record<string, CharacterAssets>;
	/** 自定义卡牌稀有度 id -> 展示元数据；未声明但出现在 cards 中的值也会自动注册 */
	cardRarities?: Record<string, CardRarityManifest>;
}

export interface LocalizedModText {
	name?: string;
	blurb?: string;
}

export interface ModCharacterData {
	id: string;
	startingHp: number;
	startingGold: number;
	maxEnergy?: number;
	startingDeck: string[];
	startingRelics: string[];
	startingPotions: string[];
	localizationId?: string;
}

export function isModCharacterData(value: unknown): value is ModCharacterData {
	return isRecord(value) && isString(value.id) && !!value.id &&
		Number.isFinite(value.startingHp) && Number.isFinite(value.startingGold) &&
		(value.maxEnergy === undefined || Number.isFinite(value.maxEnergy)) &&
		['startingDeck', 'startingRelics', 'startingPotions'].every((key) => Array.isArray(value[key]) && value[key].every(isString));
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
export type CardData = CardAttributes & {
	id: string;
	color?: string;
	pool?: string | string[];
	type: CardType;
	rarity: string;
	image?: string;
	fullArt?: boolean;
	upgrade?: Partial<CardAttributes>;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isString(value: unknown): value is string {
	return typeof value === 'string';
}

function isCharacterAssets(value: unknown): value is CharacterAssets {
	if (!isRecord(value)) return false;
	return (
		isString(value.char) &&
		(value.labels === undefined ||
			(isRecord(value.labels) && Object.values(value.labels).every(isString))) &&
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

function isCardRarityManifest(value: unknown): value is CardRarityManifest {
	if (!isRecord(value)) return false;
	const optionalText = (entry: unknown) => entry === undefined || isString(entry);
	return (
		optionalText(value.name) &&
		optionalText(value.nameZh) &&
		optionalText(value.labelKey) &&
		optionalText(value.color) &&
		optionalText(value.banner) &&
		optionalText(value.outline) &&
		optionalText(value.base) &&
		(value.fullArt === undefined || typeof value.fullArt === 'boolean')
	);
}

export function isManifest(value: unknown): value is ModManifest {
	if (!isRecord(value)) return false;

	const declaresContent =
		value.cards !== undefined ||
		value.powers !== undefined ||
		value.relics !== undefined ||
		value.potions !== undefined ||
		value.characters !== undefined;

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
		(value.characters === undefined || isString(value.characters)) &&
		(value.cardPool === undefined ||
			(isRecord(value.cardPool) && Object.values(value.cardPool).every(isCharacterAssets))) &&
		(value.cardRarities === undefined ||
			(isRecord(value.cardRarities) &&
				Object.values(value.cardRarities).every(isCardRarityManifest)))
	);
}

function isVariables(value: unknown): value is CardVariables {
	return (
		isRecord(value) &&
		Object.values(value).every((entry) => typeof entry === 'string' || (typeof entry === 'number' && Number.isFinite(entry)))
	);
}

const isCardCost = (value: unknown) =>
	(typeof value === 'number' && Number.isFinite(value)) || value === 'X' || value === null;
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

export function poolTokens(value: unknown): string[] | undefined {
	if (!isRecord(value)) return undefined;
	const p = value.pool;
	if (p === undefined) return undefined;
	if (isString(p)) return [p];
	if (Array.isArray(p) && p.every(isString)) return p as string[];
	return undefined;
}

export function isCardData(value: unknown): value is CardData {
	if (!isRecord(value)) return false;
	const { type, rarity, image, fullArt, upgrade } = value;
	const hasPool = poolTokens(value) !== undefined;
	const hasColor = isString(value.color) && value.color in COLORS;
	return (
		isString(value.id) &&
		value.id.trim().length > 0 &&
		(hasPool || hasColor) &&
		isString(type) &&
		type in CARD_TYPES &&
		isValidRarityId(rarity) &&
		(image === undefined || isString(image)) &&
		(fullArt === undefined || typeof fullArt === 'boolean') &&
		Object.entries(CARD_ATTRIBUTE_VALIDATORS).every(([key, validate]) => validate(value[key])) &&
		(upgrade === undefined || isCardUpgrade(upgrade))
	);
}

export function isModPowerData(value: unknown): value is ModPowerData {
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
export interface CollectionData {
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

export function isCollectionData(value: unknown, kind: CollectionKind): value is CollectionData {
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

