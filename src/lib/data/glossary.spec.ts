import { describe, expect, it } from 'vitest'
import { POWERS, STACK_KINDS, matchesStackFilter, type StackType } from './glossary'

describe('power stack filter', () => {
	it('未选按钮时放行全部叠加类型', () => {
		for (const stack of Object.keys(STACK_KINDS) as StackType[]) {
			expect(matchesStackFilter(stack, [])).toBe(true)
		}
		expect(matchesStackFilter(undefined, [])).toBe(true)
	})

	it('组合叠加类型同时命中对应的按钮', () => {
		expect(STACK_KINDS.IntensityDuration).toEqual(['Intensity', 'Duration'])
		expect(STACK_KINDS.IntensityCounter).toEqual(['Intensity', 'Counter'])
		expect(STACK_KINDS.CounterDuration).toEqual(['Counter', 'Duration'])
		expect(STACK_KINDS.DurationStacks).toEqual(['Duration'])
		expect(matchesStackFilter('IntensityDuration', ['Duration'])).toBe(true)
		expect(matchesStackFilter('CounterDuration', ['Counter'])).toBe(true)
		expect(matchesStackFilter('DurationStacks', ['Duration'])).toBe(true)
	})

	it('多选取并集且排除无关类型', () => {
		const selected = ['Intensity', 'Duration'] as const
		expect(matchesStackFilter('Intensity', selected)).toBe(true)
		expect(matchesStackFilter('IntensityCounter', selected)).toBe(true)
		expect(matchesStackFilter('Counter', selected)).toBe(false)
		expect(matchesStackFilter('NoStack', selected)).toBe(false)
		expect(matchesStackFilter('Passive', selected)).toBe(false)
		expect(matchesStackFilter(undefined, selected)).toBe(false)
	})

	it('数据里出现的 stack 都有映射', () => {
		for (const power of POWERS) {
			if (power.stack) expect(STACK_KINDS[power.stack]).toBeDefined()
		}
	})
})
