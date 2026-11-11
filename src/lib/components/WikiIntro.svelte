<script lang="ts">
	import type { Snippet } from 'svelte'

	let {
		intro,
		paragraph
	}: {
		intro: string[]
		paragraph: Snippet<[string]>
	} = $props()
</script>

{#each intro as text (text)}
	<p class="wiki-intro">{@render paragraph(text)}</p>
{/each}

<style>
	.wiki-intro {
		margin: 0 0 12px;
		font-size: 0.95rem;
		line-height: 1.6;
		text-wrap: pretty;
	}
</style>
