<script lang="ts">
	import { untrack } from 'svelte'
	import CommentForm from './CommentForm.svelte'
	import CommentItem from './CommentItem.svelte'
	import { commentRequestHeaders } from '#lib/comment-identity'
	import type { CommentPage, CommentTargetType, CommentView } from '#lib/comments'
	import { m } from '#lib/paraglide/messages'

	let {
		targetType = 'card',
		targetId
	}: { targetType?: CommentTargetType; targetId: string } = $props()

	let items = $state<CommentView[]>([])
	let page = $state(1)
	let total = $state(0)
	let hasMore = $state(false)
	let loading = $state(false)
	let loaded = $state(false)
	let errorMessage = $state('')

	// Ignores stale responses when the reader posts or reloads while a request is in flight.
	let requestSeq = 0

	async function requestPage(target: string, pageNumber: number): Promise<CommentPage> {
		const params = new URLSearchParams({
			targetType,
			targetId: target,
			page: String(pageNumber)
		})
		const response = await fetch(`/api/comments?${params}`, {
			headers: commentRequestHeaders(),
			cache: 'no-store'
		})
		if (!response.ok) throw new Error(`comment request failed: ${response.status}`)
		return (await response.json()) as CommentPage
	}

	function mergePages(pages: CommentPage[]): CommentView[] {
		const merged: CommentView[] = []
		const seen = new Set<string>()
		for (const result of pages) {
			for (const comment of result.items) {
				if (seen.has(comment.id)) continue
				seen.add(comment.id)
				merged.push(comment)
			}
		}
		return merged
	}

	/** Reloads every page already on screen so a new comment never drops loaded pages. */
	async function reload(target = targetId) {
		const seq = ++requestSeq
		const lastPage = Math.max(page, 1)
		loading = true
		errorMessage = ''
		try {
			const pages: CommentPage[] = []
			for (let current = 1; current <= lastPage; current += 1) {
				pages.push(await requestPage(target, current))
				if (seq !== requestSeq) return
			}
			const latest = pages[pages.length - 1]
			if (!latest) return
			items = mergePages(pages)
			page = lastPage
			total = latest.total
			hasMore = latest.hasMore
		} catch {
			if (seq === requestSeq) errorMessage = m.comments_error()
		} finally {
			if (seq === requestSeq) {
				loading = false
				loaded = true
			}
		}
	}

	async function loadMore() {
		if (loading || !hasMore) return
		const seq = ++requestSeq
		loading = true
		errorMessage = ''
		try {
			const result = await requestPage(targetId, page + 1)
			if (seq !== requestSeq) return
			const seen = new Set(items.map((item) => item.id))
			items = [...items, ...result.items.filter((item) => !seen.has(item.id))]
			page = result.page
			total = result.total
			hasMore = result.hasMore
		} catch {
			if (seq === requestSeq) errorMessage = m.comments_error()
		} finally {
			if (seq === requestSeq) {
				loading = false
				loaded = true
			}
		}
	}

	// Render the new comment immediately, then reconcile with the server list.
	function handlePosted(comment: CommentView) {
		if (comment.parentId === null) {
			items = [comment, ...items.filter((item) => item.id !== comment.id)]
			total += 1
		}
		void reload()
	}

	function refresh() {
		void reload()
	}

	$effect(() => {
		const target = targetId
		void targetType
		if (!target) return
		untrack(() => {
			items = []
			page = 1
			total = 0
			hasMore = false
			loaded = false
			void reload(target)
		})
	})
</script>

<section class="mt-8 border-t border-line pt-6" aria-label={m.comments_title()}>
	<div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
		<h2 class="font-serif text-xl text-gold">{m.comments_title()}</h2>
		{#if loaded && total > 0}
			<span class="text-[0.78rem] opacity-60">{m.comments_count({ count: total })}</span>
		{/if}
	</div>

	<CommentForm {targetType} targetId={targetId} onPosted={handlePosted} />

	{#if loading && !loaded}
		<p class="mt-4 text-[0.83rem] opacity-60">{m.comments_loading()}</p>
	{/if}

	{#if errorMessage}
		<p class="mt-3 text-[0.83rem] text-red-400" role="alert">{errorMessage}</p>
	{/if}

	{#if loaded && items.length === 0 && !errorMessage}
		<p class="mt-4 text-[0.84rem] opacity-60">{m.comments_empty()}</p>
	{/if}

	{#if items.length > 0}
		<ul class="mt-4 space-y-3">
			{#each items as comment (comment.id)}
				<li>
					<CommentItem {comment} onChanged={refresh} />
					{#if comment.replies.length > 0}
						<ul class="mt-2 space-y-2 border-l border-white/10 pl-3">
							{#each comment.replies as reply (reply.id)}
								<li><CommentItem comment={reply} onChanged={refresh} /></li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	{#if hasMore}
		<button
			type="button"
			class="mt-4 rounded-md border border-white/15 px-3 py-1.5 text-[0.8rem] text-link hover:text-gold disabled:opacity-45"
			disabled={loading}
			onclick={loadMore}
		>
			{m.comments_load_more()}
		</button>
	{/if}
</section>
