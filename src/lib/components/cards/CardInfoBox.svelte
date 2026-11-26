<script lang="ts">
	import { resolve } from '$app/paths'
	import CardThumb from '#lib/components/CardThumb.svelte'
	import Checkbox from '#lib/components/Checkbox.svelte'
	import InfoBox from '#lib/components/InfoBox.svelte'
	import { isUpgradable, resolveCard, type Card } from '#lib/data/cards'
	import { colorName, rarityName } from '#lib/data/localize'
	import { m } from '#lib/paraglide/messages'
	let { card }: { card: Card } = $props()
	let canUpgrade = $derived(isUpgradable(card))
	let upgraded = $state(false)
	let upgradedView = $derived(upgraded && canUpgrade)
	let shownCard = $derived(resolveCard(card, upgradedView))
	let rarityLabel = $derived(rarityName(card.rarity))
	let colorLabel = $derived(colorName(card.color))
</script>

				<InfoBox
					tone="card"
					ariaLabel={m.card_details()}
					class="card-infobox w-full max-w-75 justify-self-end max-lg:w-[min(100%,340px)] max-lg:justify-self-center"
				>
					{#snippet title()}
						<div
							class="pb-2.5 pt-1.5 text-center text-[30px] font-medium leading-8.75 text-ink [text-shadow:3px_2px_0_#3d5658]"
						>
							{shownCard.name}
						</div>
					{/snippet}

					{#if canUpgrade}
						<label class="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-[oklch(0.4_0.03_187)] px-3 py-1.5 text-sm">
							{m.card_tab_upgraded()}<Checkbox bind:checked={upgraded} />
						</label>
					{/if}

					<div
						class="mt-1.75 flex flex-wrap items-center justify-center gap-1.5 rounded-md bg-[oklch(0.4_0.03_187)] py-0.75 text-center text-[15px] font-semibold"
					>
						<a class="text-link hover:text-gold" href="{resolve('/cards')}?rarity={card.rarity}">
							{rarityLabel}
						</a>
						<a class="text-link hover:text-gold" href="{resolve('/cards')}?color={card.color}">
							{colorLabel}
						</a>
						<span>{m.card_noun()}</span>
					</div>

					<div class="mt-1.25 rounded-md bg-[oklch(0.4_0.03_187)] p-8">
						<div class="mx-auto w-[min(100%,273px)]">
							<CardThumb card={shownCard} upgraded={upgradedView} priority useThumb={false} />
						</div>
					</div>
				</InfoBox>
