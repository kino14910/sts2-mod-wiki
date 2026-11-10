<script lang="ts">
	import { browser } from '$app/env'
	import { afterNavigate, replaceState } from '$app/navigation'
	import { page } from '$app/state'
	import CardFilters from '#lib/components/CardFilters.svelte'
	import CardRow from '#lib/components/CardRow.svelte'
	import {
		CARD_TYPES,
		COLORS,
		RARITIES,
		resolveCard,
		type Card,
		type CardType,
		type ColorId,
		type Rarity
	} from '#lib/data/cards'
	import { CARDS } from '#lib/data/mods'
	import {
		colorName,
		localizedCards,
		localizedKeyword,
		modName,
		rarityName,
		typeName
	} from '#lib/data/localize'
	import { m } from '#lib/paraglide/messages'
	import { cardTextToPlain } from '#lib/text/card-text'
	import { WindowVirtualizer } from 'virtua/svelte'
	import type { WindowVirtualizerHandle } from 'virtua/svelte'

	const params = browser ? page.url.searchParams : new URLSearchParams()

	let query = $state(params.get('q') ?? '')
	let color = $state(params.get('color') ?? 'all')
	let type = $state(params.get('type') ?? 'all')
	let rarity = $state(params.get('rarity') ?? 'all')
	let cost = $state(params.get('cost') ?? 'all')
	let mod = $state(params.get('mod') ?? 'all')
	let sort = $state(params.get('sort') ?? 'default')
	let multiplayer = $state(params.get('multiplayer') === '1')
	let viewUpgrades = $state(params.get('upgrades') === '1')
	let viewBetaArt = $state(params.get('beta') === '1')

	let upgradedOverrides = $state<Record<string, boolean>>({})

	type CardGroup = Card[]

	// 卡片行高约 236px + 1em 行间距，作为未测量项的尺寸提示以减少滚动跳动
	const ROW_SIZE_HINT = 252

	let list = $state<WindowVirtualizerHandle | undefined>()
	let listWidth = $state(0)
	let listFontSize = $state(16)

	const colorOrder = Object.keys(COLORS) as ColorId[]
	const rarityOrder: Record<Rarity, number> = {
		basic: 0,
		common: 1,
		uncommon: 2,
		rare: 3,
		ancient: 4,
		event: 5,
		token: 6,
		curse: 7,
		status: 8,
		quest: 9
	}
	const typeOrder = Object.keys(CARD_TYPES) as CardType[]

	function costRank(card: Card) {
		if (card.cost === null) return 99
		if (card.cost === 'X') return 9
		return card.cost
	}

	let cards = $derived(localizedCards(CARDS))

	let filtered = $derived.by(() => {
		const q = query.trim().toLowerCase()
		const result = cards.filter((card) => {
			if (color !== 'all' && card.color !== color) return false
			if (type !== 'all' && card.type !== type) return false
			if (rarity !== 'all' && card.rarity !== rarity) return false
			if (mod !== 'all' && card.mod !== mod) return false
			if (cost !== 'all') {
				if (cost === 'unplayable' && card.cost !== null) return false
				if (cost === 'X' && card.cost !== 'X') return false
				if (cost !== 'unplayable' && cost !== 'X') {
					if (typeof card.cost !== 'number') return false
					if (cost === '3' ? card.cost < 3 : card.cost !== Number(cost)) return false
				}
			}
			if (!q) return true

			const modLabel = modName(card.mod)
			const keywordNames = card.keywords
				.map((keyword) => localizedKeyword(keyword))
				.join(' ')
			const view = resolveCard(card, true)
			return [
				card.name,
				cardTextToPlain(card.text, { variables: card.variables }),
				cardTextToPlain(view.text, {
					upgraded: true,
					variables: view.variables,
					baseVariables: view.baseVariables
				}),
				modLabel,
				colorName(card.color),
				typeName(card.type),
				rarityName(card.rarity),
				keywordNames
			]
				.join(' ')
				.toLowerCase()
				.includes(q)
		})

		const direction = sort.endsWith('-desc') ? -1 : 1
		const key = sort.split('-')[0]

		result.sort((a, b) => {
			switch (key) {
				case 'name':
					return a.name.localeCompare(b.name) * direction
				case 'rarity':
					return (rarityOrder[a.rarity] - rarityOrder[b.rarity]) * direction
				case 'type':
					return (typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type)) * direction
				case 'cost':
					return (costRank(a) - costRank(b)) * direction
				case 'color':
					return colorOrder.indexOf(a.color) - colorOrder.indexOf(b.color)
				default:
					return (
						colorOrder.indexOf(a.color) - colorOrder.indexOf(b.color) ||
						rarityOrder[a.rarity] - rarityOrder[b.rarity] ||
						a.name.localeCompare(b.name)
					)
			}
		})

		return result
	})

	function measureList(node: HTMLElement) {
		const update = () => {
			listWidth = node.clientWidth
			listFontSize = parseFloat(getComputedStyle(node).fontSize) || 16
		}
		update()
		const observer = new ResizeObserver(update)
		observer.observe(node)
		return () => observer.disconnect()
	}

	// 列数需与原 grid-cols-[repeat(auto-fit,minmax(30em,1fr))] + gap-[1em] 的轨道数一致
	let columns = $derived.by(() => {
		// SSR 阶段按桌面两列分组，避免 hydration 后行数减半造成列表总高度跳变
		if (!listWidth) return 2
		const min = 30 * listFontSize
		const gap = listFontSize
		return Math.max(1, Math.floor((listWidth + gap) / (min + gap)))
	})

	let groups = $derived.by(() => {
		const result: CardGroup[] = []
		for (let i = 0; i < filtered.length; i += columns) {
			result.push(filtered.slice(i, i + columns))
		}
		return result
	})

	function groupKey(group: CardGroup) {
		return `${group[0]?.id ?? ''}:${group.length}`
	}

	function resetScroll() {
		list?.scrollToIndex(0)
	}

	let modCount = $derived(new Set(filtered.map((card) => card.mod)).size)

	let listCount = $derived(
		filtered.length === 1
			? m.cards_count_one({ count: filtered.length, mods: modCount })
			: m.cards_count_many({ count: filtered.length, mods: modCount })
	)

	afterNavigate(({ to }) => {
		if (!to) return
		const search = to.url.searchParams
		query = search.get('q') ?? ''
		color = search.get('color') ?? 'all'
		type = search.get('type') ?? 'all'
		rarity = search.get('rarity') ?? 'all'
		cost = search.get('cost') ?? 'all'
		mod = search.get('mod') ?? 'all'
		sort = search.get('sort') ?? 'default'
		multiplayer = search.get('multiplayer') === '1'
		viewUpgrades = search.get('upgrades') === '1'
		viewBetaArt = search.get('beta') === '1'
	})

	function syncUrl() {
		const next = new URLSearchParams()
		if (query.trim()) next.set('q', query.trim())
		if (color !== 'all') next.set('color', color)
		if (type !== 'all') next.set('type', type)
		if (rarity !== 'all') next.set('rarity', rarity)
		if (cost !== 'all') next.set('cost', cost)
		if (mod !== 'all') next.set('mod', mod)
		if (sort !== 'default') next.set('sort', sort)
		if (multiplayer) next.set('multiplayer', '1')
		if (viewUpgrades) next.set('upgrades', '1')
		if (viewBetaArt) next.set('beta', '1')

		const url = new URL(page.url.href)
		url.search = next.toString()
		replaceState(url, {})
	}

	function handleFilterChange() {
		syncUrl()
		resetScroll()
	}

	function clearAll() {
		query = ''
		color = 'all'
		type = 'all'
		rarity = 'all'
		cost = 'all'
		mod = 'all'
		sort = 'default'
		multiplayer = false
		viewUpgrades = false
		viewBetaArt = false
		upgradedOverrides = {}
		syncUrl()
		resetScroll()
	}

	function isUpgraded(card: Card) {
		return upgradedOverrides[card.id] ?? viewUpgrades
	}

	function toggleUpgraded(card: Card) {
		upgradedOverrides[card.id] = !isUpgraded(card)
	}

	function resetUpgrades() {
		upgradedOverrides = {}
	}
</script>

<svelte:head>
	<title>{m.cards_meta_title()}</title>
	<meta name="description" content={m.cards_meta_description()} />
</svelte:head>

<div class="glossary-page">
	<section class="pb-5 pt-[clamp(22px,3vw,34px)]">
		<div class="wrap">
			<nav
				class="mb-3.5 flex items-center gap-2 font-mono text-[0.58rem] tracking-[0.06em] text-muted"
				aria-label={m.breadcrumb()}
			>
				<span>{m.game_title()}</span>
				<span aria-hidden="true">/</span>
				<span class="text-ink-dim" aria-current="page">{m.nav_cards()}</span>
			</nav>

			<header class="border-b border-line pb-4">
				<h1
					class="display flex flex-wrap items-baseline gap-2.5 text-[clamp(1.8rem,3.2vw,2.4rem)] font-normal text-gold max-[520px]:text-[1.65rem]"
				>
					{m.cards_heading()}
					<span class="font-normal text-line-bright">|</span>
					<span class="font-display text-[0.9em] font-normal text-ink-dim">{m.game_title()}</span>
				</h1>
			</header>

			<div
				class="my-3.5 flex items-start gap-2.5 rounded-md border-2 border-line-strong bg-surface-2 px-2.75 py-2 text-ink-dim"
			>
				<span
					class="grid size-5 flex-none place-items-center rounded-full border border-line-strong font-display text-[0.8rem] text-gold"
					aria-hidden="true">i</span
				>
				<p class="text-[0.78rem] leading-[1.55] max-[520px]:text-[0.73rem]">
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
				onchange={handleFilterChange}
				onclear={clearAll}
				onviewupgrades={resetUpgrades}
			/>

			<div
				class="mb-2.5 mt-6.5 flex items-baseline justify-between gap-4 border-b border-line pb-2 max-[520px]:mt-5"
			>
				<h2 class="display text-[1.45rem] font-normal text-gold max-[520px]:text-[1.25rem]">
					{m.cards_list_heading()}
				</h2>
				<p class="text-[0.7rem] text-muted">
					{listCount}
				</p>
			</div>

			{#if filtered.length}
				<div {@attach measureList}>
					<WindowVirtualizer
						bind:this={list}
						data={groups}
						getKey={groupKey}
						bufferSize={400}
						itemSize={ROW_SIZE_HINT}
						ssrCount={6}
					>
						{#snippet children(group: CardGroup, index: number)}
							<div
								class="grid grid-cols-[repeat(auto-fit,minmax(30em,1fr))] items-start gap-[1em] pb-[1em]"
							>
								{#each group as card, cardIndex (card.id)}
									<CardRow
										{card}
										upgraded={isUpgraded(card)}
										priority={index === 0 && cardIndex === 0}
										onupgraded={() => toggleUpgraded(card)}
									/>
								{/each}
							</div>
						{/snippet}
					</WindowVirtualizer>
				</div>
			{:else}
				<div
					class="mt-4 flex min-h-65 flex-col items-center justify-center gap-2.5 rounded border border-line bg-row p-8 text-center"
				>
					<span class="text-[1.4rem] text-gold opacity-[0.55]" aria-hidden="true">◇</span>
					<h2 class="display text-[1.3rem] text-gold">{m.cards_empty_title()}</h2>
					<p class="text-[0.8rem] text-muted">{m.cards_empty_body()}</p>
					<button class="button" type="button" onclick={clearAll}>{m.clear_all()}</button>
				</div>
			{/if}
		</div>
	</section>
</div>
