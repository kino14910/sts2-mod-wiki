import type { CardVariables } from '#lib/data/cards';
import { bbcodeToHtml, stripBBCode } from './bbcode';
import { ENERGY_ICON_SRC, STAR_ICON_SRC } from '#lib/data/icon-assets';

export { ENERGY_ICON_SRC, STAR_ICON_SRC };

export interface CardTextOptions {
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

interface IconRenderers {
	energy: (count: number) => string;
	star: (count: number) => string;
}

interface ResolveState {
	upgraded: boolean;
	inCombat: boolean;
	baseVars: CardVariables;
	activeVars: CardVariables;
	renderers: IconRenderers;
}

interface Current {
	name: string;
	text: string;
}

const CONTEXT_VARS = new Set(['InCombat', 'IsTargeting', 'OnTable']);
const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function isTruthy(value: string | number | undefined) {
	return value === 1 || value === '1' || value === 'true' || Number(value) > 0;
}

function matchingBrace(src: string, start: number) {
	let depth = 0;
	for (let i = start; i < src.length; i++) {
		if (src[i] === '{') depth++;
		else if (src[i] === '}' && --depth === 0) return i;
	}
	return -1;
}

// 条件分支里会嵌套 {Var:...}、plural 的 {} 或 choose(...) 的 |，必须按深度切分。
function splitTop(text: string, separator: string) {
	const parts: string[] = [];
	let braces = 0;
	let parens = 0;
	let start = 0;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (ch === '{') braces++;
		else if (ch === '}') braces--;
		else if (ch === '(') parens++;
		else if (ch === ')') parens--;
		else if (ch === separator && braces === 0 && parens === 0) {
			parts.push(text.slice(start, i));
			start = i + 1;
		}
	}
	parts.push(text.slice(start));
	return parts;
}

function topLevelColon(text: string) {
	let braces = 0;
	let parens = 0;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (ch === '{') braces++;
		else if (ch === '}') braces--;
		else if (ch === '(') parens++;
		else if (ch === ')') parens--;
		else if (ch === ':' && braces === 0 && parens === 0) return i;
	}
	return -1;
}

function rawValue(vars: CardVariables, name: string) {
	const value = vars[name];
	if (value !== undefined) return String(value);
	// 计算型变量在图书馆里没有战斗上下文，等价于 CalculationBase + Extra * 0。
	if (name.startsWith('Calculated')) {
		const base = vars.CalculationBase;
		if (base !== undefined) return String(base);
	}
	return '';
}

function highlight(name: string, text: string, state: ResolveState) {
	if (!state.upgraded) return text;
	return rawValue(state.baseVars, name) !== rawValue(state.activeVars, name)
		? `[green]${text}[/green]`
		: text;
}

function branch(
	picked: string,
	state: ResolveState,
	current: Current,
	name: string,
	truthy: boolean
) {
	const rendered = resolveTokens(picked, state, current);
	return name === 'IfUpgraded' && truthy ? `[green]${rendered}[/green]` : rendered;
}

function resolveTokens(src: string, state: ResolveState, current?: Current): string {
	let out = '';
	let cursor = 0;
	while (true) {
		const start = src.indexOf('{', cursor);
		if (start < 0) break;
		const end = matchingBrace(src, start);
		if (end < 0) break;
		out += src.slice(cursor, start);
		out += resolveToken(src.slice(start + 1, end), state, current);
		cursor = end + 1;
	}
	return out + src.slice(cursor);
}

function resolveToken(inner: string, state: ResolveState, current?: Current): string {
	const colon = topLevelColon(inner);
	const name = colon < 0 ? inner : inner.slice(0, colon);
	const args = colon < 0 ? undefined : inner.slice(colon + 1);
	const named = NAME_RE.test(name);
	const value = named ? state.activeVars[name] : undefined;
	const text = named ? rawValue(state.activeVars, name) : current?.text ?? '';
	const ref: Current = { name: named ? name : current?.name ?? '', text };

	if (args === undefined) {
		if (named && name === 'singleStarIcon') return state.renderers.star(1);
		return text;
	}

	if (CONTEXT_VARS.has(name)) {
		const formats = splitTop(args, '|');
		return resolveTokens(
			name === 'InCombat' && state.inCombat ? formats[0] : formats[1] ?? '',
			state,
			ref
		);
	}

	if (args === 'diff()' || args === 'inverseDiff()') return highlight(ref.name, text, state);
	if (args === 'abs()') return String(Math.abs(Number(text) || 0));

	const energy = /^energyIcons(?:\((\w*)\))?$/.exec(args);
	if (energy) return state.renderers.energy(Number(energy[1] ?? '') || Number(text) || 0);
	const star = /^starIcons(?:\((\w*)\))?$/.exec(args);
	if (star) return state.renderers.star(Number(star[1] ?? '') || Number(text) || 0);

	if (args === 'percentMore()' || args === 'percentLess()') {
		const n = Number(text) || 0;
		return String(Math.round((args === 'percentMore()' ? n - 1 : 1 - n) * 100));
	}

	if (args.startsWith('show:')) {
		const formats = splitTop(args.slice(5), '|');
		const truthy = name === 'IfUpgraded' ? state.upgraded : isTruthy(value);
		return branch(truthy ? formats[0] : formats[1] ?? '', state, ref, name, truthy);
	}

	const choose = /^choose\(([^)]*)\):([\s\S]*)$/.exec(args);
	if (choose) {
		const options = choose[1].split('|');
		const formats = splitTop(choose[2], '|');
		const index = options.findIndex((option) => option === text);
		const picked =
			index >= 0
				? formats[index] ?? ''
				: formats.length > options.length
					? formats[formats.length - 1]
					: '';
		return resolveTokens(picked, state, ref);
	}

	if (args.startsWith('cond:')) {
		const rest = args.slice(5);
		const q = rest.indexOf('?');
		const formats = splitTop(q < 0 ? rest : rest.slice(q + 1), '|');
		const expr = /^(>=|<=|==|!=|>|<|=)?\s*(-?\d+(?:\.\d+)?)$/.exec(
			(q < 0 ? '' : rest.slice(0, q)).trim()
		);
		const n = Number(text) || 0;
		let truthy = false;
		if (expr) {
			const target = Number(expr[2]);
			switch (expr[1] ?? '==') {
				case '>':
					truthy = n > target;
					break;
				case '<':
					truthy = n < target;
					break;
				case '>=':
					truthy = n >= target;
					break;
				case '<=':
					truthy = n <= target;
					break;
				case '!=':
					truthy = n !== target;
					break;
				default:
					truthy = n === target;
			}
		}
		return resolveTokens(truthy ? formats[0] : formats[1] ?? '', state, ref);
	}

	const plural = /^plural(?:\([^)]*\))?:([\s\S]*)$/.exec(args);
	if (plural) {
		const formats = splitTop(plural[1], '|');
		const picked = Number(text) === 1 ? formats[0] : formats[1] ?? '';
		return resolveTokens(picked, state, ref);
	}

	const formats = splitTop(args, '|');
	if (formats.length > 1) {
		const truthy = name === 'IfUpgraded' ? state.upgraded : isTruthy(value);
		return branch(truthy ? formats[0] : formats[1], state, ref, name, truthy);
	}

	return text;
}

function resolveCardText(
	src: string,
	options: CardTextOptions,
	renderers: IconRenderers
) {
	const upgraded = options.upgraded ?? false;
	const activeVars = options.variables ?? {};

	return resolveTokens(src, {
		upgraded,
		inCombat: options.inCombat ?? false,
		baseVars: options.baseVariables ?? activeVars,
		activeVars,
		renderers
	});
}

/** 变量层求值，输出仍是 BBCode 文本，供统一 AST 解析器继续解析 */
export function resolveCardTextToBBCode(text: string, options: CardTextOptions = {}): string {
	return resolveCardText(text, options, {
		energy: (count) => `[energy_icons=${Math.max(0, count)}]`,
		star: (count) => `[star_icons=${Math.max(0, count)}]`
	})
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
	return stripBBCode(
		resolveCardText(text, options, {
			energy: (count) => String(count),
			star: (count) => String(count)
		})
	);
}
