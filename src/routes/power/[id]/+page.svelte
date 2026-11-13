<script lang="ts">
	import { resolve } from '$app/paths'
	import CardRow from '#lib/components/CardRow.svelte'
	import DetailTitle from '#lib/components/DetailTitle.svelte'
	import InfoBox from '#lib/components/InfoBox.svelte'
	import Motif from '#lib/components/Motif.svelte'
	import RichText from '#lib/components/RichText.svelte'
	import WikiSources from '#lib/components/WikiSources.svelte'
	import WikiIntro from '#lib/components/WikiIntro.svelte'
	import WikiText from '#lib/components/WikiText.svelte'
	import type { CollectionEntry, CollectionKind } from '#lib/data/collections'
	import { entityHref, publicEntityKey } from '#lib/entities'
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
	let sources = $derived(data.sources)
	let interactions = $derived(data.interactions)
	let relatedPowers = $derived(localizedEntries(data.powers))
	let relics = $derived(localizedCollections(data.relics))
	let potions = $derived(localizedCollections(data.potions))
	let modLabel = $derived(entry.mod ? modName(entry.mod) : '')

	let expandedCardSources = $state<string | null>(null)
	let showAllCards = $derived(expandedCardSources === data.entityKey)
	let visibleCards = $derived(showAllCards ? data.cards : data.cards.slice(0, 6))
	let sourceCount = $derived(
		data.cards.length + relics.length + potions.length + relatedPowers.length
	)

	let iconAlt = $derived(`StS2 Icon ${wiki?.title ?? entry.name}.png`)
	let stackLabel = $derived(wiki ? 'Stack Type' : m.power_stack_type())
	let stackValue = $derived(wiki?.stackType ?? (entry.stack ? stackName(entry.stack) : ''))
	let order = $derived(wiki?.order ?? [])
	let effectsImmune = $derived(wiki?.effectsImmune ?? [])
	let showGameSources = $derived(!wiki)
	let showInteractions = $derived(interactions.length + order.length + effectsImmune.length > 0)
	let meta = $derived(
		[
			groupName(entry.group),
			entry.stack ? stackName(entry.stack) : '',
			entry.behavior ? behaviorName(entry.behavior) : ''
		]
			.filter(Boolean)
			.join(' · ')
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
	<ul class="wiki-prose">
		{#each items as item (publicEntityKey({ type: kind, id: item.id, modId: item.mod }))}
			<li>
				<a href={entityHref({ type: kind, id: item.id, modId: item.mod })}
					>{item.name}</a
				>
				— {collectionTextToPlain(item.text)}
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet sourceHeading(label: string, count: number)}
	<h3 class="wiki-section-title wiki-h3">
		<span class="mw-headline">{label}<span class="count">{count}</span></span>
	</h3>
{/snippet}

{#snippet introParagraph(text: string)}
	<WikiText text={text} />
{/snippet}

{#key data.entityKey}
<div class="glossary-page" data-entity-id={data.entityRef.id} data-entity-key={data.entityKey} data-mod-id={entry.mod ?? 'sts2'}>
	<section class="page">
		<div class="wrap">
			<nav class="crumbs" aria-label={m.breadcrumb()}>
				<a href={resolve('/cards')}>{m.nav_cards()}</a>
				<span aria-hidden="true">/</span>
				<a href={resolve('/powers')}>{m.nav_powers()}</a>
				<span aria-hidden="true">/</span>
				<span aria-current="page">{entry.name}</span>
			</nav>

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
									{#if entry.icon}
										<img alt={iconAlt} src={entry.icon} width="30" height="30" />
									{:else}
										<Motif name={entry.motif ?? 'spiral'} />
									{/if}
								</a>
								{entry.name}
							</div>
						</div>
					{/snippet}

					<div class="druid-section-container">
						<div class="druid-row druid-row-StackType" data-druid-section-row="Main">
							<div class="druid-label druid-label-StackType">{stackLabel}</div>
							<div class="druid-data druid-data-StackType druid-data-nonempty">
								{stackValue}
							</div>
						</div>
						<div class="druid-row druid-row-Text" data-druid-section-row="Main">
							<div class="druid-data druid-data-Text druid-data-nonempty druid-data-wide">
								{#if wiki}
									<WikiText text={wiki.text} />
								{:else}
									<RichText text={entry.summary} />
								{/if}
							</div>
						</div>

						{#if showGameSources}
							{#if entry.behavior}
								<div class="druid-row" data-druid-section-row="Main">
									<div class="druid-label">{m.power_turn_behavior()}</div>
									<div class="druid-data druid-data-nonempty">{behaviorName(entry.behavior)}</div>
								</div>
							{/if}
							{#if entry.cap}
								<div class="druid-row" data-druid-section-row="Main">
									<div class="druid-label">{m.power_cap()}</div>
									<div class="druid-data druid-data-nonempty">{entry.cap}</div>
								</div>
							{/if}
							<div class="druid-row" data-druid-section-row="Main">
								<div class="druid-label">{m.power_group()}</div>
								<div class="druid-data druid-data-nonempty">{groupName(entry.group)}</div>
							</div>
							{#if entry.mod}
								<div class="druid-row" data-druid-section-row="Main">
									<div class="druid-label">{m.card_from_label()}</div>
									<div class="druid-data druid-data-nonempty">
										<a href={`${resolve('/powers')}?mod=${entry.mod}`}>{modLabel}</a>
									</div>
								</div>
							{/if}
							{#if entry.enemyOnly}
								<div class="druid-row" data-druid-section-row="Main">
									<div class="druid-label">{m.power_enemy_only()}</div>
									<div class="druid-data druid-data-nonempty">·</div>
								</div>
							{/if}
							{#if entry.detail}
								<div class="druid-row druid-row-Text" data-druid-section-row="Main">
									<div class="druid-data druid-data-Text druid-data-nonempty druid-data-wide">
										{entry.detail}
									</div>
								</div>
							{/if}
							{#if entry.aliases?.length}
								<div class="druid-row druid-row-Text" data-druid-section-row="Main">
									<div class="druid-data druid-data-Text druid-data-nonempty druid-data-wide">
										{m.glossary_also_known({ aliases: entry.aliases.join(', ') })}
									</div>
								</div>
							{/if}
							{#if data.names.length}
								<div class="druid-row" data-druid-section-row="Main">
									<div class="druid-label">{m.power_other_names()}</div>
									<div class="druid-data druid-data-nonempty">
										{#each data.names as item (item.locale)}
											<div>
												{item.locale === 'eng' ? m.language_en() : m.language_zh()}: {item.name}
											</div>
										{/each}
									</div>
								</div>
							{/if}
							<div class="druid-row" data-druid-section-row="Main">
								<div class="druid-label">{m.power_internal_id()}</div>
								<div class="druid-data druid-data-nonempty"><code>{entry.id}</code></div>
							</div>
						{/if}
					</div>
				</InfoBox>

				<WikiIntro intro={intro} paragraph={introParagraph} />
				{#if showGameSources && meta}
					<p class="wiki-prose-p">{meta}</p>
				{/if}
				<div class="wiki-clear"></div>

				<section aria-labelledby="Sources">
					<h2 class="wiki-section-title"><span class="mw-headline" id="Sources">Sources</span></h2>
					{#each sources as details (details.summary)}
						<WikiSources {details} />
					{/each}

					{#if showGameSources}
						{#if sourceCount === 0}
							<p class="wiki-prose-p">{m.power_sources_empty()}</p>
						{/if}

						{#if relics.length}
							<div class="wiki-source-group">
								{@render sourceHeading(m.power_sources_relics(), relics.length)}
								{@render collectionRows(relics, 'relic')}
							</div>
						{/if}

						{#if potions.length}
							<div class="wiki-source-group">
								{@render sourceHeading(m.power_sources_potions(), potions.length)}
								{@render collectionRows(potions, 'potion')}
							</div>
						{/if}

						{#if relatedPowers.length}
							<div class="wiki-source-group">
								{@render sourceHeading(m.power_sources_powers(), relatedPowers.length)}
								<ul class="wiki-prose">
									{#each relatedPowers as item (publicEntityKey({ type: 'power', id: item.id, modId: item.mod ?? 'sts2' }))}
										<li><a href={powerHref(item)}>{item.name}</a> — {item.summary}</li>
									{/each}
								</ul>
							</div>
						{/if}
					{/if}
				</section>

				{#if showInteractions}
					<section aria-labelledby="Interactions">
						<h2 class="wiki-section-title">
							<span class="mw-headline" id="Interactions">Interactions</span>
						</h2>
						{#each interactions as details (details.summary)}
							<WikiSources {details} />
						{/each}

						{#if order.length}
							<h3 class="wiki-section-title wiki-h3">
								<span class="mw-headline" id="Order">{m.wiki_order()}</span>
							</h3>
							<ul class="wiki-prose">
								{#each order as item (item)}
									<li><WikiText text={item} /></li>
								{/each}
							</ul>
						{/if}

						{#if effectsImmune.length}
							<h3 class="wiki-section-title wiki-h3">
								<span class="mw-headline" id="Effects_Immune_to_Vulnerable">
									{m.wiki_effects_immune_to_vulnerable()}
								</span>
							</h3>
							<ul class="wiki-prose">
								{#each effectsImmune as item (item)}
									<li><WikiText text={item} /></li>
								{/each}
							</ul>
						{/if}
					</section>
				{/if}
			</article>
		</div>
	</section>
</div>
{/key}

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

	.druid-row-Title :global(svg) {
		flex: none;
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
		min-width: 0;
		text-wrap: pretty;
	}

	.druid-data-wide {
		width: 100%;
	}

	.druid-data a {
		color: oklch(0.89 0.13 95);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.druid-data code {
		font-family: var(--font-mono);
		font-size: 0.8em;
		overflow-wrap: anywhere;
	}

	.druid-row-Text .druid-data {
		line-height: 1.5;
	}

	.wiki-prose-p {
		margin: 0 0 12px;
		font-size: 0.92rem;
		line-height: 1.6;
		color: var(--muted);
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

	.count {
		margin-left: 9px;
		font-family: var(--font-mono);
		font-size: 0.58rem;
		font-weight: 400;
		letter-spacing: 0.06em;
		color: var(--muted);
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

	.wiki-source-group {
		margin-top: 18px;
	}

	.wiki-card-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.wiki-more {
		margin-top: 10px;
	}
</style>
