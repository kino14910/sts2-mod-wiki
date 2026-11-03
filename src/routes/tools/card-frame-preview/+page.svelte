<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages';
	import { loadToolScripts } from '#lib/tools/load-scripts.ts';
	import markup from './markup.html?raw';

	function bindCodeCopyButtons() {
		for (const button of document.querySelectorAll<HTMLButtonElement>('pre.code .copy[data-target]')) {
			button.addEventListener('click', async () => {
				const target = document.getElementById(button.dataset.target ?? '');
				const text = target?.textContent ?? '';
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
			});
		}
	}

	onMount(() => {
		bindCodeCopyButtons();
		return loadToolScripts([
			'/tools/preview-assets/frame-assets.js',
			'/tools/preview-assets/preview-tools.js'
		]);
	});
</script>

<svelte:head>
	<title>{m.tool_frame_meta_title()}</title>
	<meta name="description" content={m.tool_frame_meta_description()} />
	<link rel="stylesheet" href="/tools/preview-assets/preview-tools.css" />
</svelte:head>

<header class="tool-head">
	<a class="tool-back" href={resolve('/tools')}>{m.tool_back()}</a>
	<p class="eyebrow">{m.tools_eyebrow()}</p>
	<h1 class="display">{m.tool_frame_heading()}</h1>
	<p class="lede">{m.tool_frame_lead()}</p>
</header>

{@html markup}
