<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages';

	const tools = [
		{
			index: '01',
			href: resolve('/tools/id-generator'),
			title: m.tool_id_name(),
			description: m.tool_id_description()
		},
		{
			index: '02',
			href: resolve('/tools/card-frame-preview'),
			title: m.tool_frame_name(),
			description: m.tool_frame_description()
		},
		{
			index: '03',
			href: resolve('/tools/text-preview'),
			title: m.tool_text_name(),
			description: m.tool_text_description()
		}
	];
</script>

<svelte:head>
	<title>{m.tools_meta_title()}</title>
	<meta name="description" content={m.tools_meta_description()} />
</svelte:head>

<header class="tool-head">
	<p class="eyebrow">{m.tools_eyebrow()}</p>
	<h1 class="display">{m.tools_heading()}</h1>
	<p class="lede">{m.tools_lead()}</p>
</header>

<div class="tool-grid">
	{#each tools as tool (tool.href)}
		<a class="tool-card" href={tool.href}>
			<span class="tool-card-index">{tool.index} — RitsuLib</span>
			<h2>{tool.title}</h2>
			<p>{tool.description}</p>
			<span class="tool-card-arrow">{m.tools_open()}</span>
		</a>
	{/each}
</div>
