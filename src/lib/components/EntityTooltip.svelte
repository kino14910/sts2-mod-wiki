<script lang="ts">
	import { COLORS, colorInfo, rarityInfo, type Card } from '#lib/data/cards'
	import { RARITY_META, type CollectionEntry } from '#lib/data/collections'
	import {
		localizedCard,
		localizedCollection,
		rarityName,
		typeName,
		colorName,
		collectionRarityName,
		collectionCharacterName,
		isZh
	} from '#lib/data/localize'
	import { m } from '#lib/paraglide/messages'
	import CardDescription from '#lib/components/CardDescription.svelte'
	import CardTypeIcon from '#lib/components/CardTypeIcon.svelte'
	import GameText from '#lib/components/GameText.svelte'
	import type { GameEntity } from '#lib/data/entities'

	let { entity }: { entity: GameEntity } = $props()

	let card = $derived(entity.kind === 'card' ? (entity.data as Card) : null)
	let entry = $derived(
		entity.kind === 'relic' || entity.kind === 'potion'
			? (entity.data as CollectionEntry)
			: null
	)
	let cardView = $derived(card ? localizedCard(card) : null)
	let entryView = $derived(entry ? localizedCollection(entry) : null)

	let rarityColor = $derived(
		card ? rarityInfo(card.rarity).color : entry ? RARITY_META[entry.rarity].color : '#ffffff'
	)
	let charColor = $derived(
		card
			? colorInfo(card.color).accent
			: entry && entry.character !== 'any'
				? (COLORS[entry.character]?.accent ?? '#ffffff')
				: '#ffffff'
	)
	let costLabel = $derived.by(() => {
		if (!card) return ''
		if (card.cost === null) return m.unplayable()
		if (card.cost === 'X') return 'X'
		return `${card.cost} Energy`
	})
	let kindLabel = $derived(
		entry
			? entry.kind === 'relic'
				? isZh()
					? '遗物'
					: 'Relic'
				: isZh()
					? '药水'
					: 'Potion'
			: ''
	)
	let onlyLabel = $derived(isZh() ? '专属' : 'Only')
	let art = $derived(card ? (card.thumb ?? card.image ?? '') : '')
</script>

{#if card && cardView}
	<div class="entip entip-card">
		<div class="entip-body">
			<div class="entip-head">
				<span class="entip-type"><CardTypeIcon type={card.type} size={18} /></span>
				<span class="tooltip-title">{cardView.name}</span>
			</div>
			<div class="entip-meta">
				<span class="entip-seg">{costLabel}</span>
				<span class="entip-seg" style:color={rarityColor}>{rarityName(card.rarity)}</span>
				<span class="entip-seg">{typeName(card.type)}</span>
				<span class="entip-seg" style:color={charColor}>{colorName(card.color)}</span>
			</div>
			<hr class="entip-rule" />
			<div class="entip-desc">
				<CardDescription card={cardView} variant="article" />
			</div>
		</div>
		{#if art}
			<div class="card-tooltip-art">
				<img
					class="card-tooltip-art-image"
					src={art}
					alt=""
					loading="lazy"
					decoding="async"
				/>
			</div>
		{/if}
	</div>
{:else if entry && entryView}
	<div class="entip entip-relic">
		<div class="entip-head">
			{#if entry.image}
				<img class="entip-icon" src={entry.image} alt="" loading="lazy" decoding="async" />
			{/if}
			<div class="entip-headtext">
				<span class="tooltip-title">{entryView.name}</span>
				<div class="entip-meta">
					<span class="entip-seg" style:color={rarityColor}
						>{collectionRarityName(entry.rarity)} {kindLabel}</span
					>
					{#if entry.character !== 'any'}
						<span class="entip-seg" style:color={charColor}
							>{collectionCharacterName(entry.character)} {onlyLabel}</span
						>
					{/if}
				</div>
			</div>
		</div>
		<hr class="entip-rule" />
		<div class="entip-desc">
			<GameText text={entryView.text} options={{ mode: 'collection', matchEntities: false, interactive: false }} />
		</div>
	</div>
{/if}

<style>
	.entip {
		display: flex;
		gap: 10px;
	}

	.entip-card {
		align-items: stretch;
	}

	.entip-body {
		min-width: 0;
		flex: 1 1 auto;
	}

	.entip-relic {
		flex-direction: column;
	}

	.entip-head {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.entip-relic .entip-head {
		align-items: flex-start;
	}

	.entip-type {
		display: inline-flex;
		color: var(--text-dim);
	}

	.entip-icon {
		width: 46px;
		height: 46px;
		flex: none;
		object-fit: contain;
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.3);
		padding: 3px;
	}

	.entip-headtext {
		min-width: 0;
	}

	.entip-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5em;
		margin-top: 2px;
		font-size: 0.82rem;
		color: #f3efe0;
	}

	.entip-seg {
		white-space: nowrap;
	}

	.entip-rule {
		margin: 6px 0;
		border: none;
		border-top: 1px solid rgba(255, 255, 255, 0.18);
	}

	.entip-desc {
		font-size: 0.92rem;
		line-height: 1.45;
	}

	.entip-card .entip-desc {
		max-width: 58ch;
	}

	.entip-relic .entip-desc {
		max-width: 68ch;
	}

	.entip-desc :global(.sts-collection-icon),
	.entip-desc :global(.sts-energy-icon) {
		display: inline-block;
		height: 1.05em;
		width: auto;
		margin: 0 0.05em;
		vertical-align: -0.15em;
	}

	.card-tooltip-art {
		align-self: center;
		flex: none;
		padding: 4px;
	}

	.card-tooltip-art-image {
		display: block;
		width: 128px;
		height: auto;
		max-height: 168px;
		object-fit: contain;
		border-radius: 6px;
	}
</style>
