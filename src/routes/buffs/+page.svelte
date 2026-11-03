<script lang="ts">
	import { resolve } from '$app/paths';
	import GlossaryView from '#lib/components/GlossaryView.svelte';
	import { BUFFS, DEBUFFS, KEYWORDS } from '#lib/data/glossary';
	import { m } from '#lib/paraglide/messages';

	const otherLinks = [
		{ href: resolve('/keywords'), label: m.nav_keywords(), count: KEYWORDS.length },
		{ href: resolve('/debuffs'), label: m.nav_debuffs(), count: DEBUFFS.length }
	];

	const legend = [
		{ label: m.legend_intensity(), text: m.legend_intensity_text() },
		{ label: m.legend_duration(), text: m.legend_duration_text() },
		{ label: m.legend_counter(), text: m.legend_counter_text() }
	];
</script>

<svelte:head>
	<title>{m.buffs_meta_title()}</title>
	<meta name="description" content={m.buffs_meta_description()} />
</svelte:head>

<GlossaryView
	kind="buff"
	title={m.buffs_heading()}
	lead={m.buffs_lead()}
	entries={BUFFS}
	{legend}
	{otherLinks}
/>
