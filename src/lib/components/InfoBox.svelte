<script lang="ts">
	import type { Snippet } from 'svelte'

	type Tone = 'card' | 'druid'

	let {
		title,
		children,
		tone,
		ariaLabel = '',
		id = undefined,
		class: className = '',
		element = 'aside'
	}: {
		title?: Snippet
		children: Snippet
		tone: Tone
		ariaLabel?: string
		id?: string
		class?: string
		element?: 'aside' | 'div'
	} = $props()

	let toneClass = $derived(
		tone === 'card'
			? 'border-2 border-tooltip-border rounded-[10px] bg-surface p-2.5'
			: 'float-right clear-right w-[min(22em,100%)] mb-1 ml-1.5 p-2.5 border-4 border-[oklch(0.51_0.03_223)] rounded-[8px] bg-[oklch(0.49_0.04_188)] box-border text-[oklch(0.95_0_0)] [text-shadow:2px_1px_2px_oklch(0.29_0.03_188)] max-[820px]:float-none max-[820px]:m-0 max-[820px]:mb-1'
	)
</script>

<svelte:element
	this={element}
	class={`infobox font-display ${toneClass} ${className}`}
	aria-label={ariaLabel}
	{id}
>
	{#if title}{@render title()}{/if}
	{@render children()}
</svelte:element>
