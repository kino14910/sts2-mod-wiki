export type ColorId = 'ironclad' | 'silent' | 'regent' | 'necrobinder' | 'defect' | 'colorless';
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
	/** 展示用颜色：从 pool 派生的单一角色色，仅用于渲染与按角色筛选 */
	color: ColorId;
	type: CardType;
	rarity: Rarity;
	text: string;
	/** 只声明升级后发生变化的属性；空对象表示仅有文本分支变化 */
	upgrade?: Partial<CardAttributes>;
	image?: string;
	thumb?: string;
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
	colorless: { name: 'Colorless', short: 'CL', accent: '#a6a199', motif: 'star' }
};

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

export function cardHref(card: Card) {
	return `/cards/${card.id}`;
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
