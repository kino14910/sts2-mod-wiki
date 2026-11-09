<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		id,
		label,
		count,
		color,
		children
	}: {
		id: string;
		label: string;
		count: number;
		color: string;
		children: Snippet;
	} = $props();
</script>

<section
	class="scroll-mt-[calc(var(--header-height)+14px)] not-first:mt-7"
	aria-labelledby={id}
	style:--group-accent={color}
>
	<div class="mb-1.25 flex items-baseline gap-2.5">
		<h2
			{id}
			class="display font-display text-[1.3rem] font-normal text-(--group-accent)"
		>
			{label}
		</h2>
		<span class="font-mono text-[0.54rem] text-muted">{count}</span>
		<i class="h-px flex-1 bg-line" aria-hidden="true"></i>
	</div>

	{@render children()}
</section>
