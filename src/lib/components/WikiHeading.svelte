<script lang="ts">
	import type { Snippet } from 'svelte'
	import { getLocale } from '#lib/paraglide/runtime'
	import { wikiUi } from '#lib/wiki-article'
	let { id, title, level = 2, onEdit, actions, copyable = true }: {
		id: string; title: string; level?: 2 | 3 | 4
		onEdit?: () => void; actions?: Snippet; copyable?: boolean
	} = $props()
	let ui = $derived(wikiUi(getLocale()))
	let notice = $state('')
	let manualLink = $state('')
	let copySequence = 0
	async function copyLink() {
		const sequence = ++copySequence
		const url = new URL(window.location.href)
		url.hash = id
		try {
			await navigator.clipboard.writeText(url.href)
			if (sequence !== copySequence) return
			manualLink = ''
			notice = ui.copied
		} catch {
			if (sequence !== copySequence) return
			manualLink = url.href
			notice = ui.copyFailed
		}
	}
</script>

<div class={['wiki-heading mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1',
	level === 2 ? 'mt-5 border-b border-line pb-1' : level === 3 ? 'mt-4' : 'mt-3']}>
	<svelte:element this={`h${level}`} {id}
		class={['scroll-mt-24 font-normal text-gold font-display', level === 2 ? 'text-[1.5em]' : level === 3 ? 'text-[1.2em]' : 'text-[1.05em]']}>
		{title}
	</svelte:element>
	<span class="inline-flex flex-wrap items-baseline gap-2 text-[0.75rem] font-normal text-link">
		{#if onEdit}<span class="mw-editsection">[<button type="button" onclick={onEdit} aria-label={`${ui.edit}: ${title}`} class="hover:underline focus-visible:outline-2">{ui.edit}</button>]</span>{/if}
		{#if copyable}<button type="button" class="copy-section-link hover:underline focus-visible:outline-2" aria-label={`${ui.copy}: ${title}`} onclick={copyLink}>#</button>{/if}
		{#if actions}{@render actions()}{/if}
	</span>
</div>
<div class="text-[0.75rem] text-muted" role="status">{notice}</div>
{#if manualLink}<input class="mb-2 w-full rounded border border-line bg-surface px-2 py-1 text-sm" aria-label={ui.copy} readonly value={manualLink} onclick={(event) => event.currentTarget.select()} />{/if}
