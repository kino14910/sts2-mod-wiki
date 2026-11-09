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
	<div class="druid-row druid-row-Title">
		<div class="druid-data druid-data-Title druid-data-nonempty druid-data-wide">
			{#if entry.icon}
				<a class="image" href={entry.infoHref}>
					<img src={relicImage(entry.icon)} alt="" width="28" height="28" />
				</a>
			{/if}
			<span>{entry.title}</span>
			{#if entry.infoHref}
				<a class="info" href={entry.infoHref} aria-label={`${entry.title} details`}>ⓘ</a>
			{/if}
		</div>
	</div>
	<div class="druid-row druid-row-Text">
		<div class="druid-data druid-data-Text druid-data-nonempty druid-data-wide">
			<WikiInline text={entry.text} {page} />
		</div>
	</div>
</InfoBox>

<style>
	.druid-row {
		display: flex;
		margin-block: 1px;
		font-size: 16px;
	}

	.druid-row-Title {
		padding: 4px 5px 8px;
		border-bottom: 1px solid var(--line-strong);
		font-size: 18px;
		font-weight: 600;
		color: var(--gold);
	}

	.druid-row-Title .druid-data {
		display: flex;
		align-items: center;
		gap: 8px;
		text-align: left;
	}

	.druid-row-Title img {
		width: 28px;
		height: 28px;
		filter: drop-shadow(0 0 2px black);
	}

	.druid-row-Title .info {
		margin-left: auto;
		font-size: 0.9rem;
		font-weight: 400;
		color: var(--link);
	}

	.druid-row-Title .info:hover {
		color: var(--gold);
	}

	.druid-data {
		padding: 6px 5px;
		background: oklch(0.4 0.03 187);
	}

	.druid-data-wide {
		width: 100%;
	}

	.druid-row-Text .druid-data {
		line-height: 1.5;
		font-size: 0.9rem;
	}
</style>
