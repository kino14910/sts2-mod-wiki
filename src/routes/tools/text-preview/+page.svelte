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

<header class="tool-head">
	<a class="tool-back" href={resolve('/tools')}>{m.tool_back()}</a>
	<p class="eyebrow">{m.tools_eyebrow()}</p>
	<h1 class="display">{m.tool_text_heading()}</h1>
	<p class="lede">{m.tool_text_lead()}</p>
</header>

{@html markup}
