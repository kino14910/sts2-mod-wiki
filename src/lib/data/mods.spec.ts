import { describe, expect, it } from 'vitest';
import {
	isBuiltinRarity,
	isUpgradable,
	isValidRarityId,
	rarityIds,
	rarityInfo,
	rarityMatches,
	rarityRank,
	registerCardRarities,
	resolveCard,
	type Card
} from './cards';
import { rarityName } from './localize';
import { CARDS, CHARACTER_ASSETS, MOD_BY_ID, MODS } from './mods';

const baseCard: Card = {
	id: 'Abrasive',
	name: 'Abrasive',
	mod: 'sts2',
	pool: ['silent'],
	color: 'silent',
	type: 'power',
	rarity: 'rare',
	cost: 3,
	text: '',
	variables: { ThornsPower: 4, DexterityPower: 1 },
	keywords: ['Sly'],
	secondEnergy: 3,
	upgrade: {
		cost: 2,
		variables: { ThornsPower: 5 },
		keywords: ['Sly', 'Innate']
	}
};

describe('mod data loading', () => {
	it('sts2 以 other + 空前缀读取生成 Key 对应的本地化文本', () => {
		expect(MODS.map((mod) => mod.id)).toContain('sts2');
		expect(MOD_BY_ID.get('sts2')?.dependency).toEqual({ type: 'other', prefix: '' });

		const strike = CARDS.find((card) => card.mod === 'sts2' && card.id === 'StrikeIronclad');
		expect(strike?.name).toBe('Strike');
		expect(strike?.text).toBe('Deal {Damage:diff()} damage.');

		const demonForm = CARDS.find((card) => card.mod === 'sts2' && card.id === 'DemonForm');
		expect(demonForm?.name).toBe('Demon Form');
		expect(demonForm?.text).toBe(
			'At the start of your turn, gain {StrengthPower:diff()} [gold]Strength[/gold].'
		);
	});

	it('无色卡使用专属卡面与文本能量图标', () => {
		expect(CHARACTER_ASSETS.colorless?.cardEnergy).toBe(
			'/mods/sts2/images/energy_colorless.png'
		);
		expect(CHARACTER_ASSETS.colorless?.textEnergy).toBe(
			'/mods/sts2/images/colorless_energy_icon.png'
		);
	});

	it('upgrade 统一计算最终属性：覆盖 / 浅合并 / 完整替换', () => {
		expect(isUpgradable(baseCard)).toBe(true);

		const base = resolveCard(baseCard, false);
		expect(base.cost).toBe(3);
		expect(base.variables).toEqual({ ThornsPower: 4, DexterityPower: 1 });
		expect(base.keywords).toEqual(['Sly']);
		expect(base.secondEnergy).toBe(3);
		expect(base.name).toBe('Abrasive');
		expect(base.baseVariables).toEqual(baseCard.variables);

		const view = resolveCard(baseCard, true);
		expect(view.cost).toBe(2);
		expect(view.variables).toEqual({ ThornsPower: 5, DexterityPower: 1 });
		expect(view.keywords).toEqual(['Sly', 'Innate']);
		expect(view.secondEnergy).toBe(3);
		expect(view.name).toBe('Abrasive+');
		expect(baseCard.cost).toBe(3);
		expect(baseCard.variables).toEqual({ ThornsPower: 4, DexterityPower: 1 });
	});

	it('未声明 upgrade 时只标记升级态，upgrade: {} 仍视为可升级', () => {
		const plain: Card = { ...baseCard, upgrade: undefined };
		expect(isUpgradable(plain)).toBe(false);
		expect(resolveCard(plain, true).cost).toBe(3);
		expect(resolveCard(plain, true).name).toBe('Abrasive+');
		expect(isUpgradable({ ...plain, upgrade: {} })).toBe(true);
		expect(resolveCard({ ...plain, upgrade: {} }, true).keywords).toEqual(['Sly']);

		const withSecondEnergy = { ...plain, upgrade: { secondEnergy: 2 } };
		expect(resolveCard(withSecondEnergy, true).secondEnergy).toBe(2);
		expect(resolveCard(withSecondEnergy, true).cost).toBe(3);
	});

	it('全量卡牌的 upgrade 只包含已知属性且解析结果可用', () => {
		expect(CARDS.length).toBeGreaterThan(500);
		const acrobatics = CARDS.find((card) => card.id === 'Acrobatics');
		expect(acrobatics?.upgrade?.variables).toEqual({ Cards: 4 });
		expect(resolveCard(acrobatics!, true).variables).toEqual({ Cards: 4 });

		for (const card of CARDS) {
			if (!card.upgrade) continue;
			for (const key of Object.keys(card.upgrade)) {
				expect(['cost', 'secondEnergy', 'variables', 'keywords']).toContain(key);
			}
			const view = resolveCard(card, true);
			expect(view.variables).toEqual({ ...card.variables, ...card.upgrade.variables });
			expect(view.keywords).toEqual(card.upgrade.keywords ?? card.keywords);
		}
	});

	it('卡池声明 cardFrame（按类型）与 shader（HSV）', () => {
		const colors = [
			'ironclad',
			'silent',
			'defect',
			'necrobinder',
			'regent',
			'colorless'
		] as const;
		for (const color of colors) {
			const assets = CHARACTER_ASSETS[color];
			expect(assets?.cardFrame?.attack).toBe('/images/card_frames/attack.png');
			expect(assets?.cardFrame?.skill).toBe('/images/card_frames/skill.png');
			expect(assets?.cardFrame?.power).toBe('/images/card_frames/power.png');
			expect(assets?.cardFrame?.quest).toBe('/images/card_frames/quest.png');
			expect(assets?.shader).toEqual(
				expect.objectContaining({
					h: expect.any(Number),
					s: expect.any(Number),
					v: expect.any(Number)
				})
			);
		}
	});

	it('卡面缩略图由 virtual:mods 输出为 webp，并随 resolveCard 透传', () => {
		const withThumb = CARDS.filter((card) => card.thumb);
		expect(withThumb.length).toBeGreaterThan(500);
		for (const card of withThumb) {
			expect(card.thumb).toMatch(/^\/mods\/[^/]+\/images\/cards\/.*\.webp$/);
			expect(resolveCard(card, false).thumb).toBe(card.thumb);
		}
	});
});

describe('mod 自定义稀有度', () => {
	it('稀有度为自定义值的卡牌正常加载，并进入筛选项', () => {
		const npCards = CARDS.filter((card) => card.rarity === 'NoblePhantasm')
		expect(npCards.length).toBeGreaterThan(0)
		expect(npCards.every((card) => card.mod === 'fgo')).toBe(true)
		expect(rarityIds()).toContain('NoblePhantasm')
		expect(['Noble Phantasm', '宝具']).toContain(rarityName('NoblePhantasm'))
	})

	it('manifest 声明的元数据与 base 继承生效', () => {
		const info = rarityInfo('NoblePhantasm')
		expect(info.name).toBe('Noble Phantasm')
		expect(info.labels.zhs).toBe('宝具')
		expect(info.color).toBe('#ffd700')
		expect(info.base).toBe('ancient')
		expect(info.banner).toBe(rarityInfo('ancient').banner)
		expect(info.outline).toBe(rarityInfo('ancient').outline)
		expect(info.fullArt).toBe(true)
		expect(rarityInfo('ancient').fullArt).toBe(true)
		expect(rarityInfo('rare').fullArt).toBe(false)
		expect(rarityInfo('token').banner).toBe('common')
	})

	it('自定义值参与筛选匹配与排序，内置筛选按 base 一并命中', () => {
		const np = CARDS.filter((card) => rarityMatches('NoblePhantasm', card.rarity))
		expect(np.length).toBeGreaterThan(0)
		expect(np.every((card) => card.rarity === 'NoblePhantasm')).toBe(true)

		const ancient = CARDS.filter((card) => rarityMatches('ancient', card.rarity))
		expect(ancient.some((card) => card.rarity === 'NoblePhantasm')).toBe(true)
		expect(rarityMatches('rare', 'NoblePhantasm')).toBe(false)

		expect(rarityMatches('all', 'NoblePhantasm')).toBe(true)
		expect(rarityMatches('common', 'common')).toBe(true)
		expect(rarityMatches('ancient', 'common')).toBe(false)
		expect(rarityRank('common')).toBeLessThan(rarityRank('rare'))
		expect(rarityRank('NoblePhantasm')).toBeGreaterThan(rarityRank('ancient'))
		expect(rarityRank('NoblePhantasm')).toBeLessThan(rarityRank('event'))
	})

	it('未声明的其他自定义值自动可用，无需按具体 id 硬编码', () => {
		expect(isValidRarityId('NoblePhantasm')).toBe(true)
		expect(isValidRarityId('has space')).toBe(false)
		expect(isValidRarityId('_leading')).toBe(false)
		expect(isValidRarityId('')).toBe(false)
		expect(isBuiltinRarity('rare')).toBe(true)
		expect(isBuiltinRarity('NoblePhantasm')).toBe(false)

		registerCardRarities({
			DivineRelic: { nameZh: '神器', base: 'rare' },
			EventOnly: {}
		})

		expect(rarityIds()).toEqual(expect.arrayContaining(['DivineRelic', 'EventOnly']))
		expect(rarityInfo('DivineRelic').name).toBe('Divine Relic')
		expect(rarityInfo('DivineRelic').labels.zhs).toBe('神器')
		expect(rarityInfo('DivineRelic').color).toBe(rarityInfo('rare').color)
		expect(rarityMatches('rare', 'DivineRelic')).toBe(true)
		expect(rarityMatches('rare', 'EventOnly')).toBe(false)
		expect(rarityInfo('EventOnly').name).toBe('Event Only')
		expect(rarityInfo('EventOnly').banner).toBe(rarityInfo('rare').banner)
		expect(rarityRank('EventOnly')).toBeGreaterThan(rarityRank('quest'))
		expect(rarityInfo('NeverSeen').name).toBe('Never Seen')
		expect(rarityInfo('NeverSeen').color).toBe(rarityInfo('rare').color)
	})
});
