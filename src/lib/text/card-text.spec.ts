import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveCard } from '../data/cards';
import { keywordPlacement, localizedKeywordLine } from '../data/localize';
import { CARDS } from '../data/mods';
import { bbcodeToHtml } from './bbcode';
import { cardTextToHtml, cardTextToPlain } from './card-text';

const BODY_SLAM =
	'Deal damage equal to your [gold]Block[/gold].{InCombat:\n(Deals {CalculatedDamage:diff()} damage)|}';

function localizationKey(id: string) {
	let out = '';
	const value = id.trim();
	for (let i = 0; i < value.length; i++) {
		if (i > 0 && /[A-Z]/.test(value[i]) && /[A-Za-z0-9]/.test(value[i - 1])) out += '_';
		out += value[i];
	}
	return out.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
}

describe('card text context conditions', () => {
	it('默认按 InCombat:false 隐藏战斗内动态提示', () => {
		expect(cardTextToPlain(BODY_SLAM)).toBe('Deal damage equal to your Block.');
	});

	it('inCombat:true 时渲染真分支', () => {
		expect(
			cardTextToPlain(BODY_SLAM, { inCombat: true, variables: { CalculatedDamage: 12 } })
		).toBe('Deal damage equal to your Block.\n(Deals 12 damage)');
	});

	it('分支里的嵌套花括号与 | 不会截断整块', () => {
		const text = 'Deal {Damage} damage.{InCombat:\n(Hits {Cards:plural:time|times})|}';
		expect(cardTextToPlain(text, { variables: { Damage: 8 } })).toBe('Deal 8 damage.');
	});

	it('IsTargeting / OnTable 同样按 false 解析', () => {
		expect(cardTextToPlain('X{IsTargeting:\n(Apply 1)|}')).toBe('X');
		expect(cardTextToPlain('{OnTable:在场上|不在场上}')).toBe('不在场上');
	});
});

describe('card text formatters', () => {
	it('show: 升级态取真分支并标绿', () => {
		const text = 'Play the top X{IfUpgraded:show:+1|} cards.';
		expect(cardTextToPlain(text)).toBe('Play the top X cards.');
		expect(cardTextToHtml(text, { upgraded: true })).toContain(
			'<span style="color:#7FFF00">+1</span>'
		);
	});

	it('show: 缺 | 时按只有真分支处理', () => {
		expect(cardTextToPlain('X{IfUpgraded:show:+1}')).toBe('X');
		expect(cardTextToPlain('X{IfUpgraded:show:+1}', { upgraded: true })).toBe('X+1');
	});

	it('plural 按数值选分支并支持 {} 与 {:diff()}', () => {
		expect(cardTextToPlain('{Cards:plural:card|cards}', { variables: { Cards: 1 } })).toBe('card');
		expect(cardTextToPlain('{Cards:plural:card|cards}', { variables: { Cards: 2 } })).toBe(
			'cards'
		);
		expect(
			cardTextToPlain('{Repeat:plural:{} time|{} times}', { variables: { Repeat: 7 } })
		).toBe('7 times');
		expect(
			cardTextToPlain('{Repeat:plural:time|{:diff()} times}', { variables: { Repeat: 3 } })
		).toBe('3 times');
	});

	it('cond 与 choose 按变量值选分支', () => {
		expect(
			cardTextToPlain('{Attacks:cond:>1?{Attacks} Attacks are|Attack is}', {
				variables: { Attacks: 1 }
			})
		).toBe('Attack is');
		expect(
			cardTextToPlain('{Attacks:cond:>1?{Attacks} Attacks are|Attack is}', {
				variables: { Attacks: 2 }
			})
		).toBe('2 Attacks are');
		expect(
			cardTextToPlain('{CardType:choose(Attack|Skill|Power):Attack|Block|Nothing}', {
				variables: { CardType: 'Skill' }
			})
		).toBe('Block');
		expect(
			cardTextToPlain('{TargetType:choose(AllEnemies): to ALL enemies|}', {
				variables: { TargetType: 'AnyEnemy' }
			})
		).toBe('');
	});

	it('inverseDiff 与图标变量', () => {
		expect(
			cardTextToPlain('Lose {StrengthPower:inverseDiff()} Strength.', {
				variables: { StrengthPower: 2 }
			})
		).toBe('Lose 2 Strength.');
		expect(cardTextToHtml('a {singleStarIcon} cost')).toContain('sts-energy-icon');
		expect(cardTextToPlain('{Energy:energyIcons()}', { variables: { Energy: 2 } })).toBe('2');
	});
});

describe('全量卡牌描述', () => {
	it('中英文、基础与升级态都不残留花括号或格式化器名', () => {
		for (const locale of ['eng', 'zhs']) {
			const data = JSON.parse(
				fs.readFileSync(
					`D:/projects/sts2-mod-wiki/static/mods/sts2/localization/${locale}/cards.json`,
					'utf8'
				)
			) as Record<string, string>;
			for (const card of CARDS) {
				const text = data[`${localizationKey(card.id)}.description`];
				if (!text) continue;
			for (const upgraded of [false, true]) {
				const view = resolveCard(card, upgraded);
				const plain = cardTextToPlain(text, {
					upgraded,
					variables: view.variables,
					baseVariables: view.baseVariables
				});
					expect(plain, `${locale}/${card.id}/${upgraded}`).not.toMatch(/[{}]/);
					expect(plain).not.toContain('plural:');
					expect(plain).not.toContain('???');
				}
			}
		}
	});

	it('q={ 页面的卡牌渲染正确', () => {
		const cases: Record<string, string> = {
			Cascade: 'Play the top X cards of your Draw Pile.',
			OneTwoPunch: 'This turn, your next Attack is played an extra time.',
			HiddenDaggers: 'Discard 2 cards.\nAdd 2 Shivs into your Hand.',
			Outbreak: 'Every 3 times you apply Poison, deal 4 damage to ALL enemies.',
			PreciseCut: 'Deal 13 damage.\nDeals 2 less damage for each other card in your Hand.',
			Malaise: 'Enemy loses X Strength. Apply X Weak.',
			Largesse: 'Another player adds 1 random Colorless card to their Hand.',
			SevenStars: 'Deal 7 damage to ALL enemies 7 times.',
			Loop: 'At the start of your turn, trigger the passive ability of your rightmost Orb.',
			DualWield: 'Choose an Attack or Power card. Add a copy of that card into your Hand.',
			MadScience: 'Deal 12 damage.',
			Stack: 'Gain Block equal to the number of cards in your Discard Pile.'
		};
		for (const [id, expected] of Object.entries(cases)) {
			const card = CARDS.find((entry) => entry.id === id);
			expect(card, id).toBeDefined();
			expect(cardTextToPlain(card!.text, { variables: card!.variables }), id).toBe(expected);
		}
	});

	it('关键词行默认套 [gold]', () => {
		expect(localizedKeywordLine('Exhaust')).toBe('[gold]Exhaust[/gold].');
		expect(keywordPlacement(['Exhaust']).after[0]).toBe('[gold]Exhaust[/gold].');
		expect(bbcodeToHtml(localizedKeywordLine('Exhaust'))).toContain('color:#EFC851');
		expect(cardTextToHtml('[gold]Exhaust[/gold].')).toContain('color:#EFC851');
	});
});
