<script lang="ts">
	import { rarityName, typeName } from '#lib/data/localize';
	import { CARD_TYPES, rarityIds, type CardType } from '#lib/data/cards';
	import { cardCharacterOptions } from '#lib/data/characters';
	import { m } from '#lib/paraglide/messages';
	import Filter from './Filter.svelte';
	import FilterButton from './FilterButton.svelte';
	import FilterPanel from './FilterPanel.svelte';
	import FilterSearch from './FilterSearch.svelte';
	import CharacterFilter from './CharacterFilter.svelte';
	import ModSelect from './ModSelect.svelte';
	import SortButton from './SortButton.svelte';

	let {
		query = $bindable(''),
		color = $bindable('all'),
		type = $bindable('all'),
		rarity = $bindable('all'),
		cost = $bindable('all'),
		mod = $bindable('all'),
		sort = $bindable('default'),
		multiplayer = $bindable(false),
		viewUpgrades = $bindable(false),
		viewBetaArt = $bindable(false),
		count = 0,
		onchange = () => {},
		onclear = () => {},
		onviewupgrades = () => {}
	}: {
		query?: string;
		color?: string;
		type?: string;
		rarity?: string;
		cost?: string;
		mod?: string;
		sort?: string;
		multiplayer?: boolean;
		viewUpgrades?: boolean;
		viewBetaArt?: boolean;
		count?: number;
		onchange?: () => void;
		onclear?: () => void;
		onviewupgrades?: () => void;
	} = $props();

	const typeOptions = (Object.keys(CARD_TYPES) as CardType[]).map((id) => ({
		id,
		label: typeName(id)
	}));

	const rarityOptions = rarityIds().map((id) => ({
		id,
		label: rarityName(id)
	}));

	const costOptions = [
		{ id: 'X', label: 'X' },
		{ id: '0', label: '0' },
		{ id: '1', label: '1' },
		{ id: '2', label: '2' },
		{ id: '3', label: '3+' },
		{ id: 'unplayable', label: m.unplayable() }
	];

	const sortOptions = [
		{ value: 'default', label: m.sort_default() },
		{ value: 'name-asc', label: m.sort_name_asc() },
		{ value: 'name-desc', label: m.sort_name_desc() },
		{ value: 'rarity-asc', label: m.sort_rarity_asc() },
		{ value: 'rarity-desc', label: m.sort_rarity_desc() },
		{ value: 'type-asc', label: m.sort_type_asc() },
		{ value: 'type-desc', label: m.sort_type_desc() },
		{ value: 'cost-asc', label: m.sort_cost_asc() },
		{ value: 'cost-desc', label: m.sort_cost_desc() },
		{ value: 'color-asc', label: m.sort_character() }
	];

	function setType(id: CardType) {
		type = type === id ? 'all' : id;
		onchange();
	}

	function setRarity(id: string) {
		rarity = rarity === id ? 'all' : id;
		onchange();
	}

	function setCost(id: string) {
		cost = cost === id ? 'all' : id;
		onchange();
	}

	function toggleMultiplayer() {
		multiplayer = !multiplayer;
		onchange();
	}

	function toggleViewUpgrades() {
		viewUpgrades = !viewUpgrades;
		onviewupgrades();
		onchange();
	}

	function toggleViewBetaArt() {
		viewBetaArt = !viewBetaArt;
		onchange();
	}
</script>

{#snippet optionPanel<T extends string>(
	title: string,
	sortKey: 'rarity' | 'type' | 'cost',
	options: { id: T; label: string }[],
	selected: string,
	onSelect: (id: T) => void
)}
	<FilterPanel {title}>
		{#snippet header()}
			<SortButton key={sortKey} label={title} bind:sort {onchange} />
		{/snippet}
		<div class="flex flex-wrap gap-1.25">
			{#each options as option (option.id)}
				<FilterButton pressed={selected === option.id} onclick={() => onSelect(option.id)}>
					{option.label}
				</FilterButton>
			{/each}
		</div>
	</FilterPanel>
{/snippet}

<Filter label={m.filters_label()}>
	{#snippet result()}
		<div class="flex items-center gap-3 min-w-0 max-[860px]:w-full max-[460px]:flex-wrap max-[460px]:gap-1.5">
			<label class="sort-select">
				<span class="visually-hidden">{m.sort_results()}</span>
				<select bind:value={sort} onchange={onchange}>
					{#each sortOptions as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</label>
			<span class="w-px h-4.5 bg-line-strong max-[460px]:hidden" aria-hidden="true"></span>
			<span class="whitespace-nowrap text-ink-dim max-[460px]:w-full">{m.showing_results({ count })}</span>
		</div>

		<ModSelect bind:value={mod} {onchange} />
	{/snippet}

	<FilterSearch
		bind:value={query}
		title={m.filter_search()}
		placeholder={m.search_placeholder()}
		onclear={onclear}
		oninput={onchange}
	/>

	<CharacterFilter options={cardCharacterOptions()} bind:value={color} bind:sort {onchange} />

	{@render optionPanel(m.filter_rarity(), 'rarity', rarityOptions, rarity, setRarity)}
	{@render optionPanel(m.filter_type(), 'type', typeOptions, type, setType)}
	{@render optionPanel(m.filter_cost(), 'cost', costOptions, cost, setCost)}

	<FilterPanel title={m.filter_other()}>
		<div class="flex flex-wrap gap-1.25">
			<FilterButton
				pressed={multiplayer}
				title={m.filter_multiplayer_hint()}
				onclick={toggleMultiplayer}
			>
				{m.filter_multiplayer()}
			</FilterButton>
			<FilterButton
				pressed={viewUpgrades}
				title={m.filter_view_upgrades_hint()}
				onclick={toggleViewUpgrades}
			>
				{m.filter_view_upgrades()}
			</FilterButton>
			<FilterButton
				pressed={viewBetaArt}
				title={m.filter_view_beta_art_hint()}
				onclick={toggleViewBetaArt}
			>
				{m.filter_view_beta_art()}
			</FilterButton>
		</div>
	</FilterPanel>
</Filter>

<style>
	.sort-select select {
		appearance: none;
		height: 27px;
		border: 0;
		padding: 0 22px 0 0;
		background:
			url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='6'%3E%3Cpath d='M1 1 L4.5 4.5 L8 1' stroke='%23d0d8d6' fill='none'/%3E%3C/svg%3E")
				no-repeat right 2px center;
		box-shadow: none;
		outline: 0;
		font-size: 0.9rem;
		color: var(--text);
		cursor: pointer;
	}

	.sort-select option {
		background: var(--tooltip-bg);
		color: var(--text);
	}
</style>
