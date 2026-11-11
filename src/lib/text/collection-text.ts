import type { CollectionVariables } from '#lib/data/collections';
import { bbcodeToHtml, stripBBCode } from './bbcode';
import {
	ENERGY_ICON,
	NECRO_ENERGY_ICON,
	STAR_ICON
} from '#lib/data/icon-assets';

function isTruthy(value: string | number | undefined) {
	return value !== undefined && value !== '' && value !== 0 && value !== '0' && value !== 'false';
}

/**
 * 解析遗物 / 药水描述中的游戏文本占位符。
 * 与卡牌文本不同，遗物模板还包含 plural、条件、图标与先古专属变量。
 */
export function resolveCollectionText(src: string, variables: CollectionVariables = {}): string {
	let out = '';
	let index = 0;

	while (index < src.length) {
		if (src[index] !== '{') {
			out += src[index];
			index += 1;
			continue;
		}

		let depth = 0;
		let end = index;
		for (; end < src.length; end += 1) {
			if (src[end] === '{') depth += 1;
			else if (src[end] === '}') {
				depth -= 1;
				if (depth === 0) break;
			}
		}

		if (end >= src.length) {
			out += src.slice(index);
			break;
		}

		const inner = src.slice(index + 1, end);
		const colon = inner.indexOf(':');
		const name = colon >= 0 ? inner.slice(0, colon) : inner;
		const args = colon >= 0 ? inner.slice(colon + 1) : undefined;
		const value = variables[name] ?? variables[name.split('.')[0]];

		out += expand(name, args, value === undefined ? '' : String(value), variables);
		index = end + 1;
	}

	return out;
}

function expand(
	name: string,
	args: string | undefined,
	value: string,
	variables: CollectionVariables
): string {
	if (name === '') return value;
	if (name === 'singleStarIcon') return '[star]';
	if (name === 'energyPrefix') return '[energy]';
	if (args === undefined) return value;

	if (args.startsWith('plural:')) {
		const parts = args.slice(7).split('|');
		const chosen = Number(value) === 1 ? parts[0] : (parts[1] ?? parts[0]);
		return resolveNested(chosen, variables, value);
	}

	// {Var:energyIcons()} / {Var:energyIcons(1)}
	const energy = args.match(/^energyIcons(?:\((\w*)\))?$/);
	if (energy) {
		const count = Number(value || energy[1] || 1) || 1;
		return '[energy]'.repeat(count);
	}

	if (args.startsWith('starIcons')) {
		const count = Number(value || 1) || 1;
		return '[star]'.repeat(count);
	}

	if (args === 'percentMore()') {
		return value.includes('%') ? value : `${value}%`;
	}

	if (args === 'diff()') return value;

	if (args.includes('|')) {
		const condition = args.startsWith('show:') ? args.slice(5) : args;
		const [yes, no = ''] = condition.split('|');
		return resolveNested(isTruthy(value) ? yes : no, variables, value);
	}

	return value;
}

function resolveNested(text: string, variables: CollectionVariables, context: string): string {
	return resolveCollectionText(
		text.replaceAll('{}', context),
		variables
	);
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
		renderTag: (name) => {
			if (name === 'energy') {
				return `<img class="sts-collection-icon" src="${energyIcon}" alt="" aria-hidden="true" />`;
			}
			if (name === 'star') {
				return `<img class="sts-collection-icon" src="${starIcon}" alt="" aria-hidden="true" />`;
			}
			return undefined;
		}
	});
}

export function collectionTextToPlain(text: string) {
	return stripBBCode(text.replace(/\[(energy|star)\]/g, ''));
}

export { ENERGY_ICON, NECRO_ENERGY_ICON, STAR_ICON };
