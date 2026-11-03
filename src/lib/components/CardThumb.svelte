<script lang="ts">
	import { COLORS, RARITIES, type Card, type CardType } from '#lib/data/cards';
	import { rarityName, typeName } from '#lib/data/localize';
	import CardTypeIcon from './CardTypeIcon.svelte';
	import Motif from './Motif.svelte';

	interface FrameSpec {
		src: string;
		art: { left: string; top: string; width: string; height: string };
	}

	// 美术窗口坐标按 598x844 的卡框实测（透明区域边界）。
	const FRAMES: Record<'attack' | 'skill' | 'power' | 'quest', FrameSpec> = {
		attack: {
			src: '/images/card_frames/attack.png',
			art: { left: '8.03%', top: '10.07%', width: '83.11%', height: '44.79%' }
		},
		skill: {
			src: '/images/card_frames/skill.png',
			art: { left: '8.03%', top: '10.07%', width: '83.28%', height: '44.79%' }
		},
		power: {
			src: '/images/card_frames/power.png',
			art: { left: '8.53%', top: '10.31%', width: '82.44%', height: '44.31%' }
		},
		quest: {
			src: '/images/card_frames/quest.png',
			art: { left: '13.19%', top: '14.22%', width: '73.12%', height: '37.09%' }
		}
	};

	const FRAME_TYPE: Record<CardType, keyof typeof FRAMES> = {
		attack: 'attack',
		skill: 'skill',
		power: 'power',
		quest: 'quest',
		status: 'skill',
		curse: 'skill'
	};

	let { card, class: className = '' }: { card: Card; class?: string } = $props();

	let color = $derived(COLORS[card.color]);
	let rarity = $derived(RARITIES[card.rarity]);
	let typeLabel = $derived(typeName(card.type));
	let rarityLabel = $derived(rarityName(card.rarity));
	let cost = $derived(card.cost === null ? '—' : card.cost);
	let frame = $derived(FRAMES[FRAME_TYPE[card.type]]);
</script>

<div
	class="card-thumb {className}"
	style:--accent={color.accent}
	style:--rarity={rarity.color}
>
	<div
		class="art-window"
		style:left={frame.art.left}
		style:top={frame.art.top}
		style:width={frame.art.width}
		style:height={frame.art.height}
	>
		{#if card.image}
			<img class="art-image" src={card.image} alt="" loading="lazy" decoding="async" />
		{:else}
			<div class="art-glow" aria-hidden="true"></div>
			<div class="art-lines" aria-hidden="true"></div>
			<div class="motif"><Motif name={card.art} /></div>
		{/if}
	</div>

	<img class="card-frame" src={frame.src} alt="" aria-hidden="true" />

	<span class="cost" class:is-x={card.cost === 'X'} class:is-empty={card.cost === null}>{cost}</span>

	<div class="thumb-plate">
		<span class="thumb-name">{card.name}</span>
		<span class="thumb-type">
			<CardTypeIcon type={card.type} />
			{typeLabel}
		</span>
		<span class="rarity-gem" title={rarityLabel} aria-label={rarityLabel}></span>
	</div>
</div>

<style>
	.card-thumb {
		container-type: inline-size;
		position: relative;
		display: block;
		width: 100%;
		aspect-ratio: 598 / 844;
	}

	.art-window {
		position: absolute;
		overflow: hidden;
		background:
			radial-gradient(70% 78% at 50% 42%, color-mix(in srgb, var(--accent) 34%, transparent), transparent 70%),
			linear-gradient(160deg, #263238 0%, #12191b 60%, #0b0f10 100%);
	}

	.art-window::after {
		content: '';
		position: absolute;
		inset: 0;
		border: 1px solid color-mix(in srgb, var(--accent) 45%, #4f6668);
		pointer-events: none;
	}

	.art-image {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.art-glow {
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--accent) 28%, transparent), transparent 66%);
	}

	.art-lines {
		position: absolute;
		inset: -20%;
		opacity: 0.13;
		background-image:
			linear-gradient(color-mix(in srgb, var(--accent) 60%, transparent) 1px, transparent 1px),
			linear-gradient(90deg, color-mix(in srgb, var(--accent) 60%, transparent) 1px, transparent 1px);
		background-size: 22cqw 22cqw;
		background-position: center;
		transform: rotate(10deg);
	}

	.motif {
		position: absolute;
		width: 54cqw;
		height: 54cqw;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		color: color-mix(in srgb, var(--accent) 72%, #f7e9c6);
		opacity: 0.88;
		filter: drop-shadow(0 0 10px color-mix(in srgb, var(--accent) 45%, transparent));
	}

	.motif :global(svg) {
		width: 100%;
		height: 100%;
	}

	.card-frame {
		position: absolute;
		inset: 0;
		z-index: 2;
		display: block;
		width: 100%;
		height: 100%;
		pointer-events: none;
		filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.5));
	}

	.cost {
		position: absolute;
		left: 3cqw;
		top: 2.5cqw;
		z-index: 3;
		display: grid;
		place-items: center;
		width: 16cqw;
		height: 16cqw;
		border-radius: 50%;
		border: 1px solid color-mix(in srgb, var(--accent) 66%, #f0e2c0);
		background:
			radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.18), transparent 55%),
			linear-gradient(180deg, #263034, #0c1113);
		font-family: var(--font-display);
		font-size: clamp(7px, 8.4cqw, 21px);
		font-weight: 700;
		line-height: 1;
		color: #f6e6bd;
		box-shadow:
			0 0 0 2px rgba(8, 10, 11, 0.65),
			0 2px 6px rgba(0, 0, 0, 0.6);
	}

	.cost.is-x {
		font-family: var(--font-sans);
		font-style: italic;
		font-size: clamp(6px, 7.2cqw, 18px);
	}

	.cost.is-empty {
		font-size: clamp(5px, 6.2cqw, 15px);
		color: rgba(231, 236, 234, 0.55);
	}

	.thumb-plate {
		position: absolute;
		left: 12%;
		right: 12%;
		top: 58%;
		height: 28%;
		z-index: 3;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2.2cqw;
		text-align: center;
		pointer-events: none;
	}

	.thumb-name {
		font-family: var(--font-display);
		font-size: clamp(6px, 6.1cqw, 15px);
		font-weight: 600;
		line-height: 1.05;
		color: #f0e2bd;
		text-wrap: balance;
		display: -webkit-box;
		line-clamp: 2;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.thumb-type {
		display: flex;
		align-items: center;
		gap: 1.4cqw;
		font-family: var(--font-mono);
		font-size: clamp(4.5px, 3cqw, 8px);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--accent) 60%, #c8d2cf);
	}

	.thumb-type :global(svg) {
		width: 3.8cqw;
		height: 3.8cqw;
	}

	.rarity-gem {
		position: absolute;
		right: 2cqw;
		top: -1.6cqw;
		width: 4.4cqw;
		height: 4.4cqw;
		transform: rotate(45deg);
		border: 1px solid color-mix(in srgb, var(--rarity) 70%, #fff);
		background: var(--rarity);
		box-shadow: 0 0 6px color-mix(in srgb, var(--rarity) 45%, transparent);
	}
</style>
