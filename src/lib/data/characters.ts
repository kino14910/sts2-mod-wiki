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
