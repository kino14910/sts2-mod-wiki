<script lang="ts">
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import { m } from '#lib/paraglide/messages';
	import { CHARACTER_ASSETS } from '#lib/data/mods';
	import { frameTintFilterId, frameTintMatrix } from '#lib/frame-tint';
	import type { ColorId } from '#lib/data/cards';
	import type { LayoutProps } from './$types';
	import './layout.css';

	let { children }: LayoutProps = $props();

	const TINT_FILTERS = Object.entries(CHARACTER_ASSETS)
		.filter(([, assets]) => assets.shader)
		.map(([color, assets]) => ({
			color: color as ColorId,
			matrix: frameTintMatrix(assets.shader!)
		}));
</script>

<a
	class="fixed left-2.5 top-2.5 z-100 translate-y-[-160%] rounded-md bg-gold px-4 py-2.5 text-[0.82rem] font-semibold text-[#111] transition-transform focus:translate-y-0"
	href="#main-content">{m.skip_to_content()}</a>

<SiteHeader />

<svg aria-hidden="true" focusable="false" width="0" height="0" style="position:absolute">
	<defs>
		{#each TINT_FILTERS as filter (filter.color)}
			<filter
				id={frameTintFilterId(filter.color)}
				color-interpolation-filters="sRGB"
			>
				<feColorMatrix type="matrix" values={filter.matrix.join(' ')} />
			</filter>
		{/each}
	</defs>
</svg>

<main id="main-content" class="block min-h-[50vh]">
	<div class="mx-auto w-full max-w-(--page-max) px-[clamp(8px,1.6vw,18px)] pt-[clamp(12px,2vw,24px)]">
		<div class="min-h-[62vh] rounded-[10px] bg-black/86 p-[clamp(15px,3vw,45px)]">
			{@render children()}
		</div>
	</div>
</main>
