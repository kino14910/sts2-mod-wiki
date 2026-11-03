import type { CardType, ColorId, Rarity } from './cards';
import type { StackType, TurnBehavior } from './glossary';
import { BUFFS_ZH } from './buffs-zh';
import { DEBUFFS_ZH } from './debuffs-zh';

/** Chinese content for the card library. English stays the base locale in cards.ts and glossary.ts. */

export interface CardTextZh {
	name: string;
	text: string;
	upgradedText: string;
	flavor: string;
}

export const CARD_ZH: Record<string, CardTextZh> = {
	'ember-lance': {
		name: '余烬长枪',
		text: '造成 9 点伤害。若你拥有力量，额外造成 3 点伤害。',
		upgradedText: '造成 12 点伤害。若你拥有力量，额外造成 4 点伤害。',
		flavor: '余烬记得每一只喂养过它的手。'
	},
	'ashen-bulwark': {
		name: '灰烬壁垒',
		text: '获得 11 点格挡。在你的回合结束时，获得 3 点格挡。消耗。',
		upgradedText: '获得 15 点格挡。在你的回合结束时，获得 4 点格挡。消耗。',
		flavor: '熬过火焰的，终将成为墙壁。'
	},
	'crimson-ledger': {
		name: '猩红账簿',
		text: '每当你因卡牌失去生命时，获得 1 点力量。',
		upgradedText: '固有。每当你因卡牌失去生命时，获得 1 点力量。',
		flavor: '每一笔债都用同一种墨水写下。'
	},
	'last-ember': {
		name: '最后一缕余烬',
		text: '造成 6 点伤害 3 次。致命：获得 2 点力量。消耗。',
		upgradedText: '造成 8 点伤害 3 次。致命：获得 3 点力量。消耗。',
		flavor: '它只需要再燃烧一次。'
	},
	nightloom: {
		name: '夜织',
		text: '施加 3 层中毒。抽 1 张牌。',
		upgradedText: '施加 4 层中毒。抽 1 张牌。',
		flavor: '世界沉睡时，花园仍在生长。'
	},
	'sly-gambit': {
		name: '狡诈赌局',
		text: '狡诈。造成 7 点伤害。施加 1 层虚弱。',
		upgradedText: '狡诈。造成 9 点伤害。施加 2 层虚弱。',
		flavor: '从阴影里掷出的刀，依然算数。'
	},
	'venom-choir': {
		name: '毒液合唱',
		text: '每当你施加中毒时，额外施加 1 层中毒。',
		upgradedText: '每当你施加中毒时，额外施加 2 层中毒。',
		flavor: '合唱团里的每一副喉咙都唱着同一种毒。'
	},
	'thousand-fangs': {
		name: '千牙',
		text: '对随机敌人造成 4 点伤害 4 次。致命：抽 1 张牌。',
		upgradedText: '对随机敌人造成 5 点伤害 4 次。致命：抽 2 张牌。',
		flavor: '你只看见一张嘴。这正是把戏所在。'
	},
	'starfall-edict': {
		name: '星陨敕令',
		text: '花费 3 点星辰。对所有敌人造成 18 点伤害。',
		upgradedText: '花费 3 点星辰。对所有敌人造成 24 点伤害。',
		flavor: '天空是一本账簿，王庭会前来收取。'
	},
	'gilded-aegis': {
		name: '鎏金神盾',
		text: '获得 8 点格挡。获得 2 点星辰。',
		upgradedText: '获得 11 点格挡。获得 2 点星辰。',
		flavor: '黄金记得每一次打击的形状。'
	},
	'forge-the-heavens': {
		name: '铸造苍穹',
		text: '铸造 5。抽 1 张牌。',
		upgradedText: '铸造 8。抽 1 张牌。',
		flavor: '一把剑在被握持之前，只是一个承诺。'
	},
	'royal-decree': {
		name: '王室敕令',
		text: '获得 2 点星辰。下回合，获得 1 点能量。消耗。',
		upgradedText: '获得 3 点星辰。下回合，获得 1 点能量。消耗。',
		flavor: '王庭不会问第二次。'
	},
	'doom-toll': {
		name: '厄运丧钟',
		text: '施加 6 层厄运。若该敌人在本回合死亡，获得 1 点能量。',
		upgradedText: '施加 9 层厄运。若该敌人在本回合死亡，获得 1 点能量。',
		flavor: '每一记钟声都是一场准时的小型天启。'
	},
	'bone-choir': {
		name: '骸骨合唱',
		text: '每当你召唤时，对所有敌人造成 3 点伤害。',
		upgradedText: '每当你召唤时，对所有敌人造成 5 点伤害。',
		flavor: '死者哼唱的调子，活人的耳朵早已遗忘。'
	},
	'ostys-grasp': {
		name: '奥斯蒂之握',
		text: '造成 7 点伤害。召唤 2。',
		upgradedText: '造成 10 点伤害。召唤 3。',
		flavor: '他并不温柔。他只是忠诚。'
	},
	'grave-pact': {
		name: '坟墓契约',
		text: '失去 3 点生命。获得 2 点能量。消耗。',
		upgradedText: '失去 2 点生命。获得 2 点能量。消耗。',
		flavor: '坟墓很有耐心。债务没有。'
	},
	'frost-array': {
		name: '冰霜阵列',
		text: '引导 2 个冰霜充能球。获得 4 点格挡。',
		upgradedText: '引导 3 个冰霜充能球。获得 5 点格挡。',
		flavor: '寒冷只是机器能够理解的一种结构。'
	},
	'ion-storm': {
		name: '离子风暴',
		text: '在你的回合开始时，引导 1 个闪电充能球。',
		upgradedText: '在你的回合开始时，引导 2 个闪电充能球。',
		flavor: '天气预报是由静电许下的承诺。'
	},
	'focus-lens': {
		name: '聚焦透镜',
		text: '获得 2 点集中。抽 1 张牌。',
		upgradedText: '获得 3 点集中。抽 1 张牌。',
		flavor: '清晰是你亲手在体内建起的一台机器。'
	},
	'glass-requiem': {
		name: '琉璃安魂曲',
		text: '激发所有充能球。每激发一个充能球，对所有敌人造成 4 点伤害。',
		upgradedText: '激发所有充能球。每激发一个充能球，对所有敌人造成 6 点伤害。',
		flavor: '花园碎裂时，每一块玻璃都在歌唱。'
	},
	'prismatic-bloom': {
		name: '棱彩绽放',
		text: '引导 1 个玻璃充能球、1 个等离子充能球和 1 个黑暗充能球。消耗。',
		upgradedText: '引导 2 个玻璃充能球、2 个等离子充能球和 2 个黑暗充能球。消耗。',
		flavor: '一朵颜色多到无法命名的花。'
	},
	'null-pulse': {
		name: '虚无脉冲',
		text: '移除所有敌人身上的全部格挡。抽 1 张牌。消耗。',
		upgradedText: '移除所有敌人身上的全部格挡。抽 2 张牌。消耗。',
		flavor: '信号没有抵达。随后什么都没有。'
	},
	'echo-chamber': {
		name: '回声之室',
		text: '你每回合打出的第一张牌会额外打出一次。',
		upgradedText: '你每回合打出的第一张牌会额外打出一次。',
		flavor: '一次永远不太够。'
	},
	'enigma-codex': {
		name: '谜典',
		text: '选择 3 张稀有牌中的 1 张，将其加入你的手牌。消耗。',
		upgradedText: '选择 3 张稀有牌中的 1 张，将其加入你的手牌。消耗。',
		flavor: '每个答案都是一个穿着更好外套的问题。'
	},
	'kindled-spark': {
		name: '点燃的火花',
		text: '造成 6 点伤害。',
		upgradedText: '造成 9 点伤害。',
		flavor: '每一场火，开始时都比握着它的手更小。'
	},
	'fading-echo': {
		name: '渐隐回声',
		text: '抽 X 张牌。消耗。',
		upgradedText: '抽 X+1 张牌。消耗。',
		flavor: '最后的话语，重复到失去意义。'
	},
	'sealed-scroll': {
		name: '封印卷轴',
		text: '不可打出。完成此任务，将一张随机稀有牌加入你的手牌。',
		upgradedText: '不可打出。完成此任务，将一张随机稀有牌加入你的手牌。',
		flavor: '蜡封还是温的。'
	},
	'scrap-plating': {
		name: '废料装甲',
		text: '不可打出。在你的回合结束时，失去 2 点生命。',
		upgradedText: '不可打出。在你的回合结束时，失去 2 点生命。',
		flavor: '它曾经是那台机器的一部分。'
	},
	'hollow-relic': {
		name: '空洞遗物',
		text: '不可打出。每当你抽到这张牌时，失去 1 点能量。',
		upgradedText: '不可打出。每当你抽到这张牌时，失去 1 点能量。',
		flavor: '你保留它越久，它索求的就越多。'
	},
	'sovereign-blade': {
		name: '君王之刃',
		text: '造成 10 点伤害。消耗。',
		upgradedText: '造成 14 点伤害。消耗。',
		flavor: '一位国王的承诺，被磨得锋利。'
	}
};

export const MOD_ZH: Record<string, { name: string; blurb: string }> = {
	'wayfarers-gambit': {
		name: '旅人赌局',
		blurb: '一把流浪的刀与一柄沉默的匕首，一场战斗一场战斗地改写道路。'
	},
	'sunless-court': {
		name: '无光王庭',
		blurb: '一座永不见晨光的王庭，星辰是货币，坟墓会回话。'
	},
	'mechanical-bloom': {
		name: '机械绽华',
		blurb: '玻璃花园、风暴引擎，以及一台正在学会渴望的机器。'
	}
};

export const COLOR_ZH: Record<ColorId, string> = {
	ironclad: '铁甲战士',
	silent: '静默猎手',
	regent: '摄政者',
	necrobinder: '缚灵师',
	defect: '故障机器人',
	colorless: '无色'
};

export const CARD_TYPE_ZH: Record<CardType, { name: string; plural: string }> = {
	attack: { name: '攻击', plural: '攻击牌' },
	skill: { name: '技能', plural: '技能牌' },
	power: { name: '能力', plural: '能力牌' },
	status: { name: '状态', plural: '状态牌' },
	curse: { name: '诅咒', plural: '诅咒牌' },
	quest: { name: '任务', plural: '任务牌' }
};

export const RARITY_ZH: Record<Rarity, string> = {
	basic: '基础',
	common: '普通',
	uncommon: '罕见',
	rare: '稀有',
	ancient: '远古',
	event: '事件',
	token: '衍生'
};

export interface GlossaryTextZh {
	name: string;
	summary?: string;
	detail?: string;
	aliases?: string[];
}

export const GLOSSARY_ZH: Record<string, GlossaryTextZh> = {
	...BUFFS_ZH,
	...DEBUFFS_ZH,
	eternal: {
		name: '永恒',
		summary: '无法从你的牌组中移除或变化。'
	},
	ethereal: {
		name: '虚无',
		summary: '如果这张牌在这个回合结束时留在你的手牌中，则将其消耗。'
	},
	exhaust: {
		name: '消耗',
		summary: '在战斗结束前移除。'
	},
	innate: {
		name: '固有',
		summary: '每场战斗开始时这张牌会出现在你的手牌。'
	},
	retain: {
		name: '保留',
		summary: '保留的牌不会在回合结束时被弃掉。'
	},
	sly: {
		name: '奇巧',
		summary: '如果这张牌在你的回合结束前从你的手牌中被丢弃，则免费将其打出。'
	},
	unplayable: {
		name: '不能被打出',
		summary: '不能被打出的牌无法被打出。'
	}
};

export const GROUP_ZH: Record<string, string> = {
	Common: '通用',
	Card: '卡牌',
	Intensity: '强度',
	Duration: '持续',
	Counter: '计数',
	'Does not stack': '不叠加',
	Other: '其他'
};

export const STACK_ZH: Record<StackType, string> = {
	Intensity: '强度',
	Duration: '持续',
	Counter: '计数',
	Passive: '被动',
	NoStack: '不叠加',
	IntensityDuration: '强度 + 持续',
	IntensityCounter: '强度 + 计数',
	CounterDuration: '计数 + 持续',
	DurationStacks: '持续（独立叠加）'
};

export const BEHAVIOR_ZH: Record<TurnBehavior, string> = {
	Permanent: '永久',
	Conserved: '保持',
	Decremented: '递减',
	Removed: '移除',
	Consumed: '消耗',
	Reset: '重置',
	Special: '特殊'
};
