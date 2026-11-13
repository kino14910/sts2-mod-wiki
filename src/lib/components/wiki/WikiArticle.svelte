<script lang="ts">
	import WikiToc from '#lib/components/WikiToc.svelte'
	import { getLocale } from '#lib/paraglide/runtime'
	import { m } from '#lib/paraglide/messages'
	import { articleToc, wikiUi, type ArticleView } from '#lib/wiki-article'
	import type { WikiViewer } from '#lib/wiki-collaboration'
	import WikiSection from './WikiSection.svelte'
	import WikiSectionContent from './WikiSectionContent.svelte'

	let { article, viewer, onChanged }: { article: ArticleView; viewer: WikiViewer; onChanged: () => void | Promise<void> } = $props()
	let toc = $derived([...articleToc(article.sections), { id: 'Comments', label: m.comments_title(), depth: 0, number: String(article.sections.filter((section) => section.level === 2).length + 1) }])
	let ui = $derived(wikiUi(getLocale()))
</script>

<div lang={article.lang}>
	{#if article.overview}
		<WikiSection section={{ key: 'overview', id: 'Overview', title: ui.overview, level: 2, blocks: article.intro, published: article.overview }}
			{viewer} context={article.context} {onChanged} heading={false} />
	{:else}<WikiSectionContent blocks={article.intro} context={article.context} />{/if}
	<div class="my-4"><WikiToc items={toc} collapsible /></div>
	{#each article.sections as section (section.published?.sectionId ?? section.key)}
		<WikiSection {section} {viewer} context={article.context} {onChanged} />
	{/each}
</div>
