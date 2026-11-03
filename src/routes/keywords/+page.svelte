<script lang="ts">
	import { resolve } from '$app/paths';
	import GlossaryView from '#lib/components/GlossaryView.svelte';
	import { BUFFS, DEBUFFS, KEYWORDS } from '#lib/data/glossary';
	import { m } from '#lib/paraglide/messages';

	const otherLinks = [
		{ href: resolve('/buffs'), label: m.nav_buffs(), count: BUFFS.length },
		{ href: resolve('/debuffs'), label: m.nav_debuffs(), count: DEBUFFS.length }
	];
</script>

<svelte:head>
	<title>{m.keywords_meta_title()}</title>
	<meta name="description" content={m.keywords_meta_description()} />
</svelte:head>

<GlossaryView
	kind="keyword"
	title={m.keywords_heading()}
	lead={m.keywords_lead()}
	entries={KEYWORDS}
	{otherLinks}
/>
