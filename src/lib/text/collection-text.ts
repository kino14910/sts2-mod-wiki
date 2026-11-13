import type { CollectionVariables } from '#lib/data/collections';
import { bbcodeToHtml, stripBBCode } from './bbcode';
import { resolveGameTemplate, type TemplateOptions } from './game-template';
import {
	ENERGY_ICON,
	NECRO_ENERGY_ICON,
	STAR_ICON
} from '#lib/data/icon-assets';

/** Relics and potions use the same SmartFormat semantics as cards. */
export function resolveCollectionText(
	src: string,
	variables: CollectionVariables = {},
	options: Omit<TemplateOptions, 'variables'> = {}
): string {
	return resolveGameTemplate(src, { ...options, variables })
}

export interface CollectionTextOptions {
	/** 能量图标；默认无色能量 */
	energyIcon?: string;
	starIcon?: string;
}

export function collectionTextToHtml(text: string, options: CollectionTextOptions = {}) {
	const energyIcon = options.energyIcon ?? ENERGY_ICON;
	const starIcon = options.starIcon ?? STAR_ICON;

	return bbcodeToHtml(text, {
		sizeUnit: 'px',
		renderTag: (name, arg) => {
			if (name === 'energy' || name === 'energy_icons') {
				return `<img class="sts-collection-icon" src="${energyIcon}" alt="" aria-hidden="true" />`.repeat(name === 'energy' ? 1 : Math.max(0, Math.min(4, Number(arg) || 0)));
			}
			if (name === 'star' || name === 'star_icons') {
				return `<img class="sts-collection-icon" src="${starIcon}" alt="" aria-hidden="true" />`.repeat(name === 'star' ? 1 : Math.max(0, Math.min(4, Number(arg) || 0)));
			}
			return undefined;
		}
	});
}

export function collectionTextToPlain(text: string) {
	return stripBBCode(text.replace(/\[(energy|star)(?:_icons(?:=\d+)?)?\]/g, ''));
}

export { ENERGY_ICON, NECRO_ENERGY_ICON, STAR_ICON };
