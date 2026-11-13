import { publicEntityId } from '../entity-identity.ts';

export type ColorId = 'ironclad' | 'silent' | 'regent' | 'necrobinder' | 'defect' | 'fool' | 'colorless';
export type CardType = 'attack' | 'skill' | 'power' | 'status' | 'curse' | 'quest';
export type Rarity =
	| 'basic'
	| 'common'
	| 'uncommon'
	| 'rare'
	| 'ancient'
	| 'event'
	| 'token'
	| 'curse'
	| 'status'
	| 'quest';
/** 对应游戏 CardKeyword；顺序决定卡面上的换行位置 */
export type CardKeyword =
	| 'Ethereal'
	| 'Sly'
	| 'Retain'
	| 'Innate'
	| 'Unplayable'
	| 'Exhaust'
	| 'Eternal';
export const CARD_KEYWORDS_BEFORE: CardKeyword[] = [
	'Ethereal',
	'Sly',
	'Retain',
	'Innate',
	'Unplayable'
];
export const CARD_KEYWORDS_AFTER: CardKeyword[] = ['Exhaust', 'Eternal'];
export const ALL_CARD_KEYWORDS: CardKeyword[] = [...CARD_KEYWORDS_BEFORE, ...CARD_KEYWORDS_AFTER];
export type MotifName =
	| 'blade'
	| 'flame'
	| 'crown'
	| 'star'
	| 'moon'
	| 'skull'
	| 'web'
	| 'orb'
	| 'shard'
	| 'gear'
	| 'eye'
	| 'spiral'
	| 'thorn'
	| 'feather'
	| 'shield';

/** 卡牌描述里 {Name} 占位符的取值 */
export type CardVariables = Record<string, string | number>;

/** 升级时可能发生变化的属性；新增可升级属性只需扩展此类型 */
export interface CardAttributes {
	cost: number | 'X' | null;
	secondEnergy?: number | 'X' | null;
	variables?: CardVariables;
	keywords: CardKeyword[];
}

export interface Card extends CardAttributes {
	id: string;
	name: string;
	mod: string;
	/** 卡池：原始 pool 标签，如 ['fgo', 'silent']，是卡牌归属的权威多值字段 */
	pool: string[];
	/** 展示用颜色：从 pool 派生的单一角色色，仅用于渲染与按角色筛选；可来自模组自定义色（如 'fgo'） */
	color: string;
	type: CardType;
	/** 内置 rarity 或 mod 定义/注入的自定义值（如 NoblePhantasm） */
	rarity: string;
	text: string;
	/** 只声明升级后发生变化的属性；空对象表示仅有文本分支变化 */
	upgrade?: Partial<CardAttributes>;
	image?: string;
	thumb?: string;
	/** 卡图为整张卡面的全框插画（原版 ancient 卡），渲染时铺满卡面而非小画窗 */
	fullArt?: boolean;
	featured?: boolean;
}

/** 已计算最终属性的卡牌；baseVariables 供 {X:diff()} 判断是否需要标绿 */
export interface CardView extends Card {
	baseVariables?: CardVariables;
}

export const COLORS: Record<ColorId, { name: string; short: string; accent: string; motif: MotifName }> = {
	ironclad: { name: 'Ironclad', short: 'IC', accent: '#c65a42', motif: 'flame' },
	silent: { name: 'Silent', short: 'SL', accent: '#55a47c', motif: 'feather' },
	regent: { name: 'Regent', short: 'RG', accent: '#d5aa5b', motif: 'crown' },
	necrobinder: { name: 'Necrobinder', short: 'NB', accent: '#9a73c9', motif: 'skull' },
	defect: { name: 'Defect', short: 'DF', accent: '#5aa9c9', motif: 'orb' },
	fool: { name: 'Fool', short: 'FO', accent: '#d62000', motif: 'moon' },
	colorless: { name: 'Colorless', short: 'CL', accent: '#a6a199', motif: 'star' }
};

/** 安全取色：模组自定义色（如 'fgo'）回退到 colorless，避免 COLORS[id] 越界 */
export function colorInfo(id: string) {
	return (COLORS as Record<string, (typeof COLORS)[ColorId]>)[id] ?? COLORS.colorless;
}

export const CARD_TYPES: Record<CardType, { name: string; plural: string }> = {
	attack: { name: 'Attack', plural: 'Attacks' },
	skill: { name: 'Skill', plural: 'Skills' },
	power: { name: 'Power', plural: 'Powers' },
	status: { name: 'Status', plural: 'Statuses' },
	curse: { name: 'Curse', plural: 'Curses' },
	quest: { name: 'Quest', plural: 'Quests' }
};

export const RARITIES: Record<Rarity, { name: string; color: string }> = {
	basic: { name: 'Basic', color: '#9aa6a4' },
	common: { name: 'Common', color: '#b7c3c0' },
	uncommon: { name: 'Uncommon', color: '#75b2c4' },
	rare: { name: 'Rare', color: '#e3c06f' },
	ancient: { name: 'Ancient', color: '#b98bd9' },
	event: { name: 'Event', color: '#8fc78d' },
	token: { name: 'Token', color: '#d4a56e' },
	curse: { name: 'Curse', color: '#a05cb0' },
	status: { name: 'Status', color: '#8f9aa0' },
	quest: { name: 'Quest', color: '#c9a227' }
};

/** mod 清单中可声明的自定义稀有度元数据，全部字段可选 */
export interface CardRarityManifest {
	name?: string
	nameZh?: string
	labelKey?: string
	color?: string
	banner?: string
	outline?: string
	fullArt?: boolean
	/** 继承的内置稀有度：提供默认卡面资源与排序位置，并让该内置筛选项也匹配此自定义值 */
	base?: string
}

export interface CardRarityDefinition extends CardRarityManifest {
	labels?: Record<string, string>
}

export interface RarityInfo {
	id: string
	name: string
	labels: Record<string, string>
	color: string
	banner: string
	outline: string
	fullArt: boolean
	rank: number
	base?: Rarity
}

const BASE_RARITY_ORDER = Object.keys(RARITIES) as Rarity[]

const BANNER_RARITY: Record<Rarity, string> = {
	basic: 'common',
	common: 'common',
	uncommon: 'uncommon',
	rare: 'rare',
	ancient: 'ancient',
	event: 'event',
	token: 'common',
	curse: 'curse',
	status: 'status',
	quest: 'quest'
}

const RARITY_OUTLINE: Record<Rarity, string> = {
	basic: '#4d4b40',
	common: '#4d4b40',
	token: '#4d4b40',
	ancient: '#4d4b40',
	uncommon: '#005c75',
	rare: '#6b4b00',
	event: '#1b6131',
	curse: '#550b9e',
	status: '#4f522f',
	quest: '#7e3e15'
}

export function isValidRarityId(value: unknown): value is string {
	return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(value)
}

export function isBuiltinRarity(id: string): id is Rarity {
	return Object.prototype.hasOwnProperty.call(RARITIES, id)
}

function rarityDisplayName(id: string) {
	return id.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim() || id
}

function builtinRarityInfo(id: Rarity): RarityInfo {
	return {
		id,
		name: RARITIES[id].name,
		labels: {},
		color: RARITIES[id].color,
		banner: BANNER_RARITY[id],
		outline: RARITY_OUTLINE[id],
		fullArt: id === 'ancient',
		rank: BASE_RARITY_ORDER.indexOf(id)
	}
}

const customRarities = new Map<string, RarityInfo>()
let customRarityOrder = 0

function unknownRarityInfo(id: string): RarityInfo {
	return {
		id,
		name: rarityDisplayName(id),
		labels: {},
		color: RARITIES.rare.color,
		banner: BANNER_RARITY.rare,
		outline: RARITY_OUTLINE.common,
		fullArt: false,
		rank: BASE_RARITY_ORDER.length + customRarityOrder
	}
}

/** 由加载层注入 mod 声明与自动发现的自定义稀有度；内置 id 不可覆盖 */
export function registerCardRarities(definitions: Record<string, CardRarityDefinition>) {
	for (const [id, def] of Object.entries(definitions)) {
		if (!isValidRarityId(id) || isBuiltinRarity(id)) continue
		if (customRarities.has(id)) {
			console.warn(`[mods] 重复的自定义稀有度定义，已忽略：${id}`)
			continue
		}

		const base = def.base && isBuiltinRarity(def.base) ? def.base : undefined
		const inherited = base ? builtinRarityInfo(base) : undefined
		const info = unknownRarityInfo(id)
		const order = BASE_RARITY_ORDER.length + customRarityOrder++

		customRarities.set(id, {
			...info,
			name: def.name ?? info.name,
			labels: { ...(def.nameZh ? { zhs: def.nameZh } : {}), ...def.labels },
			color: def.color ?? inherited?.color ?? info.color,
			banner: def.banner ?? inherited?.banner ?? info.banner,
			outline: def.outline ?? inherited?.outline ?? info.outline,
			fullArt: def.fullArt ?? inherited?.fullArt ?? false,
			base,
			rank: base ? BASE_RARITY_ORDER.indexOf(base) + 0.5 : order
		})
	}
}

export function rarityInfo(id: string): RarityInfo {
	if (isBuiltinRarity(id)) return builtinRarityInfo(id)
	return customRarities.get(id) ?? unknownRarityInfo(id)
}

export function rarityIds(): string[] {
	return [...BASE_RARITY_ORDER, ...customRarities.keys()]
}

export function rarityRank(id: string): number {
	return rarityInfo(id).rank
}

export function rarityMatches(filter: string, cardRarity: string): boolean {
	return filter === 'all' || filter === cardRarity || customRarities.get(cardRarity)?.base === filter
}

export function cardHref(card: Card) {
	const id = publicEntityId({ type: 'card', id: card.id, modId: card.mod });
	if (id === null) throw new Error(`Invalid card identity: ${card.mod}:${card.id}`);
	return `/cards/${encodeURIComponent(id)}`;
}

export function isUpgradable(card: Card) {
	return card.upgrade !== undefined;
}

/** 普通字段覆盖、variables 浅合并、keywords 完整替换，运行时唯一计算升级结果 */
export function resolveCard(card: Card, upgraded: boolean): CardView {
	const baseVariables = card.variables ?? {};
	if (!upgraded) return { ...card, baseVariables };

	const patch = card.upgrade ?? {};
	return {
		...card,
		...patch,
		name: `${card.name}+`,
		...(patch.variables && {
			variables: { ...card.variables, ...patch.variables }
		}),
		baseVariables
	};
}
