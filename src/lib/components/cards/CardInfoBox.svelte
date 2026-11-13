<script lang="ts">
	import { resolve } from '$app/paths'
	import CardDescription from '#lib/components/CardDescription.svelte'
	import CardThumb from '#lib/components/CardThumb.svelte'
	import Checkbox from '#lib/components/Checkbox.svelte'
	import InfoBox from '#lib/components/InfoBox.svelte'
	import { isUpgradable, resolveCard, type Card } from '#lib/data/cards'
	import { colorName, rarityName, typeName } from '#lib/data/localize'
	import { m } from '#lib/paraglide/messages'
	let { card }: { card: Card } = $props()
	let canUpgrade = $derived(isUpgradable(card))
	let upgraded = $state(false)
	let upgradedView = $derived(upgraded && canUpgrade)
	let shownCard = $derived(resolveCard(card, upgradedView))
	let costLabel = $derived(shownCard.cost === null ? m.unplayable() : shownCard.cost === 'X' ? 'X' : shownCard.cost)
	let rarityLabel = $derived(rarityName(card.rarity))
	let colorLabel = $derived(colorName(card.color))
	let typeLabel = $derived(typeName(card.type))
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
						<div class="relative mx-auto w-[min(100%,273px)] @container">
							<CardThumb showText={false} card={shownCard} upgraded={upgradedView} priority useThumb={false} />

							<span
								class={[
									'pointer-events-none absolute left-[15%] top-[1%] z-10 flex h-[12.796%] w-[70%] items-center justify-center text-center text-[clamp(7px,7.1cqw,21px)] leading-[1.05] font-normal [-webkit-text-stroke:0.24rem_#4d4b40] [paint-order:stroke_fill]',
									upgradedView ? 'text-[#7fff00]' : 'text-[#fdf5e6]'
								]}
							>
								{shownCard.name}
							</span>

							<span
								class="pointer-events-none absolute left-[-5.333%] top-[-3.791%] z-10 grid h-[15.165%] w-[21.333%] place-items-center text-[clamp(7px,10.667cqw,32px)] font-bold leading-none text-[#fdf5e6] [-webkit-text-stroke:0.36rem_#802020] [paint-order:stroke_fill]"
							>
								{costLabel}
							</span>

							<span
								class="pointer-events-none absolute left-1/2 top-[50.237%] z-10 grid h-[8.77%] min-w-[20.33%] -translate-x-1/2 place-items-center text-[clamp(5px,5.333cqw,16px)] font-bold leading-none text-[oklch(0_0_0/75%)]"
							>
								{typeLabel}
							</span>

							<div
								class="absolute left-[9.333%] top-[58.768%] z-10 flex h-[32.227%] w-[81%] items-center justify-center"
							>
								<CardDescription variant="face" card={shownCard} upgraded={upgradedView} />
							</div>
						</div>
					</div>
				</InfoBox>
