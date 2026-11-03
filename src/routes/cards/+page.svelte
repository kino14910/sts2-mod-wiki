<script lang="ts">
	import { afterNavigate, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import CardFilters from '#lib/components/CardFilters.svelte';
	import CardRow from '#lib/components/CardRow.svelte';
	import {
		CARDS,
		CARD_TYPES,
		COLORS,
		MODS,
		RARITIES,
		type Card,
		type CardType,
		type ColorId,
		type Rarity
	} from '#lib/data/cards';
	import { ENTRY_BY_ID } from '#lib/data/glossary';
	import {
		colorName,
		localizedCards,
		localizedEntry,
		modName,
		rarityName,
		typeName
	} from '#lib/data/localize';
	import { m } from '#lib/paraglide/messages';

	const params = page.url.searchParams;

	let query = $state(params.get('q') ?? '');
	let color = $state(params.get('color') ?? 'all');
	let type = $state(params.get('type') ?? 'all');
	let rarity = $state(params.get('rarity') ?? 'all');
	let cost = $state(params.get('cost') ?? 'all');
	let mod = $state(params.get('mod') ?? 'all');
	let sort = $state(params.get('sort') ?? 'default');
	let multiplayer = $state(params.get('multiplayer') === '1');
	let viewUpgrades = $state(params.get('upgrades') === '1');
	let viewBetaArt = $state(params.get('beta') === '1');

	let upgradedOverrides = $state<Record<string, boolean>>({});

	const colorOrder = Object.keys(COLORS) as ColorId[];
	const rarityOrder: Record<Rarity, number> = {
		basic: 0,
		common: 1,
		uncommon: 2,
		rare: 3,
		ancient: 4,
		event: 5,
		token: 6
	};
	const typeOrder = Object.keys(CARD_TYPES) as CardType[];

	function costRank(card: Card) {
		if (card.cost === null) return 99;
		if (card.cost === 'X') return 9;
		return card.cost;
	}

	let cards = $derived(localizedCards(CARDS));

	let filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const result = cards.filter((card) => {
			if (color !== 'all' && card.color !== color) return false;
			if (type !== 'all' && card.type !== type) return false;
			if (rarity !== 'all' && card.rarity !== rarity) return false;
			if (mod !== 'all' && card.mod !== mod) return false;
			if (cost !== 'all') {
				if (cost === 'unplayable' && card.cost !== null) return false;
				if (cost === 'X' && card.cost !== 'X') return false;
				if (cost !== 'unplayable' && cost !== 'X') {
					if (typeof card.cost !== 'number') return false;
					if (cost === '3' ? card.cost < 3 : card.cost !== Number(cost)) return false;
				}
			}
			if (!q) return true;

			const modLabel = modName(card.mod);
			const keywordNames = card.keywords
				.map((id) => {
					const entry = ENTRY_BY_ID.get(id);
					return entry ? localizedEntry(entry).name : '';
				})
				.join(' ');
			return [
				card.name,
				card.text,
				card.upgradedText,
				modLabel,
				colorName(card.color),
				typeName(card.type),
				rarityName(card.rarity),
				keywordNames
			]
				.join(' ')
				.toLowerCase()
				.includes(q);
		});

		const direction = sort.endsWith('-desc') ? -1 : 1;
		const key = sort.split('-')[0];

		result.sort((a, b) => {
			switch (key) {
				case 'name':
					return a.name.localeCompare(b.name) * direction;
				case 'rarity':
					return (rarityOrder[a.rarity] - rarityOrder[b.rarity]) * direction;
				case 'type':
					return (typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type)) * direction;
				case 'cost':
					return (costRank(a) - costRank(b)) * direction;
				case 'color':
					return colorOrder.indexOf(a.color) - colorOrder.indexOf(b.color);
				default:
					return (
						colorOrder.indexOf(a.color) - colorOrder.indexOf(b.color) ||
						rarityOrder[a.rarity] - rarityOrder[b.rarity] ||
						a.name.localeCompare(b.name)
					);
			}
		});

		return result;
	});

	afterNavigate(({ to }) => {
		if (!to) return;
		const search = to.url.searchParams;
		query = search.get('q') ?? '';
		color = search.get('color') ?? 'all';
		type = search.get('type') ?? 'all';
		rarity = search.get('rarity') ?? 'all';
		cost = search.get('cost') ?? 'all';
		mod = search.get('mod') ?? 'all';
		sort = search.get('sort') ?? 'default';
		multiplayer = search.get('multiplayer') === '1';
		viewUpgrades = search.get('upgrades') === '1';
		viewBetaArt = search.get('beta') === '1';
	});

	function syncUrl() {
		const next = new URLSearchParams();
		if (query.trim()) next.set('q', query.trim());
		if (color !== 'all') next.set('color', color);
		if (type !== 'all') next.set('type', type);
		if (rarity !== 'all') next.set('rarity', rarity);
		if (cost !== 'all') next.set('cost', cost);
		if (mod !== 'all') next.set('mod', mod);
		if (sort !== 'default') next.set('sort', sort);
		if (multiplayer) next.set('multiplayer', '1');
		if (viewUpgrades) next.set('upgrades', '1');
		if (viewBetaArt) next.set('beta', '1');

		const url = new URL(page.url.href);
		url.search = next.toString();
		replaceState(url, {});
	}

	function clearAll() {
		query = '';
		color = 'all';
		type = 'all';
		rarity = 'all';
		cost = 'all';
		mod = 'all';
		sort = 'default';
		multiplayer = false;
		viewUpgrades = false;
		viewBetaArt = false;
		upgradedOverrides = {};
		syncUrl();
	}

	function isUpgraded(card: Card) {
		return upgradedOverrides[card.id] ?? viewUpgrades;
	}

	function toggleUpgraded(card: Card) {
		upgradedOverrides[card.id] = !isUpgraded(card);
	}
</script>

<svelte:head>
	<title>{m.cards_meta_title()}</title>
	<meta name="description" content={m.cards_meta_description()} />
</svelte:head>

<section class="page">
	<div class="wrap">
		<nav class="crumbs" aria-label={m.breadcrumb()}>
			<span>{m.game_title()}</span>
			<span aria-hidden="true">/</span>
			<span aria-current="page">{m.nav_cards()}</span>
		</nav>

		<header class="page-head">
			<h1 class="display">
				{m.cards_heading()}
				<span class="title-sep">|</span>
				<span class="title-sub">{m.game_title()}</span>
			</h1>
			<p class="lede">{m.cards_lede()}</p>
		</header>

		<div class="notice">
			<span class="notice-mark" aria-hidden="true">i</span>
			<p>
				<i>{m.cards_notice()}</i>
			</p>
		</div>

		<CardFilters
			bind:query
			bind:color
			bind:type
			bind:rarity
			bind:cost
			bind:mod
			bind:sort
			bind:multiplayer
			bind:viewUpgrades
			bind:viewBetaArt
			count={filtered.length}
			onchange={syncUrl}
			onclear={clearAll}
		/>

		<div class="list-head">
			<h2 class="display">{m.cards_list_heading()}</h2>
			<p>
				{filtered.length === 1
					? m.cards_count_one({ count: filtered.length, mods: MODS.length })
					: m.cards_count_many({ count: filtered.length, mods: MODS.length })}
			</p>
		</div>

		{#if filtered.length}
			<div class="card-list">
				{#each filtered as card (card.id)}
					<CardRow
						{card}
						upgraded={isUpgraded(card)}
						onupgraded={() => toggleUpgraded(card)}
					/>
				{/each}
			</div>
		{:else}
			<div class="empty">
				<span class="empty-mark" aria-hidden="true">◇</span>
				<h2 class="display">{m.cards_empty_title()}</h2>
				<p>{m.cards_empty_body()}</p>
				<button class="button" type="button" onclick={clearAll}>{m.clear_all()}</button>
			</div>
		{/if}
	</div>
</section>

<style>
	.page {
		padding: clamp(22px, 3vw, 34px) 0 20px;
	}

	.crumbs {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 14px;
		font-family: var(--font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.06em;
		color: var(--muted);
	}

	.crumbs span[aria-current='page'] {
		color: var(--text-dim);
	}

	.page-head {
		padding-bottom: 16px;
		border-bottom: 1px solid var(--line);
	}

	.page-head h1 {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 10px;
		font-size: clamp(1.8rem, 3.2vw, 2.4rem);
		font-weight: 400;
		color: var(--gold);
	}

	.title-sep {
		color: var(--line-bright);
		font-weight: 400;
	}

	.title-sub {
		font-family: var(--font-display);
		font-size: 0.9em;
		font-weight: 400;
		color: var(--text-dim);
	}

	.page-head .lede {
		margin-top: 8px;
		font-size: 0.85rem;
	}

	.notice {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		margin: 14px 0 14px;
		padding: 8px 11px;
		border: 2px solid var(--line-strong);
		border-radius: 6px;
		background: var(--surface-secondary);
		color: var(--text-dim);
	}

	.notice-mark {
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		flex: none;
		border: 1px solid var(--line-strong);
		border-radius: 50%;
		font-family: var(--font-display);
		font-size: 0.8rem;
		color: var(--gold);
	}

	.notice p {
		font-size: 0.78rem;
		line-height: 1.55;
	}

	.list-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
		margin: 26px 0 10px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--line);
	}

	.list-head h2 {
		font-size: 1.45rem;
		font-weight: 400;
		color: var(--gold);
	}

	.list-head p {
		font-size: 0.7rem;
		color: var(--muted);
	}

	.card-list {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(30em, 1fr));
		gap: 1em;
		align-items: start;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		min-height: 260px;
		margin-top: 16px;
		padding: 32px;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: var(--row);
		text-align: center;
	}

	.empty-mark {
		font-size: 1.4rem;
		color: var(--gold);
		opacity: 0.55;
	}

	.empty h2 {
		font-size: 1.3rem;
		color: var(--gold);
	}

	.empty p {
		font-size: 0.8rem;
		color: var(--muted);
	}

	@media (max-width: 520px) {
		.page-head h1 {
			font-size: 1.65rem;
		}

		.notice p {
			font-size: 0.73rem;
		}

		.list-head {
			margin-top: 20px;
		}

		.list-head h2 {
			font-size: 1.25rem;
		}
	}
</style>
