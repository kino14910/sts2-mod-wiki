<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages';
	import { loadToolScripts } from '#lib/tools/load-scripts.ts';
	import markup from './markup.html?raw';

	async function handleCopy(event: MouseEvent) {
		const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(
			'pre.code .copy[data-target]'
		);
		if (!button) return;

		const text = document.getElementById(button.dataset.target ?? '')?.textContent ?? '';
		if (!text) return;

		let copied = false;
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
		} catch {
			const area = document.createElement('textarea');
			area.value = text;
			area.style.position = 'fixed';
			area.style.left = '-9999px';
			document.body.appendChild(area);
			area.select();
			copied = document.execCommand('copy');
			area.remove();
		}

		button.classList.toggle('copy-failed', !copied);
		button.classList.toggle('kira-codeblock-copy-wrapper-copied', copied);
		setTimeout(() => {
			button.classList.remove('copy-failed', 'kira-codeblock-copy-wrapper-copied');
		}, 1500);
	}

	onMount(() =>
		loadToolScripts([
			'/tools/preview-assets/frame-assets.js',
			'/tools/preview-assets/preview-tools.js'
		])
	);
</script>

<svelte:head>
	<title>{m.tool_frame_meta_title()}</title>
	<meta name="description" content={m.tool_frame_meta_description()} />
	<link rel="stylesheet" href="/tools/preview-assets/preview-tools.css" />
</svelte:head>

<svelte:document onclick={handleCopy} />

<header class="mb-[clamp(24px,3vw,36px)] grid max-w-[68ch] gap-3.5">
	<a
		class="justify-self-start font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-gold"
		href={resolve('/tools')}>{m.tool_back()}</a
	>
	<p class="eyebrow">{m.tools_eyebrow()}</p>
	<h1 class="display text-[clamp(2rem,3.4vw,2.9rem)] tracking-[-0.015em] text-gold">
		{m.tool_frame_heading()}
	</h1>
	<p class="lede max-w-[62ch]">{m.tool_frame_lead()}</p>
</header>

{@html markup}
