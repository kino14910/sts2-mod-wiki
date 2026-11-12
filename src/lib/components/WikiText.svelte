<script lang="ts">
	import WikiEntity from '#lib/components/WikiEntity.svelte'
	import { entityKey, type EntityRef } from '#lib/entities'
	import { parseWikiText, type WikiNode } from '#lib/text/wiki-text'

	let {
		text,
		locale,
		current = null
	}: {
		text: string
		locale?: string
		current?: EntityRef | null
	} = $props()

	let nodes = $derived(parseWikiText(text, { locale, current }))
</script>

<!-- 模板空白会进入 textContent，递归 snippet 与根节点的标记必须紧贴 -->
{#snippet renderNode(node: WikiNode)}{#if node.type === 'text'}{node.value}{:else if node.type === 'break'}<br />{:else if node.type === 'upgraded'}<span class="wiki-upgraded text-[#94ee93]">{node.value}</span>{:else if node.type === 'ambiguous'}<span
		class="wiki-ambiguous"
		role="note"
		data-entity-candidates={JSON.stringify(node.refs.map(entityKey))}
		title={node.refs.map(entityKey).join(' / ')}>{node.value}</span
	>{:else if node.type === 'entity'}<WikiEntity
		entry={node.entry}
		ref={node.ref}
		text={node.icon ? '' : node.value}
		href={node.href}
		tooltip={node.tooltip}
		icon={node.icon?.name ?? ''}
		iconSrc={node.icon?.src ?? ''}
		iconKind={node.icon?.kind ?? 'power'}
		iconLabel={node.icon?.label ?? ''}
	/>{:else if node.type === 'tag'}<span
		style:color={node.style.color}
		style:font-family={node.style.font ? `'${node.style.font}'` : node.style.italic ? "var(--font-italic, 'Source Han Serif SC', serif)" : undefined}
		style:font-size={node.style.fontSize}
		style:font-weight={node.style.bold ? '700' : undefined}
		style:text-decoration={node.style.underline ? 'underline' : undefined}
		style:display={node.style.align ? 'block' : undefined}
		style:text-align={node.style.align}
	>{#each node.children as child, i (i)}{@render renderNode(child)}{/each}</span>{/if}{/snippet}

{#each nodes as node, i (i)}{@render renderNode(node)}{/each}
