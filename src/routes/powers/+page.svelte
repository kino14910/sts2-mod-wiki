<script lang="ts">
	import { resolve } from '$app/paths'
	import GlossaryView from '#lib/components/GlossaryView.svelte'
	import { KEYWORDS, POWERS } from '#lib/data/glossary'
	import { m } from '#lib/paraglide/messages'

	const otherLinks = [
		{ href: resolve('/keywords'), label: m.nav_keywords(), count: KEYWORDS.length }
	]
</script>

<svelte:head>
	<title>{m.powers_meta_title()}</title>
	<meta name="description" content={m.powers_meta_description()} />
</svelte:head>

<GlossaryView
	kind="power"
	title={m.powers_heading()}
	lead={m.powers_lead()}
	entries={POWERS}
	{otherLinks}
/>
