<script lang="ts">
	import { resolve } from '$app/paths';
	import CollectionView from '#lib/components/CollectionView.svelte';
	import { POTION_RARITIES } from '#lib/data/collections';
	import { RELICS, POTIONS } from '#lib/data/mods';
	import { m } from '#lib/paraglide/messages';

	const otherLinks = [
		{ href: resolve('/relics'), label: m.nav_relics(), count: RELICS.length }
	];
</script>

<svelte:head>
	<title>{m.potions_meta_title()}</title>
	<meta name="description" content={m.potions_meta_description()} />
</svelte:head>

<CollectionView
	kind="potion"
	title={m.potions_heading()}
	lead={m.potions_lead()}
	notice={m.potions_notice()}
	entries={POTIONS}
	rarities={POTION_RARITIES}
	{otherLinks}
/>
