<script lang="ts">
	import type { Snippet } from 'svelte'

	let {
		show = false,
		html = '',
		x = 0,
		y = 0,
		registerTip,
		content
	}: {
		show?: boolean
		html?: string
		x?: number
		y?: number
		registerTip?: (node: HTMLElement) => void | (() => void)
		content?: Snippet
	} = $props()

	const attach = $derived(registerTip ?? (() => {}))
</script>

{#if show}
	<div
		class="custom-tooltip"
		{@attach attach}
		style:left="{x}px"
		style:top="{y}px"
		role="tooltip"
	>
		{#if content}{@render content()}{:else}{@html html}{/if}
	</div>
{/if}
