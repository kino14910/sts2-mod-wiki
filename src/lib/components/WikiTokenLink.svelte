<script lang="ts">
	import { page as appPage } from '$app/state'
	import HoverTooltip from '#lib/components/HoverTooltip.svelte'
	import { isSelfLink } from '#lib/data/wiki-links'

	let {
		label,
		icon = '',
		href = '',
		tooltip = ''
	}: { label: string; icon?: string; href?: string; tooltip?: string } = $props()

	let pathname = $derived(appPage.url.pathname)
	let hovered = $state(false)
	let tipX = $state(0)
	let tipY = $state(0)
	let tipEl: HTMLElement | undefined = $state()
	let triggerEl: HTMLElement | undefined = $state()
	let timer: ReturnType<typeof setTimeout> | undefined

	function registerTip(element: HTMLElement) {
		tipEl = element
		return () => {
			if (tipEl === element) tipEl = undefined
		}
	}

	function registerTrigger(element: HTMLElement) {
		triggerEl = element
		return () => {
			if (triggerEl === element) triggerEl = undefined
		}
	}

	function placeAt(x: number, y: number) {
		const rect = tipEl?.getBoundingClientRect()
		const width = rect?.width || 390
		const height = rect?.height || 150
		tipX = Math.max(8, Math.min(x + 15, window.innerWidth - width - 8))
		tipY = Math.max(8, Math.min(y + 15, window.innerHeight - height - 8))
	}

	function show(x: number, y: number) {
		hovered = true
		placeAt(x, y)
	}

	function enter(event: MouseEvent) {
		if (!tooltip) return
		clearTimeout(timer)
		timer = setTimeout(() => show(event.clientX, event.clientY), 100)
	}

	function move(event: MouseEvent) {
		if (hovered) placeAt(event.clientX, event.clientY)
	}

	function focus() {
		if (!tooltip) return
		const rect = triggerEl?.getBoundingClientRect()
		if (rect) show(rect.left, rect.bottom)
	}

	function touch(event: TouchEvent) {
		if (!tooltip) return
		const point = event.touches[0]
		if (point) show(point.clientX, point.clientY)
		clearTimeout(timer)
		timer = setTimeout(leave, 2500)
	}

	function leave() {
		clearTimeout(timer)
		hovered = false
	}

	let self = $derived(isSelfLink(pathname, href))
</script>

{#snippet content()}{#if icon}<img
			class="wiki-inline-icon inline h-[1.35em] w-auto mx-[0.08em] align-[-0.32em] filter-[drop-shadow(0_0_1px_black)]"
			src={icon}
			alt=""
		/>{/if}{label}{/snippet}

{#if href && !self}
	<a
		class="wiki-inline-link text-[#85d2e4] whitespace-nowrap hover:underline [text-underline-thickness:1px] underline-offset-2"
		href={href}
		{@attach registerTrigger}
		onmouseenter={enter}
		onmousemove={move}
		onmouseleave={leave}
		onfocus={focus}
		onblur={leave}
		ontouchstart={touch}
	>{@render content()}</a
	>
{:else}
	<!-- svelte-ignore a11y_no_noninteractive_tabindex (A tooltip-only term must be reachable by keyboard.) -->
	<span
		class="wiki-inline-link wiki-inline-link--plain whitespace-nowrap font-semibold text-ink"
		role="note"
		tabindex={tooltip ? 0 : undefined}
		aria-current={self ? 'page' : undefined}
		{@attach registerTrigger}
		onmouseenter={enter}
		onmousemove={move}
		onmouseleave={leave}
		onfocus={focus}
		onblur={leave}
		ontouchstart={touch}
	>{@render content()}</span
	>
{/if}

<HoverTooltip show={hovered && !!tooltip} html={tooltip} x={tipX} y={tipY} {registerTip} />
