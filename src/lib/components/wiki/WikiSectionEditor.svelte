<script lang="ts">
	import { untrack } from 'svelte'
	import { getLocale } from '#lib/paraglide/runtime'
	import { m } from '#lib/paraglide/messages'
	import { articleBlocks, wikiUi, type ArticleContent, type PublishedSection } from '#lib/wiki-article'
	import { diffLines } from '#lib/wiki-diff'
	import type { SectionEditResult } from '#lib/wiki-collaboration'
	import DiffView from './DiffView.svelte'
	import WikiSectionContent from './WikiSectionContent.svelte'

	let { section, snapshot, canPublish = false, context, onSaved, onCancel, onRefresh }: {
		section: PublishedSection
		snapshot: { sectionId: string; version: number; content: string }
		canPublish?: boolean
		context?: ArticleContent['context']
		onSaved: (result: SectionEditResult) => void | Promise<void>
		onCancel: () => void
		onRefresh: () => void | Promise<void>
	} = $props()
	// The snapshot is captured by the parent when the editor opens, never from live props on submit.
	const opening = untrack(() => ({ ...snapshot }))
	let draft = $state(opening.content)
	let summary = $state('')
	let tab = $state<'write' | 'preview'>('write')
	let submitting = $state(false)
	let errorMessage = $state('')
	let conflict = $state(false)
	let comparing = $state(false)
	let base = $state(opening)
	let ui = $derived(wikiUi(getLocale()))
	let preview = $derived(articleBlocks(draft, section.contentType))
	let comparison = $derived(diffLines(section.content, draft))
	const fieldId = $props.id()

	function focusEditor(element: HTMLTextAreaElement) {
		element.focus()
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault()
		const submittedBase = { ...base }
		if (submitting || draft === submittedBase.content) return
		submitting = true
		errorMessage = ''
		try {
			const response = await fetch(`/api/wiki/sections/${encodeURIComponent(submittedBase.sectionId)}/edits`, {
				method: 'POST', headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ content: draft, baseVersion: submittedBase.version, summary })
			})
			const body = await response.json().catch(() => null) as (SectionEditResult & { message?: string }) | null
			if (!response.ok) {
				conflict = response.status === 409
				if (conflict) { errorMessage = ui.conflict; await onRefresh(); comparing = true }
				else errorMessage = response.status === 401 ? ui.sessionExpired : body?.message ?? ui.error
				return
			}
			if (!body || (body.kind !== 'published' && body.kind !== 'proposed')) throw new Error(ui.error)
			await onSaved(body)
		} catch (cause) { errorMessage = cause instanceof Error ? cause.message : ui.error }
		finally { submitting = false }
	}
</script>

<form class="my-3 space-y-3 rounded border border-line bg-surface/40 p-3" onsubmit={submit} aria-busy={submitting}>
	<div class="flex flex-wrap items-center gap-3 text-sm">
		<button type="button" class="text-link hover:underline" aria-pressed={tab === 'write'} onclick={() => (tab = 'write')}>{m.wiki_edit_write()}</button>
		<button type="button" class="text-link hover:underline" aria-pressed={tab === 'preview'} onclick={() => (tab = 'preview')}>{m.wiki_edit_preview()}</button>
		<span class="text-muted">v{base.version}</span>
	</div>
	<div hidden={tab !== 'write'}>
		<label class="sr-only" for={fieldId}>{m.wiki_edit_content_label()}</label>
		<textarea id={fieldId} {@attach focusEditor} rows="10" bind:value={draft}
			class="w-full resize-y rounded border border-line bg-black/30 px-3 py-2 font-mono text-sm leading-relaxed focus-visible:outline-2"></textarea>
	</div>
	{#if tab === 'preview'}<WikiSectionContent blocks={preview} {context} />{/if}
	<label class="block text-sm" for={`${fieldId}-summary`}>{ui.summary}</label>
	<input id={`${fieldId}-summary`} type="text" maxlength="500" bind:value={summary} class="w-full rounded border border-line bg-black/30 px-3 py-2 text-sm" />
	{#if errorMessage}<p role="alert" class="text-sm text-red-300">{errorMessage}</p>{/if}
	{#if conflict || section.version !== base.version}
		<p class="text-sm text-amber-200">{ui.conflict}</p>
		<button type="button" class="text-sm text-link hover:underline" onclick={async () => { await onRefresh(); comparing = true }}>{ui.compare}</button>
		{#if comparing && section.version !== base.version}
			<button type="button" class="ml-3 text-sm text-link hover:underline" onclick={() => { base = { sectionId: base.sectionId, version: section.version, content: section.content }; conflict = false; errorMessage = '' }}>{ui.rebase}</button>
		{/if}
	{/if}
	{#if comparing}<DiffView diff={comparison} />{/if}
	<div class="flex flex-wrap items-center gap-3 text-sm">
		<button type="submit" class="rounded bg-link px-3 py-1.5 font-semibold text-black disabled:opacity-50" disabled={submitting || draft === base.content}>
			{submitting ? m.wiki_edit_saving() : canPublish ? m.wiki_edit_publish() : m.wiki_edit_submit()}
		</button>
		<button type="button" class="text-link hover:underline" disabled={submitting} onclick={onCancel}>{m.wiki_edit_cancel()}</button>
		{#if !canPublish}<span class="text-muted">{m.wiki_edit_review_hint()}</span>{/if}
	</div>
</form>
