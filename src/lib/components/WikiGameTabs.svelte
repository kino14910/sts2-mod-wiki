<script lang="ts">
	import type { RelicWikiTab } from '#lib/data/relic-wiki'

	let { tabs }: { tabs: RelicWikiTab[] } = $props()
</script>

<div class="game-tabs">
	{#each tabs as tab (tab.label)}
		{#if tab.href}
			<a class="game-tab" href={tab.href}>{tab.label}</a>
		{:else}
			<span class="game-tab game-tab--current" aria-current="page">{tab.label}</span>
		{/if}
	{/each}
</div>

<style>
	.game-tabs {
		display: flex;
		align-items: flex-end;
		gap: 3px;
		margin-bottom: 10px;
		border-bottom: 2px solid var(--accent);
		font-family: var(--font-display);
		font-size: 0.88rem;
	}

	.game-tab {
		padding: 2px 9px 3px;
		border: 2px solid var(--line-strong);
		border-bottom: none;
		border-radius: 4px 4px 0 0;
		background: oklch(0.4 0.03 187);
		color: var(--text);
		line-height: 1.4;
	}

	a.game-tab:hover {
		background: oklch(0.49 0.04 188);
		color: var(--gold);
	}

	.game-tab--current {
		border-color: var(--accent);
		background: oklch(0.89 0.02 200);
		color: oklch(0.22 0.02 220);
		font-weight: 600;
	}
</style>
