<script lang="ts">
	import { resolve } from '$app/paths';
	import GlossaryView from '#lib/components/GlossaryView.svelte';
	import { KEYWORDS, POWERS } from '#lib/data/glossary';
	import { m } from '#lib/paraglide/messages';

	const otherLinks = [
		{ href: resolve('/powers'), label: m.nav_powers(), count: POWERS.length }
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
