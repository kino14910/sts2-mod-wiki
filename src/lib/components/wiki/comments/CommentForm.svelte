<script lang="ts">
	import { onMount } from 'svelte'
	import { commentRequestHeaders, getCommentName, setCommentName } from '#lib/comment-identity'
	import {
		MAX_COMMENT_LENGTH,
		type CommentTargetType,
		type CommentView
	} from '#lib/comments'
	import { m } from '#lib/paraglide/messages'

	let {
		targetType = 'card',
		targetId,
		parentId = null,
		compact = false,
		onPosted,
		onCancel
	}: {
		targetType?: CommentTargetType
		targetId: string
		parentId?: string | null
		compact?: boolean
		onPosted: (comment: CommentView) => void
		onCancel?: () => void
	} = $props()

	let authorName = $state('')
	let content = $state('')
	let submitting = $state(false)
	let errorMessage = $state('')
	const contentId = $props.id()

	onMount(() => {
		authorName = getCommentName()
	})

	async function submit(event: SubmitEvent) {
		event.preventDefault()
		if (submitting) return
		submitting = true
		errorMessage = ''
		try {
			const response = await fetch('/api/comments', {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...commentRequestHeaders() },
				body: JSON.stringify({
					targetType,
					targetId,
					parentId,
					content,
					authorName
				})
			})
			if (response.status === 429) {
				errorMessage = m.comments_rate_limited()
				return
			}
			if (!response.ok) {
				errorMessage = m.comments_error()
				return
			}
			const created: CommentView = await response.json()
			setCommentName(authorName)
			content = ''
			onPosted(created)
		} catch {
			errorMessage = m.comments_error()
		} finally {
			submitting = false
		}
	}
</script>

<form class="mt-3 space-y-2" onsubmit={submit}>
	{#if !compact || authorName.trim().length === 0}
		<label class="block text-[0.8rem] opacity-80">
			{m.comments_author_label()}
			<input
				class="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-1.5 text-[0.86rem] text-ink outline-none focus:border-link"
				type="text"
				name="authorName"
				bind:value={authorName}
				minlength={2}
				maxlength={32}
				required
				autocomplete="nickname"
			/>
		</label>
	{/if}

	<label for={contentId} class="sr-only">{m.comments_placeholder()}</label>
	<textarea
		id={contentId}
		class="w-full resize-y rounded-md border border-white/15 bg-black/30 px-3 py-2 text-[0.88rem] leading-[1.55] text-ink outline-none focus:border-link"
		name="content"
		rows={compact ? 2 : 4}
		maxlength={MAX_COMMENT_LENGTH}
		placeholder={m.comments_placeholder()}
		bind:value={content}
		required
	></textarea>

	<div class="flex flex-wrap items-center justify-between gap-2 text-[0.76rem]">
		<span class="opacity-50">{content.length}/{MAX_COMMENT_LENGTH}</span>
		<div class="flex items-center gap-2">
			{#if onCancel}
				<button
					type="button"
					class="rounded-md px-2.5 py-1 text-link hover:text-gold"
					onclick={onCancel}
				>
					{m.comments_cancel()}
				</button>
			{/if}
			<button
				type="submit"
				class="rounded-md bg-link px-3 py-1 font-semibold text-black transition-opacity disabled:opacity-45"
				disabled={submitting || content.trim().length === 0 || authorName.trim().length < 2}
			>
				{m.comments_submit()}
			</button>
		</div>
	</div>

	{#if errorMessage}
		<p class="text-[0.78rem] text-red-400" role="alert">{errorMessage}</p>
	{/if}
</form>
