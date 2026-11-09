<script lang="ts">
	import { resolve } from '$app/paths'
	import CardDescription from '#lib/components/CardDescription.svelte'
	import CardThumb from '#lib/components/CardThumb.svelte'
	import DetailTitle from '#lib/components/DetailTitle.svelte'
	import InfoBox from '#lib/components/InfoBox.svelte'
	import Motif from '#lib/components/Motif.svelte'
	import WikiHeading from '#lib/components/WikiHeading.svelte'
	import WikiNavbox from '#lib/components/WikiNavbox.svelte'
	import WikiTable from '#lib/components/WikiTable.svelte'
	import WikiToc from '#lib/components/WikiToc.svelte'
	import { cardHref, isUpgradable, resolveCard } from '#lib/data/cards'
	import { ENTRY_BY_ID, entryHref } from '#lib/data/glossary'
	import {
		colorName,
		localizedCard,
		localizedEntries,
		localizedKeyword,
		modName,
		rarityName,
		typeName
	} from '#lib/data/localize'
	import { CHARACTER_ASSETS, CHARACTER_ICONS, MOD_BY_ID, modContentText } from '#lib/data/mods'
	import { m } from '#lib/paraglide/messages'
	import { cardTextToPlain, ENERGY_ICON_SRC } from '#lib/text/card-text'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	let card = $derived(localizedCard(data.card))
	let colorLabel = $derived(colorName(data.card.color))
	let rarityLabel = $derived(rarityName(data.card.rarity))
	let typeLabel = $derived(typeName(data.card.type))
	let modLabel = $derived(modName(data.card.mod))
	let mod = $derived(MOD_BY_ID.get(data.card.mod))
	let assets = $derived(CHARACTER_ASSETS[data.card.color])
	let characterIcon = $derived(CHARACTER_ICONS[data.card.color])
	let energyIcon = $derived(assets?.textEnergy ?? ENERGY_ICON_SRC)

	let canUpgrade = $derived(isUpgradable(data.card))
	let upgraded = $state(false)
	let upgradedView = $derived(upgraded && canUpgrade)
	let shownCard = $derived(resolveCard(card, upgradedView))
	let costLabel = $derived(
		shownCard.cost === null ? m.unplayable() : shownCard.cost === 'X' ? 'X' : shownCard.cost
	)

	let keywords = $derived(
		localizedEntries(
			shownCard.keywords
				.map((keyword) => ENTRY_BY_ID.get(keyword.toLowerCase()))
				.filter((entry) => entry !== undefined)
		)
	)
	let keywordLabels = $derived(shownCard.keywords.map(localizedKeyword))
	let related = $derived(data.related.map(localizedCard))

	let names = $derived.by(() => {
		const eng = mod ? modContentText(mod, 'card', data.card.id, 'title', 'eng') : undefined
		const zhs = mod ? modContentText(mod, 'card', data.card.id, 'title', 'zhs') : undefined
		return [
			{ locale: 'eng', label: m.language_en(), name: eng ?? data.card.name },
			{ locale: 'zhs', label: m.language_zh(), name: zhs ?? data.card.name }
		]
	})

	let toc = $derived([
		{ id: 'Obtaining', number: '1', label: m.card_obtaining({ name: card.name }), indent: false },
		{ id: 'Interactions', number: '2', label: m.card_interactions(), indent: false },
		{ id: 'Synergies', number: '2.1', label: m.card_synergies(), indent: true },
		{ id: 'Notes', number: '3', label: m.card_notes(), indent: false },
		{ id: 'Names_in_Other_Languages', number: '4', label: m.power_other_names(), indent: false },
		{ id: 'Update_History', number: '5', label: m.card_update_history(), indent: false }
	])

	let metaText = $derived(cardTextToPlain(card.text, { variables: card.variables }))
</script>

<svelte:head>
	<title>{m.card_meta_title({ name: card.name })}</title>
	<meta
		name="description"
		content={m.card_meta_description({ name: card.name, text: metaText, mod: modLabel })}
	/>
</svelte:head>

<div class="glossary-page">
	<section class="wrap py-[clamp(22px,3vw,34px)]">
		<div
			class="rounded-md border border-line bg-[oklch(0_0_0/62%)] px-[clamp(14px,2.4vw,30px)] py-5"
		>
			<div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
				<article class="min-w-0">
					<DetailTitle name={card.name} />

					<p class="mb-4 text-[0.9rem] leading-[1.6]">
						{#if characterIcon}
							<img src={characterIcon} alt="" class="inline-block size-4.5 align-[-0.25em]" />
						{/if}
						{#if energyIcon}
							<img src={energyIcon} alt="" class="inline-block h-[1.1em] w-auto align-[-0.2em]" />
						{/if}
						{m.card_summary({
							name: card.name,
							rarity: rarityLabel,
							type: typeLabel,
							color: colorLabel,
							cost: String(costLabel)
						})}
					</p>

					<WikiToc items={toc} />

					<WikiHeading id="Obtaining" title={m.card_obtaining({ name: card.name })} />
					<p class="mb-3 text-[0.9rem] leading-[1.6]">
						{m.card_obtaining_body({ name: card.name, mod: modLabel, color: colorLabel })}
					</p>

					<WikiHeading id="Interactions" title={m.card_interactions()} />
					<WikiHeading id="Synergies" title={m.card_synergies()} level={3} />
					{#if keywords.length}
						<ul class="mb-3 ml-5 list-disc space-y-1 text-[0.88rem] leading-[1.55]">
							{#each keywords as entry (entry.id)}
								<li>
									<a
										class="inline-flex items-center gap-1 text-link hover:text-gold"
										href={entryHref(entry)}
									>
										<span class="inline-grid size-5.5 place-items-center">
											{#if entry.icon}
												<img src={entry.icon} alt="" class="size-5.5" loading="lazy" />
											{:else}
												<Motif name={entry.motif ?? 'spiral'} />
											{/if}
										</span>
										{entry.name}
									</a>
									<span class="text-muted"> — {entry.summary}</span>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="mb-3 text-[0.88rem] text-muted">—</p>
					{/if}

					<WikiHeading id="Notes" title={m.card_notes()} />
					<ul class="mb-3 ml-5 list-disc space-y-1 text-[0.88rem] leading-[1.55]">
						<li>{m.card_cost()}: <strong class="text-ink">{costLabel}</strong></li>
						{#if canUpgrade}
							<li>{m.card_base_text()} / {m.card_upgraded_text()}</li>
						{:else}
							<li>{m.card_cannot_upgrade()}</li>
						{/if}
						{#if keywordLabels.length}
							<li>{m.nav_keywords()}: {keywordLabels.join(', ')}</li>
						{/if}
						<li>
							{m.card_from_label()}:
							<a class="text-link hover:text-gold" href="{resolve('/cards')}?mod={data.card.mod}">
								{modLabel}
							</a>
						</li>
					</ul>

					<WikiHeading id="Names_in_Other_Languages" title={m.power_other_names()} />
					<WikiTable
						columns={[m.language(), m.card_table_name()]}
						rows={names.map((item) => [{ text: item.label }, { text: item.name }])}
					/>

					<WikiHeading id="Update_History" title={m.card_update_history()} />
					<WikiTable
						columns={[m.card_table_version(), m.card_table_changes()]}
						rows={[[{ text: mod?.version ?? '—' }, { text: m.card_added() }]]}
					/>

					<WikiNavbox
						title={m.card_navbox({ name: colorLabel })}
						href="{resolve('/cards')}?color={data.card.color}"
						ariaLabel={m.card_navbox({ name: colorLabel })}
						groups={[
							{
								label: rarityLabel,
								rows: [
									{
										items: related.map((item) => ({ name: item.name, href: cardHref(item) }))
									}
								]
							}
						]}
						trailing={{ label: m.nav_cards(), href: resolve('/cards') }}
					/>
				</article>

			<InfoBox
				tone="card"
				ariaLabel={m.card_details()}
				class="card-infobox w-full max-w-75 justify-self-end max-lg:order-first max-lg:w-[min(100%,340px)] max-lg:justify-self-center"
			>
				{#snippet title()}
					<div
						class="pb-2.5 pt-1.5 text-center text-[30px] font-medium leading-8.75 text-ink [text-shadow:3px_2px_0_#3d5658]"
					>
						{shownCard.name}
					</div>
				{/snippet}

				<div class="flex gap-1.25 text-[14px] font-sans">
						<button
							type="button"
							aria-pressed={!upgradedView}
							onclick={() => (upgraded = false)}
							class="flex-1 rounded-md bg-[oklch(0.4_0.03_187)] py-px text-ink outline-1 outline-link transition-colors aria-pressed:bg-link aria-pressed:text-black"
						>
							{m.card_tab_base()}
						</button>
						<button
							type="button"
							aria-pressed={upgradedView}
							disabled={!canUpgrade}
							onclick={() => (upgraded = true)}
							class="flex-1 rounded-md bg-[oklch(0.4_0.03_187)] py-px text-ink outline-1 outline-link transition-colors aria-pressed:bg-link aria-pressed:text-black disabled:opacity-45"
						>
							{m.card_tab_upgraded()}
						</button>
					</div>

					<div
						class="mt-1.75 flex flex-wrap items-center justify-center gap-1.5 rounded-md bg-[oklch(0.4_0.03_187)] py-0.75 text-center text-[15px] font-semibold font-sans"
					>
						<a class="text-link hover:text-gold" href="{resolve('/cards')}?rarity={data.card.rarity}">
							{rarityLabel}
						</a>
						<a class="text-link hover:text-gold" href="{resolve('/cards')}?color={data.card.color}">
							{colorLabel}
						</a>
						<span>{m.card_noun()}</span>
					</div>

					<div class="mt-1.25 rounded-md bg-[oklch(0.4_0.03_187)] px-1.5 pb-5 pt-3.25">
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
			</div>
		</div>
	</section>
</div>