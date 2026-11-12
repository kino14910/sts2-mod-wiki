<script lang="ts">
	import type { DiffResult } from '#lib/wiki-collaboration'
	import { m } from '#lib/paraglide/messages'

	let { diff, maxHeight = true }: { diff: DiffResult; maxHeight?: boolean } = $props()

	function rowClass(type: 'equal' | 'add' | 'remove'): string {
		if (type === 'add') return 'bg-emerald-400/10 text-emerald-200'
		if (type === 'remove') return 'bg-rose-400/10 text-rose-200'
		return 'text-ink/80'
	}
</script>

<div class="overflow-hidden rounded-md border border-white/10 bg-black/20">
	<div class="flex flex-wrap items-center gap-3 border-b border-white/10 px-3 py-1.5 text-[0.74rem]">
		<span class="text-emerald-400">+{diff.additions} {m.wiki_diff_added()}</span>
		<span class="text-rose-400">-{diff.deletions} {m.wiki_diff_removed()}</span>
		{#if diff.truncated}
			<span class="opacity-60">{m.wiki_diff_truncated()}</span>
		{/if}
	</div>
	<div
		class="overflow-auto font-mono text-[0.76rem] leading-[1.55] {maxHeight ? 'max-h-72' : ''}"
	>
		{#each diff.lines as line, index (index)}
			<div
				class="grid grid-cols-[2.2rem_2.2rem_1.1rem_1fr] items-start gap-1 px-2 {rowClass(line.type)}"
			>
				<span class="select-none text-right opacity-45">{line.oldNumber ?? ''}</span>
				<span class="select-none text-right opacity-45">{line.newNumber ?? ''}</span>
				<span class="select-none text-center opacity-70">
					{line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ''}
				</span>
				<pre class="m-0 whitespace-pre-wrap wrap-break-word font-mono">{line.text || ' '}</pre>
			</div>
		{/each}
	</div>
</div>
