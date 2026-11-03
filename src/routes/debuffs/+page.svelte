<script lang="ts">
	import { resolve } from '$app/paths';
	import GlossaryView from '#lib/components/GlossaryView.svelte';
	import { BUFFS, DEBUFFS, KEYWORDS } from '#lib/data/glossary';
	import { m } from '#lib/paraglide/messages';

	const otherLinks = [
		{ href: resolve('/keywords'), label: m.nav_keywords(), count: KEYWORDS.length },
		{ href: resolve('/buffs'), label: m.nav_buffs(), count: BUFFS.length }
	];

	const legend = [
		{ label: m.legend_intensity(), text: m.legend_intensity_text() },
		{ label: m.legend_duration(), text: m.legend_duration_text() },
		{ label: m.legend_counter(), text: m.legend_counter_text() }
	];
</script>

<svelte:head>
	<title>{m.debuffs_meta_title()}</title>
	<meta name="description" content={m.debuffs_meta_description()} />
</svelte:head>

<GlossaryView
	kind="debuff"
	title={m.debuffs_heading()}
	lead={m.debuffs_lead()}
	entries={DEBUFFS}
	{legend}
	{otherLinks}
/>
