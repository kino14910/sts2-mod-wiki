<script lang="ts">
	import WikiTokenLink from '#lib/components/WikiTokenLink.svelte'
	import WikiText from '#lib/components/WikiText.svelte'
	import { relicImage, type RelicWikiPage } from '#lib/data/relic-wiki'

	let {
		text,
		page
	}: { text: string; page: Pick<RelicWikiPage, 'tokens' | 'tooltips'> } = $props()

	type Node =
		| { kind: 'text'; value: string }
		| { kind: 'bold'; value: string }
		| { kind: 'break' }
		| {
				kind: 'token'
				key: string
				label: string
				icon: string
				href: string
				tooltip: string
		  }

	const PATTERN = /\[\[([^\]]+)\]\]|\*\*([^*]+)\*\*|\n/g

	function parse(value: string): Node[] {
		const nodes: Node[] = []
		let last = 0
		for (const match of value.matchAll(PATTERN)) {
			const start = match.index ?? 0
			if (start > last) nodes.push({ kind: 'text', value: value.slice(last, start) })
			const end = start + match[0].length
			if (match[1] !== undefined) {
				const key = match[1]
				const token = page.tokens[key] ?? {}
				nodes.push({
					kind: 'token',
					key,
					label: token.text ?? key,
					icon: relicImage(token.icon),
					href: token.href ?? '',
					tooltip: token.tooltip ? (page.tooltips[token.tooltip] ?? '') : ''
				})
			} else if (match[2] !== undefined) {
				nodes.push({ kind: 'bold', value: match[2] })
			} else {
				nodes.push({ kind: 'break' })
			}
			last = end
		}
		if (last < value.length) nodes.push({ kind: 'text', value: value.slice(last) })
		return nodes
	}

	let nodes = $derived(parse(text))
</script>

{#each nodes as node, index (index)}
	{#if node.kind === 'token'}<WikiTokenLink
			label={node.label}
			icon={node.icon}
			href={node.href}
			tooltip={node.tooltip}
		/>{:else if node.kind === 'bold'}<strong>{node.value}</strong
	>{:else if node.kind === 'break'}<br />{:else if node.kind === 'text'}<WikiText text={node.value} />{/if}
{/each}
