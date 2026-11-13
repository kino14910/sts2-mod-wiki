<script lang="ts">
	import WikiInline from '#lib/components/WikiInline.svelte'
	import WikiText from '#lib/components/WikiText.svelte'
	import WikiTable from '#lib/components/WikiTable.svelte'
	import { getLocale } from '#lib/paraglide/runtime'
	import type { ArticleBlock, ArticleContent, ArticleListItem } from '#lib/wiki-article'
	let { blocks, context }: { blocks: ArticleBlock[]; context?: ArticleContent['context'] } = $props()
	let tableScrollLabel = $derived(getLocale() === 'zhs' ? '可横向滚动的表格' : 'Horizontally scrollable table')
</script>

{#snippet inline(text: string)}
	{#if context}<WikiInline {text} page={context} />{:else}<WikiText {text} />{/if}
{/snippet}
{#snippet list(items: ArticleListItem[], nested = false)}
	<ul class={['ml-5 list-disc space-y-1', nested && 'mt-1 list-[circle]']}>
		{#each items as item, index (index)}
			<li>{@render inline(item.text)}{#if item.children?.length}{@render list(item.children, true)}{/if}</li>
		{/each}
	</ul>
{/snippet}

<div class="wiki-section-content min-w-0 max-w-full space-y-3 text-[0.9rem] leading-[1.6] wrap-anywhere">
	{#each blocks as block, index (index)}
		{#if block.kind === 'paragraph'}<p>{@render inline(block.text)}</p>
		{:else if block.kind === 'list'}{@render list(block.items)}
		{:else if block.kind === 'table'}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex (The labelled overflow region needs focus for native keyboard scrolling.) -->
			<div
				class="article-table-scroll min-w-0 w-full max-w-full overflow-x-auto overscroll-x-contain focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link"
				role="region"
				aria-label={`${tableScrollLabel}: ${block.table.columns.join(', ')}`}
				tabindex="0"
			>
				<WikiTable columns={block.table.columns} rows={block.table.rows} />
			</div>
		{:else if block.kind === 'heading'}
			<svelte:element this={`h${block.level}`} class="mt-4 font-display text-lg text-gold">{@render inline(block.text)}</svelte:element>
		{/if}
	{/each}
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
