<script lang="ts">
	import { onMount } from 'svelte'
	import DiffView from './DiffView.svelte'
	import type { DiffResult, RevisionView } from '#lib/wiki-collaboration'
	import { m } from '#lib/paraglide/messages'

	let {
		sectionId,
		canRevert = false,
		initiallyOpen = false,
		baseVersion,
		onReverted
	}: {
		sectionId: string
		canRevert?: boolean
		initiallyOpen?: boolean
		baseVersion?: number
		onReverted?: () => void
	} = $props()

	let open = $state(false)
	let items = $state<RevisionView[]>([])
	let loading = $state(false)
	let loaded = $state(false)
	let errorMessage = $state('')
	interface DiffPayload {
		revision: RevisionView
		parentContent: string
		diff: DiffResult
	}

	let diff = $state<DiffPayload | null>(null)
	let busy = $state('')
	let notice = $state('')
	const contentId = $props.id()
	onMount(() => {
		if (initiallyOpen) { open = true; void load() }
	})

	function formatTime(value: string): string {
		const date = new Date(value)
		return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
	}

	async function load() {
		loading = true
		errorMessage = ''
		try {
			const response = await fetch(`/api/wiki/sections/${encodeURIComponent(sectionId)}/history`, {
				cache: 'no-store'
			})
			if (!response.ok) throw new Error(String(response.status))
			const body = (await response.json()) as { items: RevisionView[] }
			items = body.items
			loaded = true
		} catch {
			errorMessage = m.wiki_edit_error()
		} finally {
			loading = false
		}
	}

	function toggle() {
		open = !open
		if (open && !loaded) void load()
	}

	async function showDiff(revisionId: string) {
		if (diff?.revision.id === revisionId) {
			diff = null
			return
		}
		busy = revisionId
		errorMessage = ''
		try {
			const response = await fetch(
				`/api/wiki/sections/${encodeURIComponent(sectionId)}/history?revision=${encodeURIComponent(revisionId)}`,
				{ cache: 'no-store' }
			)
			if (!response.ok) throw new Error(String(response.status))
			const body = (await response.json()) as { diff: DiffPayload | null }
			diff = body.diff
		} catch {
			errorMessage = m.wiki_edit_error()
		} finally {
			busy = ''
		}
	}

	async function revert(revision: RevisionView) {
		if (!confirm(m.wiki_history_revert_confirm())) return
		busy = revision.id
		errorMessage = ''
		notice = ''
		try {
			const response = await fetch(`/api/wiki/sections/${encodeURIComponent(sectionId)}/revert`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ revisionId: revision.id, baseVersion })
			})
			if (!response.ok) {
				const body = (await response.json().catch(() => null)) as { message?: string } | null
				throw new Error(body?.message ?? String(response.status))
			}
			notice = m.wiki_history_reverted()
			diff = null
			await load()
			onReverted?.()
		} catch (cause) {
			errorMessage = cause instanceof Error ? cause.message : m.wiki_edit_error()
		} finally {
			busy = ''
		}
	}
</script>

<div class="mt-3 border-t border-white/10 pt-3">
	<button
		type="button"
		class="rounded-md border border-white/15 px-2.5 py-1 text-[0.78rem] text-link hover:text-gold"
		onclick={toggle}
		aria-expanded={open}
		aria-controls={contentId}
	>
		{m.wiki_history()} {open ? '▴' : '▾'}
	</button>

	<div id={contentId}>
	{#if open}
		{#if loading && !loaded}
			<p class="mt-3 text-[0.8rem] opacity-60">{m.wiki_history_loading()}</p>
		{/if}
		{#if errorMessage}
			<p class="mt-3 text-[0.8rem] text-red-400" role="alert">{errorMessage}</p>
		{/if}
		{#if notice}
			<p class="mt-3 text-[0.8rem] text-emerald-400" role="status">{notice}</p>
		{/if}

		{#if loaded && items.length === 0}
			<p class="mt-3 text-[0.8rem] opacity-60">{m.wiki_history_empty()}</p>
		{/if}

		<ul class="mt-3 space-y-2">
			{#each items as revision (revision.id)}
				<li class="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-[0.8rem]">
					<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
						<span class="font-semibold text-gold">v{revision.revisionNo}</span>
						<span class="opacity-75">{revision.editorName ?? m.wiki_history_system()}</span>
						<time class="opacity-55" datetime={revision.createdAt}>{formatTime(revision.createdAt)}</time>
						<span class="rounded bg-white/10 px-1.5 py-0.5 text-[0.7rem] opacity-70">
							{revision.sourceType}
						</span>
					</div>
					{#if revision.summary}
						<p class="mt-1 opacity-75">{revision.summary}</p>
					{/if}
					<div class="mt-1.5 flex flex-wrap gap-3 text-[0.76rem]">
						<button
							type="button"
							class="text-link hover:text-gold disabled:opacity-45"
							disabled={busy === revision.id}
							onclick={() => showDiff(revision.id)}
						>
							{m.wiki_history_diff()}
						</button>
						{#if canRevert && baseVersion !== undefined}
							<button
								type="button"
								class="text-link hover:text-gold disabled:opacity-45"
								disabled={busy !== ''}
								onclick={() => revert(revision)}
							>
								{m.wiki_history_revert()}
							</button>
						{/if}
					</div>
					{#if diff?.revision.id === revision.id}
						<div class="mt-2">
							<DiffView diff={diff.diff} />
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
	</div>
</div>
