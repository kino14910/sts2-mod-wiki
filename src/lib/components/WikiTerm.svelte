<script lang="ts">
	import type { Snippet } from 'svelte'
	import HoverTooltip from '#lib/components/HoverTooltip.svelte'

	let { tooltip, children }: { tooltip: string; children: Snippet } = $props()

	let hovered = $state(false)
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

	function enter(event: MouseEvent) {
		if (!tooltip) return
		clearTimeout(timer)
		timer = setTimeout(() => {
			hovered = true
			place(event)
		}, 100)
	}

	function move(event: MouseEvent) {
		if (hovered) place(event)
	}

	function leave() {
		clearTimeout(timer)
		hovered = false
	}
</script>

<span
	class="wiki-term"
	role="note"
	onmouseenter={enter}
	onmousemove={move}
	onmouseleave={leave}>{@render children()}</span
>
<HoverTooltip show={hovered && !!tooltip} html={tooltip} x={tipX} y={tipY} {registerTip} />

<style>
	.wiki-term {
		cursor: help;
	}
</style>
