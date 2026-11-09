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
	<div class="filter-grid">
		{@render children()}
	</div>

	{#if result}
		<div class="filter-result">
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

	.filter-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 8px;
		padding: 7px;
	}

	.filter-result {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		min-height: 34px;
		margin-top: 10px;
		padding: 2px 10px;
		border: 2px solid var(--tooltip-border);
		border-radius: 6px;
		background: var(--tooltip-bg);
		font-family: var(--font-display);
		font-size: 1rem;
		color: var(--text);
	}

	@media (max-width: 860px) {
		.filter-grid {
			grid-template-columns: 1fr;
		}

		.filter-result {
			flex-wrap: wrap;
			padding: 6px 9px;
		}
	}
</style>
