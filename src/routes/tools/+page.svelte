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

<header class="mb-[clamp(24px,3vw,36px)] grid max-w-[68ch] gap-3.5">
	<p class="eyebrow">{m.tools_eyebrow()}</p>
	<h1 class="display text-[clamp(2rem,3.4vw,2.9rem)] tracking-[-0.015em] text-gold">
		{m.tools_heading()}
	</h1>
	<p class="lede max-w-[62ch]">{m.tools_lead()}</p>
</header>

<div class="grid grid-cols-3 gap-4 max-[980px]:grid-cols-1">
	{#each tools as tool (tool.href)}
		<a
			class="tool-card group flex min-h-57.5 flex-col gap-3 rounded-md border border-line-strong p-[26px_24px] text-current no-underline hover:no-underline transition-all duration-300 hover:-translate-y-1 hover:border-accent hover:shadow-[0_24px_50px_-30px_rgba(0,0,0,0.8)] max-[980px]:min-h-0"
			href={tool.href}
		>
			<span class="font-mono text-[0.66rem] uppercase tracking-[0.2em] text-gold">
				{tool.index} — STS2
			</span>
			<h2 class="font-display text-[1.4rem] font-normal tracking-[0.01em] text-gold">{tool.title}</h2>
			<p class="text-[0.92rem] leading-[1.7] text-muted-strong">{tool.description}</p>
			<span
				class="mt-auto font-mono text-[0.72rem] uppercase tracking-[0.14em] text-ink-dim transition-[color,translate] group-hover:translate-x-1 group-hover:text-gold"
			>
				{m.tools_open()}
			</span>
		</a>
	{/each}
</div>

<style>
	/* color-mix + 双背景仍用原生 CSS，其余布局交给工具类 */
	.tool-card {
		background:
			radial-gradient(
				120% 100% at 20% 0%,
				color-mix(in srgb, var(--gold) 8%, transparent),
				transparent 55%
			),
			var(--surface-secondary);
	}
</style>
