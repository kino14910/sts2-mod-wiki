<script lang="ts">
	import ModWikiContent from '#lib/components/ModWikiContent.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	let title = $derived(data.wikiMeta.slug.split('/').join(' / '))
</script>

<svelte:head>
	<title>{title} · Mod Wiki</title>
</svelte:head>

<div class="py-8">
	<nav class="mb-4 text-[0.82rem] opacity-70" aria-label="breadcrumb">
		<a class="text-link" href="/cards">Home</a>
		<span> / </span>
		<span>{data.wikiMeta.modId}</span>
		<span> / </span>
		<span>{title}</span>
	</nav>

	<h1 class="text-2xl font-semibold text-gold">{title}</h1>
	<p class="mt-2 text-[0.82rem] opacity-70">
		{data.wikiMeta.key} · {data.wikiMeta.sectionCount} sections · source: {data.wikiMeta.source}
	</p>

	{#each data.wikiSections as section (section.key)}
		<section class="mt-8 rounded-md border border-white/10 bg-white/5 p-5">
			<header class="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 pb-2">
				<h2 class="text-lg font-semibold">{section.key}</h2>
				<span class="text-[0.78rem] opacity-60">
					v{section.version} · {section.sourceType ?? 'unknown'}
				</span>
			</header>
			{#if section.contentType === 'markdown'}
				<ModWikiContent content={section.content} />
			{:else}
				<p class="text-[0.86rem] opacity-70">
					{section.contentType} content is not rendered by the first markdown-only release.
				</p>
			{/if}
		</section>
	{/each}
</div>
