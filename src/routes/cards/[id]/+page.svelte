<script lang="ts">
	import { resolve } from '$app/paths';
	import CardRow from '#lib/components/CardRow.svelte';
	import CardThumb from '#lib/components/CardThumb.svelte';
	import Motif from '#lib/components/Motif.svelte';
	import RichText from '#lib/components/RichText.svelte';
	import { COLORS, cardHref } from '#lib/data/cards';
	import {
		colorName,
		localizedCard,
		localizedEntries,
		modName,
		rarityName,
		typeName
	} from '#lib/data/localize';
	import { ENTRY_BY_ID, glossaryHref } from '#lib/data/glossary';
	import { m } from '#lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let card = $derived(localizedCard(data.card));
	let accent = $derived(COLORS[data.card.color].accent);
	let colorLabel = $derived(colorName(data.card.color));
	let rarityLabel = $derived(rarityName(data.card.rarity));
	let typeLabel = $derived(typeName(data.card.type));
	let modLabel = $derived(modName(data.card.mod));
	let upgraded = $state(false);

	let shownCard = $derived(
		upgraded
			? {
					...card,
					name: `${card.name}+`,
					text: card.upgradedText,
					cost: card.upgradedCost ?? card.cost
				}
			: card
	);

	let keywords = $derived(
		localizedEntries(
			data.card.keywords
				.map((id) => ENTRY_BY_ID.get(id))
				.filter((entry) => entry !== undefined)
		)
	);

	let costLabel = $derived(
		shownCard.cost === null ? m.unplayable() : shownCard.cost === 'X' ? 'X' : shownCard.cost
	);
</script>

<svelte:head>
	<title>{m.card_meta_title({ name: card.name })}</title>
	<meta
		name="description"
		content={m.card_meta_description({ name: card.name, text: card.text, mod: modLabel })}
	/>
</svelte:head>

<section class="page" style:--accent={accent}>
	<div class="wrap">
		<nav class="crumbs" aria-label={m.breadcrumb()}>
			<a href={resolve('/cards')}>{m.nav_cards()}</a>
			<span aria-hidden="true">/</span>
			<a href="{resolve('/cards')}?color={data.card.color}">{colorLabel}</a>
			<span aria-hidden="true">/</span>
			<span aria-current="page">{card.name}</span>
		</nav>

		<div class="detail-layout">
			<div class="card-stage">
				<CardThumb card={shownCard} />
				<p class="stage-note">{upgraded ? m.card_upgraded_note() : m.card_base_note()}</p>
			</div>

			<div class="detail-main">
				<div class="detail-head">
					<h1 class="display">{shownCard.name}</h1>
					<p class="meta">{rarityLabel} - {colorLabel} - {typeLabel}</p>
					<p class="origin">
						{m.card_from_label()}
						<a href="{resolve('/cards')}?mod={data.card.mod}">{modLabel}</a>
					</p>
				</div>

				<div class="text-panel">
					<div class="text-tabs">
						<button type="button" aria-pressed={!upgraded} onclick={() => (upgraded = false)}>{m.card_tab_base()}</button>
						<button type="button" aria-pressed={upgraded} onclick={() => (upgraded = true)}>{m.card_tab_upgraded()}</button>
					</div>

					<div class="card-text">
						<RichText text={shownCard.text} />
					</div>

					<div class="text-meta">
						<span>{m.card_cost()} <strong>{costLabel}</strong></span>
						<span>{upgraded ? m.card_upgraded_text() : m.card_base_text()}</span>
						{#if upgraded && data.card.upgradedCost !== undefined && data.card.upgradedCost !== data.card.cost}
							<span>{m.card_base_cost()} <strong>{data.card.cost === null ? '—' : data.card.cost}</strong></span>
						{/if}
					</div>
				</div>

				{#if keywords.length}
					<section class="rules" aria-labelledby="rules-heading">
						<div class="rules-head">
							<h2 id="rules-heading" class="display">{m.card_linked_rules()}</h2>
							<span>{keywords.length === 1
								? m.card_entries_one({ count: keywords.length })
								: m.card_entries_many({ count: keywords.length })}</span>
						</div>
						<div class="rule-list">
							{#each keywords as entry (entry.id)}
								<a class="rule-row" href={glossaryHref(entry)}>
									<span class="rule-icon"><Motif name={entry.motif ?? 'spiral'} /></span>
									<span class="rule-copy">
										<span class="rule-name">{entry.name}</span>
										<span class="rule-summary">{entry.summary}</span>
									</span>
									<span class="rule-arrow" aria-hidden="true">→</span>
								</a>
							{/each}
						</div>
					</section>
				{/if}

				<div class="facts">
					<span>{rarityLabel}</span>
					<span>{colorLabel}</span>
					<span>{typeLabel}</span>
					<span>{modLabel}</span>
				</div>
			</div>
		</div>

		<section class="related" aria-labelledby="related-heading">
			<div class="list-head">
				<h2 id="related-heading" class="display">{m.card_more()}</h2>
				<a href={resolve('/cards')}>{m.card_back()}</a>
			</div>
			<div class="related-list">
				{#each data.related as entry (entry.id)}
					<CardRow card={entry} showActions={false} />
				{/each}
			</div>
		</section>

		<nav class="card-nav" aria-label={m.card_nav_label()}>
			{#if data.prev}
				<a class="nav-card" href={cardHref(data.prev)}>
					<span>{m.card_prev()}</span>
					<strong class="display">{localizedCard(data.prev).name}</strong>
				</a>
			{:else}
				<span></span>
			{/if}
			{#if data.next}
				<a class="nav-card nav-card--next" href={cardHref(data.next)}>
					<span>{m.card_next()}</span>
					<strong class="display">{localizedCard(data.next).name}</strong>
				</a>
			{/if}
		</nav>
	</div>
</section>

<style>
	.page {
		padding: clamp(22px, 3vw, 34px) 0 20px;
	}

	.crumbs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-bottom: 18px;
		font-family: var(--font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.06em;
		color: var(--muted);
	}

	.crumbs a:hover {
		color: var(--gold);
	}

	.crumbs span[aria-current='page'] {
		color: var(--text-dim);
	}

	.detail-layout {
		display: grid;
		grid-template-columns: minmax(170px, 232px) minmax(0, 1fr);
		gap: clamp(26px, 4.5vw, 56px);
		align-items: start;
		padding: 8px 0 6px;
	}

	.card-stage {
		position: sticky;
		top: calc(var(--header-height) + 24px);
	}

	.stage-note {
		margin-top: 8px;
		text-align: center;
		font-family: var(--font-mono);
		font-size: 0.54rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.detail-main {
		min-width: 0;
	}

	.detail-head {
		padding-bottom: 14px;
		border-bottom: 1px solid var(--line);
	}

	.detail-head h1 {
		font-size: clamp(1.9rem, 3.8vw, 2.9rem);
		font-weight: 400;
		line-height: 1.1;
		color: var(--gold);
		text-wrap: balance;
	}

	.meta {
		margin-top: 4px;
		font-size: 0.74rem;
		color: var(--muted);
	}

	.origin {
		margin-top: 8px;
		font-size: 0.76rem;
		color: var(--muted);
	}

	.origin a {
		color: var(--gold-soft);
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 3px;
	}

	.origin a:hover {
		color: var(--gold);
	}

	.text-panel {
		margin-top: 14px;
		padding: 12px 14px;
		border: 2px solid var(--tooltip-border);
		border-radius: 6px;
		background: var(--tooltip-bg);
	}

	.text-tabs {
		display: inline-flex;
		gap: 4px;
	}

	.text-tabs button {
		height: 27px;
		padding: 0 10px;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--button);
		font-size: 0.68rem;
		color: var(--text-dim);
		transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
	}

	.text-tabs button:hover {
		background: var(--button-hover);
		border-color: var(--line-strong);
	}

	.text-tabs button[aria-pressed='true'] {
		border-color: mediumseagreen;
		background: mediumseagreen;
		color: oklch(0 0 0);
	}

	.card-text {
		padding: 18px 8px 14px;
		text-align: center;
		font-size: clamp(0.92rem, 1.6vw, 1.06rem);
		line-height: 1.6;
		color: var(--text);
		text-wrap: pretty;
	}

	.text-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 13px;
		padding-top: 10px;
		border-top: 1px solid var(--line);
		font-family: var(--font-mono);
		font-size: 0.53rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.text-meta strong {
		font-family: var(--font-display);
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0;
		color: var(--text-dim);
	}

	.rules {
		margin-top: 20px;
	}

	.rules-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 14px;
		padding-bottom: 6px;
		border-bottom: 1px solid var(--line);
	}

	.rules-head h2 {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--gold);
	}

	.rules-head span {
		font-size: 0.63rem;
		color: var(--muted);
	}

	.rule-list {
		display: flex;
		flex-direction: column;
		gap: 5px;
		margin-top: 7px;
	}

	.rule-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 10px;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--row);
		transition: border-color 0.16s ease, background 0.16s ease;
	}

	.rule-row:hover {
		border-color: var(--accent);
		background: var(--surface-secondary);
	}

	.rule-icon {
		width: 25px;
		height: 25px;
		flex: none;
		padding: 4px;
		border: 1px solid var(--line-strong);
		border-radius: 50%;
		color: var(--gold-soft);
	}

	.rule-copy {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.rule-name {
		font-family: var(--font-display);
		font-size: 0.92rem;
		color: var(--text);
	}

	.rule-summary {
		font-size: 0.68rem;
		color: var(--muted);
		line-height: 1.4;
	}

	.rule-arrow {
		margin-left: auto;
		font-size: 0.75rem;
		color: var(--gold-soft);
		opacity: 0.65;
	}

	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-top: 18px;
	}

	.facts span {
		padding: 3px 8px;
		border: 1px solid var(--line);
		border-radius: 3px;
		font-size: 0.63rem;
		color: var(--muted);
	}

	.related {
		margin-top: clamp(34px, 5vw, 56px);
	}

	.list-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--line);
	}

	.list-head h2 {
		font-size: 1.4rem;
		font-weight: 400;
		color: var(--gold);
	}

	.list-head a {
		font-size: 0.68rem;
		color: var(--muted);
		transition: color 0.16s ease;
	}

	.list-head a:hover {
		color: var(--gold);
	}

	.related-list {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(30em, 1fr));
		gap: 1em;
		margin-top: 8px;
	}

	.card-nav {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		margin-top: 28px;
		padding-top: 12px;
		border-top: 1px solid var(--line);
	}

	.nav-card {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.nav-card--next {
		margin-left: auto;
		text-align: right;
	}

	.nav-card span {
		font-family: var(--font-mono);
		font-size: 0.53rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.nav-card strong {
		font-size: 0.92rem;
		font-weight: 600;
		color: var(--text-dim);
		transition: color 0.16s ease;
	}

	.nav-card:hover strong {
		color: var(--gold);
	}

	@media (max-width: 760px) {
		.detail-layout {
			grid-template-columns: 1fr;
			gap: 20px;
		}

		.card-stage {
			position: static;
			width: min(210px, 56vw);
		}

		.detail-head h1 {
			font-size: clamp(1.7rem, 8vw, 2.3rem);
		}
	}

	@media (max-width: 480px) {
		.card-stage {
			width: min(180px, 52vw);
		}

		.related-list {
			gap: 5px;
		}
	}
</style>
