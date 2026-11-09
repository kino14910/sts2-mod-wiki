import { describe, expect, it } from 'vitest';
import { frameTintMatrix, frameTintFilterId } from './frame-tint';
import { CHARACTER_ASSETS } from './data/mods';

/** 把 feColorMatrix 的 20 个值施加到一个 RGB 像素并做 [0,1] 钳位 */
function apply(matrix: number[], rgb: [number, number, number]): [number, number, number] {
	const [r, g, b] = rgb;
	const out = [0, 1, 2].map((i) =>
		Math.max(
			0,
			Math.min(1, matrix[i * 5] * r + matrix[i * 5 + 1] * g + matrix[i * 5 + 2] * b)
		)
	);
	return out as [number, number, number];
}

/** tools/card-frame-preview 的 VANILLA_MATS：卡池 -> 卡框颜色 */
const PRESETS = {
	ironclad: { h: 0.025, s: 0.85, v: 1.0, dominant: 0 },
	silent: { h: 0.32, s: 0.45, v: 1.2, dominant: 1 },
	defect: { h: 0.55, s: 0.9, v: 1.0, dominant: 2 },
	necrobinder: { h: 0.965, s: 0.55, v: 1.2, dominant: 0 },
	regent: { h: 0.12, s: 1.5, v: 1.2, dominant: 0 },
	colorless: { h: 1.0, s: 0.0, v: 1.2, dominant: -1 }
} as const;

describe('frameTintMatrix', () => {
	it('复刻 hsv.gdshader：红色底框按卡池 HSV 旋转到对应的主色通道', () => {
		const redBase: [number, number, number] = [1, 0, 0];
		for (const [color, { h, s, v, dominant }] of Object.entries(PRESETS)) {
			const out = apply(frameTintMatrix({ h, s, v }), redBase);
			if (dominant === -1) {
				// 无色：s=0 时 I/Q 被清零，输出应为中性灰（三通道近似相等）
				expect(Math.abs(out[0] - out[1]), `${color} 应为灰色`).toBeLessThan(0.02);
				expect(Math.abs(out[1] - out[2]), `${color} 应为灰色`).toBeLessThan(0.02);
			} else {
				expect(Math.max(...out), `${color} 主色通道`).toBe(out[dominant]);
			}
		}
	});

	it('alpha 行保持恒等，卡框透明区域不受影响', () => {
		const matrix = frameTintMatrix({ h: 0.32, s: 0.45, v: 1.2 });
		expect(matrix.length).toBe(20);
		expect(matrix.slice(15)).toEqual([0, 0, 0, 1, 0]);
	});

	it('清单中的 shader 与预览工具的预设一致，且每个卡池有独立滤镜 id', () => {
		for (const [color, preset] of Object.entries(PRESETS)) {
			expect(CHARACTER_ASSETS[color]?.shader).toEqual({
				h: preset.h,
				s: preset.s,
				v: preset.v
			});
			expect(frameTintFilterId(color as 'ironclad')).toBe(`frame-tint-${color}`);
		}
	});
});
