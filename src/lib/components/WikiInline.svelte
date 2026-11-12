<script lang="ts">
	import HoverTooltip from '#lib/components/HoverTooltip.svelte'
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
	let hovered = $state('')
	let tipX = $state(0)
	let tipY = $state(0)
	let tipEl: HTMLElement | undefined = $state()
	let timer: ReturnType<typeof setTimeout> | undefined

	function registerTip(element: HTMLElement) {
		tipEl = element
		return () => {
			if (tipEl === element) tipEl = undefined
		}
	}

	function place(event: MouseEvent) {
		const rect = tipEl?.getBoundingClientRect()
		const width = rect?.width || 390
		const height = rect?.height || 150
		tipX = Math.max(8, Math.min(event.clientX + 15, window.innerWidth - width - 8))
		tipY = Math.max(8, Math.min(event.clientY + 15, window.innerHeight - height - 8))
	}

	function enter(event: MouseEvent, key: string, tooltip: string) {
		if (!tooltip) return
		clearTimeout(timer)
		timer = setTimeout(() => {
			hovered = key
			place(event)
		}, 100)
	}

	function move(event: MouseEvent) {
		if (hovered) place(event)
	}

	function leave() {
		clearTimeout(timer)
		hovered = ''
	}

	let activeTip = $derived(nodes.find((node) => node.kind === 'token' && node.key === hovered))
</script>

{#each nodes as node, index (index)}
	{#if node.kind === 'token'}
		{#if node.href}
			<a
				class="wiki-inline-link text-[#85d2e4] whitespace-nowrap hover:underline [text-underline-thickness:1px] underline-offset-2"
				href={node.href}
				onmouseenter={(event) => enter(event, node.key, node.tooltip)}
				onmousemove={move}
				onmouseleave={leave}
				>{#if node.icon}<img class="wiki-inline-icon inline h-[1.35em] w-auto mx-[0.08em] align-[-0.32em] filter-[drop-shadow(0_0_1px_black)]" src={node.icon} alt="" />{/if}{node.label}</a
			>
		{:else}
			<span
				class="wiki-inline-link wiki-inline-link--plain text-[#85d2e4] whitespace-nowrap font-semibold hover:underline [text-underline-thickness:1px] underline-offset-2"
				role="note"
				onmouseenter={(event) => enter(event, node.key, node.tooltip)}
				onmousemove={move}
				onmouseleave={leave}
				>{#if node.icon}<img class="wiki-inline-icon inline h-[1.35em] w-auto mx-[0.08em] align-[-0.32em] filter-[drop-shadow(0_0_1px_black)]" src={node.icon} alt="" />{/if}{node.label}</span
			>
		{/if}
{:else if node.kind === 'bold'}<strong>{node.value}</strong
>{:else if node.kind === 'break'}<br />{:else if node.kind === 'text'}<WikiText text={node.value} />{/if}
{/each}

<HoverTooltip
	show={!!activeTip && activeTip.kind === 'token' && !!activeTip.tooltip}
	html={activeTip?.kind === 'token' ? activeTip.tooltip : ''}
	x={tipX}
	y={tipY}
	{registerTip}
/>
