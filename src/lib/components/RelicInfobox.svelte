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
		<div class="druid-title">{page.title}</div>
	{/snippet}

	{#if variants.length}
		<div class="druid-tabs">
			{#each variants as variant, index (variant)}
				<span class={['druid-tab', index === 0 && 'druid-tab--focused']}>{variant}</span>
			{/each}
		</div>
	{/if}

	<div class="relic-topinfo">
		<div class="relic-rarity">
			<a href={infobox.rarity.href}>{infobox.rarity.label}</a>
		</div>
		<div class="relic-character">
			<a href={infobox.character.href}>{infobox.character.label}</a>
		</div>
	</div>

	<div class="relic-art">
		<img class="relic-art-back" src={relicImage(infobox.image.backing)} alt="" aria-hidden="true" />
		<img class="relic-art-frame" src={relicImage(infobox.image.frame)} alt="" aria-hidden="true" />
		<a class="relic-art-link" href={infobox.image.fileHref}>
			<img src={relicImage(infobox.image.art)} alt={infobox.image.alt} />
		</a>
	</div>

	<div class="relic-description"><WikiInline text={infobox.description} {page} /></div>
	<div class="relic-flavor">{infobox.flavor}</div>
</InfoBox>

<style>
	.druid-title {
		padding: 2px 0 6px;
		border-bottom: 1px solid var(--line-strong);
		text-align: center;
		font-family: var(--font-display);
		font-size: 1.65rem;
		font-weight: 700;
		line-height: 1.2;
		color: oklch(0.97 0 0);
	}

	.druid-tabs {
		display: flex;
		justify-content: center;
		gap: 4px;
		padding-top: 6px;
	}

	.druid-tab {
		padding: 1px 10px;
		border: 1px solid var(--line-strong);
		border-radius: 3px;
		background: oklch(0.4 0.03 187);
		font-size: 0.82rem;
	}

	.druid-tab--focused {
		border-color: var(--accent);
		background: oklch(0.56 0.04 188);
	}

	.relic-topinfo {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1px;
		padding: 8px 0 4px;
		font-size: 0.9rem;
	}

	.relic-rarity a {
		color: oklch(0.86 0.02 200);
	}

	.relic-character a {
		color: var(--link);
	}

	.relic-topinfo a:hover {
		color: var(--gold);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.relic-art {
		position: relative;
		width: min(100%, 224px);
		aspect-ratio: 1;
		margin: 6px auto 10px;
	}

	.relic-art img,
	.relic-art-link {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	.relic-art-back {
		width: 89.3%;
		height: auto;
	}

	.relic-art-frame {
		width: 100%;
		height: auto;
	}

	.relic-art-link {
		display: grid;
		width: 100%;
		height: 100%;
		place-items: center;
	}

	.relic-art-link img {
		width: 57.1%;
		height: auto;
		filter: drop-shadow(0 2px 3px oklch(0 0 0 / 60%));
	}

	.relic-description {
		padding: 4px 2px 0;
		text-align: center;
		font-family: var(--font-display);
		font-size: 0.98rem;
		line-height: 1.6;
		color: oklch(0.95 0 0);
		text-wrap: pretty;
	}

	.relic-description :global(.wiki-inline-link) {
		color: var(--gold-soft);
	}

	.relic-description :global(a.wiki-inline-link:hover) {
		color: oklch(0.95 0.14 95);
	}

	.relic-flavor {
		padding: 10px 8px 2px;
		text-align: center;
		font-family: var(--font-display);
		font-size: 0.92rem;
		font-style: italic;
		line-height: 1.5;
		color: oklch(0.93 0 0);
		text-wrap: pretty;
	}
</style>
