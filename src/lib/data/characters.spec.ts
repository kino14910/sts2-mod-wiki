import { describe, expect, it } from 'vitest';
import {
	cardCharacterOptions,
	characterSortRank,
	displayCharacterOrder
} from './characters';

const optionIds = (options: { id: string }[]) => options.map((o) => o.id);

describe('displayCharacterOrder', () => {
	it('colorless 固定显示在最前面，其余保持按钮顺序', () => {
		const options = cardCharacterOptions();
		const ordered = displayCharacterOrder(options);
		expect(ordered[0].id).toBe('colorless');
		// 其余顺序与传入一致（按钮顺序）
		expect(optionIds(ordered.slice(1))).toEqual(optionIds(options.filter((o) => o.id !== 'colorless')));
	});
});

describe('characterSortRank', () => {
	it('默认排序 colorless 排在最末，其余严格按按钮顺序', () => {
		const options = cardCharacterOptions().filter((o) => o.id !== 'colorless');
		const ids = optionIds(options);
		const ranked = [...ids].sort((a, b) => characterSortRank(a) - characterSortRank(b));
		// 按钮顺序不变，colorless（若存在）始终最后
		expect(ranked.filter((id) => id !== 'colorless')).toEqual(ids);
		expect(characterSortRank('colorless')).toBeGreaterThan(characterSortRank(ids[0]));
	});

	it('展示顺序与排序逻辑相互独立：改变展示顺序不影响排序 rank', () => {
		// 展示层只关心 colorless 最前；数据层按 CHARACTER_ORDER 定 rank
		const shuffled = [...cardCharacterOptions()].reverse();
		const display = displayCharacterOrder(shuffled);
		expect(display[0].id).toBe('colorless');
		// rank 不依赖传入数组，仅依赖 id 本身
		expect(characterSortRank('colorless')).toBe(Number.MAX_SAFE_INTEGER);
	});
});
