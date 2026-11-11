<script lang="ts">
	import CommentForm from './CommentForm.svelte'
	import { commentRequestHeaders } from '#lib/comment-identity'
	import { MAX_COMMENT_LENGTH, type CommentView } from '#lib/comments'
	import { m } from '#lib/paraglide/messages'

	let { comment, onChanged }: { comment: CommentView; onChanged: () => void } = $props()

	let replying = $state(false)
	let editing = $state(false)
	let editContent = $state('')
	let saving = $state(false)
	let errorMessage = $state('')

	let deleted = $derived(comment.status === 'deleted')
	let canReply = $derived(!deleted && comment.parentId === null)

	function formatTime(value: string): string {
		const date = new Date(value)
		return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
	}

	function startEditing() {
		editContent = comment.content
		editing = true
		errorMessage = ''
	}

	async function saveEdit() {
		if (saving) return
		saving = true
		errorMessage = ''
		try {
			const response = await fetch(`/api/comments/${encodeURIComponent(comment.id)}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json', ...commentRequestHeaders() },
				body: JSON.stringify({ content: editContent })
			})
			if (!response.ok) {
				errorMessage = m.comments_error()
				return
			}
			editing = false
			onChanged()
		} catch {
			errorMessage = m.comments_error()
		} finally {
			saving = false
		}
	}

	async function remove() {
		if (saving || !confirm(m.comments_delete_confirm())) return
		saving = true
		errorMessage = ''
		try {
			const response = await fetch(`/api/comments/${encodeURIComponent(comment.id)}`, {
				method: 'DELETE',
				headers: commentRequestHeaders()
			})
			if (!response.ok) {
				errorMessage = m.comments_error()
				return
			}
			onChanged()
		} catch {
			errorMessage = m.comments_error()
		} finally {
			saving = false
		}
	}
</script>

<article class="rounded-md border border-white/10 bg-white/5 px-3 py-2.5">
	<header class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[0.78rem]">
		<span class="font-semibold text-ink">{comment.author.name}</span>
		<time class="opacity-55" datetime={comment.createdAt}>{formatTime(comment.createdAt)}</time>
		{#if comment.edited}
			<span class="opacity-45">({m.comments_edited()})</span>
		{/if}
	</header>

	{#if deleted}
		<p class="mt-1.5 text-[0.86rem] italic opacity-55">{m.comments_deleted()}</p>
	{:else if editing}
		<div class="mt-2 space-y-2">
			<textarea
				class="w-full resize-y rounded-md border border-white/15 bg-black/30 px-3 py-2 text-[0.88rem] leading-[1.55] text-ink outline-none focus:border-link"
				rows="4"
				maxlength={MAX_COMMENT_LENGTH}
				bind:value={editContent}
			></textarea>
			<div class="flex justify-end gap-2 text-[0.78rem]">
				<button
					type="button"
					class="rounded-md px-2.5 py-1 text-link hover:text-gold"
					onclick={() => (editing = false)}
				>
					{m.comments_cancel()}
				</button>
				<button
					type="button"
					class="rounded-md bg-link px-3 py-1 font-semibold text-black disabled:opacity-45"
					disabled={saving || editContent.trim().length === 0}
					onclick={saveEdit}
				>
					{m.comments_save()}
				</button>
			</div>
		</div>
	{:else}
		<p class="mt-1.5 whitespace-pre-wrap wrap-break-word text-[0.9rem] leading-[1.6]">
			{comment.content}
		</p>
	{/if}

	{#if !deleted && !editing}
		<div class="mt-2 flex flex-wrap items-center gap-3 text-[0.78rem]">
			{#if canReply}
				<button
					type="button"
					class="text-link hover:text-gold"
					onclick={() => (replying = !replying)}
				>
					{m.comments_reply()}
				</button>
			{/if}
			{#if comment.owned}
				<button type="button" class="text-link hover:text-gold" onclick={startEditing}>
					{m.comments_edit()}
				</button>
				<button
					type="button"
					class="text-link hover:text-gold disabled:opacity-45"
					disabled={saving}
					onclick={remove}
				>
					{m.comments_delete()}
				</button>
			{/if}
		</div>
	{/if}

	{#if errorMessage}
		<p class="mt-2 text-[0.78rem] text-red-400" role="alert">{errorMessage}</p>
	{/if}

	{#if replying}
		<CommentForm
			targetId={comment.targetId}
			parentId={comment.id}
			compact
			onPosted={() => {
				replying = false
				onChanged()
			}}
			onCancel={() => (replying = false)}
		/>
	{/if}
</article>
