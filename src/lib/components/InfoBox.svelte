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
</script>

<svelte:element
	this={element}
	class={`infobox infobox--${tone} ${className}`}
	aria-label={ariaLabel}
	{id}
>
	{#if title}{@render title()}{/if}
	{@render children()}
</svelte:element>

<style>
	.infobox {
		font-family: var(--font-display);
	}

	.infobox--card {
		border: 2px solid var(--tooltip-border);
		border-radius: 10px;
		background: var(--surface);
		padding: 0.625rem;
	}

	.infobox--druid {
		float: right;
		clear: right;
		width: min(22em, 100%);
		margin: 0 0 1em 1.5em;
		padding: 10px;
		border: 4px solid oklch(0.51 0.03 223);
		border-radius: 8px;
		background: oklch(0.49 0.04 188);
		box-sizing: border-box;
		color: oklch(0.95 0 0);
		text-shadow: 2px 1px 2px oklch(0.29 0.03 188);
	}

	@media (max-width: 820px) {
		.infobox--druid {
			float: none;
			margin: 0 0 1em;
		}
	}
</style>
