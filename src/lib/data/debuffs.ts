import type { GlossaryEntry } from './glossary';

/** Slay the Spire 2 debuffs, sourced from static/localization. */
export const DEBUFFS: GlossaryEntry[] = [
	{
		id: 'biased-cognition',
		name: 'Biased Cognition',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/biased_cognition_power.png',
		summary: 'At the start of your turn, lose 1 Focus.',
		motif: 'spiral'
	},
	{
		id: 'borrowed-time',
		name: 'Borrowed Time',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/borrowed_time_power.png',
		summary: 'Cards cost an additional Energy this turn.',
		detail: 'Cards cost an additional X Energy this turn.',
		motif: 'spiral'
	},
	{
		id: 'chains-of-binding',
		name: 'Chains of Binding',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/chains_of_binding_power.png',
		summary: 'The first 3 cards drawn each turn are Afflicted with Bound.',
		motif: 'spiral'
	},
	{
		id: 'confused',
		name: 'Confused',
		kind: 'debuff',
		group: 'Does not stack',
		stack: 'NoStack',
		icon: '/images/powers/confused_power.png',
		summary: 'The costs of your cards are randomized on draw, from 0 to 3.',
		motif: 'spiral'
	},
	{
		id: 'conqueror',
		name: 'Conqueror',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/conqueror_power.png',
		summary: 'Sovereign Blade deals double damage to the enemy this turn.',
		detail: 'Sovereign Blade deals double damage to this creature for the next X turns.',
		motif: 'spiral'
	},
	{
		id: 'constrict',
		name: 'Constrict',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/constrict_power.png',
		summary: 'While the Slithering Strangler is alive, at the end of your turn, take 1 damage.',
		motif: 'spiral'
	},
	{
		id: 'dampen',
		name: 'Dampen',
		kind: 'debuff',
		group: 'Does not stack',
		stack: 'NoStack',
		icon: '/images/powers/dampen_power.png',
		summary: 'While Magi Knight is alive, ALL your cards are Downgraded.',
		motif: 'spiral'
	},
	{
		id: 'debilitate',
		name: 'Debilitate',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/debilitate_power.png',
		summary: 'Vulnerable and Weak are twice as effective for the next 2 turns.',
		motif: 'spiral'
	},
	{
		id: 'demise',
		name: 'Demise',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/demise_power.png',
		summary: 'At the end of this creature\'s turn, it loses X HP.',
		motif: 'spiral'
	},
	{
		id: 'dexterity-down',
		name: 'Dexterity Down',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/dexterity_down_power.png',
		summary: 'At the end of this turn, lose Dexterity.',
		detail: 'At the end of this turn, lose X Dexterity.',
		motif: 'spiral'
	},
	{
		id: 'disintegration',
		name: 'Disintegration',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/disintegration_power.png',
		summary: 'At the end of your turn, take 5 damage.',
		motif: 'spiral'
	},
	{
		id: 'doom',
		name: 'Doom',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/doom_power.png',
		summary: 'At the end of the enemy turn, if it has at least as much Doom as HP, it dies.',
		detail: 'At the end of the player turn, if this creature has X or less HP, it dies.',
		motif: 'spiral'
	},
	{
		id: 'flanking',
		name: 'Flanking',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/flanking_power.png',
		summary: 'Other allies deal 2x more attack damage to this enemy this turn.',
		motif: 'spiral'
	},
	{
		id: 'focus-down',
		name: 'Focus Down',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		summary: 'At the end of this turn, lose 1 Focus.',
		motif: 'spiral'
	},
	{
		id: 'frail',
		name: 'Frail',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/frail_power.png',
		summary: 'While Frail, gain 25% less Block from cards.',
		motif: 'spiral'
	},
	{
		id: 'grasp',
		name: 'Grasp',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/grasp_power.png',
		summary: 'Whenever you play a card, lose 1 Energy.',
		motif: 'spiral'
	},
	{
		id: 'hang',
		name: 'Hang',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/hang_power.png',
		summary: 'All Hangs deal 2 times more damage to this enemy.',
		motif: 'spiral'
	},
	{
		id: 'hex',
		name: 'Hex',
		kind: 'debuff',
		group: 'Does not stack',
		stack: 'NoStack',
		icon: '/images/powers/hex_power.png',
		summary: 'While Spectral Knight is alive, ALL your cards are Ethereal.',
		motif: 'spiral'
	},
	{
		id: 'hunger',
		name: 'Hunger',
		kind: 'debuff',
		group: 'Does not stack',
		stack: 'NoStack',
		icon: '/images/powers/hunger_power.png',
		summary: 'Whenever you play an Attack or Skill, it is Exhausted.',
		motif: 'spiral'
	},
	{
		id: 'imbalanced',
		name: 'Imbalanced',
		kind: 'debuff',
		group: 'Does not stack',
		stack: 'NoStack',
		icon: '/images/powers/imbalanced_power.png',
		summary: 'If this creature\'s attacks are fully blocked by any player, it becomes Stunned.',
		motif: 'spiral'
	},
	{
		id: 'inked',
		name: 'Inked',
		kind: 'debuff',
		group: 'Does not stack',
		stack: 'NoStack',
		summary: 'This creature takes 2 additional damage from Attacks.',
		motif: 'spiral'
	},
	{
		id: 'knockdown',
		name: 'Knockdown',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/knockdown_power.png',
		summary: 'This creature takes X times the damage from other players this turn.',
		motif: 'spiral'
	},
	{
		id: 'magic-bomb',
		name: 'Magic Bomb',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/magic_bomb_power.png',
		summary: 'Take 20 damage at the end of your turn. Is cleared if the Magi Knight dies.',
		motif: 'spiral'
	},
	{
		id: 'mind-rot',
		name: 'Mind Rot',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/mind_rot_power.png',
		summary: 'Draw 1 fewer card each turn.',
		motif: 'spiral'
	},
	{
		id: 'neurosurge',
		name: 'Neurosurge',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/neurosurge_power.png',
		summary: 'At the start of your turn, apply 3 Doom to yourself.',
		motif: 'spiral'
	},
	{
		id: 'no-block',
		name: 'No Block',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/no_block_power.png',
		summary: 'You cannot gain Block from cards.',
		detail: 'You cannot gain Block from cards for X turns.',
		motif: 'spiral'
	},
	{
		id: 'no-draw',
		name: 'No Draw',
		kind: 'debuff',
		group: 'Does not stack',
		stack: 'NoStack',
		icon: '/images/powers/no_draw_power.png',
		summary: 'You may not draw any more cards this turn.',
		motif: 'spiral'
	},
	{
		id: 'no-energy-gain',
		name: 'No Energy Gain',
		kind: 'debuff',
		group: 'Does not stack',
		stack: 'NoStack',
		icon: '/images/powers/no_energy_gain_power.png',
		summary: 'You cannot gain additional Energy this turn.',
		motif: 'spiral'
	},
	{
		id: 'no-escape',
		name: 'No Escape',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		summary: 'At the end of 3 turns, gains 50 Doom.',
		motif: 'spiral'
	},
	{
		id: 'oblivion',
		name: 'Oblivion',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/oblivion_power.png',
		summary: 'Whenever you play a card, this enemy gains 1 Doom.',
		motif: 'spiral'
	},
	{
		id: 'plow',
		name: 'Plow',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/plow_power.png',
		summary: 'The first time this creature\'s HP reaches 150 or below, it becomes Stunned.',
		motif: 'spiral'
	},
	{
		id: 'poison',
		name: 'Poison',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/poison_power.png',
		summary: 'Poisoned creatures lose HP at the start of their turn. Each turn, Poison is reduced by 1.',
		motif: 'spiral'
	},
	{
		id: 'ringing',
		name: 'Ringing',
		kind: 'debuff',
		group: 'Does not stack',
		stack: 'NoStack',
		icon: '/images/powers/ringing_power.png',
		summary: 'You can only play 1 card this turn.',
		motif: 'spiral'
	},
	{
		id: 'scrutiny',
		name: 'Scrutiny',
		kind: 'debuff',
		group: 'Does not stack',
		stack: 'NoStack',
		icon: '/images/powers/scrutiny_power.png',
		summary: 'You cannot draw additional cards during your turn.',
		motif: 'spiral'
	},
	{
		id: 'shriek',
		name: 'Shriek',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/shriek_power.png',
		summary: 'The first time this creature\'s HP reaches 50% or below, it becomes Stunned.',
		motif: 'spiral'
	},
	{
		id: 'shrink',
		name: 'Shrink',
		kind: 'debuff',
		group: 'Does not stack',
		stack: 'NoStack',
		icon: '/images/powers/shrink_power.png',
		summary: 'This creature\'s Attacks deal 30% less damage for the next 3 turns.',
		motif: 'spiral'
	},
	{
		id: 'sic-em',
		name: 'Sic \'Em',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/sic_em_power.png',
		summary: 'Whenever Osty hits this enemy this turn, Summon 3.',
		motif: 'spiral'
	},
	{
		id: 'sloth',
		name: 'Sloth',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/sloth_power.png',
		summary: 'You cannot play more than 3 cards each turn.',
		motif: 'spiral'
	},
	{
		id: 'slow',
		name: 'Slow',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/slow_power.png',
		summary: 'Whenever you play a card, this enemy receives 10% more damage from Attacks this turn.',
		motif: 'spiral'
	},
	{
		id: 'smoggy',
		name: 'Smoggy',
		kind: 'debuff',
		group: 'Does not stack',
		stack: 'NoStack',
		icon: '/images/powers/smoggy_power.png',
		summary: 'You can only play 1 Skill per turn.',
		motif: 'spiral'
	},
	{
		id: 'soul-wither',
		name: 'Soul Wither',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		summary: 'After Soul Nexus deals unblocked attack damage to you 9 times, it deals 999 damage to you.',
		motif: 'spiral'
	},
	{
		id: 'strangle',
		name: 'Strangle',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/strangle_power.png',
		summary: 'Whenever you play a card this turn, this enemy loses 2 HP.',
		motif: 'spiral'
	},
	{
		id: 'surrounded',
		name: 'Surrounded',
		kind: 'debuff',
		group: 'Does not stack',
		stack: 'NoStack',
		icon: '/images/powers/surrounded_power.png',
		summary: 'Receive 50% more damage if attacked from behind. Use targeting cards or potions to change your orientation.',
		motif: 'spiral'
	},
	{
		id: 'tag-team',
		name: 'Tag Team',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/tag_team_power.png',
		summary: 'The next Attack another player plays on the enemy is played X extra times.',
		motif: 'spiral'
	},
	{
		id: 'tangled',
		name: 'Tangled',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/tangled_power.png',
		summary: 'Attacks cost 1 additional Energy this turn.',
		motif: 'spiral'
	},
	{
		id: 'tender',
		name: 'Tender',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/tender_power.png',
		summary: 'Whenever you play a card, lose 1 Strength and 1 Dexterity this turn.',
		motif: 'spiral'
	},
	{
		id: 'tezcataras-blight',
		name: 'Tezcataras Blight',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		summary: 'At the end of this turn, lose 1 Strength.',
		motif: 'spiral'
	},
	{
		id: 'the-gambit',
		name: 'The Gambit',
		kind: 'debuff',
		group: 'Does not stack',
		stack: 'NoStack',
		icon: '/images/powers/the_gambit_power.png',
		summary: 'If you take unblocked attack damage this combat, die.',
		motif: 'spiral'
	},
	{
		id: 'torn',
		name: 'Torn',
		kind: 'debuff',
		group: 'Does not stack',
		stack: 'NoStack',
		summary: 'Draw 1 fewer card every turn.',
		motif: 'spiral'
	},
	{
		id: 'unstable',
		name: 'Unstable',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		summary: 'Whenever you play an Attack, this enemy loses 5 HP.',
		motif: 'spiral'
	},
	{
		id: 'unsteady',
		name: 'Unsteady',
		kind: 'debuff',
		group: 'Does not stack',
		stack: 'NoStack',
		summary: 'When Flail Knight falls below 50% HP, becomes Stunned.',
		motif: 'spiral'
	},
	{
		id: 'vulnerable',
		name: 'Vulnerable',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/vulnerable_power.png',
		summary: 'Vulnerable creatures take 50% more damage from Attacks.',
		motif: 'spiral'
	},
	{
		id: 'waste-away',
		name: 'Waste Away',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/waste_away_power.png',
		summary: 'Gain 1 less Energy per turn.',
		motif: 'spiral'
	},
	{
		id: 'weak',
		name: 'Weak',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/weak_power.png',
		summary: 'Weakened creatures deal 25% less damage with Attacks.',
		motif: 'spiral'
	},
	{
		id: 'wraith-form',
		name: 'Wraith Form',
		kind: 'debuff',
		group: 'Counter',
		stack: 'Counter',
		icon: '/images/powers/wraith_form_power.png',
		summary: 'At the start of your turn, lose 1 Dexterity.',
		motif: 'spiral'
	},
];
