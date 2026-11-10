<script lang="ts">
	import WikiText from '#lib/components/WikiText.svelte'
	import { parseInlineSegments, parseMarkdownBlocks } from '#lib/wiki-markdown'

	let { content }: { content: string } = $props()

	let blocks = $derived(parseMarkdownBlocks(content))
</script>

{#snippet inline(text: string)}
	{#each parseInlineSegments(text) as segment, index (index)}
		{#if segment.bold}
			<strong><WikiText text={segment.text} /></strong>
		{:else}
			<WikiText text={segment.text} />
		{/if}
	{/each}
{/snippet}

<div class="space-y-3 text-[0.95rem] leading-[1.75]">
	{#each blocks as block, index (index)}
		{#if block.kind === 'heading'}
			<svelte:element
				this={block.level === 2 ? 'h2' : block.level === 3 ? 'h3' : 'h4'}
				class="mt-6 mb-2 font-semibold text-gold"
			>
				{@render inline(block.text)}
			</svelte:element>
		{:else if block.kind === 'list'}
			<ul class="list-disc space-y-1 pl-6">
				{#each block.items as item, itemIndex (itemIndex)}
					<li>{@render inline(item)}</li>
				{/each}
			</ul>
		{:else}
			<p>{@render inline(block.text)}</p>
		{/if}
	{/each}
</div>
