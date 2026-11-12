<script lang="ts">
	import { onMount } from 'svelte'
	import ModWikiContent from '#lib/components/ModWikiContent.svelte'
	import CommentList from './comments/CommentList.svelte'
	import WikiHistoryPanel from './WikiHistoryPanel.svelte'
	import { m } from '#lib/paraglide/messages'
	import type { ProposalView, SectionEditResult, WikiViewer } from '#lib/wiki-collaboration'

	interface SectionData {
		key: string
		sectionId: string | null
		contentType: string
		content: string
		version: number
	}

	let {
		section,
		viewer,
		onChanged
	}: {
		section: SectionData
		viewer: WikiViewer
		onChanged: () => void
	} = $props()

	let editing = $state(false)
	let tab = $state<'write' | 'preview'>('write')
	let draft = $state('')
	let summary = $state('')
	let submitting = $state(false)
	let message = $state('')
	let isError = $state(false)
	let pending = $state<ProposalView[]>([])

	let canEdit = $derived(
		Boolean(section.sectionId) && viewer.permissions.includes('wiki:proposal:create')
	)
	let canPublish = $derived(viewer.permissions.includes('wiki:revision:publish'))
	let canRevert = $derived(viewer.permissions.includes('wiki:revision:revert'))
	let ownPending = $derived(
		viewer.session
			? pending.some((item) => item.submittedBy === viewer.session!.userId)
			: false
	)

	async function loadPending(target: string) {
		try {
			const response = await fetch(
				`/api/wiki/sections/${encodeURIComponent(target)}/proposals?status=pending`,
				{ cache: 'no-store' }
			)
			if (!response.ok) return
			const body = (await response.json()) as { items: ProposalView[] }
			pending = body.items
		} catch {
			// A failed status badge must not break reading the section.
		}
	}

	onMount(() => {
		if (section.sectionId) void loadPending(section.sectionId)
	})

	function startEditing() {
		draft = section.content
		summary = ''
		tab = 'write'
		editing = true
		message = ''
		isError = false
	}

	function cancelEditing() {
		editing = false
		message = ''
		isError = false
	}

	async function submit() {
		if (submitting || !section.sectionId) return
		submitting = true
		message = ''
		isError = false
		try {
			const response = await fetch(
				`/api/wiki/sections/${encodeURIComponent(section.sectionId)}/edits`,
				{
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ content: draft, baseVersion: section.version, summary })
				}
			)
			const body = (await response.json().catch(() => null)) as
				| (SectionEditResult & { message?: string })
				| null
			if (!response.ok) throw new Error(body?.message ?? m.wiki_edit_error())
			message = body?.kind === 'published' ? m.wiki_edit_saved() : m.wiki_edit_pending()
			editing = false
			await loadPending(section.sectionId)
			onChanged()
		} catch (cause) {
			isError = true
			message = cause instanceof Error ? cause.message : m.wiki_edit_error()
		} finally {
			submitting = false
		}
	}
</script>

{#if editing}
	<div class="space-y-3">
		<div class="flex flex-wrap items-center gap-2 text-[0.78rem]">
			<button
				type="button"
				class="rounded-md px-2.5 py-1 {tab === 'write'
					? 'bg-link text-black'
					: 'border border-white/15 text-link hover:text-gold'}"
				onclick={() => (tab = 'write')}
			>
				{m.wiki_edit_write()}
			</button>
			<button
				type="button"
				class="rounded-md px-2.5 py-1 {tab === 'preview'
					? 'bg-link text-black'
					: 'border border-white/15 text-link hover:text-gold'}"
				onclick={() => (tab = 'preview')}
			>
				{m.wiki_edit_preview()}
			</button>
			<span class="opacity-55">v{section.version}</span>
		</div>

		{#if tab === 'write'}
			<textarea
				class="w-full resize-y rounded-md border border-white/15 bg-black/30 px-3 py-2 font-mono text-[0.84rem] leading-[1.6] text-ink outline-none focus:border-link"
				rows="12"
				bind:value={draft}
				aria-label={m.wiki_edit_content_label()}
			></textarea>
		{:else}
			<div class="min-h-32 rounded-md border border-white/15 bg-black/20 p-3">
				<ModWikiContent content={draft} />
			</div>
		{/if}

		<input
			class="w-full rounded-md border border-white/15 bg-black/30 px-3 py-1.5 text-[0.84rem] text-ink outline-none focus:border-link"
			type="text"
			maxlength="500"
			placeholder={m.wiki_edit_summary()}
			bind:value={summary}
		/>

		<div class="flex flex-wrap items-center gap-2 text-[0.8rem]">
			<button
				type="button"
				class="rounded-md bg-link px-3 py-1 font-semibold text-black disabled:opacity-45"
				disabled={submitting || draft === section.content}
				onclick={submit}
			>
				{submitting
					? m.wiki_edit_saving()
					: canPublish
						? m.wiki_edit_publish()
						: m.wiki_edit_submit()}
			</button>
			<button
				type="button"
				class="rounded-md border border-white/15 px-3 py-1 text-link hover:text-gold"
				onclick={cancelEditing}
			>
				{m.wiki_edit_cancel()}
			</button>
			{#if !canPublish}
				<span class="opacity-55">{m.wiki_edit_review_hint()}</span>
			{/if}
		</div>
	</div>
{:else if section.contentType === 'markdown'}
	<ModWikiContent content={section.content} />
{:else}
	<p class="text-[0.86rem] whitespace-pre-wrap opacity-70">{section.content}</p>
{/if}

{#if message}
	<p
		class="mt-3 text-[0.8rem] {isError ? 'text-red-400' : 'text-emerald-400'}"
		role={isError ? 'alert' : 'status'}
	>
		{message}
	</p>
{/if}

<div class="mt-3 flex flex-wrap items-center gap-3 text-[0.78rem]">
	{#if canEdit && !editing}
		<button
			type="button"
			class="rounded-md border border-white/15 px-2.5 py-1 text-link hover:text-gold"
			onclick={startEditing}
		>
			{m.wiki_edit()}
		</button>
	{:else if !viewer.session}
		<span class="opacity-55">{m.wiki_edit_signin()}</span>
	{/if}
	{#if pending.length > 0}
		<span class="rounded-md bg-amber-400/15 px-2 py-0.5 text-amber-300">
			{m.wiki_status_pending()} {pending.length}
		</span>
	{/if}
	{#if ownPending}
		<span class="opacity-60">{m.wiki_edit_own_pending()}</span>
	{/if}
</div>

{#if section.sectionId}
	<WikiHistoryPanel
		sectionId={section.sectionId}
		{canRevert}
		onReverted={onChanged}
	/>
	<CommentList targetType="wiki_section" targetId={section.sectionId} />
{:else}
	<p class="mt-3 text-[0.78rem] opacity-55">{m.wiki_edit_legacy()}</p>
{/if}
