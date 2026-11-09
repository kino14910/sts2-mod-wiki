<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		pressed = false,
		label,
		title,
		size = 'md',
		onclick = () => {},
		children
	}: {
		pressed?: boolean;
		label?: string;
		title?: string;
		size?: 'md' | 'lg';
		onclick?: () => void;
		children: Snippet;
	} = $props();

	const sizeClass = $derived(
		size === 'lg' ? 'min-w-9 p-1 text-lg' : 'min-w-6 p-0.75 text-base'
	);
</script>

<button
	class={[
		'flex items-center justify-center gap-1.5 rounded-[3px] bg-surface font-display leading-normal tracking-[0.02em] text-ink transition-all duration-100 ease-in-out select-none [&:hover:not([aria-pressed=\'true\'])]:brightness-[1.2] aria-pressed:brightness-[1.12] aria-pressed:outline-2 aria-pressed:outline-offset-0 aria-pressed:outline-accent',
		sizeClass
	]}
	type="button"
	aria-pressed={pressed}
	aria-label={label}
	{title}
	{onclick}
>
	{@render children()}
</button>
