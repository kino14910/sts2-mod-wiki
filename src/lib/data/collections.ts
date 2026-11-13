/** 遗物与药水共享的展示类型与筛选元数据 */
import { publicEntityId } from '../entity-identity.ts';

export type CollectionKind = 'relic' | 'potion';

export type RelicRarity =
	| 'starter'
	| 'common'
	| 'uncommon'
	| 'rare'
	| 'ancient'
	| 'shop'
	| 'special'
	| 'event';

export type PotionRarity = 'common' | 'uncommon' | 'rare' | 'special';

export type CollectionRarity = RelicRarity | PotionRarity;

export type CollectionCharacter =
	| 'any'
	| 'ironclad'
	| 'silent'
	| 'regent'
	| 'necrobinder'
	| 'defect'
	| 'fool';

export type CollectionVariables = Record<string, string | number>;

export interface CollectionEntry {
	id: string;
	name: string;
	/** 来源模组；基础游戏为 sts2 */
	mod: string;
	kind: CollectionKind;
	rarity: CollectionRarity;
	character: CollectionCharacter;
	tags: string[];
	/** 已按基础语言替换占位符的描述 */
	text: string;
	image?: string;
	/** 遗物的先古升级版本 */
	upgraded?: boolean;
	/** 先古遗物的来源（Neow、Pael 等） */
	ancient?: string;
	variables?: CollectionVariables;
	/** 中文模板专用变量，例如附魔名称 */
	variablesZh?: CollectionVariables;
}

export function collectionHref(entry: CollectionEntry): string {
	const id = publicEntityId({ type: entry.kind, id: entry.id, modId: entry.mod });
	if (id === null) throw new Error(`Invalid collection identity: ${entry.mod}:${entry.id}`);
	return entry.kind === 'relic' ? `/relic/${encodeURIComponent(id)}` : `/potions#potion-${encodeURIComponent(id).replaceAll('%3A', ':')}`;
}

export interface RarityMeta {
	id: CollectionRarity;
	name: string;
	color: string;
}

export const RELIC_RARITIES: RelicRarity[] = [
	'starter',
	'common',
	'uncommon',
	'rare',
	'shop',
	'event',
	'ancient',
	'special'
];

export const POTION_RARITIES: PotionRarity[] = ['common', 'uncommon', 'rare', 'special'];

export const RARITY_META: Record<CollectionRarity, RarityMeta> = {
	starter: { id: 'starter', name: 'Starter', color: '#9aa6a4' },
	common: { id: 'common', name: 'Common', color: '#b7c3c0' },
	uncommon: { id: 'uncommon', name: 'Uncommon', color: '#75b2c4' },
	rare: { id: 'rare', name: 'Rare', color: '#e3c06f' },
	ancient: { id: 'ancient', name: 'Ancient', color: '#b98bd9' },
	shop: { id: 'shop', name: 'Shop', color: '#d4a56e' },
	event: { id: 'event', name: 'Event', color: '#8fc78d' },
	special: { id: 'special', name: 'Special', color: '#d97a9c' }
};

export const COLLECTION_CHARACTERS: CollectionCharacter[] = [
	'ironclad',
	'silent',
	'regent',
	'necrobinder',
	'defect',
	'fool',
	'any'
];

export function isCollectionCharacter(value: string): value is CollectionCharacter {
	return (COLLECTION_CHARACTERS as string[]).includes(value);
}

export function isRelicRarity(value: string): value is RelicRarity {
	return (RELIC_RARITIES as string[]).includes(value);
}

export function isPotionRarity(value: string): value is PotionRarity {
	return (POTION_RARITIES as string[]).includes(value);
}

/** 先古遗物来源的中文名 */
export const ANCIENTS_ZH: Record<string, string> = {
	Neow: '涅奥',
	Orobas: '欧洛巴斯',
	Pael: '佩尔',
	Tezcatara: '特兹卡塔拉',
	Tanx: '坦克斯',
	Vakuu: '瓦库',
	Nonupeipe: '诺努佩佩',
	Darv: '达夫'
};
