<script lang="ts">
	import { resolve } from '$app/paths'
	import CardRow from '#lib/components/CardRow.svelte'
	import DetailTitle from '#lib/components/DetailTitle.svelte'
	import InfoBox from '#lib/components/InfoBox.svelte'
	import Motif from '#lib/components/Motif.svelte'
	import RichText from '#lib/components/RichText.svelte'
	import WikiSources from '#lib/components/WikiSources.svelte'
	import WikiText from '#lib/components/WikiText.svelte'
	import type { CollectionEntry, CollectionKind } from '#lib/data/collections'
	import { powerHref } from '#lib/data/glossary'
	import {
		behaviorName,
		groupName,
		localizedCollections,
		localizedEntries,
		localizedEntry,
		modName,
		stackName
	} from '#lib/data/localize'
	import { m } from '#lib/paraglide/messages'
	import { collectionTextToPlain } from '#lib/text/collection-text'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	let entry = $derived(localizedEntry(data.entry))
	let wiki = $derived(data.wiki)
	let intro = $derived(data.intro)
	let relatedPowers = $derived(localizedEntries(data.powers))
	let relics = $derived(localizedCollections(data.relics))
	let potions = $derived(localizedCollections(data.potions))
	let modLabel = $derived(entry.mod ? modName(entry.mod) : '')

	let showAllCards = $state(false)
	let visibleCards = $derived(showAllCards ? data.cards : data.cards.slice(0, 6))
	let sourceCount = $derived(
		data.cards.length + relics.length + potions.length + relatedPowers.length
	)
</script>

<svelte:head>
	<title>{m.power_meta_title({ name: entry.name })}</title>
	<meta
		name="description"
		content={m.power_meta_description({
			name: entry.name,
			text: entry.summary,
			mod: modLabel
		})}
	/>
</svelte:head>

{#snippet collectionRows(items: CollectionEntry[], kind: CollectionKind)}
	<div class="mini-list">
		{#each items as item (`${kind}-${item.id}`)}
			<a
				class="mini-row"
				href={`${resolve(kind === 'relic' ? '/relics' : '/potions')}#${kind}-${item.id}`}
			>
				<span class="mini-icon">
					{#if item.image}
						<img src={item.image} alt="" loading="lazy" decoding="async" />
					{/if}
				</span>
				<span class="mini-copy">
					<span class="mini-name">{item.name}</span>
					<span class="mini-text">{collectionTextToPlain(item.text)}</span>
				</span>
				<span class="mini-arrow" aria-hidden="true">→</span>
			</a>
		{/each}
	</div>
{/snippet}

{#snippet sourceHeading(label: string, count: number)}
	<h3 class="group-title display">
		{label}
		<span class="count">{count}</span>
	</h3>
{/snippet}

<div class="glossary-page">
	<section class="page">
		<div class="wrap">
			<nav class="crumbs" aria-label={m.breadcrumb()}>
				<a href={resolve('/cards')}>{m.nav_cards()}</a>
				<span aria-hidden="true">/</span>
				<a href={resolve('/powers')}>{m.nav_powers()}</a>
				<span aria-hidden="true">/</span>
				<span aria-current="page">{entry.name}</span>
			</nav>

			{#if wiki}
				<article class="wiki-page">
					<DetailTitle name={entry.name} />
					<InfoBox
						tone="druid"
						element="div"
						id="druid-container-1"
						class="druid-infobox druid-container noexcerpt druid-container-small"
					>
						{#snippet title()}
							<div class="druid-row druid-row-Title" data-druid-section-row="Main">
								<div class="druid-data druid-data-Title druid-data-nonempty druid-data-wide">
									<a class="image" href={entry.icon}>
										<img
											alt={`StS2 Icon ${wiki.title}.png`}
											src={entry.icon}
											width="30"
											height="30"
										/>
									</a>
									{entry.name}
								</div>
							</div>
						{/snippet}

						<div class="druid-section-container">
							<div class="druid-row druid-row-StackType" data-druid-section-row="Main">
								<div class="druid-label druid-label-StackType">Stack Type</div>
								<div class="druid-data druid-data-StackType druid-data-nonempty">
									{wiki.stackType}
								</div>
							</div>
							<div class="druid-row druid-row-Text" data-druid-section-row="Main">
							<div class="druid-data druid-data-Text druid-data-nonempty druid-data-wide">
								<WikiText text={wiki.text} />
							</div>
							</div>
						</div>
					</InfoBox>

				{#each intro as paragraph (paragraph)}
					<p class="wiki-intro"><WikiText text={paragraph} /></p>
				{/each}
					<div class="wiki-clear"></div>

					<section aria-labelledby="Sources">
						<h2 class="wiki-section-title"><span class="mw-headline" id="Sources">Sources</span></h2>
						{#each wiki.sources as details (details.summary)}
							<WikiSources {details} />
						{/each}
					</section>

					<section aria-labelledby="Interactions">
						<h2 class="wiki-section-title">
							<span class="mw-headline" id="Interactions">Interactions</span>
						</h2>
						{#each wiki.interactions as details (details.summary)}
							<WikiSources {details} />
						{/each}

						<h3 class="wiki-section-title wiki-h3">
							<span class="mw-headline" id="Order">Order</span>
						</h3>
						<ul class="wiki-prose">
							{#each wiki.order as item (item)}
								<li><WikiText text={item} /></li>
							{/each}
						</ul>

						<h3 class="wiki-section-title wiki-h3">
							<span class="mw-headline" id="Effects_Immune_to_Vulnerable">
								Effects Immune to Vulnerable
							</span>
						</h3>
						<ul class="wiki-prose">
							{#each wiki.effectsImmune as item (item)}
								<li><WikiText text={item} /></li>
							{/each}
						</ul>
					</section>
				</article>
			{:else}
				<div class="detail-layout">
					<aside class="infobox" aria-label={entry.name}>
						<div class="box-title">
							<span class="box-icon">
								{#if entry.icon}
									<img src={entry.icon} alt="" loading="lazy" decoding="async" />
								{:else}
									<Motif name={entry.motif ?? 'spiral'} />
								{/if}
							</span>
							<span class="box-name display">{entry.name}</span>
						</div>

						<dl class="facts">
							{#if entry.stack}
								<div><dt>{m.power_stack_type()}</dt><dd>{stackName(entry.stack)}</dd></div>
							{/if}
							{#if entry.behavior}
								<div><dt>{m.power_turn_behavior()}</dt><dd>{behaviorName(entry.behavior)}</dd></div>
							{/if}
							{#if entry.cap}
								<div><dt>{m.power_cap()}</dt><dd>{entry.cap}</dd></div>
							{/if}
							<div><dt>{m.power_group()}</dt><dd>{groupName(entry.group)}</dd></div>
							{#if entry.mod}
								<div><dt>{m.card_from_label()}</dt><dd>{modLabel}</dd></div>
							{/if}
							{#if entry.enemyOnly}
								<div><dt>{m.power_enemy_only()}</dt><dd>·</dd></div>
							{/if}
						</dl>

						<div class="box-text">
							<RichText text={entry.summary} />
						</div>

						{#if entry.detail}
							<p class="box-detail">{entry.detail}</p>
						{/if}

						{#if entry.aliases?.length}
							<p class="box-note">{m.glossary_also_known({ aliases: entry.aliases.join(', ') })}</p>
						{/if}

						{#if data.names.length}
							<section class="box-section">
								<h2 class="box-heading">{m.power_other_names()}</h2>
								<dl class="names-list">
									{#each data.names as item (item.locale)}
										<div>
											<dt>{item.locale === 'eng' ? m.language_en() : m.language_zh()}</dt>
											<dd>{item.name}</dd>
										</div>
									{/each}
								</dl>
							</section>
						{/if}

						<section class="box-section">
							<h2 class="box-heading">{m.power_internal_id()}</h2>
							<code class="internal-id">{entry.id}</code>
						</section>
					</aside>

					<div class="detail-main">
					<header class="detail-head">
						<DetailTitle name={entry.name} />
							<p class="meta">
								{groupName(entry.group)}
								{#if entry.stack} · {stackName(entry.stack)}{/if}
								{#if entry.behavior} · {behaviorName(entry.behavior)}{/if}
							</p>
							{#if entry.mod}
								<p class="origin">
									{m.card_from_label()}
									<a href={`${resolve('/powers')}?mod=${entry.mod}`}>{modLabel}</a>
								</p>
							{/if}
						</header>

						<section class="effect" aria-labelledby="effect-heading">
							<h2 id="effect-heading" class="section-title display">{m.power_effect()}</h2>
							<p class="effect-text"><RichText text={entry.summary} /></p>
							{#if entry.detail}
								<p class="effect-detail">{entry.detail}</p>
							{/if}
						</section>

						<section class="sources" aria-labelledby="sources-heading">
							<h2 id="sources-heading" class="section-title display">
								{m.power_sources()}
								<span class="section-count">{sourceCount}</span>
							</h2>

							{#if sourceCount === 0}
								<p class="empty">{m.power_sources_empty()}</p>
							{/if}

							{#if data.cards.length}
								<div class="source-group">
									{@render sourceHeading(m.power_sources_cards(), data.cards.length)}
									<div class="card-list">
										{#each visibleCards as card (card.id)}
											<CardRow {card} showActions={false} />
										{/each}
									</div>
									{#if data.cards.length > 6}
										<button
											class="button button--ghost more-button"
											type="button"
											onclick={() => (showAllCards = !showAllCards)}
										>
											{showAllCards
												? m.power_show_less()
												: m.power_show_all({ count: data.cards.length })}
										</button>
									{/if}
								</div>
							{/if}

							{#if relics.length}
								<div class="source-group">
									{@render sourceHeading(m.power_sources_relics(), relics.length)}
									{@render collectionRows(relics, 'relic')}
								</div>
							{/if}

							{#if potions.length}
								<div class="source-group">
									{@render sourceHeading(m.power_sources_potions(), potions.length)}
									{@render collectionRows(potions, 'potion')}
								</div>
							{/if}

							{#if relatedPowers.length}
								<div class="source-group">
									{@render sourceHeading(m.power_sources_powers(), relatedPowers.length)}
									<div class="mini-list">
										{#each relatedPowers as item (item.id)}
											<a class="mini-row" href={powerHref(item)}>
												<span class="mini-icon">
													{#if item.icon}
														<img src={item.icon} alt="" loading="lazy" decoding="async" />
													{:else}
														<Motif name={item.motif ?? 'spiral'} />
													{/if}
												</span>
												<span class="mini-copy">
													<span class="mini-name">{item.name}</span>
													<span class="mini-text">{item.summary}</span>
												</span>
												<span class="mini-arrow" aria-hidden="true">→</span>
											</a>
										{/each}
									</div>
								</div>
							{/if}
						</section>
					</div>
				</div>
			{/if}
		</div>
	</section>
</div>

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

	.wiki-page {
		max-width: 62rem;
		font-family: var(--font-sans);
		color: var(--text);
	}

	.druid-row {
		display: flex;
		margin-block: 1px;
		font-size: 16px;
	}

	.druid-row-Title {
		padding: 4px 5px 8px;
		border-bottom: 1px solid oklch(0.51 0.03 223);
		font-size: 18px;
		font-weight: 600;
		color: oklch(0.89 0.13 95);
	}

	.druid-row-Title .druid-data {
		display: flex;
		align-items: center;
		gap: 8px;
		text-align: left;
	}

	.druid-row-Title img {
		width: 30px;
		height: 30px;
		filter: drop-shadow(0 0 2px black);
	}

	.druid-label,
	.druid-data {
		padding: 6px 5px;
		background: oklch(0.4 0.03 187);
	}

	.druid-label {
		width: 48%;
		flex-shrink: 0;
		font-weight: 600;
	}

	.druid-data {
		flex: 1;
	}

	.druid-data-wide {
		width: 100%;
	}

	.druid-row-Text .druid-data {
		line-height: 1.5;
	}

	.wiki-intro {
		margin: 0 0 12px;
		font-size: 0.95rem;
		line-height: 1.6;
		text-wrap: pretty;
	}

	.wiki-clear {
		clear: both;
	}

	.wiki-section-title {
		margin: 22px 0 8px;
		padding-bottom: 4px;
		border-bottom: 1px solid oklch(0.51 0.03 223);
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 600;
		color: oklch(0.89 0.13 95);
	}

	.wiki-h3 {
		font-size: 1.2rem;
	}

	.wiki-prose {
		margin: 0 0 12px;
		padding-left: 24px;
		list-style: disc;
		font-size: 0.92rem;
		line-height: 1.6;
	}

	.wiki-prose li {
		margin-bottom: 6px;
		text-wrap: pretty;
	}

	.detail-layout {
		display: grid;
		grid-template-columns: minmax(210px, 268px) minmax(0, 1fr);
		gap: clamp(24px, 3.5vw, 48px);
		align-items: start;
	}

	.infobox {
		position: sticky;
		top: calc(var(--header-height) + 24px);
		min-width: 0;
		padding: 12px;
		border: 2px solid var(--tooltip-border);
		border-radius: 6px;
		background: var(--tooltip-bg);
	}

	.box-title {
		display: flex;
		align-items: center;
		gap: 10px;
		padding-bottom: 10px;
		border-bottom: 1px solid var(--line);
	}

	.box-icon {
		display: grid;
		place-items: center;
		flex: none;
		width: 42px;
		height: 42px;
		padding: 3px;
		border: 1px solid var(--line-strong);
		border-radius: 4px;
		background: var(--surface-secondary);
		color: var(--gold-soft);
	}

	.box-icon img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.box-name {
		font-size: 1.18rem;
		font-weight: 600;
		line-height: 1.15;
		color: var(--gold);
		text-wrap: balance;
	}

	.facts {
		margin: 10px 0 0;
		font-size: 0.72rem;
	}

	.facts div,
	.names-list div {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
		padding: 4px 0;
		border-bottom: 1px solid var(--line);
	}

	.facts dt,
	.names-list dt {
		font-family: var(--font-mono);
		font-size: 0.56rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--muted);
		white-space: nowrap;
	}

	.facts dd,
	.names-list dd {
		margin: 0;
		text-align: right;
		color: var(--text-dim);
		text-wrap: pretty;
	}

	.box-text {
		margin-top: 12px;
		padding: 9px 10px;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: var(--surface-secondary);
		font-size: 0.82rem;
		line-height: 1.55;
		color: var(--text);
		text-wrap: pretty;
	}

	.box-detail,
	.box-note {
		margin-top: 8px;
		font-size: 0.72rem;
		line-height: 1.55;
		color: var(--muted);
		text-wrap: pretty;
	}

	.box-section {
		margin-top: 14px;
		padding-top: 10px;
		border-top: 1px solid var(--line);
	}

	.box-heading {
		margin-bottom: 6px;
		font-family: var(--font-mono);
		font-size: 0.56rem;
		font-weight: 400;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--gold-soft);
	}

	.internal-id {
		display: block;
		overflow-wrap: anywhere;
		font-family: var(--font-mono);
		font-size: 0.66rem;
		color: var(--text-dim);
	}

	.detail-main {
		min-width: 0;
	}

	.detail-head {
		padding-bottom: 14px;
	}

	.meta {
		margin-top: 5px;
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

	.effect {
		margin-top: 16px;
		padding: 12px 14px 14px;
		border: 2px solid var(--tooltip-border);
		border-radius: 6px;
		background: var(--tooltip-bg);
	}

	.section-title {
		display: flex;
		align-items: baseline;
		gap: 10px;
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--gold);
	}

	.section-count,
	.count {
		font-family: var(--font-mono);
		font-size: 0.58rem;
		font-weight: 400;
		letter-spacing: 0.06em;
		color: var(--muted);
	}

	.effect-text {
		margin-top: 10px;
		font-size: 0.95rem;
		line-height: 1.6;
		color: var(--text);
		text-wrap: pretty;
	}

	.effect-detail {
		margin-top: 8px;
		font-size: 0.78rem;
		line-height: 1.55;
		color: var(--muted);
		text-wrap: pretty;
	}

	.sources {
		margin-top: 22px;
	}

	.sources > .section-title {
		padding-bottom: 7px;
		border-bottom: 1px solid var(--line);
	}

	.empty {
		margin-top: 12px;
		font-size: 0.8rem;
		color: var(--muted);
	}

	.source-group {
		margin-top: 18px;
	}

	.group-title {
		display: flex;
		align-items: baseline;
		gap: 9px;
		margin-bottom: 8px;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-dim);
	}

	.card-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.more-button {
		margin-top: 10px;
	}

	.mini-list {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.mini-row {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 8px 10px;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--row);
		transition:
			border-color 0.16s ease,
			background 0.16s ease;
	}

	.mini-row:hover {
		border-color: var(--accent);
		background: var(--surface-secondary);
	}

	.mini-icon {
		display: grid;
		place-items: center;
		flex: none;
		width: 34px;
		height: 34px;
		padding: 2px;
		border: 1px solid var(--line-strong);
		border-radius: 3px;
		background: var(--surface-secondary);
		color: var(--gold-soft);
	}

	.mini-icon img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.mini-copy {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.mini-name {
		font-family: var(--font-display);
		font-size: 0.9rem;
		color: var(--text);
	}

	.mini-text {
		font-size: 0.72rem;
		line-height: 1.45;
		color: var(--muted);
		text-wrap: pretty;
	}

	.mini-arrow {
		margin-left: auto;
		font-size: 0.75rem;
		color: var(--gold-soft);
		opacity: 0.65;
	}

	@media (max-width: 820px) {
		.detail-layout {
			grid-template-columns: 1fr;
			gap: 22px;
		}

		.infobox {
			position: static;
		}
	}
</style>
