<script lang="ts">
	import WikiEntity from '#lib/components/WikiEntity.svelte'
	import { parseWikiEntityReference, resolveWikiEntityReference } from '#lib/markdown/wiki-entity-ref'

	let {
		namespace = '',
		entityType = '',
		entityId = '',
		raw = '',
		locale
	}: {
		namespace?: string
		entityType?: string
		entityId?: string
		raw?: string
		locale?: string
	} = $props()

	let reference = $derived(parseWikiEntityReference(`${namespace}:${entityType}:${entityId}`))
	let resolved = $derived(reference ? resolveWikiEntityReference(reference) : null)
	let unknownLabel = $derived(locale === 'zhs' ? '未知实体' : 'Unknown entity')
</script>

{#if resolved}<WikiEntity ref={resolved} {locale} />{:else}<span
		class="wiki-entity-missing"
		title={unknownLabel}
		data-entity-ref={`${namespace}:${entityType}:${entityId}`}>{raw}</span
	>{/if}
