<script lang="ts">
	import { resolve } from '$app/paths'
	import { COLORS, RARITIES, cardHref, isUpgradable, resolveCard, type Card } from '#lib/data/cards'
	import { colorName, localizedCard, modName, rarityName, typeName } from '#lib/data/localize'
	import { CHARACTER_ASSETS } from '#lib/data/mods'
	import { m } from '#lib/paraglide/messages'
	import CardDescription from './CardDescription.svelte'
	import CardThumb from './CardThumb.svelte'

	let {
		card,
		upgraded = false,
		showActions = true,
		priority = false,
		onupgraded = () => {}
	}: {
		card: Card
		upgraded?: boolean
		showActions?: boolean
		priority?: boolean
		onupgraded?: () => void
	} = $props()

	let localized = $derived(localizedCard(card))
	let color = $derived(COLORS[card.color])
	let accent = $derived(CHARACTER_ASSETS[card.color]?.accent ?? color.accent)
	let rarity = $derived(RARITIES[card.rarity])
	let canUpgrade = $derived(isUpgradable(card))
	let upgradedView = $derived(upgraded && canUpgrade)
	let type = $derived(typeName(card.type))
	let colorLabel = $derived(colorName(card.color))
	let rarityLabel = $derived(rarityName(card.rarity))
	let display = $derived(resolveCard(localized, upgradedView))
</script>

<article
	class="card-row card-box"
	style:--accent={accent}
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
		<CardThumb card={display} upgraded={upgradedView} {priority} />
	</a>

	<div class="row-content">
		<div class="row-head">
			<a class="card-title" href={cardHref(card)}>{display.name}</a>
			<span class="card-meta">
				<a href="{resolve('/cards')}?rarity={card.rarity}">{rarityLabel}</a>
				<span aria-hidden="true">-</span>
				<a href="{resolve('/cards')}?color={card.color}">{colorLabel}</a>
				<span aria-hidden="true">-</span>
				<a href="{resolve('/cards')}?type={card.type}">{type}</a>
			</span>
		</div>

		<CardDescription card={display} upgraded={upgradedView} />

		{#if showActions}
			<div class="row-actions">
				{#if canUpgrade}
					<button
						class="upgrade-button"
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
	}

	.thumb-link {
		flex: none;
		width: 150px;
		border-radius: 4px;
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

	.card-title {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 400;
		line-height: 1.1;
		color: var(--gold);
		text-wrap: balance;
		text-shadow: 2px 1px 2px rgba(0, 0, 0, 0.36);
		transition: color 0.16s ease;
	}

	.card-title:hover {
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

	.row-actions {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		margin-top: auto;
		padding-top: 4px;
	}

	.upgrade-button {
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

	.upgrade-button[aria-pressed='true'] {
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

		.card-title {
			font-size: 1.25rem;
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

		.card-title {
			font-size: 1.1rem;
		}

		.card-meta {
			font-size: 0.72rem;
			flex-wrap: wrap;
		}
	}
</style>
