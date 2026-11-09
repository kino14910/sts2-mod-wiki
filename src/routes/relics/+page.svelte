<script lang="ts">
	import { resolve } from '$app/paths';
	import CollectionView from '#lib/components/CollectionView.svelte';
	import { RELIC_RARITIES } from '#lib/data/collections';
	import { RELICS, POTIONS } from '#lib/data/mods';
	import { m } from '#lib/paraglide/messages';

	const otherLinks = [
		{ href: resolve('/potions'), label: m.nav_potions(), count: POTIONS.length }
	];
</script>

<svelte:head>
	<title>{m.relics_meta_title()}</title>
	<meta name="description" content={m.relics_meta_description()} />
</svelte:head>

<CollectionView
	kind="relic"
	title={m.relics_heading()}
	lead={m.relics_lead()}
	notice={m.relics_notice()}
	entries={RELICS}
	rarities={RELIC_RARITIES}
	{otherLinks}
/>
