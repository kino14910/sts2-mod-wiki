<script lang="ts">
	import { page } from '$app/state'
	import { cardWikiHref, type WikiEntry } from '#lib/data/power-wiki'
	import { cardByName, powerIconByName, cardIcon, isSelfLink } from '#lib/data/wiki-links'
	import HoverTooltip from '#lib/components/HoverTooltip.svelte'
	import WikiIcon from '#lib/components/WikiIcon.svelte'

	let {
		entry,
		text = entry.name,
		href,
		tooltip,
		icon = ''
	}: {
		entry: WikiEntry
		text?: string
		href?: string | null
		tooltip?: string
		icon?: string
	} = $props()

	let hovered = $state(false)
	let tipX = $state(0)
	let tipY = $state(0)
	let tipEl: HTMLElement | undefined = $state()
	let timer: ReturnType<typeof setTimeout> | undefined

	let link = $derived(
		href !== undefined ? href : entry.kind === 'card' ? cardWikiHref(entry.name) : null
	)
	let tip = $derived(tooltip ?? entry.tooltip)

	let iconInfo = $derived.by((): { kind: 'power' | 'card'; src: string | null } => {
		if (icon) return { kind: 'power', src: powerIconByName(icon) }
		if (entry.kind === 'card') {
			const card = cardByName(entry.name)
			return { kind: 'card', src: card ? cardIcon(card) : null }
		}
		return { kind: 'power', src: null }
	})

	let current = $derived(isSelfLink(page.url.pathname, link))

	function registerTip(element: HTMLElement) {
		tipEl = element
		return () => {
			if (tipEl === element) tipEl = undefined
		}
	}

	function place(event: MouseEvent) {
		const rect = tipEl?.getBoundingClientRect()
		const width = rect?.width || 420
		const height = rect?.height || 160
		tipX = Math.max(8, Math.min(event.clientX + 15, window.innerWidth - width - 8))
		tipY = Math.max(8, Math.min(event.clientY + 15, window.innerHeight - height - 8))
	}

	function enter(event: MouseEvent) {
		if (!tip) return
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

{#if link && !current}
	<a
		class="wiki-card-link"
		href={link}
		onmouseenter={enter}
		onmousemove={move}
		onmouseleave={leave}
	>{#if iconInfo.src}<WikiIcon asLink={false} kind={iconInfo.kind} src={iconInfo.src} />{/if}{text}</a>
{:else}
	<span
		class="wiki-card-link"
		role="note"
		aria-current={current ? 'page' : undefined}
		onmouseenter={enter}
		onmousemove={move}
		onmouseleave={leave}
	>{#if iconInfo.src}<WikiIcon asLink={false} kind={iconInfo.kind} src={iconInfo.src} />{/if}{text}</span>
{/if}

<HoverTooltip show={hovered && !!tip} html={tip} x={tipX} y={tipY} {registerTip} />

<style>
	.wiki-card-link {
		color: #85d2e4;
	}

	a.wiki-card-link:hover {
		color: #fff3bd;
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 2px;
	}
</style>
