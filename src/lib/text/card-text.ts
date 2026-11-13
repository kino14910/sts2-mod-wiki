import type { CardVariables } from '#lib/data/cards';
import { bbcodeToHtml, stripBBCode } from './bbcode';
import { ENERGY_ICON_SRC, STAR_ICON_SRC } from '#lib/data/icon-assets';
import { resolveGameTemplate, type TemplateOptions } from './game-template';

export { ENERGY_ICON_SRC, STAR_ICON_SRC };

export interface CardTextOptions extends Pick<TemplateOptions, 'locale' | 'upgradeDisplay' | 'onDiagnostic'> {
	upgraded?: boolean;
	/** 最终变量，升级态已合并完成 */
	variables?: CardVariables;
	/** 基础变量，仅用于 diff() 判断是否标绿 */
	baseVariables?: CardVariables;
	/** font_size 单位：卡面缩略图用 cqw，正文用 px */
	sizeUnit?: 'cqw' | 'px';
	energyIconSrc?: string;
	secondEnergyIconSrc?: string;
	/** 战斗内才显示的动态数值提示，默认按非战斗（InCombat:false）渲染 */
	inCombat?: boolean;
}

/** Shared SmartFormat evaluation; BBCode and assets are rendered in later stages. */
export function resolveCardTextToBBCode(text: string, options: CardTextOptions = {}): string {
	return resolveGameTemplate(text, options)
}

export function cardTextToHtml(text: string, options: CardTextOptions = {}) {
	const src = resolveCardTextToBBCode(text, options);
	const iconSrc = options.energyIconSrc ?? ENERGY_ICON_SRC;
	const starSrc = options.secondEnergyIconSrc ?? STAR_ICON_SRC;

	return bbcodeToHtml(src, {
		sizeUnit: options.sizeUnit ?? 'px',
		renderTag: (name, arg) => {
			if (name === 'energy_icons') {
				const icon = `<img class="sts-energy-icon" src="${iconSrc}" alt="" aria-hidden="true" />`;
				return `<span class="sts-energy-icons">${icon.repeat(Number(arg) || 0)}</span>`;
			}
			if (name === 'star_icons') {
				const icon = `<img class="sts-energy-icon" src="${starSrc}" alt="" aria-hidden="true" />`;
				return `<span class="sts-energy-icons">${icon.repeat(Number(arg) || 0)}</span>`;
			}
			return undefined;
		}
	});
}

export function cardTextToPlain(text: string, options: CardTextOptions = {}) {
	return stripBBCode(resolveGameTemplate(text, {
		...options,
		renderIcons: (_kind, count) => String(count)
	}))
}
