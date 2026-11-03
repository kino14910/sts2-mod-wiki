<script lang="ts">
	import { COLORS, RARITIES, cardHref, isUpgradable, type Card } from '#lib/data/cards';
	import {
		colorName,
		localizedCard,
		modName,
		rarityName,
		typeName
	} from '#lib/data/localize';
	import { m } from '#lib/paraglide/messages';
	import CardThumb from './CardThumb.svelte';
	import RichText from './RichText.svelte';

	let {
		card,
		upgraded = false,
		showActions = true,
		onupgraded = () => {}
	}: {
		card: Card;
		upgraded?: boolean;
		showActions?: boolean;
		onupgraded?: () => void;
	} = $props();

	let localized = $derived(localizedCard(card));
	let color = $derived(COLORS[card.color]);
	let rarity = $derived(RARITIES[card.rarity]);
	let canUpgrade = $derived(isUpgradable(card));
	let type = $derived(typeName(card.type));
	let colorLabel = $derived(colorName(card.color));
	let rarityLabel = $derived(rarityName(card.rarity));

	let display = $derived(
		upgraded && canUpgrade
			? {
					...localized,
					name: `${localized.name}+`,
					text: localized.upgradedText,
					cost: localized.upgradedCost ?? localized.cost
				}
			: localized
	);
</script>

<article
	class="card-row card-box"
	style:--accent={color.accent}
	data-name={localized.name}
	data-rarity={rarityLabel}
	data-type={type}
	data-color={colorLabel}
	data-canupgrade={canUpgrade ? 'true' : 'false'}
	data-hasbeta="false"
	data-cost={localized.cost === null ? m.unplayable() : localized.cost}
	data-multiplayer="false"
	data-tags={card.keywords.join(' ')}
>
	<a class="thumb-link card-image-wrap" href={cardHref(card)} aria-label={m.card_open({ name: localized.name })}>
		<CardThumb card={display} />
	</a>

	<div class="row-content card-text">
		<div class="row-head">
			<a class="card-name card-title" href={cardHref(card)}>{display.name}</a>
			<span class="card-meta">
				<i class="rarity-dot" style:background={rarity.color} aria-hidden="true"></i>
				{rarityLabel} - {colorLabel} - {type}
			</span>
		</div>

		<div class="card-desc">
			<RichText text={display.text} />
		</div>

		{#if showActions}
			<div class="row-actions card-toggles">
				{#if canUpgrade}
					<button
						class="row-button card-toggle-button upgrade-toggle"
						type="button"
						aria-pressed={upgraded}
						title={m.card_toggle_upgraded()}
						onclick={onupgraded}
					>
						{m.card_tab_upgraded()}
					</button>
				{:else}
					<span class="upgrade-disabled">{m.card_cannot_upgrade()}</span>
				{/if}
				<span class="upgrade-disabled">{m.card_no_beta_art()}</span>
				<span class="mod-name">{modName(card.mod)}</span>
			</div>
		{/if}
	</div>
</article>

<style>
	.card-row {
		position: relative;
		display: grid;
		grid-template-columns: 150px minmax(0, 1fr);
		align-items: center;
		gap: 12px;
		padding: 12px;
		border: 0;
		border-radius: 6px;
		background: var(--list-cell);
		transition:
			background 0.18s ease,
			box-shadow 0.18s ease;
	}

	.card-row:hover {
		background: color-mix(in srgb, var(--list-cell) 96%, white 6%);
		box-shadow: inset 2px 0 0 color-mix(in srgb, var(--gold) 45%, transparent);
	}

	.thumb-link {
		flex: none;
		width: 150px;
		border-radius: 4px;
		transition: transform 0.24s var(--ease);
	}

	.thumb-link:hover {
		transform: translateY(-2px);
	}

	.row-content {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 7px;
		min-width: 0;
		align-self: stretch;
		justify-content: flex-start;
		padding: 0.4em 0.7em 0.4em 0;
	}

	.row-head {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}

	.card-name {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 400;
		line-height: 1.1;
		color: var(--gold);
		text-wrap: balance;
		text-shadow: 2px 1px 2px rgba(0, 0, 0, 0.36);
		transition: color 0.16s ease;
	}

	.card-name:hover {
		color: #fff3bd;
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 3px;
	}

	.card-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 4px;
		font-size: 0.9rem;
		color: var(--link);
	}

	.rarity-dot {
		width: 6px;
		height: 6px;
		flex: none;
		transform: rotate(45deg);
		box-shadow: 0 0 4px rgba(0, 0, 0, 0.4);
	}

	.card-desc {
		max-width: 82ch;
		font-size: 1rem;
		line-height: 1.3;
		color: var(--text);
		text-wrap: pretty;
	}

	.row-actions {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		margin-top: auto;
		padding-top: 4px;
	}

	.row-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 5px 8px;
		border: 1px solid var(--line-strong);
		border-radius: 4px;
		background: transparent;
		color: var(--text);
		font-size: 0.95rem;
		white-space: nowrap;
		transition:
			background 0.16s ease,
			border-color 0.16s ease,
			color 0.16s ease;
	}

	.row-button:hover:not(:disabled) {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		color: var(--text);
	}

	.row-button[aria-pressed='true'] {
		border-color: mediumseagreen;
		background: mediumseagreen;
		color: oklch(0 0 0);
	}

	.upgrade-disabled {
		display: inline-flex;
		align-items: center;
		padding: 4px 8px;
		border: 2px solid gray;
		border-radius: 6px;
		font-size: 0.9rem;
		font-style: italic;
		font-weight: 600;
		color: gray;
		white-space: nowrap;
	}

	.mod-name {
		margin-left: auto;
		padding-left: 6px;
		font-family: var(--font-mono);
		font-size: 0.55rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (max-width: 640px) {
		.card-row {
			grid-template-columns: 110px minmax(0, 1fr);
		}

		.thumb-link {
			width: 110px;
		}

		.card-name {
			font-size: 1.25rem;
		}

		.card-desc {
			font-size: 0.88rem;
		}

		.mod-name {
			display: none;
		}
	}

	@media (max-width: 420px) {
		.card-row {
			grid-template-columns: 84px minmax(0, 1fr);
			gap: 10px;
			padding: 10px;
		}

		.thumb-link {
			width: 84px;
		}

		.card-name {
			font-size: 1.1rem;
		}

		.card-meta {
			font-size: 0.72rem;
			flex-wrap: wrap;
		}

		.card-desc {
			font-size: 0.82rem;
		}
	}
</style>
