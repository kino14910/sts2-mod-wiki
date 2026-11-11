<script lang="ts">
	import type { RelicWikiTab } from '#lib/data/relic-wiki'

	let { tabs }: { tabs: RelicWikiTab[] } = $props()
</script>

<div class="game-tabs flex items-end gap-0.75 mb-2.5 border-b-2 border-accent font-display text-[0.88rem]">
	{#each tabs as tab (tab.label)}
		{#if tab.href}
			<a class="game-tab block px-2.25 py-0.75 border-2 border-line-strong border-b-0 rounded-t-sm bg-[oklch(0.4_0.03_187)] text-ink leading-[1.4] hover:bg-[oklch(0.49_0.04_188)] hover:text-gold" href={tab.href}>{tab.label}</a>
		{:else}
			<span class="game-tab game-tab--current block px-2.25 py-0.75 border-2 border-accent border-b-0 rounded-t-sm bg-[oklch(0.89_0.02_200)] text-[oklch(0.22_0.02_220)] leading-[1.4] font-semibold" aria-current="page">{tab.label}</span>
		{/if}
	{/each}
</div>
