<script lang="ts">
	import { colorName, modName, rarityName, typeName } from '#lib/data/localize';
	import {
		CARD_TYPES,
		COLORS,
		MODS,
		RARITIES,
		type CardType,
		type ColorId,
		type Rarity
	} from '#lib/data/cards';
	import { m } from '#lib/paraglide/messages';
	import Motif from './Motif.svelte';

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
		onclear = () => {}
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
	} = $props();

	const colorOptions = (Object.keys(COLORS) as ColorId[]).map((id) => ({
		id,
		name: colorName(id),
		accent: COLORS[id].accent,
		motif: COLORS[id].motif
	}));

	const typeOptions = (Object.keys(CARD_TYPES) as CardType[]).map((id) => ({
		id,
		name: typeName(id)
	}));

	const rarityOptions = (Object.keys(RARITIES) as Rarity[]).map((id) => ({
		id,
		name: rarityName(id)
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

	function toggleColor(id: ColorId) {
		color = color === id ? 'all' : id;
		onchange();
	}

	function setType(id: CardType) {
		type = type === id ? 'all' : id;
		onchange();
	}

	function setRarity(id: Rarity) {
		rarity = rarity === id ? 'all' : id;
		onchange();
	}

	function setCost(id: string) {
		cost = cost === id ? 'all' : id;
		onchange();
	}

	function cycleSort(key: 'rarity' | 'type' | 'cost') {
		if (sort === `${key}-asc`) sort = `${key}-desc`;
		else if (sort === `${key}-desc`) sort = 'default';
		else sort = `${key}-asc`;
		onchange();
	}
</script>

{#snippet sortButton(key: 'rarity' | 'type' | 'cost', label: string)}
	<button
		class="sort-button"
		class:active={sort.startsWith(`${key}-`)}
		type="button"
		aria-label={m.filter_sort_by({ label })}
		title={m.filter_sort_by({ label })}
		onclick={() => cycleSort(key)}
	>
		<img src="/icons/sort-button.webp" alt="" />
	</button>
{/snippet}

<section class="filter-shell" aria-label={m.filters_label()}>
	<div class="filter-grid">
		<div class="panel panel--search">
			<h2 class="panel-title">{m.filter_search()}</h2>
			<div class="search-row">
				<label class="search-field">
					<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
						<circle cx="9" cy="9" r="5.5" />
						<path d="M13 13 L17 17" />
					</svg>
					<input
						type="search"
						placeholder={m.search_placeholder()}
						aria-label={m.search_placeholder()}
						bind:value={query}
						oninput={onchange}
					/>
				</label>
				<button class="tag-button clear-button" type="button" onclick={onclear}>{m.clear_all()}</button>
			</div>
		</div>

		<div class="panel">
			<h2 class="panel-title">{m.filter_character()}</h2>
			<div class="class-row">
				{#each colorOptions as option (option.id)}
					<button
						class="class-button"
						type="button"
						style:--accent={option.accent}
						aria-pressed={color === option.id}
						aria-label={m.filter_character_aria({ name: option.name })}
						title={option.name}
						onclick={() => toggleColor(option.id)}
					>
						<span class="class-icon">
							<Motif name={option.motif} />
						</span>
					</button>
				{/each}
			</div>
		</div>

		<div class="panel">
			<div class="panel-head">
				<h2 class="panel-title">{m.filter_rarity()}</h2>
				{@render sortButton('rarity', m.filter_rarity())}
			</div>
			<div class="tag-row">
				{#each rarityOptions as option (option.id)}
					<button
						class="tag-button"
						type="button"
						aria-pressed={rarity === option.id}
						onclick={() => setRarity(option.id)}
					>
						{option.name}
					</button>
				{/each}
			</div>
		</div>

		<div class="panel">
			<div class="panel-head">
				<h2 class="panel-title">{m.filter_type()}</h2>
				{@render sortButton('type', m.filter_type())}
			</div>
			<div class="tag-row">
				{#each typeOptions as option (option.id)}
					<button
						class="tag-button"
						type="button"
						aria-pressed={type === option.id}
						onclick={() => setType(option.id)}
					>
						{option.name}
					</button>
				{/each}
			</div>
		</div>

		<div class="panel">
			<div class="panel-head">
				<h2 class="panel-title">{m.filter_cost()}</h2>
				{@render sortButton('cost', m.filter_cost())}
			</div>
			<div class="tag-row cost-row">
				<button
					class="tag-button energy-button"
					type="button"
					aria-pressed={cost === 'all'}
					aria-label={m.filter_any_cost()}
					title={m.filter_any_cost()}
					onclick={() => {
						cost = 'all';
						onchange();
					}}
				>
					<img src="/icons/energy.png" alt="" />
				</button>
				{#each costOptions as option (option.id)}
					<button
						class="tag-button"
						type="button"
						aria-pressed={cost === option.id}
						onclick={() => setCost(option.id)}
					>
						{option.label}
					</button>
				{/each}
			</div>
		</div>

		<div class="panel">
			<h2 class="panel-title">{m.filter_other()}</h2>
			<div class="tag-row">
				<button
					class="tag-button"
					type="button"
					aria-pressed={multiplayer}
					onclick={() => {
						multiplayer = !multiplayer;
						onchange();
					}}
				>
					{m.filter_multiplayer()}
				</button>
				<button
					class="tag-button"
					type="button"
					aria-pressed={viewUpgrades}
					onclick={() => {
						viewUpgrades = !viewUpgrades;
						onchange();
					}}
				>
					{m.filter_view_upgrades()}
				</button>
				<button
					class="tag-button"
					type="button"
					aria-pressed={viewBetaArt}
					onclick={() => {
						viewBetaArt = !viewBetaArt;
						onchange();
					}}
				>
					{m.filter_view_beta_art()}
				</button>
			</div>
		</div>
	</div>

	<div class="result-bar">
		<div class="result-left">
			<label class="sort-select">
				<span class="visually-hidden">{m.sort_results()}</span>
				<select bind:value={sort} onchange={onchange}>
					{#each sortOptions as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</label>
			<span class="result-divider" aria-hidden="true"></span>
			<span class="result-count">{m.showing_results({ count })}</span>
		</div>

		<label class="mod-select">
			<span>{m.filter_mod()}</span>
			<select bind:value={mod} onchange={onchange} aria-label={m.filter_by_mod()}>
				<option value="all">{m.filter_all_mods()}</option>
				{#each MODS as entry (entry.id)}
					<option value={entry.id}>{modName(entry.id)}</option>
				{/each}
			</select>
		</label>
	</div>
</section>

<style>
	.filter-shell {
		--surface-background-color: oklch(0.49 0.04 188);
		--accent-color: oklch(0.8 0.07 178);

		border: 17px solid transparent;
		border-image: url('/images/tooltip-border.png') 22 fill / 17px / 0 stretch;
		border-radius: 8px;
		background: var(--tooltip-bg);
		padding: 0;
		filter: drop-shadow(9px 7px 2px rgba(0, 0, 0, 0.36));
	}

	.filter-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 8px;
		padding: 7px;
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-height: 0;
		padding: 4px 8px 8px;
		border: 2px solid var(--line-strong);
		border-radius: 6px;
		background: var(--surface-secondary);
	}

	.panel-title {
		font-family: var(--font-display);
		font-size: 1.2rem;
		font-weight: 400;
		line-height: 1;
		color: var(--gold);
		letter-spacing: 0.01em;
		text-shadow: 2px 1px 2px rgba(0, 0, 0, 0.36);
	}

	.panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.sort-button {
		--bevel-button-border-color: teal darkslategray darkslategray teal;
		--bevel-button-background-color: darkslategray;

		display: flex;
		align-items: center;
		justify-content: center;
		padding: 3px 2px;
		border: 2px outset;
		border-color: var(--bevel-button-border-color);
		border-radius: 5px;
		background: var(--bevel-button-background-color);
		filter: brightness(60%);
		cursor: pointer;
		transition: filter 0.18s ease, border-color 0.18s ease;
	}

	.sort-button:hover {
		filter: brightness(85%);
	}

	.sort-button.active {
		border-color: var(--gold);
		filter: brightness(100%);
	}

	.sort-button img {
		width: 18px;
		height: auto;
		filter: drop-shadow(0 0 4px rgba(242, 219, 116, 0.2));
	}

	.search-row {
		display: flex;
		gap: 7px;
	}

	.search-field {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-width: 0;
		height: 36px;
		padding: 0 10px;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: var(--table);
		transition: border-color 0.18s ease;
	}

	.search-field:focus-within {
		border-color: var(--accent);
	}

	.search-field svg {
		width: 14px;
		height: 14px;
		flex: none;
		color: var(--muted);
	}

	.search-field input {
		width: 100%;
		min-width: 0;
		border: 0;
		padding: 0;
		background: transparent;
		box-shadow: none;
		outline: 0;
		font-size: 0.95rem;
		color: var(--text);
	}

	.search-field input::placeholder {
		color: var(--muted);
	}

	.tag-row {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}

	.tag-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-width: 16px;
		padding: 3px 6px;
		border: 0;
		border-radius: 3px;
		background: var(--surface-background-color);
		color: var(--text);
		font-family: var(--font-display);
		font-size: 1rem;
		line-height: 1.5;
		letter-spacing: 0.02em;
		user-select: none;
		transition: all ease-in-out 0.1s;
	}

	.tag-button:hover {
		filter: brightness(1.2);
	}

	.tag-button[aria-pressed='true'] {
		outline: 2px solid var(--accent-color);
		outline-offset: 0;
		filter: brightness(1.12);
	}

	.clear-button {
		height: 36px;
		min-height: 36px;
		white-space: nowrap;
	}

	.class-row {
		display: flex;
		align-items: flex-start;
		gap: clamp(7px, 1.4vw, 15px);
		flex-wrap: wrap;
	}

	.class-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		aspect-ratio: 1 / 1;
		padding: 3px;
		border: 0;
		border-radius: 3px;
		background: color-mix(in srgb, var(--accent) 22%, var(--surface-background-color));
		color: color-mix(in srgb, var(--accent) 72%, white);
		letter-spacing: 0.02em;
		user-select: none;
		transition: all ease-in-out 0.1s;
	}

	.class-button:hover {
		filter: brightness(1.2);
	}

	.class-button[aria-pressed='true'] {
		outline: 2px solid var(--accent-color);
		outline-offset: 0;
		filter: brightness(1.15);
	}

	.class-icon {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
	}

	.class-icon :global(svg) {
		width: 100%;
		height: 100%;
		opacity: 1;
		stroke-width: 2.6;
	}

	.cost-row {
		align-items: stretch;
	}

	.energy-button {
		min-width: 0;
		padding: 3px 6px;
	}

	.energy-button img {
		width: 17px;
		height: 17px;
	}

	.result-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		min-height: 34px;
		margin-top: 10px;
		padding: 2px 10px;
		border: 2px solid var(--tooltip-border);
		border-radius: 6px;
		background: var(--tooltip-bg);
		font-family: var(--font-display);
		font-size: 1rem;
		color: var(--text);
	}

	.result-left {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}

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

	.sort-select option,
	.mod-select option {
		background: var(--tooltip-bg);
		color: var(--text);
	}

	.result-divider {
		width: 1px;
		height: 18px;
		background: var(--line-strong);
	}

	.result-count {
		white-space: nowrap;
		color: var(--text-dim);
	}

	.mod-select {
		display: flex;
		align-items: center;
		gap: 7px;
		flex: none;
	}

	.mod-select > span {
		font-family: var(--font-mono);
		font-size: 0.55rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.mod-select select {
		appearance: none;
		height: 27px;
		max-width: 180px;
		border: 1px solid var(--line);
		border-radius: 4px;
		padding: 0 23px 0 7px;
		background:
			url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='6'%3E%3Cpath d='M1 1 L4.5 4.5 L8 1' stroke='%23d0d8d6' fill='none'/%3E%3C/svg%3E")
				no-repeat right 8px center,
			var(--table);
		box-shadow: none;
		outline: 0;
		font-family: var(--font-display);
		font-size: 0.85rem;
		color: var(--text);
		cursor: pointer;
	}

	@media (max-width: 860px) {
		.filter-grid {
			grid-template-columns: 1fr;
		}

		.panel--search {
			order: -1;
		}

		.result-bar {
			flex-wrap: wrap;
			padding: 6px 9px;
		}

		.result-left {
			width: 100%;
		}

		.mod-select {
			margin-left: auto;
		}
	}

	@media (max-width: 460px) {
		.search-row {
			flex-direction: column;
			align-items: stretch;
		}

		.clear-button {
			width: 100%;
		}

		.class-row {
			gap: 8px;
		}

		.class-button {
			width: 30px;
		}

		.result-left {
			flex-wrap: wrap;
			gap: 6px;
		}

		.result-divider {
			display: none;
		}

		.result-count {
			width: 100%;
		}
	}
</style>
