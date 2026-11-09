<script lang="ts">
	import CharacterFilter from './CharacterFilter.svelte';
	import FilterButton from './FilterButton.svelte';
	import FilterPanel from './FilterPanel.svelte';
	import ReferenceGroup from './ReferenceGroup.svelte';
	import ReferencePage from './ReferencePage.svelte';
	import SortButton from './SortButton.svelte';
	import {
		RARITY_META,
		type CollectionEntry,
		type CollectionKind,
		type CollectionRarity
	} from '#lib/data/collections';
	import {
		ancientName,
		collectionCharacterName,
		collectionRarityName,
		isZh,
		localizedCollections,
		modName
	} from '#lib/data/localize';
	import { collectionCharacterOptions } from '#lib/data/characters';
	import { m } from '#lib/paraglide/messages';
	import {
		ENERGY_ICON,
		NECRO_ENERGY_ICON,
		collectionTextToHtml,
		collectionTextToPlain
	} from '#lib/text/collection-text';

	let {
		kind,
		title,
		lead,
		notice,
		entries,
		rarities,
		otherLinks = []
	}: {
		kind: CollectionKind;
		title: string;
		lead: string;
		notice: string;
		entries: CollectionEntry[];
		rarities: CollectionRarity[];
		otherLinks?: { href: string; label: string; count: number }[];
	} = $props();

	let query = $state('');
	let character = $state<string>('all');
	let rarity = $state<'all' | CollectionRarity>('all');
	let mod = $state<string>('all');
	let sort = $state('default');

	let accent = $derived(
		kind === 'relic' ? 'oklch(0.84 0.14 90)' : 'oklch(0.82 0.11 236)'
	);

	let localized = $derived(localizedCollections(entries));

	let filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const result = localized.filter((entry) => {
			if (character !== 'all' && entry.character !== character) return false;
			if (rarity !== 'all' && entry.rarity !== rarity) return false;
			if (mod !== 'all' && entry.mod !== mod) return false;
			if (!q) return true;

			return [
				entry.name,
				collectionTextToPlain(entry.text),
				collectionCharacterName(entry.character),
				collectionRarityName(entry.rarity),
				entry.tags.join(' '),
				entry.ancient ?? ''
			]
				.join(' ')
				.toLowerCase()
				.includes(q);
		});

		const rarityOrder = rarities.indexOf.bind(rarities);
		result.sort((a, b) => {
			if (sort === 'rarity-desc') {
				return rarityOrder(b.rarity) - rarityOrder(a.rarity) || a.name.localeCompare(b.name);
			}
			if (sort === 'rarity-asc') {
				return rarityOrder(a.rarity) - rarityOrder(b.rarity) || a.name.localeCompare(b.name);
			}
			return a.name.localeCompare(b.name);
		});
		return result;
	});

	let groups = $derived.by(() => {
		const ids = sort === 'rarity-desc' ? [...rarities].reverse() : rarities;
		const result: { rarity: CollectionRarity; entries: CollectionEntry[] }[] = [];
		for (const rarityId of ids) {
			const groupEntries = filtered.filter((entry) => entry.rarity === rarityId);
			if (groupEntries.length) result.push({ rarity: rarityId, entries: groupEntries });
		}
		return result;
	});

	let countLabel = $derived(m.showing_results({ count: filtered.length }));

	function groupId(rarityId: CollectionRarity) {
		return `${kind}-${rarityId}`;
	}

	function clearAll() {
		query = '';
		character = 'all';
		rarity = 'all';
		mod = 'all';
	}

	function descriptionHtml(entry: CollectionEntry) {
		return collectionTextToHtml(entry.text, {
			energyIcon: entry.character === 'necrobinder' ? NECRO_ENERGY_ICON : ENERGY_ICON
		});
	}

	function meta(entry: CollectionEntry) {
		const parts = [collectionRarityName(entry.rarity), collectionCharacterName(entry.character)];
		if (entry.ancient) parts.push(m.collection_from({ name: ancientName(entry.ancient) }));
		if (isZh() && entry.mod !== 'sts2') parts.push(modName(entry.mod));
		return parts.join(' · ');
	}
</script>

{#snippet filtersBlock()}
	<CharacterFilter options={collectionCharacterOptions()} bind:value={character} />

	<FilterPanel title={m.filter_rarity()}>
		{#snippet header()}
			<SortButton key="rarity" label={m.filter_rarity()} bind:sort />
		{/snippet}
		<div class="flex flex-wrap gap-1.25">
			{#each rarities as rarityId (rarityId)}
				<FilterButton
					pressed={rarity === rarityId}
					label={collectionRarityName(rarityId)}
					onclick={() => (rarity = rarity === rarityId ? 'all' : rarityId)}
				>
					{collectionRarityName(rarityId)}
				</FilterButton>
			{/each}
		</div>
	</FilterPanel>
{/snippet}

{#snippet groupsBlock()}
	{#each groups as group (group.rarity)}
		<ReferenceGroup
			id={groupId(group.rarity)}
			label={collectionRarityName(group.rarity)}
			count={group.entries.length}
			color={RARITY_META[group.rarity].color}
		>
			<div
				class="grid grid-cols-[repeat(auto-fill,minmax(21em,1fr))] items-start gap-1.25"
			>
				{#each group.entries as entry (entry.id)}
					<article
						class="collection-row group relative grid scroll-mt-[calc(var(--header-height)+16px)] grid-cols-[58px_minmax(0,1fr)] items-start gap-2.75 rounded-[3px] border border-line bg-row px-2.75 py-2.25 transition-[border-color,background-color,box-shadow] duration-160 ease-[ease] hover:border-(--group-accent) hover:bg-surface-2 max-[620px]:grid-cols-[46px_minmax(0,1fr)] max-[620px]:gap-2 max-[620px]:px-2.25 max-[620px]:py-2"
						id="{kind}-{entry.id}"
					>
						<span
							class="mt-px grid size-14.5 place-items-center rounded-sm border border-line-strong bg-black/35 p-1 max-[620px]:size-11"
						>
							{#if entry.image}
								<img
									class="size-full rounded-xs object-contain"
									src={entry.image}
									alt=""
									loading="lazy"
									decoding="async"
								/>
							{/if}
						</span>

						<div class="min-w-0">
							<div class="flex flex-wrap items-center gap-1.5">
								<h3
									class="font-display text-[1.02rem] leading-tight font-semibold text-ink max-[620px]:text-[0.94rem]"
								>
									{entry.name}
								</h3>
								{#if entry.upgraded}
									<span
										class="rounded-[3px] border border-line px-1.5 py-px font-mono text-[0.48rem] tracking-wider text-(--group-accent) uppercase"
										>{m.collection_ancient_upgrade()}</span
									>
								{/if}
							</div>

							<p class="mt-0.5 font-mono text-[0.56rem] tracking-[0.04em] text-muted uppercase">
								{meta(entry)}
							</p>

							<p
								class="collection-desc mt-1 max-w-[82ch] text-[0.86rem] leading-[1.45] text-pretty text-ink-dim"
							>
								{@html descriptionHtml(entry)}
							</p>

							{#if kind === 'relic'}
								<a
									class="mt-1 inline-block text-[0.72rem] text-link hover:text-gold"
									href={`/relic/${entry.id}`}
								>
									{m.power_detail_short()} →
								</a>
							{/if}
						</div>
					</article>
				{/each}
			</div>
		</ReferenceGroup>
	{/each}
{/snippet}

<ReferencePage
	{title}
	{lead}
	{notice}
	{accent}
	filtersLabel={m.collection_filters_label()}
	{countLabel}
	isEmpty={filtered.length === 0}
	onclear={clearAll}
	bind:query
	bind:mod
	filters={filtersBlock}
	groups={groupsBlock}
/>

<style>
	.collection-desc :global(.sts-collection-icon) {
		display: inline-block;
		height: 1.05em;
		width: auto;
		margin: 0 0.06em;
		vertical-align: -0.14em;
	}

	.collection-row :global(.sts-collection-icon) {
		filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.4));
	}
</style>
