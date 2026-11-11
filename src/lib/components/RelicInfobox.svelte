<script lang="ts">
	import InfoBox from '#lib/components/InfoBox.svelte'
	import WikiInline from '#lib/components/WikiInline.svelte'
	import { relicImage, type RelicWikiPage } from '#lib/data/relic-wiki'

	let { page }: { page: RelicWikiPage } = $props()

	let infobox = $derived(page.infobox)
	let variants = $derived(infobox.variants.length > 1 ? infobox.variants : [])
</script>

<InfoBox
	tone="druid"
	element="div"
	id="druid-container-1"
	class="druid-infobox druid-container noexcerpt druid-container-relicpopup"
>
	{#snippet title()}
		<div class="druid-title px-0 pt-0.5 pb-1.5 border-b border-line-strong text-center font-display text-[1.65rem] font-bold leading-[1.2] text-[oklch(0.97_0_0)]">
			{page.title}
		</div>
	{/snippet}

	{#if variants.length}
		<div class="druid-tabs flex justify-center gap-1 pt-1.5">
			{#each variants as variant, index (variant)}
				<span class={['druid-tab px-2.5 py-px border border-line-strong rounded-[3px] bg-[oklch(0.4_0.03_187)] text-[0.82rem]', index === 0 && 'druid-tab--focused border-accent bg-[oklch(0.56_0.04_188)]']}>{variant}</span>
			{/each}
		</div>
	{/if}

	<div class="relic-topinfo flex flex-col items-center gap-px pt-2 pb-1 text-[0.9rem]">
		<div class="relic-rarity">
			<a class="text-[oklch(0.86_0.02_200)] hover:text-gold hover:underline underline-offset-2" href={infobox.rarity.href}>{infobox.rarity.label}</a>
		</div>
		<div class="relic-character">
			<a class="text-link hover:text-gold hover:underline underline-offset-2" href={infobox.character.href}>{infobox.character.label}</a>
		</div>
	</div>

	<div class="relic-art relative mx-auto mt-1.5 mb-2.5 w-[min(100%,224px)] aspect-square">
		<img class="relic-art-back absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[89.3%] h-auto" src={relicImage(infobox.image.backing)} alt="" aria-hidden="true" />
		<img class="relic-art-frame absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-auto" src={relicImage(infobox.image.frame)} alt="" aria-hidden="true" />
		<a class="relic-art-link absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 grid w-full h-full place-items-center" href={infobox.image.fileHref}>
			<img class="w-[57.1%] h-auto filter-[drop-shadow(0_2px_3px_oklch(0_0_0/60%))]" src={relicImage(infobox.image.art)} alt={infobox.image.alt} />
		</a>
	</div>

	<div class="relic-description px-0.5 pt-1 pb-0 text-center font-display text-[0.98rem] leading-[1.6] text-[oklch(0.95_0_0)] text-pretty">
		<WikiInline text={infobox.description} {page} />
	</div>
	<div class="relic-flavor px-2.5 pt-2.5 pb-0.5 text-center font-display text-[0.92rem] italic leading-normal text-[oklch(0.93_0_0)] text-pretty">{infobox.flavor}</div>
</InfoBox>

<style>
	.relic-description :global(.wiki-inline-link) {
		color: var(--gold-soft);
	}

	.relic-description :global(a.wiki-inline-link:hover) {
		color: oklch(0.95 0.14 95);
	}
</style>
