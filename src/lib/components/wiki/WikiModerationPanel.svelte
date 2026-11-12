<script lang="ts">
	import { onMount } from 'svelte'
	import DiffView from './DiffView.svelte'
	import { m } from '#lib/paraglide/messages'
	import type { DiffResult, ProposalView, WikiViewer } from '#lib/wiki-collaboration'

	interface SourceUpdateItem {
		id: string
		sectionId: string
		status: string
		incomingHash: string
		createdAt: string
	}

	interface SourceUpdateDetail {
		id: string
		sectionKey: string
		sourcePath: string
		status: string
		currentContent: string
		incomingContent: string
		conflictDiff: DiffResult
		upstreamDiff: DiffResult
		hasCommunityDrift: boolean
	}

	let { viewer, onChanged }: { viewer: WikiViewer; onChanged: () => void } = $props()

	let canReview = $derived(viewer.permissions.includes('wiki:proposal:review'))
	let canViewSource = $derived(viewer.permissions.includes('wiki:source:view'))
	let canResolveSource = $derived(viewer.permissions.includes('wiki:source:review'))

	let proposals = $state<ProposalView[]>([])
	let sourceUpdates = $state<SourceUpdateItem[]>([])
	let detail = $state<SourceUpdateDetail | null>(null)
	let openDetailId = $state('')
	let note = $state('')
	let busy = $state('')
	let errorMessage = $state('')
	let notice = $state('')

	async function load() {
		errorMessage = ''
		const requests: Promise<void>[] = []
		if (canReview) {
			requests.push(
				fetch('/api/wiki/proposals?status=pending', { cache: 'no-store' })
					.then(async (response) => {
						if (!response.ok) throw new Error(String(response.status))
						const body = (await response.json()) as { items: ProposalView[] }
						proposals = body.items
					})
			)
		}
		if (canViewSource) {
			requests.push(
				fetch('/api/admin/wiki/source-updates', { cache: 'no-store' })
					.then(async (response) => {
						if (!response.ok) throw new Error(String(response.status))
						const body = (await response.json()) as { items: SourceUpdateItem[] }
						sourceUpdates = body.items.filter((item) =>
							['pending', 'conflict'].includes(item.status)
						)
					})
			)
		}
		const results = await Promise.allSettled(requests)
		if (results.some((result) => result.status === 'rejected')) errorMessage = m.wiki_edit_error()
	}

	onMount(() => {
		if (canReview || canViewSource) void load()
	})

	async function decide(kind: 'proposal' | 'source', id: string, decision: 'approve' | 'reject') {
		busy = id
		errorMessage = ''
		notice = ''
		try {
			const url =
				kind === 'proposal'
					? `/api/wiki/proposals/${encodeURIComponent(id)}`
					: `/api/admin/wiki/source-updates/${encodeURIComponent(id)}`
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ decision, note })
			})
			const body = (await response.json().catch(() => null)) as { message?: string } | null
			if (!response.ok) throw new Error(body?.message ?? m.wiki_edit_error())
			notice = decision === 'approve' ? m.wiki_review_approved() : m.wiki_review_rejected()
			if (kind === 'source') {
				detail = null
				openDetailId = ''
			}
			await load()
			onChanged()
		} catch (cause) {
			errorMessage = cause instanceof Error ? cause.message : m.wiki_edit_error()
		} finally {
			busy = ''
		}
	}

	async function toggleDetail(id: string) {
		if (openDetailId === id) {
			openDetailId = ''
			detail = null
			return
		}
		openDetailId = id
		detail = null
		try {
			const response = await fetch(
				`/api/admin/wiki/source-updates/${encodeURIComponent(id)}`,
				{ cache: 'no-store' }
			)
			if (!response.ok) throw new Error(String(response.status))
			detail = (await response.json()) as SourceUpdateDetail
		} catch {
			errorMessage = m.wiki_edit_error()
		}
	}

	function formatTime(value: string): string {
		const date = new Date(value)
		return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
	}
</script>

{#if canReview || canViewSource}
	<section class="mt-10 rounded-md border border-gold/25 bg-white/5 p-5" aria-label={m.wiki_review_title()}>
		<h2 class="font-serif text-xl text-gold">{m.wiki_review_title()}</h2>

		{#if errorMessage}
			<p class="mt-2 text-[0.8rem] text-red-400" role="alert">{errorMessage}</p>
		{/if}
		{#if notice}
			<p class="mt-2 text-[0.8rem] text-emerald-400" role="status">{notice}</p>
		{/if}

		<label class="mt-3 block text-[0.78rem] opacity-75">
			{m.wiki_review_note()}
			<input
				class="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-1.5 text-[0.84rem] text-ink outline-none focus:border-link"
				type="text"
				maxlength="500"
				bind:value={note}
			/>
		</label>

		{#if canReview}
			<h3 class="mt-5 text-[0.9rem] font-semibold">{m.wiki_review()} ({proposals.length})</h3>
			{#if proposals.length === 0}
				<p class="mt-2 text-[0.8rem] opacity-60">{m.wiki_review_empty()}</p>
			{/if}
			<ul class="mt-3 space-y-4">
				{#each proposals as proposal (proposal.id)}
					<li class="rounded-md border border-white/10 bg-black/20 p-3 text-[0.8rem]">
						<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
							<span class="font-semibold text-gold">{proposal.sectionKey}</span>
							<span class="opacity-75">{proposal.submittedByName}</span>
							<time class="opacity-55" datetime={proposal.createdAt}>
								{formatTime(proposal.createdAt)}
							</time>
							<span class="opacity-55">v{proposal.baseVersion}</span>
						</div>
						{#if proposal.summary}
							<p class="mt-1 opacity-75">{proposal.summary}</p>
						{/if}
						{#if proposal.diff}
							<div class="mt-2"><DiffView diff={proposal.diff} /></div>
						{/if}
						<div class="mt-2 flex flex-wrap gap-3">
							<button
								type="button"
								class="rounded-md bg-link px-2.5 py-1 font-semibold text-black disabled:opacity-45"
								disabled={busy !== ''}
								onclick={() => decide('proposal', proposal.id, 'approve')}
							>
								{m.wiki_review_approve()}
							</button>
							<button
								type="button"
								class="rounded-md border border-white/15 px-2.5 py-1 text-link hover:text-gold disabled:opacity-45"
								disabled={busy !== ''}
								onclick={() => decide('proposal', proposal.id, 'reject')}
							>
								{m.wiki_review_reject()}
							</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}

		{#if canViewSource}
			<h3 class="mt-6 text-[0.9rem] font-semibold">
				{m.wiki_source_updates()} ({sourceUpdates.length})
			</h3>
			{#if sourceUpdates.length === 0}
				<p class="mt-2 text-[0.8rem] opacity-60">{m.wiki_review_empty()}</p>
			{/if}
			<ul class="mt-3 space-y-2">
				{#each sourceUpdates as update (update.id)}
					<li class="rounded-md border border-white/10 bg-black/20 p-3 text-[0.8rem]">
						<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
							<span class="rounded bg-amber-400/15 px-1.5 py-0.5 text-amber-300">
								{update.status}
							</span>
							<span class="opacity-60">{update.incomingHash.slice(0, 20)}</span>
							<time class="opacity-55" datetime={update.createdAt}>
								{formatTime(update.createdAt)}
							</time>
						</div>
						<div class="mt-2 flex flex-wrap gap-3">
							<button
								type="button"
								class="text-link hover:text-gold"
								onclick={() => toggleDetail(update.id)}
							>
								{m.wiki_source_update_view()}
							</button>
							{#if canResolveSource}
								<button
									type="button"
									class="text-link hover:text-gold disabled:opacity-45"
									disabled={busy !== ''}
									onclick={() => decide('source', update.id, 'approve')}
								>
									{m.wiki_source_update_approve()}
								</button>
								<button
									type="button"
									class="text-link hover:text-gold disabled:opacity-45"
									disabled={busy !== ''}
									onclick={() => decide('source', update.id, 'reject')}
								>
									{m.wiki_review_reject()}
								</button>
							{/if}
						</div>
						{#if openDetailId === update.id}
							{#if detail}
								<p class="mt-2 wrap-break-word opacity-70">{detail.sourcePath}</p>
								{#if detail.hasCommunityDrift}
									<p class="mt-1 text-amber-300">{m.wiki_source_update_conflict()}</p>
								{/if}
								<div class="mt-2"><DiffView diff={detail.conflictDiff} /></div>
							{:else}
								<p class="mt-2 opacity-60">{m.wiki_history_loading()}</p>
							{/if}
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}
