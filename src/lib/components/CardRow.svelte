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
	class="card-row card-box relative grid grid-cols-[150px_minmax(0,1fr)] items-center gap-3 border border-gray rounded-md bg-list-cell px-6 py-5 max-[640px]:grid-cols-[110px_minmax(0,1fr)] max-[420px]:grid-cols-[84px_minmax(0,1fr)] max-[420px]:gap-2.5 max-[420px]:p-2.5"
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
	<a class="thumb-link card-image-wrap flex-none w-37.5 rounded-sm max-[640px]:w-27.5 max-[420px]:w-21" href={cardHref(card)} aria-label={m.card_open({ name: localized.name })}>
		<CardThumb card={display} upgraded={upgradedView} {priority} />
	</a>

	<div class="row-content flex min-w-0 flex-col items-start justify-start gap-1.75 py-[0.4em] pl-[0.7em] pr-0">
		<div class="row-head flex min-w-0 flex-col gap-0.75">
			<a class="card-title font-display text-[1.5rem] font-semibold leading-[1.1] text-balance [text-shadow:2px_1px_2px_rgba(0,0,0,0.36)] transition-colors duration-160 hover:underline [text-underline-thickness:1px] underline-offset-[3px] max-[640px]:text-[1.25rem] max-[420px]:text-[1.1rem]" href={cardHref(card)}>{display.name}</a>
			<span class="card-meta flex items-center gap-1.5 mb-1 text-[0.9rem] text-link max-[420px]:text-[0.72rem] max-[420px]:flex-wrap">
				<a href="{resolve('/cards')}?rarity={card.rarity}">{rarityLabel}</a>
				<span aria-hidden="true">-</span>
				<a href="{resolve('/cards')}?color={card.color}">{colorLabel}</a>
				<span aria-hidden="true">-</span>
				<a href="{resolve('/cards')}?type={card.type}">{type}</a>
			</span>
		</div>

		<CardDescription card={display} upgraded={upgradedView} />

		{#if showActions}
			<div class="row-actions flex flex-wrap items-center gap-2.5 mt-auto pt-1">
				{#if canUpgrade}
					<button
						class="upgrade-button inline-flex items-center justify-center px-2 py-1.25 border border-line-strong rounded-sm bg-transparent text-ink text-[0.95rem] whitespace-nowrap transition-colors duration-160 aria-pressed:border-[mediumseagreen] aria-pressed:bg-[mediumseagreen] aria-pressed:text-[oklch(0_0_0)]"
						type="button"
						aria-pressed={upgraded}
						title={m.card_toggle_upgraded()}
						onclick={onupgraded}
					>
						{m.card_tab_upgraded()}
					</button>
				{:else}
					<span class="upgrade-disabled inline-flex items-center px-2 py-1 border-2 border-gray rounded-md text-[0.9rem] italic font-semibold text-gray whitespace-nowrap">{m.card_cannot_upgrade()}</span>
				{/if}
				<span class="upgrade-disabled inline-flex items-center px-2 py-1 border-2 border-gray rounded-md text-[0.9rem] italic font-semibold text-gray whitespace-nowrap">{m.card_no_beta_art()}</span>
				<span class="mod-name ml-auto pl-1.5 font-mono text-[0.55rem] tracking-wider uppercase text-muted overflow-hidden text-ellipsis whitespace-nowrap max-[640px]:hidden">{modName(card.mod)}</span>
			</div>
		{/if}
	</div>
</article>
