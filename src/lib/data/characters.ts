import { COLORS, type ColorId } from './cards';
import { CHARACTER_ICONS, COLORLESS_ICON } from './mods';
import { colorName, collectionCharacterName } from './localize';
import type { CollectionCharacter } from './collections';

export interface CharacterFilterOption {
	id: string;
	name: string;
	image?: string;
}

const BASE_COLORS: string[] = (Object.keys(COLORS) as ColorId[]).filter((id) => id !== 'colorless');

// 基色固定在前，其余模组自定义色（如 fgo、noble）按注册顺序追加；colorless 由筛选器显式前置，此处排除
const CHARACTER_ORDER: string[] = [
	...BASE_COLORS,
	...Object.keys(CHARACTER_ICONS).filter(
		(id) => id !== 'colorless' && !BASE_COLORS.includes(id)
	)
];

// 展示层：colorless 固定最前，其余保持传入顺序（即按钮顺序），与数据排序逻辑互不干扰
export function displayCharacterOrder<T extends { id: string }>(options: T[]): T[] {
	const colorless = options.filter((o) => o.id === 'colorless');
	const rest = options.filter((o) => o.id !== 'colorless');
	return [...colorless, ...rest];
}

// 数据排序层：默认排序 colorless 置最后，其余严格按按钮顺序（CHARACTER_ORDER）排列
export function characterSortRank(id: string): number {
	if (id === 'colorless') return Number.MAX_SAFE_INTEGER;
	const index = CHARACTER_ORDER.indexOf(id);
	return index === -1 ? Number.MAX_SAFE_INTEGER - 1 : index;
}

function mainOptions(nameOf: (id: string) => string): CharacterFilterOption[] {
	return CHARACTER_ORDER.filter((id) => id in CHARACTER_ICONS).map((id) => ({
		id,
		name: nameOf(id),
		image: CHARACTER_ICONS[id]
	}));
}

export function cardCharacterOptions(): CharacterFilterOption[] {
	return [
		{ id: 'colorless', name: colorName('colorless'), image: COLORLESS_ICON },
		...mainOptions((id) => colorName(id))
	];
}

export function collectionCharacterOptions(): CharacterFilterOption[] {
	return [
		{ id: 'any', name: collectionCharacterName('any') },
		...mainOptions((id) => collectionCharacterName(id as CollectionCharacter))
	];
}
