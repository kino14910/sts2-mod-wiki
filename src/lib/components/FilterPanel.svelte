<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		header,
		children
	}: {
		title: string;
		header?: Snippet;
		children: Snippet;
	} = $props();
</script>

<div class="flex min-h-0 flex-col gap-1 rounded-md border-2 border-line-strong bg-surface-2 px-2 pt-1 pb-2">
	<div class="flex items-center justify-between gap-3">
		<h2
			class="font-display text-[1.2rem] leading-none font-normal tracking-[0.01em] text-gold [text-shadow:2px_1px_2px_rgba(0,0,0,0.36)]"
		>
			{title}
		</h2>
		{@render header?.()}
	</div>
	{@render children()}
</div>
