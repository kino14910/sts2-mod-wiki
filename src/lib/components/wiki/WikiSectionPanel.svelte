<script lang="ts">
	import { articleBlocks, type PublishedSection } from '#lib/wiki-article'
	import type { WikiViewer } from '#lib/wiki-collaboration'
	import WikiSection from './WikiSection.svelte'
	let { section, viewer, onChanged }: {
		section: PublishedSection; viewer: WikiViewer; onChanged: () => void | Promise<void>
	} = $props()
	let articleSection = $derived({ key: section.key, id: `section-${section.key}`, title: section.key,
		level: 2 as const, blocks: articleBlocks(section.content, section.contentType), published: section })
</script>

<WikiSection section={articleSection} {viewer} {onChanged} heading={false} />
