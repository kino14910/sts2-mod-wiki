<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		result,
		class: className = '',
		children
	}: {
		label: string;
		result?: Snippet;
		class?: string;
		children: Snippet;
	} = $props();
</script>

<section class={['filter-shell', className]} aria-label={label}>
	<div class="filter-grid grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 p-1.75 max-[860px]:grid-cols-1">
		{@render children()}
	</div>

	{#if result}
		<div class="filter-result flex min-h-8.5 items-center justify-between gap-4 mt-2.5 px-2.5 py-0.5 border-2 border-tooltip-border rounded-md bg-tooltip-bg font-display text-base text-ink max-[860px]:flex-wrap max-[860px]:p-[6px_9px]">
			{@render result()}
		</div>
	{/if}
</section>

<style>
	/* Tailwind 无法安全表达带 `/` 的 border-image 简写，保留这一处自定义 */
	.filter-shell {
		border: 17px solid transparent;
		border-image: url('/images/tooltip-border.png') 22 fill / 17px / 0 stretch;
		border-radius: 8px;
		background: var(--tooltip-bg);
		filter: drop-shadow(9px 7px 2px rgba(0, 0, 0, 0.36));
	}
</style>
