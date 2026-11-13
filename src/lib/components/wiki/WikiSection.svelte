<script lang="ts">
	import { tick } from 'svelte'
	import WikiHeading from '#lib/components/WikiHeading.svelte'
	import { getLocale } from '#lib/paraglide/runtime'
	import { m } from '#lib/paraglide/messages'
	import { wikiUi, type ArticleContent, type ArticleSection } from '#lib/wiki-article'
	import type { SectionEditResult, WikiViewer } from '#lib/wiki-collaboration'
	import WikiSectionContent from './WikiSectionContent.svelte'
	import WikiSectionEditor from './WikiSectionEditor.svelte'
	import WikiHistoryPanel from './WikiHistoryPanel.svelte'
	import CommentList from './comments/CommentList.svelte'

	let { section, viewer, context, onChanged, heading = true }: {
		section: ArticleSection; viewer: WikiViewer; context?: ArticleContent['context']
		onChanged: () => void | Promise<void>; heading?: boolean
	} = $props()
	let ui = $derived(wikiUi(getLocale()))
	let canEdit = $derived(viewer.session?.status === 'active' && viewer.permissions.includes('wiki:proposal:create'))
	let canPublish = $derived(viewer.permissions.includes('wiki:revision:publish'))
	let canRevert = $derived(viewer.permissions.includes('wiki:revision:revert'))
	let snapshot = $state<{ sectionId: string; version: number; content: string } | null>(null)
	let history = $state(false)
	let discussion = $state(false)
	let message = $state('')
	let notice = $state('')
	let contentElement: HTMLDivElement | undefined
	let revision = $derived(`${section.published?.sectionId ?? section.key}:${section.published?.version ?? 0}`)
	function registerContent(element: HTMLDivElement) {
		contentElement = element
		return () => { if (contentElement === element) contentElement = undefined }
	}

	function edit() {
		if (!viewer.session) { document.getElementById('community-account')?.click(); return }
		if (!section.published?.sectionId || !canEdit) { notice = ui.readOnly; return }
		snapshot = { sectionId: section.published.sectionId, version: section.published.version, content: section.published.content }
		message = ''
	}
	async function restoreFocus() {
		snapshot = null
		await tick()
		contentElement?.querySelector<HTMLButtonElement>('.mw-editsection button')?.focus()
	}
	async function saved(result: SectionEditResult) {
		message = result.kind === 'published' ? m.wiki_edit_saved() : m.wiki_edit_pending()
		await onChanged()
		await restoreFocus()
	}
</script>

<div {@attach registerContent} class="wiki-section" data-section-key={section.key} data-section-id={section.published?.sectionId} data-version={section.published?.version}>
	{#snippet actions()}
		{#if section.published?.sectionId}
			<button type="button" class="hover:underline" aria-expanded={history} aria-controls={`${section.id}-history`} onclick={() => (history = !history)}>{ui.history}</button>
			<button type="button" class="hover:underline" aria-expanded={discussion} aria-controls={`${section.id}-discussion`} onclick={() => (discussion = !discussion)}>{ui.discussion}</button>
		{/if}
	{/snippet}
	{#if heading}
		<WikiHeading id={section.id} title={section.title} level={section.level} onEdit={edit} {actions} />
	{:else}
		<div class="mb-2 flex flex-wrap items-center gap-3 text-xs text-link">
			<button class="mw-editsection hover:underline" type="button" aria-label={`${ui.edit}: ${section.title}`} onclick={edit}>[{ui.edit}]</button>
			{@render actions()}
		</div>
	{/if}
	{#if snapshot && section.published}
		<WikiSectionEditor section={section.published} {snapshot} {canPublish} {context} onSaved={saved} onCancel={restoreFocus} onRefresh={onChanged} />
	{:else}<WikiSectionContent blocks={section.blocks} {context} />{/if}
	{#if notice}<p role="status" class="my-2 text-xs text-muted">{notice}</p>{/if}
	{#if message}<p role="status" class="my-2 text-sm text-emerald-300">{message}</p>{/if}
	<div id={`${section.id}-history`}>
		{#if history && section.published?.sectionId}
			{#key revision}<WikiHistoryPanel sectionId={section.published.sectionId} baseVersion={section.published.version} {canRevert} onReverted={onChanged} initiallyOpen />{/key}
		{/if}
	</div>
	<div id={`${section.id}-discussion`}>
		{#if discussion && section.published?.sectionId}
			{#key section.published.sectionId}<CommentList targetType="wiki_section" targetId={section.published.sectionId} headingLevel={Math.min(section.level + 1, 6) as 3 | 4 | 5} />{/key}
		{/if}
	</div>
</div>
