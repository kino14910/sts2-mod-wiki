<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages';
	import { loadToolScripts } from '#lib/tools/load-scripts.ts';
	import markup from './markup.html?raw';

	onMount(() =>
		loadToolScripts(['/tools/id-generator/id-generator.js', '/tools/id-generator/id-generator-ui.js'])
	);
</script>

<svelte:head>
	<title>{m.tool_id_meta_title()}</title>
	<meta name="description" content={m.tool_id_meta_description()} />
	<link rel="stylesheet" href="/tools/id-generator/id-generator.css" />
</svelte:head>

<header class="tool-head">
	<a class="tool-back" href={resolve('/tools')}>{m.tool_back()}</a>
	<p class="eyebrow">{m.tools_eyebrow()}</p>
	<h1 class="display">{m.tool_id_heading()}</h1>
	<p class="lede">{m.tool_id_lead()}</p>
</header>

{@html markup}
