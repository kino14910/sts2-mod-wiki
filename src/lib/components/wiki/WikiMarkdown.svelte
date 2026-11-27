<script lang="ts">
	import WikiHeading from '#lib/components/WikiHeading.svelte'
	import { getLocale } from '#lib/paraglide/runtime'
	import { parseWikiMarkdown, type HastElement, type HastNode } from '#lib/markdown/wiki-markdown'
	import type { ArticleContent } from '#lib/wiki-article'
	import WikiMarkdownDetails from './markdown/WikiMarkdownDetails.svelte'
	import WikiMarkdownEntity from './markdown/WikiMarkdownEntity.svelte'
	import WikiMarkdownLink from './markdown/WikiMarkdownLink.svelte'
	import WikiMarkdownToken from './markdown/WikiMarkdownToken.svelte'

	let {
		md,
		context,
		locale
	}: { md: string; context?: ArticleContent['context']; locale?: string } = $props()

	let ast = $derived(parseWikiMarkdown(md))
	let activeLocale = $derived(locale ?? getLocale())
	let tableScrollLabel = $derived(activeLocale === 'zhs' ? '可横向滚动的表格' : 'Horizontally scrollable table')

	const HEADING_LEVEL: Record<string, 2 | 3 | 4> = { h1: 2, h2: 3, h3: 4, h4: 4, h5: 4, h6: 4 }

	function text(value: unknown): string {
		return typeof value === 'string' ? value : ''
	}

	function number(value: unknown): number | undefined {
		return typeof value === 'number' ? value : undefined
	}

	function align(value: unknown): 'left' | 'center' | 'right' | undefined {
		return value === 'left' || value === 'center' || value === 'right' ? value : undefined
	}

	function imageSrc(value: unknown): string {
		const src = text(value)
		return /^(https?:\/\/|\/(?!\/))/i.test(src) ? src : ''
	}
</script>

{#snippet renderNodes(nodes: HastNode[], depth = 0, inPre = false)}
	{#each nodes as node, index (index)}
		{@render renderNode(node, depth, inPre)}
	{/each}
{/snippet}

{#snippet renderNode(node: HastNode, depth = 0, inPre = false)}
	{#if node.type === 'text'}{node.value}
	{:else if node.type === 'element'}
		{@const tag = node.tagName}
		{@const attrs = node.properties ?? {}}
		{@const level = HEADING_LEVEL[tag]}
		{#if tag === 'p'}
			<p>{@render renderNodes(node.children, depth, inPre)}</p>
		{:else if tag === 'ul'}
			<ul class={depth > 0 ? 'mt-1 ml-5 list-[circle] space-y-1' : 'ml-5 list-disc space-y-1'}
				>{@render renderNodes(node.children, depth + 1, inPre)}</ul
			>
		{:else if tag === 'ol'}
			<ol
				start={number(attrs.start)}
				class={depth > 0 ? 'mt-1 ml-5 list-[circle] space-y-1' : 'ml-5 list-decimal space-y-1'}
				>{@render renderNodes(node.children, depth + 1, inPre)}</ol
			>
		{:else if tag === 'li'}
			<li>{@render renderNodes(node.children, depth, inPre)}</li>
		{:else if tag === 'blockquote'}
			<blockquote class="border-l-2 border-line pl-3 text-muted"
				>{@render renderNodes(node.children, depth, inPre)}</blockquote
			>
		{:else if level}
			<WikiHeading id={text(attrs.id)} title={text(attrs.headingText)} level={level ?? 2}>
				{@render renderNodes(node.children, depth, inPre)}
			</WikiHeading>
		{:else if tag === 'table'}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex (The labelled overflow region needs focus for native keyboard scrolling.) -->
			<div
				class="article-table-scroll min-w-0 w-full max-w-full overflow-x-auto overscroll-x-contain focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link"
				role="region"
				aria-label={tableScrollLabel}
				tabindex="0"
			>
				<table class="mb-3 w-full border-collapse text-[0.84rem]"
					>{@render renderNodes(node.children, depth, inPre)}</table
				>
			</div>
		{:else if tag === 'thead' || tag === 'tbody'}
			<svelte:element this={tag}>{@render renderNodes(node.children, depth, inPre)}</svelte:element>
		{:else if tag === 'tr'}
			<tr>{@render renderNodes(node.children, depth, inPre)}</tr>
		{:else if tag === 'th'}
			<th
				class="border border-line bg-(--table-header) px-2 py-1 text-left"
				style:text-align={align(attrs.align)}
				>{@render renderNodes(node.children, depth, inPre)}</th
			>
		{:else if tag === 'td'}
			<td
				class="border border-line px-2 py-1 align-top"
				style:text-align={align(attrs.align)}
				>{@render renderNodes(node.children, depth, inPre)}</td
			>
		{:else if tag === 'a'}
			<WikiMarkdownLink href={text(attrs.href)} title={text(attrs.title)}
				>{@render renderNodes(node.children, depth, inPre)}</WikiMarkdownLink
			>
		{:else if tag === 'img'}
			{#if imageSrc(attrs.src)}<img
					class="my-1 max-w-full rounded"
					src={imageSrc(attrs.src)}
					alt={text(attrs.alt)}
					loading="lazy"
					decoding="async"
				/>{/if}
		{:else if tag === 'pre'}
			<pre
				class="my-3 overflow-x-auto rounded border border-line bg-black/30 p-3 font-mono text-[0.82rem] leading-relaxed"><code
					class="font-mono">{@render renderNodes(node.children, depth, true)}</code></pre>
		{:else if tag === 'code'}
			{#if inPre}<code class="font-mono">{@render renderNodes(node.children, depth, true)}</code
				>{:else}<code class="rounded bg-black/30 px-1 py-0.5 font-mono text-[0.85em]"
					>{@render renderNodes(node.children, depth, false)}</code
				>{/if}
		{:else if tag === 'strong'}
			<strong>{@render renderNodes(node.children, depth, inPre)}</strong>
		{:else if tag === 'em'}
			<em>{@render renderNodes(node.children, depth, inPre)}</em>
		{:else if tag === 'del'}
			<del>{@render renderNodes(node.children, depth, inPre)}</del>
		{:else if tag === 'br'}
			<br />
		{:else if tag === 'hr'}
			<hr class="my-4 border-line" />
		{:else if tag === 'sup'}
			<sup>{@render renderNodes(node.children, depth, inPre)}</sup>
		{:else if tag === 'sub'}
			<sub>{@render renderNodes(node.children, depth, inPre)}</sub>
		{:else if tag === 'input'}
			<input type="checkbox" checked={attrs.checked === true} disabled />
		{:else if tag === 'wiki-entity'}
			<WikiMarkdownEntity
				namespace={text(attrs.namespace)}
				entityType={text(attrs.entityType)}
				entityId={text(attrs.entityId)}
				raw={text(attrs.raw)}
				{locale}
			/>
		{:else if tag === 'wiki-token'}
			<WikiMarkdownToken tokenKey={text(attrs.key)} raw={text(attrs.raw)} {context} />
		{:else if tag === 'wiki-details'}
			<WikiMarkdownDetails summary={text(attrs.summary)}>
				{@render renderNodes(node.children, depth, inPre)}
			</WikiMarkdownDetails>
		{:else}
			{@render renderNodes(node.children, depth, inPre)}
		{/if}
	{/if}
{/snippet}

<div
	class="wiki-section-content min-w-0 max-w-full space-y-3 text-[0.9rem] leading-[1.6] wrap-anywhere"
	data-wiki-markdown
>
	{@render renderNodes(ast.children)}
</div>

<style>
	.article-table-scroll :global(table) {
		min-width: 600px;
		overflow-wrap: normal;
	}

	.article-table-scroll :global(th) {
		white-space: nowrap;
	}
</style>
