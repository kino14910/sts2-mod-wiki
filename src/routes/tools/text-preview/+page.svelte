<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages';
	import { loadToolScripts } from '#lib/tools/load-scripts.ts';
	import markup from './markup.html?raw';

	onMount(() => loadToolScripts(['/tools/preview-assets/preview-tools.js']));
</script>

<svelte:head>
	<title>{m.tool_text_meta_title()}</title>
	<meta name="description" content={m.tool_text_meta_description()} />
	<link rel="stylesheet" href="/tools/preview-assets/preview-tools.css" />
	<link rel="stylesheet" href="/tools/text-preview/text-preview.css" />
</svelte:head>

<header class="mb-[clamp(24px,3vw,36px)] grid max-w-[68ch] gap-3.5">
	<a
		class="justify-self-start font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-gold"
		href={resolve('/tools')}>{m.tool_back()}</a
	>
	<p class="eyebrow">{m.tools_eyebrow()}</p>
	<h1 class="display text-[clamp(2rem,3.4vw,2.9rem)] tracking-[-0.015em] text-gold">
		{m.tool_text_heading()}
	</h1>
	<p class="lede max-w-[62ch]">{m.tool_text_lead()}</p>
</header>

{@html markup}
