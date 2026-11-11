<script lang="ts">
	import InfoBox from '#lib/components/InfoBox.svelte'
	import WikiInline from '#lib/components/WikiInline.svelte'
	import { relicImage, type RelicWikiGlossary, type RelicWikiPage } from '#lib/data/relic-wiki'

	let { entry, page, id }: { entry: RelicWikiGlossary; page: RelicWikiPage; id: string } = $props()
</script>

<InfoBox
	tone="druid"
	element="div"
	{id}
	class="druid-infobox druid-container noexcerpt druid-container-small"
>
	<div class="druid-row druid-row-Title flex my-px px-1.25 pt-1 pb-2 border-b border-line-strong text-[18px] font-semibold text-gold">
		<div class="druid-data druid-data-Title druid-data-nonempty druid-data-wide flex w-full items-center gap-2 text-left p-[6px_5px] bg-[oklch(0.4_0.03_187)]">
			{#if entry.icon}
				<a class="image" href={entry.infoHref}>
					<img class="w-7 h-7 filter-[drop-shadow(0_0_2px_black)]" src={relicImage(entry.icon)} alt="" width="28" height="28" />
				</a>
			{/if}
			<span>{entry.title}</span>
			{#if entry.infoHref}
				<a class="info ml-auto text-[0.9rem] font-normal text-link hover:text-gold" href={entry.infoHref} aria-label={`${entry.title} details`}>ⓘ</a>
			{/if}
		</div>
	</div>
	<div class="druid-row druid-row-Text flex my-px">
		<div class="druid-data druid-data-Text druid-data-nonempty druid-data-wide w-full p-[6px_5px] bg-[oklch(0.4_0.03_187)] leading-normal text-[0.9rem]">
			<WikiInline text={entry.text} {page} />
		</div>
	</div>
</InfoBox>
