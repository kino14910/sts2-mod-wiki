<script lang="ts">
	import { resolve } from '$app/paths'
	import DetailTitle from '#lib/components/DetailTitle.svelte'
	import RelicInfobox from '#lib/components/RelicInfobox.svelte'
	import WikiDruidBox from '#lib/components/WikiDruidBox.svelte'
	import WikiGameTabs from '#lib/components/WikiGameTabs.svelte'
	import WikiHeading from '#lib/components/WikiHeading.svelte'
	import WikiInline from '#lib/components/WikiInline.svelte'
	import WikiIntro from '#lib/components/WikiIntro.svelte'
	import WikiNavbox from '#lib/components/WikiNavbox.svelte'
	import WikiTable from '#lib/components/WikiTable.svelte'
	import WikiToc from '#lib/components/WikiToc.svelte'
	import {
		collectionCharacterName,
		collectionRarityName,
		localizedCollection,
		modName
	} from '#lib/data/localize'
	import { m } from '#lib/paraglide/messages'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	let entry = $derived(localizedCollection(data.entry))
	let wiki = $derived(data.wiki)
	let toc = $derived(
		wiki
			? wiki.sections.map((section) => ({
					id: section.id,
					number: section.number ?? '',
					label: section.title,
					indent: section.indent
				}))
			: []
	)
	let navGroups = $derived(
		data.navbox.groups.map((group) => ({
			label: group.label,
			href: group.href ?? undefined,
			rows: group.rows.map((row) => ({
				group: row.group || undefined,
				href: row.href || undefined,
				items: row.items
			}))
		}))
	)
</script>

<svelte:head>
	<title>{entry.name} | {m.game_title()}</title>
	<meta name="description" content={`${entry.name}: ${data.text}`} />
</svelte:head>

<div class="glossary-page">
	<section class="page">
		<div class="wrap">
			<nav class="crumbs" aria-label={m.breadcrumb()}>
				<a href={resolve('/relics')}>{m.nav_relics()}</a>
				<span aria-hidden="true">/</span>
				<span aria-current="page">{entry.name}</span>
			</nav>

			{#if wiki}
				<article class="wiki-page">
					<DetailTitle name={entry.name} />
					<WikiGameTabs tabs={wiki.gameTabs} />

					{#snippet introParagraph(text: string)}
						<WikiInline text={text} page={wiki} />
					{/snippet}

					<div class="relic-body">
						<div class="relic-main">
							<WikiIntro intro={wiki.intro} paragraph={introParagraph} />

							<div class="wiki-toc-wrap"><WikiToc items={toc} collapsible /></div>
							<div class="wiki-clear-left"></div>

							{#each wiki.sections as section (section.id)}
								<WikiHeading id={section.id} title={section.title} level={section.level} />
								{#each section.paragraphs ?? [] as paragraph (paragraph)}
									<p class="wiki-prose-p"><WikiInline text={paragraph} page={wiki} /></p>
								{/each}
								{#each section.lists ?? [] as list, listIndex (listIndex)}
									<ul class="wiki-prose">
										{#each list as item (item)}
											<li><WikiInline text={item} page={wiki} /></li>
										{/each}
									</ul>
								{/each}
							{#if section.table === 'updateHistory'}
								<WikiTable
									columns={wiki.updateHistory.columns}
									rows={wiki.updateHistory.rows}
								/>
							{/if}
							{/each}
						</div>

						<aside class="relic-aside">
							<RelicInfobox page={wiki} />
							{#each wiki.glossary as item, index (item.title)}
								<WikiDruidBox entry={item} page={wiki} id={`druid-container-${index + 2}`} />
							{/each}
						</aside>
					</div>

					<div class="wiki-clear"></div>
					<WikiNavbox
						title={data.navbox.title}
						href={data.navbox.href}
						templateHref={data.navbox.templateHref}
						groups={navGroups}
						collapsed
						ariaLabel={data.navbox.title}
					/>
				</article>
			{:else}
				<div class="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
					<article class="min-w-0">
						<DetailTitle name={entry.name} />
						<section class="mt-4 rounded-md border-2 border-line bg-table p-4">
							<h2 class="font-display text-[1.1rem] font-semibold text-gold">
								{m.power_effect()}
							</h2>
							<p class="mt-2 text-[0.95rem] leading-[1.6]">{data.text}</p>
						</section>
				</article>

					<aside class="rounded-md border-2 border-line bg-table p-3" aria-label={entry.name}>
						<div class="flex items-center gap-2.5 border-b border-line pb-2.5">
							<span class="grid size-10.5 shrink-0 place-items-center rounded-sm border border-line-strong bg-black/35 p-1">
								{#if entry.image}
									<img class="size-full object-contain" src={entry.image} alt="" loading="lazy" />
								{/if}
							</span>
							<span class="font-display text-[1.15rem] font-semibold text-gold">{entry.name}</span>
						</div>
						<dl class="mt-2 text-[0.72rem]">
							<div class="flex justify-between gap-2 border-b border-line py-1">
								<dt class="font-mono text-[0.56rem] uppercase tracking-wider text-muted">Rarity</dt>
								<dd class="text-ink-dim">{collectionRarityName(entry.rarity)}</dd>
							</div>
							<div class="flex justify-between gap-2 border-b border-line py-1">
								<dt class="font-mono text-[0.56rem] uppercase tracking-wider text-muted">Character</dt>
								<dd class="text-ink-dim">{collectionCharacterName(entry.character)}</dd>
							</div>
							<div class="flex justify-between gap-2 border-b border-line py-1">
								<dt class="font-mono text-[0.56rem] uppercase tracking-wider text-muted">
									{m.card_from_label()}
								</dt>
								<dd class="text-ink-dim">{modName(entry.mod)}</dd>
							</div>
						</dl>
						<p class="mt-3 rounded-sm border border-line bg-surface-2 p-2.5 text-[0.82rem] leading-[1.55]">
							{data.text}
						</p>
						<section class="mt-3 border-t border-line pt-2.5">
							<h2 class="font-mono text-[0.56rem] uppercase tracking-wider text-gold-soft">
								{m.power_internal_id()}
							</h2>
							<code class="font-mono text-[0.7rem] text-ink-dim">{entry.id}</code>
						</section>
					</aside>
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

	.relic-body {
		display: grid;
		grid-template-columns: minmax(0, 1fr) min(22em, 34%);
		gap: 0 1.5em;
		align-items: start;
	}

	.relic-main {
		min-width: 0;
	}

	.relic-aside {
		display: flex;
		flex-direction: column;
		gap: 1em;
		min-width: 0;
	}

	.wiki-toc-wrap {
		float: left;
		margin: 0 1.5em 1em 0;
	}

	.wiki-clear-left {
		clear: left;
	}

	.wiki-clear {
		clear: both;
	}

	.wiki-prose-p {
		margin: 0 0 12px;
		font-size: 0.92rem;
		line-height: 1.6;
		text-wrap: pretty;
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

	@media (max-width: 820px) {
		.relic-body {
			grid-template-columns: 1fr;
		}

		.relic-aside {
			order: -1;
		}

		.relic-aside :global(.infobox--druid) {
			margin: 0 auto 1em;
		}

		.wiki-toc-wrap {
			float: none;
			margin: 0 0 1em;
		}
	}
</style>
