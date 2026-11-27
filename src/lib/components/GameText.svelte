<script lang="ts">
	import WikiEntity from '#lib/components/WikiEntity.svelte'
	import WikiVariable from '#lib/components/WikiVariable.svelte'
	import {
		parseGameText,
		type GameTextNode,
		type GameTextOptions,
		type GameTextStyle
	} from '#lib/text/game-text'

	type IconNode = Extract<GameTextNode, { type: 'icon' }>
	type TagNode = Extract<GameTextNode, { type: 'tag' }>

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

	const italicFont = "var(--font-italic, 'Source Han Serif SC', serif)"

	function fontFamily(style: GameTextStyle) {
		if (style.font) return `'${style.font}'`
		return style.italic ? italicFont : undefined
	}

	function assetRef(node: IconNode) {
		return node.kind === 'asset' ? JSON.stringify(node.ref) : undefined
	}
</script>

<!-- 块首尾空白会被裁掉，跨行空白会折叠成一个空格：label 与图标循环必须写在同一行 -->

{#snippet renderNodes(list: GameTextNode[])}
	{#each list as node, index (index)}
		{@render renderNode(node)}
	{/each}
{/snippet}

{#snippet renderNode(node: GameTextNode)}
	{#if node.type === 'text'}
		{node.value}
	{:else if node.type === 'break'}
		<br />
	{:else if node.type === 'icon'}
		{@render renderIcon(node)}
	{:else if node.type === 'entity'}
		<WikiEntity
			ref={node.ref}
			text={node.value}
			locale={options.locale}
			href={linkable ? undefined : null}
		/>
	{:else if node.type === 'variable'}
		<WikiVariable name={node.name} value={node.value}>
			{@render renderNodes(node.children)}
		</WikiVariable>
	{:else if node.type === 'tag'}
		{@render renderTag(node)}
	{/if}
{/snippet}

{#snippet renderIcon(node: IconNode)}
	{node.label ?? ''}{#each { length: node.count } as _, index (index)}
		{#if node.src}
			<img
				class="sts-energy-icon"
				src={node.src}
				alt=""
				aria-hidden="true"
				data-icon-ref={assetRef(node)}
			/>
		{:else if node.diagnostic}
			<span class="sts-energy-icon" data-icon-missing={node.diagnostic}></span>
		{/if}
	{/each}
{/snippet}

{#snippet renderTag(node: TagNode)}
	{@const style = node.style}
	<span
		style:color={style.color}
		style:font-family={fontFamily(style)}
		style:font-size={style.fontSize}
		style:font-weight={style.bold ? '700' : undefined}
		style:text-decoration={style.underline ? 'underline' : undefined}
		style:display={style.align ? 'block' : undefined}
		style:text-align={style.align}
	>
		{@render renderNodes(node.children)}
	</span>
{/snippet}

<span class={['game-text', className]}>
	{@render renderNodes(nodes)}
</span>
