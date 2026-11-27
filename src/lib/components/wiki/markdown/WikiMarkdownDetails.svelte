<script lang="ts">
	import type { Snippet } from 'svelte'
	import { getLocale } from '#lib/paraglide/runtime'

	let {
		summary = '',
		children
	}: { summary?: string; children?: Snippet } = $props()

	let label = $derived(summary || (getLocale() === 'zhs' ? '详情' : 'Details'))
</script>

<details class="my-3 rounded border border-line bg-surface/40 px-3 py-2">
	<summary class="cursor-pointer select-none text-[0.9rem] font-semibold text-gold">{label}</summary>
	<div class="mt-2 space-y-3 text-[0.9rem] leading-[1.6] wrap-anywhere">{@render children?.()}</div>
</details>
