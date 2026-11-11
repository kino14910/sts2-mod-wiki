// 移植自 static/tools/preview-assets/preview-tools.js 的 bbcodeToHtml：
// 把 STS2 卡牌描述里的 BBCode 转成 HTML，供卡牌缩略图渲染。
// 与工具页一致地支持命名颜色、color / font / font_size、b / i / u、[br]，
// 另外补上游戏在描述外层使用的 [center] / [left] / [right]。

const NAMED_COLORS: Record<string, string> = {
	gold: '#EFC851',
	red: '#FF5555',
	green: '#7FFF00',
	blue: '#87CEEB',
	purple: '#EE82EE',
	orange: '#FFA518',
	pink: '#FF78A0',
	aqua: '#2AEBBE'
};

// MegaRichTextLabel 的逐字特效标签：卡面里不播放动画，仅剥掉标签保留文字。
const EFFECT_TAGS = new Set(['jitter', 'sine', 'fade_in', 'fly_in', 'thinky_dots', 'rainbow']);

const ALIGN_TAGS = new Set(['center', 'left', 'right']);

type Token =
	| { type: 'text'; value: string }
	| { type: 'tag'; name: string; close: boolean; arg: string | null };

type Frame = {
	tag: string;
	color?: string;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	font?: string;
	size?: string;
	align?: string;
};

// 游戏卡面宽 300，缩略图容器宽即 100cqw，因此 1px = 1/3cqw。
function sizeToUnit(size: string, unit: 'cqw' | 'px') {
	if (/^\d+(\.\d+)?$/.test(size)) {
		return unit === 'cqw' ? `${Number(size) / 3}cqw` : `${Number(size)}px`;
	}
	return size;
}

function escapeHtml(text: string) {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(text: string) {
	return escapeHtml(String(text)).replace(/"/g, '&quot;');
}

function parseArg(tail: string) {
	const raw = tail.trim();
	return raw.startsWith('=') ? raw.slice(1).trim() : null;
}

const KNOWN_TAGS = new Set([
	'color',
	'font',
	'font_size',
	'b',
	'i',
	'u',
	'br',
	'energy_icons',
	...Object.keys(NAMED_COLORS),
	...ALIGN_TAGS,
	...EFFECT_TAGS
]);

export interface BBCodeOptions {
	/** font_size 数值的单位：卡面缩略图用 cqw（1px = 1/3cqw），正文用 px */
	sizeUnit?: 'cqw' | 'px';
	/** 额外内联标签渲染；返回 HTML 片段，返回 undefined 则按普通文本输出 */
	renderTag?: (name: string, arg: string | null) => string | undefined;
}

// 去掉描述里的 BBCode 标签，只保留纯文本；[br] 转为换行。
export function stripBBCode(src: string): string {
	return src.replace(/\[(\/?)([a-zA-Z_]+)([^\]]*)\]/g, (match: string, close: string, name: string) => {
		const tag = name.toLowerCase();
		if (!KNOWN_TAGS.has(tag)) return match;
		return tag === 'br' && !close ? '\n' : '';
	});
}

export function bbcodeToHtml(src: string, options: BBCodeOptions = {}): string {
	const sizeUnit = options.sizeUnit ?? 'cqw';
	const tokens: Token[] = [];
	const re = /\[(\/?)([a-zA-Z_]+)([^\]]*)\]/g;
	let last = 0;
	let match: RegExpExecArray | null;

	while ((match = re.exec(src)) !== null) {
		if (match.index > last) tokens.push({ type: 'text', value: src.slice(last, match.index) });
		tokens.push({
			type: 'tag',
			name: match[2].toLowerCase(),
			close: match[1] === '/',
			arg: parseArg(match[3])
		});
		last = match.index + match[0].length;
	}
	if (last < src.length) tokens.push({ type: 'text', value: src.slice(last) });

	const stack: Frame[] = [];
	let out = '';

	function activeStyles() {
		let color: string | undefined;
		let bold = false;
		let italic = false;
		let underline = false;
		let font: string | undefined;
		let size: string | undefined;
		let align: string | undefined;
		for (const frame of stack) {
			if (frame.color) color = frame.color;
			if (frame.font) font = frame.font;
			if (frame.size) size = frame.size;
			if (frame.bold) bold = true;
			if (frame.italic) italic = true;
			if (frame.underline) underline = true;
			if (frame.align) align = frame.align;
		}
		return { color, bold, italic, underline, font, size, align };
	}

	function emitText(text: string) {
		if (!text) return;
		const styles = activeStyles();
		const css: string[] = [];
		if (styles.color) css.push(`color:${escapeAttr(styles.color)}`);
		// 中文下的 [i] 在原版会换成宋体系字体，这里沿用同一个回退。
		if (styles.italic && !styles.font) {
			css.push("font-family:var(--font-italic, 'Source Han Serif SC', serif)");
		}
		if (styles.font) css.push(`font-family:'${escapeAttr(styles.font)}'`);
		if (styles.size) css.push(`font-size:${escapeAttr(sizeToUnit(styles.size, sizeUnit))}`);
		if (styles.bold) css.push('font-weight:700');
		if (styles.underline) css.push('text-decoration:underline');
		if (styles.align) css.push(`display:block;text-align:${styles.align}`);
		const attr = css.length ? ` style="${css.join(';')}"` : '';
		out += `<span${attr}>${escapeHtml(text)}</span>`;
	}

	for (const token of tokens) {
		if (token.type === 'text') {
			emitText(token.value);
			continue;
		}
		if (token.close) {
			for (let i = stack.length - 1; i >= 0; i--) {
				if (stack[i].tag === token.name) {
					stack.splice(i, 1);
					break;
				}
			}
			continue;
		}

		const arg = token.arg;
		if (token.name === 'color' && arg) stack.push({ tag: 'color', color: arg });
		else if (token.name === 'font' && arg) stack.push({ tag: 'font', font: arg });
		else if (token.name === 'font_size' && arg) stack.push({ tag: 'font_size', size: arg });
		else if (NAMED_COLORS[token.name]) {
			stack.push({ tag: token.name, color: NAMED_COLORS[token.name] });
		} else if (token.name === 'b') stack.push({ tag: 'b', bold: true });
		else if (token.name === 'i') stack.push({ tag: 'i', italic: true });
		else if (token.name === 'u') stack.push({ tag: 'u', underline: true });
		else if (token.name === 'br') out += '<br>';
		else if (ALIGN_TAGS.has(token.name)) stack.push({ tag: token.name, align: token.name });
		else if (EFFECT_TAGS.has(token.name)) stack.push({ tag: token.name });
		else {
			const custom = options.renderTag?.(token.name, arg);
			if (custom === undefined) emitText(`[${token.name}${arg ? '=' + arg : ''}]`);
			else out += custom;
		}
	}

	return out;
}

export { NAMED_COLORS, EFFECT_TAGS, ALIGN_TAGS, KNOWN_TAGS, sizeToUnit, parseArg }
export type { Token as BBCodeToken }
