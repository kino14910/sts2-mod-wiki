<script lang="ts">
	import WikiTokenLink from '#lib/components/WikiTokenLink.svelte'
	import { relicImage } from '#lib/data/relic-wiki'
	import type { ArticleContent } from '#lib/wiki-article'

	let {
		tokenKey = '',
		raw = '',
		context
	}: { tokenKey?: string; raw?: string; context?: ArticleContent['context'] } = $props()

	let token = $derived(context?.tokens?.[tokenKey])
	let tooltip = $derived(token?.tooltip ? (context?.tooltips?.[token.tooltip] ?? '') : '')
</script>

{#if token}<WikiTokenLink
		label={token.text ?? tokenKey}
		icon={relicImage(token.icon)}
		href={token.href ?? ''}
		{tooltip}
	/>{:else}{raw}{/if}
