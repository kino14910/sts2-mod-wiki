<script lang="ts">
	import { page } from '$app/state'
	import type { Card } from '#lib/data/cards'
	import {
		powerIconByName,
		powerHrefByName,
		relicHrefByName,
		cardIcon,
		isSelfLink
	} from '#lib/data/wiki-links'

	let {
		kind,
		name = '',
		src = '',
		card,
		label = '',
		href,
		asLink = true
	}: {
		kind: 'power' | 'relic' | 'card'
		name?: string
		src?: string
		card?: Card
		label?: string
		href?: string | null
		asLink?: boolean
	} = $props()

	let iconSrc = $derived(
		src || (kind === 'power' ? powerIconByName(name) : kind === 'card' && card ? cardIcon(card) : null)
	)

	let resolvedHref = $derived.by(() => {
		if (href !== undefined) return href
		if (kind === 'power') return powerHrefByName(name)
		if (kind === 'relic') return relicHrefByName(name)
		if (card) return `/cards/${encodeURIComponent(card.id)}`
		return null
	})

	let current = $derived(asLink && isSelfLink(page.url.pathname, resolvedHref))
</script>

{#if asLink && resolvedHref && !current}
	<a class="wiki-icon-link" href={resolvedHref}>
		{#if iconSrc}
			<img class="wiki-icon-img" src={iconSrc} alt="" width="20" height="20" loading="lazy" decoding="async" />
		{/if}
		{#if label}<span class="wiki-icon-label">{label}</span>{/if}
	</a>
{:else}
	<span class="wiki-icon-link" aria-current={asLink && current ? 'page' : undefined}>
		{#if iconSrc}
			<img class="wiki-icon-img" src={iconSrc} alt="" width="20" height="20" loading="lazy" decoding="async" />
		{/if}
		{#if label}<span class="wiki-icon-label">{label}</span>{/if}
	</span>
{/if}

<style>
	.wiki-icon-img {
		display: inline;
		width: auto;
		height: 1.35em;
		margin: 0 0.08em;
		vertical-align: -0.32em;
		filter: drop-shadow(0 0 1px black);
	}

	.wiki-icon-label {
		margin-left: 0.1em;
		font-weight: 700;
	}

	.wiki-icon-link {
		color: #85d2e4;
		white-space: nowrap;
		text-decoration: none;
	}

	a.wiki-icon-link:hover {
		color: #fff3bd;
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 2px;
	}
</style>
