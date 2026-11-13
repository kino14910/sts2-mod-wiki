<script lang="ts">
	import type { CardView } from '#lib/data/cards'
	import { keywordPlacement } from '#lib/data/localize'
	import { CHARACTER_ASSETS } from '#lib/data/mods'
	import GameText from '#lib/components/GameText.svelte'
	import type { GameTextOptions } from '#lib/text/game-text'

	let {
		card,
		upgraded = false,
		variant = 'article',
		class: className = ''
	}: {
		card: CardView
		upgraded?: boolean
		variant?: 'article' | 'face'
		class?: string
	} = $props()

	let assets = $derived(CHARACTER_ASSETS[card.color])
	let keywordLines = $derived(keywordPlacement(card.keywords))

	let textOptions = $derived<GameTextOptions>({
		upgraded,
		variables: card.variables,
		baseVariables: card.baseVariables,
		sizeUnit: 'px',
		energyIconSrc: assets?.textEnergy,
		secondEnergyIconSrc: assets?.secondTextEnergy
	})

	const keywordOptions: GameTextOptions = { sizeUnit: 'px', matchEntities: false }
</script>

<div
	class={[
		'card-desc max-w-[82ch] [font-family:var(--font-game,var(--font-display))] text-[1.125rem] leading-[1.2] text-(--cream,#fff6e2) text-pretty',
		variant === 'face' &&
			'card-desc-face max-w-none text-[clamp(9px,5.9cqw,16px)] font-[350] leading-[1.15] tracking-[-0.01rem] text-[oldlace] text-center [text-shadow:2px_1px_0_oklch(0.3_0.02_112)]',
		className
	]}
>
	{#each keywordLines.before as line (line)}
		<p class="desc-keyword"><GameText text={line} options={keywordOptions} /></p>
	{/each}
	<p class="desc-body whitespace-pre-line"><GameText text={card.text ?? ''} options={textOptions} /></p>
	{#each keywordLines.after as line (line)}
		<p class="desc-keyword"><GameText text={line} options={keywordOptions} /></p>
	{/each}
</div>

<style>
	.card-desc :global(.sts-energy-icon) {
		display: inline-block;
		height: 1.05em;
		width: auto;
		margin: 0 0.03em;
		vertical-align: -0.15em;
	}

	.card-desc-face :global(.wiki-icon-link) {
		display: none;
	}

	.card-desc-face :global(a.wiki-card-link) {
		color: inherit;
	}

	.card-desc :global(.custom-tooltip) {
		width: max-content;
		max-width: 16dvw;
	}

	@media (max-width: 640px) {
		.card-desc:not(.card-desc-face) {
			font-size: 1rem;
		}
	}

	@media (max-width: 420px) {
		.card-desc:not(.card-desc-face) {
			font-size: 0.95rem;
		}
	}
</style>
