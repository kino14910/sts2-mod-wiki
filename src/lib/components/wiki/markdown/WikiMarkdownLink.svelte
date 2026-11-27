<script lang="ts">
	import type { Snippet } from 'svelte'
	import { safeHref } from '#lib/wiki-article'

	let {
		href = '',
		title = '',
		children
	}: { href?: string; title?: string; children?: Snippet } = $props()

	let safe = $derived(safeHref(href))
</script>

{#if safe}<a {href} {title} class="text-[#85d2e4] hover:underline [text-underline-thickness:1px] underline-offset-2"
		>{@render children?.()}</a
	>{:else}<span>{@render children?.()}</span>{/if}
