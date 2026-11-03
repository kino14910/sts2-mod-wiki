export type ColorId = 'ironclad' | 'silent' | 'regent' | 'necrobinder' | 'defect' | 'colorless';
export type CardType = 'attack' | 'skill' | 'power' | 'status' | 'curse' | 'quest';
export type Rarity = 'basic' | 'common' | 'uncommon' | 'rare' | 'ancient' | 'event' | 'token';
export type MotifName =
	| 'blade'
	| 'flame'
	| 'crown'
	| 'star'
	| 'moon'
	| 'skull'
	| 'web'
	| 'orb'
	| 'shard'
	| 'gear'
	| 'eye'
	| 'spiral'
	| 'thorn'
	| 'feather'
	| 'shield';

export interface ModInfo {
	id: string;
	name: string;
	author: string;
	blurb: string;
	accent: string;
}

export interface Card {
	id: string;
	name: string;
	mod: string;
	color: ColorId;
	type: CardType;
	rarity: Rarity;
	cost: number | 'X' | null;
	text: string;
	upgradedText: string;
	upgradedCost?: number | 'X' | null;
	keywords: string[];
	flavor: string;
	art: MotifName;
	image?: string;
	featured?: boolean;
}

export const COLORS: Record<ColorId, { name: string; short: string; accent: string; motif: MotifName }> = {
	ironclad: { name: 'Ironclad', short: 'IC', accent: '#c65a42', motif: 'flame' },
	silent: { name: 'Silent', short: 'SL', accent: '#55a47c', motif: 'feather' },
	regent: { name: 'Regent', short: 'RG', accent: '#d5aa5b', motif: 'crown' },
	necrobinder: { name: 'Necrobinder', short: 'NB', accent: '#9a73c9', motif: 'skull' },
	defect: { name: 'Defect', short: 'DF', accent: '#5aa9c9', motif: 'orb' },
	colorless: { name: 'Colorless', short: 'CL', accent: '#a6a199', motif: 'star' }
};

export const CARD_TYPES: Record<CardType, { name: string; plural: string }> = {
	attack: { name: 'Attack', plural: 'Attacks' },
	skill: { name: 'Skill', plural: 'Skills' },
	power: { name: 'Power', plural: 'Powers' },
	status: { name: 'Status', plural: 'Statuses' },
	curse: { name: 'Curse', plural: 'Curses' },
	quest: { name: 'Quest', plural: 'Quests' }
};

export const RARITIES: Record<Rarity, { name: string; color: string }> = {
	basic: { name: 'Basic', color: '#9aa6a4' },
	common: { name: 'Common', color: '#b7c3c0' },
	uncommon: { name: 'Uncommon', color: '#75b2c4' },
	rare: { name: 'Rare', color: '#e3c06f' },
	ancient: { name: 'Ancient', color: '#b98bd9' },
	event: { name: 'Event', color: '#8fc78d' },
	token: { name: 'Token', color: '#d4a56e' }
};

export const MODS: ModInfo[] = [
	{
		id: 'wayfarers-gambit',
		name: "Wayfarer's Gambit",
		author: 'Salt & Cinder',
		blurb: 'A wandering blade and a quiet knife, rewriting the road one fight at a time.',
		accent: '#c65a42'
	},
	{
		id: 'sunless-court',
		name: 'Sunless Court',
		author: 'Vesper',
		blurb: 'A court that never sees morning, where stars are currency and graves answer back.',
		accent: '#9a73c9'
	},
	{
		id: 'mechanical-bloom',
		name: 'Mechanical Bloom',
		author: 'Mossline',
		blurb: 'Glass gardens, storm engines, and a machine learning how to want.',
		accent: '#5aa9c9'
	}
];

export const CARDS: Card[] = [
	// Wayfarer's Gambit — Ironclad & Silent
	{
		id: 'ember-lance',
		name: 'Ember Lance',
		mod: 'wayfarers-gambit',
		color: 'ironclad',
		type: 'attack',
		rarity: 'common',
		cost: 1,
		text: 'Deal 9 damage. If you have Strength, deal 3 additional damage.',
		upgradedText: 'Deal 12 damage. If you have Strength, deal 4 additional damage.',
		keywords: ['strength'],
		flavor: 'The ember remembers every hand that fed it.',
		art: 'blade'
	},
	{
		id: 'ashen-bulwark',
		name: 'Ashen Bulwark',
		mod: 'wayfarers-gambit',
		color: 'ironclad',
		type: 'skill',
		rarity: 'uncommon',
		cost: 2,
		text: 'Gain 11 Block. At the end of your turn, gain 3 Block. Exhaust.',
		upgradedText: 'Gain 15 Block. At the end of your turn, gain 4 Block. Exhaust.',
		keywords: ['block', 'exhaust'],
		flavor: 'What survives the fire becomes the wall.',
		art: 'flame',
		featured: true
	},
	{
		id: 'crimson-ledger',
		name: 'Crimson Ledger',
		mod: 'wayfarers-gambit',
		color: 'ironclad',
		type: 'power',
		rarity: 'rare',
		cost: 1,
		text: 'Whenever you lose HP from a card, gain 1 Strength.',
		upgradedText: 'Innate. Whenever you lose HP from a card, gain 1 Strength.',
		keywords: ['strength', 'innate'],
		flavor: 'Every debt is written in the same ink.',
		art: 'thorn'
	},
	{
		id: 'last-ember',
		name: 'Last Ember',
		mod: 'wayfarers-gambit',
		color: 'ironclad',
		type: 'attack',
		rarity: 'rare',
		cost: 2,
		text: 'Deal 6 damage 3 times. Fatal: gain 2 Strength. Exhaust.',
		upgradedText: 'Deal 8 damage 3 times. Fatal: gain 3 Strength. Exhaust.',
		keywords: ['fatal', 'strength', 'exhaust'],
		flavor: 'It only needs to burn once more.',
		art: 'flame',
		featured: true
	},
	{
		id: 'nightloom',
		name: 'Nightloom',
		mod: 'wayfarers-gambit',
		color: 'silent',
		type: 'skill',
		rarity: 'common',
		cost: 1,
		text: 'Apply 3 Poison. Draw 1 card.',
		upgradedText: 'Apply 4 Poison. Draw 1 card.',
		keywords: ['poison'],
		flavor: 'The garden grows while the world sleeps.',
		art: 'moon'
	},
	{
		id: 'sly-gambit',
		name: 'Sly Gambit',
		mod: 'wayfarers-gambit',
		color: 'silent',
		type: 'skill',
		rarity: 'uncommon',
		cost: 0,
		text: 'Sly. Deal 7 damage. Apply 1 Weak.',
		upgradedText: 'Sly. Deal 9 damage. Apply 2 Weak.',
		keywords: ['sly', 'weak'],
		flavor: 'A blade thrown from the shadows still counts.',
		art: 'feather',
		featured: true
	},
	{
		id: 'venom-choir',
		name: 'Venom Choir',
		mod: 'wayfarers-gambit',
		color: 'silent',
		type: 'power',
		rarity: 'rare',
		cost: 2,
		text: 'Whenever you apply Poison, apply 1 additional Poison.',
		upgradedText: 'Whenever you apply Poison, apply 2 additional Poison.',
		keywords: ['poison'],
		flavor: 'Every throat in the choir sings the same venom.',
		art: 'web'
	},
	{
		id: 'thousand-fangs',
		name: 'Thousand Fangs',
		mod: 'wayfarers-gambit',
		color: 'silent',
		type: 'attack',
		rarity: 'uncommon',
		cost: 2,
		text: 'Deal 4 damage 4 times to random enemies. Fatal: draw 1 card.',
		upgradedText: 'Deal 5 damage 4 times to random enemies. Fatal: draw 2 cards.',
		keywords: ['fatal'],
		flavor: 'You only see one mouth. That is the trick.',
		art: 'thorn'
	},

	// Sunless Court — Regent & Necrobinder
	{
		id: 'starfall-edict',
		name: 'Starfall Edict',
		mod: 'sunless-court',
		color: 'regent',
		type: 'attack',
		rarity: 'rare',
		cost: 2,
		text: 'Spend 3 Stars. Deal 18 damage to ALL enemies.',
		upgradedText: 'Spend 3 Stars. Deal 24 damage to ALL enemies.',
		keywords: ['stars'],
		flavor: 'The sky is a ledger, and the court collects.',
		art: 'star',
		featured: true
	},
	{
		id: 'gilded-aegis',
		name: 'Gilded Aegis',
		mod: 'sunless-court',
		color: 'regent',
		type: 'skill',
		rarity: 'uncommon',
		cost: 1,
		text: 'Gain 8 Block. Gain 2 Stars.',
		upgradedText: 'Gain 11 Block. Gain 2 Stars.',
		keywords: ['block', 'stars'],
		flavor: 'Gold remembers the shape of every blow.',
		art: 'crown'
	},
	{
		id: 'forge-the-heavens',
		name: 'Forge the Heavens',
		mod: 'sunless-court',
		color: 'regent',
		type: 'skill',
		rarity: 'rare',
		cost: 1,
		text: 'Forge 5. Draw 1 card.',
		upgradedText: 'Forge 8. Draw 1 card.',
		keywords: ['forge'],
		flavor: 'A blade is only a promise until it is held.',
		art: 'blade'
	},
	{
		id: 'royal-decree',
		name: 'Royal Decree',
		mod: 'sunless-court',
		color: 'regent',
		type: 'skill',
		rarity: 'common',
		cost: 1,
		text: 'Gain 2 Stars. Next turn, gain 1 Energy. Exhaust.',
		upgradedText: 'Gain 3 Stars. Next turn, gain 1 Energy. Exhaust.',
		keywords: ['stars', 'energy', 'exhaust'],
		flavor: 'The court does not ask twice.',
		art: 'crown'
	},
	{
		id: 'doom-toll',
		name: 'Doom Toll',
		mod: 'sunless-court',
		color: 'necrobinder',
		type: 'skill',
		rarity: 'common',
		cost: 1,
		text: 'Apply 6 Doom. If the enemy dies this turn, gain 1 Energy.',
		upgradedText: 'Apply 9 Doom. If the enemy dies this turn, gain 1 Energy.',
		keywords: ['doom', 'energy'],
		flavor: 'Every bell is a small, punctual apocalypse.',
		art: 'skull'
	},
	{
		id: 'bone-choir',
		name: 'Bone Choir',
		mod: 'sunless-court',
		color: 'necrobinder',
		type: 'power',
		rarity: 'uncommon',
		cost: 2,
		text: 'Whenever you Summon, deal 3 damage to ALL enemies.',
		upgradedText: 'Whenever you Summon, deal 5 damage to ALL enemies.',
		keywords: ['summon'],
		flavor: 'The dead hum in a key that living ears forget.',
		art: 'skull',
		featured: true
	},
	{
		id: 'ostys-grasp',
		name: "Osty's Grasp",
		mod: 'sunless-court',
		color: 'necrobinder',
		type: 'attack',
		rarity: 'common',
		cost: 1,
		text: 'Deal 7 damage. Summon 2.',
		upgradedText: 'Deal 10 damage. Summon 3.',
		keywords: ['summon'],
		flavor: 'He is not gentle. He is simply loyal.',
		art: 'thorn'
	},
	{
		id: 'grave-pact',
		name: 'Grave Pact',
		mod: 'sunless-court',
		color: 'necrobinder',
		type: 'skill',
		rarity: 'rare',
		cost: 1,
		text: 'Lose 3 HP. Gain 2 Energy. Exhaust.',
		upgradedText: 'Lose 2 HP. Gain 2 Energy. Exhaust.',
		keywords: ['energy', 'exhaust'],
		flavor: 'The grave is patient. The debt is not.',
		art: 'spiral'
	},

	// Mechanical Bloom — Defect & Colorless
	{
		id: 'frost-array',
		name: 'Frost Array',
		mod: 'mechanical-bloom',
		color: 'defect',
		type: 'skill',
		rarity: 'uncommon',
		cost: 1,
		text: 'Channel 2 Frost. Gain 4 Block.',
		upgradedText: 'Channel 3 Frost. Gain 5 Block.',
		keywords: ['channel', 'frost', 'block'],
		flavor: 'Cold is only a structure the machine understands.',
		art: 'shard'
	},
	{
		id: 'ion-storm',
		name: 'Ion Storm',
		mod: 'mechanical-bloom',
		color: 'defect',
		type: 'power',
		rarity: 'rare',
		cost: 2,
		text: 'At the start of your turn, Channel 1 Lightning.',
		upgradedText: 'At the start of your turn, Channel 2 Lightning.',
		keywords: ['channel', 'lightning'],
		flavor: 'The forecast is a promise made of static.',
		art: 'orb',
		featured: true
	},
	{
		id: 'focus-lens',
		name: 'Focus Lens',
		mod: 'mechanical-bloom',
		color: 'defect',
		type: 'skill',
		rarity: 'common',
		cost: 1,
		text: 'Gain 2 Focus. Draw 1 card.',
		upgradedText: 'Gain 3 Focus. Draw 1 card.',
		keywords: ['focus'],
		flavor: 'Clarity is a machine you build inside yourself.',
		art: 'eye'
	},
	{
		id: 'glass-requiem',
		name: 'Glass Requiem',
		mod: 'mechanical-bloom',
		color: 'defect',
		type: 'attack',
		rarity: 'rare',
		cost: 2,
		text: 'Evoke all Orbs. Deal 4 damage to ALL enemies for each Orb Evoked.',
		upgradedText: 'Evoke all Orbs. Deal 6 damage to ALL enemies for each Orb Evoked.',
		keywords: ['evoke', 'orbs'],
		flavor: 'When the garden shatters, every pane sings.',
		art: 'shard',
		featured: true
	},
	{
		id: 'prismatic-bloom',
		name: 'Prismatic Bloom',
		mod: 'mechanical-bloom',
		color: 'colorless',
		type: 'skill',
		rarity: 'rare',
		cost: 1,
		text: 'Channel 1 Glass, 1 Plasma, and 1 Dark. Exhaust.',
		upgradedText: 'Channel 2 Glass, 2 Plasma, and 2 Dark. Exhaust.',
		keywords: ['channel', 'glass', 'plasma', 'dark', 'exhaust'],
		flavor: 'A flower with too many colors to name.',
		art: 'orb'
	},
	{
		id: 'null-pulse',
		name: 'Null Pulse',
		mod: 'mechanical-bloom',
		color: 'colorless',
		type: 'skill',
		rarity: 'uncommon',
		cost: 0,
		text: 'Remove all Block from ALL enemies. Draw 1 card. Exhaust.',
		upgradedText: 'Remove all Block from ALL enemies. Draw 2 cards. Exhaust.',
		keywords: ['block', 'exhaust'],
		flavor: 'The signal does not arrive. Nothing follows.',
		art: 'spiral'
	},
	{
		id: 'echo-chamber',
		name: 'Echo Chamber',
		mod: 'mechanical-bloom',
		color: 'colorless',
		type: 'power',
		rarity: 'rare',
		cost: 2,
		upgradedCost: 1,
		text: 'The first card you play each turn is played an extra time.',
		upgradedText: 'The first card you play each turn is played an extra time.',
		keywords: ['replay'],
		flavor: 'Once is never quite enough.',
		art: 'web'
	},
	{
		id: 'enigma-codex',
		name: 'Enigma Codex',
		mod: 'mechanical-bloom',
		color: 'colorless',
		type: 'skill',
		rarity: 'rare',
		cost: 3,
		upgradedCost: 2,
		text: 'Choose 1 of 3 Rare cards to add to your hand. Exhaust.',
		upgradedText: 'Choose 1 of 3 Rare cards to add to your hand. Exhaust.',
		keywords: ['exhaust'],
		flavor: 'Every answer is a question wearing a better coat.',
		art: 'eye',
		featured: true
	},
	{
		id: 'kindled-spark',
		name: 'Kindled Spark',
		mod: 'wayfarers-gambit',
		color: 'ironclad',
		type: 'attack',
		rarity: 'basic',
		cost: 1,
		text: 'Deal 6 damage.',
		upgradedText: 'Deal 9 damage.',
		keywords: [],
		flavor: 'Every fire starts smaller than the hand that holds it.',
		art: 'flame'
	},
	{
		id: 'fading-echo',
		name: 'Fading Echo',
		mod: 'mechanical-bloom',
		color: 'colorless',
		type: 'skill',
		rarity: 'rare',
		cost: 'X',
		text: 'Draw X cards. Exhaust.',
		upgradedText: 'Draw X+1 cards. Exhaust.',
		keywords: ['exhaust'],
		flavor: 'The last word, repeated until it means nothing.',
		art: 'spiral'
	},
	{
		id: 'sealed-scroll',
		name: 'Sealed Scroll',
		mod: 'sunless-court',
		color: 'colorless',
		type: 'quest',
		rarity: 'event',
		cost: null,
		text: 'Unplayable. Complete this quest to add a random Rare card to your hand.',
		upgradedText: 'Unplayable. Complete this quest to add a random Rare card to your hand.',
		keywords: ['unplayable'],
		flavor: 'The wax is still warm.',
		art: 'web'
	},
	{
		id: 'scrap-plating',
		name: 'Scrap Plating',
		mod: 'mechanical-bloom',
		color: 'colorless',
		type: 'status',
		rarity: 'common',
		cost: null,
		text: 'Unplayable. At the end of your turn, lose 2 HP.',
		upgradedText: 'Unplayable. At the end of your turn, lose 2 HP.',
		keywords: ['unplayable'],
		flavor: 'It was part of the machine once.',
		art: 'gear'
	},
	{
		id: 'hollow-relic',
		name: 'Hollow Relic',
		mod: 'sunless-court',
		color: 'colorless',
		type: 'curse',
		rarity: 'ancient',
		cost: null,
		text: 'Unplayable. Whenever you draw this, lose 1 Energy.',
		upgradedText: 'Unplayable. Whenever you draw this, lose 1 Energy.',
		keywords: ['unplayable', 'energy'],
		flavor: 'It asks for more the longer you keep it.',
		art: 'spiral'
	},
	{
		id: 'sovereign-blade',
		name: 'Sovereign Blade',
		mod: 'sunless-court',
		color: 'colorless',
		type: 'attack',
		rarity: 'token',
		cost: 0,
		text: 'Deal 10 damage. Exhaust.',
		upgradedText: 'Deal 14 damage. Exhaust.',
		keywords: ['exhaust'],
		flavor: "A king's promise, sharpened.",
		art: 'blade'
	}
];

export const MOD_BY_ID = new Map(MODS.map((mod) => [mod.id, mod]));

export const FEATURED_CARDS = CARDS.filter((card) => card.featured);

export function cardsByMod(modId: string) {
	return CARDS.filter((card) => card.mod === modId);
}

export function cardHref(card: Card) {
	return `/cards/${card.id}`;
}

export function isUpgradable(card: Card) {
	return card.upgradedText !== card.text || card.upgradedCost !== undefined;
}
