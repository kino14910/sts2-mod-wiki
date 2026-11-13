import type { CardType, ColorId, Rarity } from './cards';
import type { StackType, TurnBehavior } from './glossary';

/** Chinese content for the shared reference pages. Card and mod text live in each mod's locale files. */

export const COLOR_ZH: Record<ColorId, string> = {
	ironclad: '铁甲战士',
	silent: '静默猎手',
	regent: '摄政者',
	necrobinder: '缚灵师',
	defect: '故障机器人',
	fool: '愚者',
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
	token: '衍生',
	curse: '诅咒',
	status: '状态',
	quest: '任务'
};

export interface GlossaryTextZh {
	name: string;
	summary?: string;
	detail?: string;
	aliases?: string[];
}

export const GLOSSARY_ZH: Record<string, GlossaryTextZh> = {
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
