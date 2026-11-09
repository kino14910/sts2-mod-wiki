import { describe, expect, it } from 'vitest';
import {
	buildBaseLibEntryId,
	buildRitsuLibEntryId,
	normalizePublicStem,
	normalizeSegment
} from './entry-id';
import {
	entryIdFor,
	isModDependency,
	localizationKeyFor,
	resolveContentText,
	type ModDependency
} from './mod-dependency';

describe('entry-id', () => {
	it('按前置库规则归一化并拼接 Entry ID', () => {
		expect(normalizeSegment('Strike')).toBe('STRIKE');
		expect(normalizeSegment('DemonForm')).toBe('DEMON_FORM');
		expect(normalizeSegment('strike ironclad')).toBe('STRIKE_IRONCLAD');
		expect(normalizePublicStem('FGO')).toBe('FGO');
		expect(buildBaseLibEntryId('Test.Scripts', 'DemonForm')).toBe('TEST-DEMON_FORM');
		expect(buildRitsuLibEntryId('FGO', 'card', 'Strike')).toBe('FGO_CARD_STRIKE');
		expect(buildRitsuLibEntryId('FGO', 'power', 'FifthForcePower')).toBe(
			'FGO_POWER_FIFTH_FORCE_POWER'
		);
	});
});

describe('mod dependency', () => {
	it('baselib 使用命名空间首段作为前缀', () => {
		const dependency: ModDependency = { type: 'baselib', namespace: 'Test.Scripts' };
		expect(entryIdFor(dependency, 'card', 'Strike')).toBe('TEST-STRIKE');
		expect(localizationKeyFor(dependency, 'power', 'FifthForcePower', 'title')).toBe(
			'TEST-FIFTH_FORCE_POWER.title'
		);
	});

	it('ritsulib 由 modid 与内容类别自动生成 Key', () => {
		const dependency: ModDependency = { type: 'ritsulib', modid: 'FGO' };
		expect(localizationKeyFor(dependency, 'card', 'Strike', 'title')).toBe(
			'FGO_CARD_STRIKE.title'
		);
		expect(localizationKeyFor(dependency, 'card', 'Strike', 'description')).toBe(
			'FGO_CARD_STRIKE.description'
		);
		expect(localizationKeyFor(dependency, 'power', 'FifthForcePower', 'title')).toBe(
			'FGO_POWER_FIFTH_FORCE_POWER.title'
		);
		expect(localizationKeyFor(dependency, 'power', 'FifthForcePower', 'description')).toBe(
			'FGO_POWER_FIFTH_FORCE_POWER.description'
		);
	});

	it('other 允许空前缀，由开发者自定义前缀时按原样拼接', () => {
		expect(entryIdFor({ type: 'other', prefix: '' }, 'card', 'DemonForm')).toBe('DEMON_FORM');
		expect(entryIdFor({ type: 'other' }, 'card', 'Strike')).toBe('STRIKE');
		expect(entryIdFor({ type: 'other', prefix: 'FGO_' }, 'power', 'FifthForcePower')).toBe(
			'FGO_FIFTH_FORCE_POWER'
		);
	});

	it('从本地化表中按生成的 Key 读取文本', () => {
		const dependency: ModDependency = { type: 'ritsulib', modid: 'FGO' };
		const texts = {
			'FGO_CARD_STRIKE.title': 'Strike',
			'FGO_CARD_STRIKE.description': 'Deal {Damage:diff()} damage.',
			'FGO_POWER_FIFTH_FORCE_POWER.title': 'Fifth Force',
			'FGO_POWER_FIFTH_FORCE_POWER.description': 'Gain {Amount} Strength.'
		};

		expect(resolveContentText(texts, dependency, 'card', 'Strike', 'title')).toBe('Strike');
		expect(resolveContentText(texts, dependency, 'card', 'Strike', 'description')).toBe(
			'Deal {Damage:diff()} damage.'
		);
		expect(
			resolveContentText(texts, dependency, 'power', 'FifthForcePower', 'title')
		).toBe('Fifth Force');
		expect(resolveContentText(undefined, dependency, 'card', 'Strike', 'title')).toBeUndefined();
	});

	it('拒绝缺少必填字段或带冗余字段的依赖声明', () => {
		expect(isModDependency({ type: 'baselib', namespace: 'Test.Scripts' })).toBe(true);
		expect(isModDependency({ type: 'baselib' })).toBe(false);
		expect(isModDependency({ type: 'baselib', namespace: 'Test.Scripts', prefix: '' })).toBe(
			false
		);

		expect(isModDependency({ type: 'ritsulib', modid: 'FGO' })).toBe(true);
		expect(isModDependency({ type: 'ritsulib' })).toBe(false);
		expect(
			isModDependency({ type: 'ritsulib', modid: 'FGO', category: 'card', prefix: '' })
		).toBe(false);

		expect(isModDependency({ type: 'other', prefix: '' })).toBe(true);
		expect(isModDependency({ type: 'other' })).toBe(true);
		expect(isModDependency({ type: 'other', namespace: 'Test.Scripts' })).toBe(false);
		expect(isModDependency({ type: 'other', prefix: 'FGO-' })).toBe(false);
		expect(isModDependency({ type: 'unknown' })).toBe(false);
	});
});
