<script lang="ts">
	import { refreshAll } from '$app/navigation'
	import DetailTitle from '#lib/components/DetailTitle.svelte'
	import CardInfoBox from '#lib/components/cards/CardInfoBox.svelte'
	import WikiArticle from '#lib/components/wiki/WikiArticle.svelte'
	import WikiModerationPanel from '#lib/components/wiki/WikiModerationPanel.svelte'
	import WikiNavbox from '#lib/components/WikiNavbox.svelte'
	import CommentList from '#lib/components/wiki/comments/CommentList.svelte'
	import { buildCardNavbox } from '#lib/data/card-navbox'
	import { BASH_CARD_ARTICLE } from '#lib/data/card-wiki'
	import { localizedCard, colorName, rarityName, typeName, modName, localizedKeyword } from '#lib/data/localize'
	import { composeWikiArticle, type ArticleContent, type ArticleListItem } from '#lib/wiki-article'
	import { cardTextToPlain } from '#lib/text/card-text'
	import { m } from '#lib/paraglide/messages'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()
	let card = $derived(localizedCard(data.card))
	let isBash = $derived(card.mod === 'sts2' && card.id === 'Bash')
	let colorLabel = $derived(colorName(card.color))
	let rarityLabel = $derived(rarityName(card.rarity))
	let typeLabel = $derived(typeName(card.type))
	let modLabel = $derived(modName(card.mod))
	let costLabel = $derived(card.cost === null ? m.unplayable() : String(card.cost))
	let generatedSummary = $derived(isBash ? '' : m.card_summary({ name: card.name, rarity: rarityLabel, type: typeLabel, color: colorLabel, cost: costLabel }))
	let fallback = $derived.by((): ArticleContent => {
		if (isBash) return BASH_CARD_ARTICLE
		const notes: ArticleListItem[] = [
			{ text: `${m.card_cost()}: ${costLabel}` },
			{ text: `${m.card_from_label()}: ${modLabel}` }
		]
		if (card.keywords.length) notes.push({ text: `${m.nav_keywords()}: ${card.keywords.map(localizedKeyword).join(', ')}` })
		return {
			intro: [],
			sections: [
				{ key: 'obtaining', id: 'Obtaining', title: m.card_obtaining({ name: card.name }), level: 2,
					blocks: [{ kind: 'paragraph', text: m.card_obtaining_body({ name: card.name, mod: modLabel, color: colorLabel }) }] },
				{ key: 'interactions', id: 'Interactions', title: m.card_interactions(), level: 2, blocks: [] },
				{ key: 'synergies', id: 'Synergies', title: m.card_synergies(), level: 3, blocks: [] },
				{ key: 'notes', id: 'Notes', title: m.card_notes(), level: 2, blocks: [{ kind: 'list', items: notes }] },
				{ key: 'history', id: 'Update_History', title: m.card_update_history(), level: 2, blocks: [] }
			]
		}
	})
	let article = $derived(composeWikiArticle(fallback, data.wikiSections))
	let metaText = $derived(cardTextToPlain(card.text, { variables: card.variables }))
	let navbox = $derived(buildCardNavbox(data.card))
	const refresh = () => refreshAll()
</script>

<svelte:head>
	<title>{m.card_meta_title({ name: card.name })}</title>
	<meta name="description" content={m.card_meta_description({ name: card.name, text: metaText, mod: modLabel })} />
</svelte:head>

{#key data.entityKey}
<article class="card-article min-w-0 py-2" data-entity-id={data.entityRef.id} data-entity-key={data.entityKey} data-mod-id={card.mod}>
	<DetailTitle name={card.name} />
	<div class="grid items-start gap-x-6 gap-y-5 lg:grid-cols-[minmax(0,1fr)_300px]">
		<div class="min-w-0 max-lg:order-2">
			{#if generatedSummary}<p class="mb-3 text-[0.9rem] leading-[1.6]">{generatedSummary}</p>{/if}
			<WikiArticle {article} viewer={data.viewer} onChanged={refresh} />
		</div>
		<CardInfoBox {card} />
	</div>
	<WikiNavbox title={navbox.title} href={navbox.href} groups={navbox.groups}
		ariaLabel={navbox.title} collapsed />
	<CommentList id="Comments" targetId={data.entityRef.id} />
	<WikiModerationPanel viewer={data.viewer} pageId={data.wikiMeta.pageId ?? undefined}
		sectionIds={data.wikiSections.flatMap((section) => section.sectionId ? [section.sectionId] : [])} onChanged={refresh} />
</article>
{/key}
