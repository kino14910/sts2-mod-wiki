import type { GlossaryTextZh } from './zh';

export const DEBUFFS_ZH: Record<string, GlossaryTextZh> = {
	'biased-cognition': {
		name: '偏差认知',
		summary: '在你的回合开始时，失去1点集中。',
	},
	'borrowed-time': {
		name: '预借时间',
		summary: '卡牌在本回合耗能增加一。',
		detail: '卡牌在本回合耗能增加X点能量。',
	},
	'chains-of-binding': {
		name: '魂缚锁链',
		summary: '每回合抽到的前3张牌将会被侵蚀为魂缚。',
	},
	'confused': {
		name: '混乱',
		summary: '你的卡牌耗能会在抽取时变化，范围为0到3。',
	},
	'conqueror': {
		name: '征服者',
		summary: '君王之剑在本回合对该敌人造成双倍伤害。',
		detail: '君王之剑在X回合内对该生物造成双倍伤害。',
	},
	'constrict': {
		name: '紧缠',
		summary: '蛇行扼杀者存活时，在你的回合结束时受到1点伤害。',
	},
	'dampen': {
		name: '抑制',
		summary: '魔法骑士存活时，你的所有卡牌被降级。',
	},
	'debilitate': {
		name: '摧残',
		summary: '2回合内，易伤和虚弱的效果变为两倍。',
	},
	'demise': {
		name: '消亡',
		summary: '这个生物在其回合结束时失去生命。',
		detail: '该生物的回合结束时，该生物失去X点生命。',
	},
	'dexterity-down': {
		name: '敏捷下降',
		summary: '本回合结束时，失去敏捷。',
		detail: '本回合结束时，失去X点敏捷。',
	},
	'disintegration': {
		name: '瓦解',
		summary: '在你的回合结束时，受到5点伤害。',
	},
	'doom': {
		name: '灾厄',
		summary: '在敌人的回合结束时，如果其灾厄值等于或大于其生命，则其直接死亡。',
		detail: '在玩家的回合结束时，如果该生物的生命值不高于X，则该生物立即死亡。',
	},
	'flanking': {
		name: '夹击',
		summary: '其他盟友在本回合对这名敌人造成2倍攻击伤害。',
	},
	'focus-down': {
		name: '集中下降',
		summary: '在你的回合结束时，失去1点集中。',
	},
	'frail': {
		name: '脆弱',
		summary: '脆弱时，从卡牌中获得的格挡值减少25%。',
	},
	'grasp': {
		name: '紧握',
		summary: '每当你打出一张牌时，失去 1点能量。',
	},
	'hang': {
		name: '吊杀',
		summary: '所有吊杀牌对这名敌人造成2倍伤害。',
	},
	'hex': {
		name: '恶咒',
		summary: '幽灵骑士存活时，你的所有卡牌都拥有虚无。',
	},
	'hunger': {
		name: '饥饿',
		summary: '当你打出攻击牌或技能牌时，将其消耗。',
	},
	'imbalanced': {
		name: '失衡',
		summary: '如果这个生物的攻击被任意玩家完全格挡，则它将被击晕。',
	},
	'inked': {
		name: '墨染',
		summary: '这个生物从攻击牌中受到的伤害增加2点。',
	},
	'knockdown': {
		name: '击倒',
		summary: '该敌人在本回合受到的来自其他玩家的伤害变为X倍。',
	},
	'magic-bomb': {
		name: '魔法炸弹',
		summary: '在你的回合结束时受到20点伤害。如果魔法骑士死亡，消除这一效果。',
	},
	'mind-rot': {
		name: '心灵腐化',
		summary: '每回合少抽1张牌。',
	},
	'neurosurge': {
		name: '精神过载',
		summary: '在你的回合开始时，给予自身3层灾厄。',
	},
	'no-block': {
		name: '不可格挡',
		summary: '你无法从卡牌中获得格挡。',
	},
	'no-draw': {
		name: '不可抽牌',
		summary: '你在本回合无法再抽更多牌。',
	},
	'no-energy-gain': {
		name: '无法获得能量',
		summary: '你在本回合无法再获得更多能量。',
	},
	'no-escape': {
		name: '无处可逃',
		summary: '在3个回合后，获得50层灾厄。',
	},
	'oblivion': {
		name: '湮灭',
		summary: '你在本回合内每打出一张牌，就给予该敌人1层灾厄。',
	},
	'plow': {
		name: '横冲直撞',
		summary: '这个生物的生命值第一次下降到150或更低时，将其击晕。',
	},
	'poison': {
		name: '中毒',
		summary: '中毒的生物会在自身回合开始时失去生命。中毒层数每回合减少1。',
	},
	'ringing': {
		name: '昏眩',
		summary: '本回合你只能打出1张牌。',
	},
	'scrutiny': {
		name: '细看',
		summary: '在你的回合内你无法额外抽牌。',
	},
	'shriek': {
		name: '尖叫',
		summary: '这个生物的生命值第一次降到50%或以下时，会被击晕。',
	},
	'shrink': {
		name: '缩小',
		summary: '这个生物的攻击伤害在3回合内减少30%。',
	},
	'sic-em': {
		name: '紧追不放',
		summary: '本回合，每当奥斯提命中这个敌人时，召唤3。',
	},
	'sloth': {
		name: '懒惰',
		summary: '你在每个回合不能打出超过3张牌。',
	},
	'slow': {
		name: '缓慢',
		summary: '你在本回合内每打出一张牌，该敌人本回合从攻击牌中受到的伤害增加10%。',
	},
	'smoggy': {
		name: '烟雾弥漫',
		summary: '每回合你只能打出1张技能牌。',
	},
	'soul-wither': {
		name: '灵魂枯萎',
		summary: '在灵魂枢纽对你造成未被格挡的伤害9次之后，对你造成999伤害。',
	},
	'strangle': {
		name: '紧勒',
		summary: '本回合，你每次打出牌时，这名敌人失去2点生命。',
	},
	'surrounded': {
		name: '遭到包围',
		summary: '被从后方攻击时受到的伤害增加50%。使用有目标的卡牌或药水来改变你的朝向。',
	},
	'tag-team': {
		name: '多人组队',
		summary: '另一名玩家对该敌人的下一张攻击牌会多打出X次。',
	},
	'tangled': {
		name: '缠结',
		summary: '本回合，攻击牌的能量费用增加1。',
	},
	'tender': {
		name: '柔嫩',
		summary: '本回合，你每打出一张牌，就失去1点力量和1点敏捷。',
	},
	'tezcataras-blight': {
		name: '特兹卡特拉的荒疫',
		summary: '在本回合结束时，失去1点力量。',
	},
	'the-gambit': {
		name: '孤注一掷',
		summary: '如果你在这场战斗中受到未被格挡的攻击伤害，则立即死亡。',
	},
	'torn': {
		name: '破裂',
		summary: '每回合少抽1张牌。',
	},
	'unstable': {
		name: '不稳定',
		summary: '你每打出一张攻击牌，这个敌人失去5点生命。',
	},
	'unsteady': {
		name: '脚下不稳',
		summary: '当连枷骑士的生命值下降到50%以下时，会被击晕。',
	},
	'vulnerable': {
		name: '易伤',
		summary: '易伤的生物从攻击中受到的伤害增加50%。',
	},
	'waste-away': {
		name: '衰朽',
		summary: '每回合获得的能量减少1点。',
	},
	'weak': {
		name: '虚弱',
		summary: '虚弱的生物造成的攻击伤害减少25%。',
	},
	'wraith-form': {
		name: '幽魂形态',
		summary: '在你的回合开始时，失去1点敏捷。',
	},
};
