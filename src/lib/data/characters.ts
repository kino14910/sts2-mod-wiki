import { type ColorId } from './cards';
import { CHARACTER_ICONS, COLORLESS_ICON } from './mods';
import { colorName, collectionCharacterName } from './localize';
import type { CollectionCharacter } from './collections';

export interface CharacterFilterOption {
	id: string;
	name: string;
	image?: string;
}

const CHARACTER_ORDER: ColorId[] = ['ironclad', 'silent', 'regent', 'necrobinder', 'defect'];

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
		...mainOptions((id) => colorName(id as ColorId))
	];
}

export function collectionCharacterOptions(): CharacterFilterOption[] {
	return [
		{ id: 'any', name: collectionCharacterName('any') },
		...mainOptions((id) => collectionCharacterName(id as CollectionCharacter))
	];
}
