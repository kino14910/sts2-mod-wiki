<script lang="ts">
	import WikiEntity from '#lib/components/WikiEntity.svelte'
	import WikiVariable from '#lib/components/WikiVariable.svelte'
	import { parseGameText, type GameTextNode, type GameTextOptions } from '#lib/text/game-text'

	let {
		text,
		options = {},
		class: className = ''
	}: {
		text: string
		options?: GameTextOptions
		class?: string
	} = $props()

	let nodes = $derived(parseGameText(text, options))
	let linkable = $derived(options.interactive !== false)
</script>

<!-- 模板空白会进入 textContent，递归 snippet 与根节点的标记必须紧贴 -->

{#snippet renderNode(node: GameTextNode)}{#if node.type === 'text'}{node.value}{:else if node.type === 'break'}<br />{:else if node.type === 'icon'}{#each Array.from({ length: node.count }) as _, i (i)}{#if node.src}<img class="sts-energy-icon" src={node.src} alt="" aria-hidden="true" data-icon-ref={node.kind === 'asset' ? JSON.stringify(node.ref) : undefined} />{:else if node.diagnostic}<span class="sts-energy-icon" data-icon-missing={node.diagnostic}></span>{/if}{/each}{:else if node.type === 'entity'}<WikiEntity ref={node.ref} text={node.value} href={linkable ? undefined : null} />{:else if node.type === 'variable'}{#if node.children.length}<WikiVariable name={node.name} value={node.value}>{#each node.children as child, i (i)}{@render renderNode(child)}{/each}</WikiVariable>{:else}<WikiVariable name={node.name} value={node.value} />{/if}{:else if node.type === 'tag'}{@const style = node.style}{@const font = style.font ? `'${style.font}'` : style.italic ? "var(--font-italic, 'Source Han Serif SC', serif)" : undefined}<span
			style:color={style.color}
			style:font-family={font}
			style:font-size={style.fontSize}
			style:font-weight={style.bold ? '700' : undefined}
			style:text-decoration={style.underline ? 'underline' : undefined}
			style:display={style.align ? 'block' : undefined}
			style:text-align={style.align}
		>{#each node.children as child, i (i)}{@render renderNode(child)}{/each}</span>{/if}{/snippet}

<span class={['game-text', className]}>{#each nodes as node, i (i)}{@render renderNode(node)}{/each}</span>
