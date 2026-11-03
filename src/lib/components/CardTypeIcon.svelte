<script lang="ts">
	import type { CardType } from '#lib/data/cards';

	let { type, size = 14 }: { type: CardType; size?: number } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.7"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if type === 'attack'}
		<path d="M4 20 L17 7 M14 4 L20 10 M7 13 L11 17 M4 16 L8 20" />
		<path d="M3 21 L7 17" />
	{:else if type === 'skill'}
		<path d="M12 3 L19 6 V12 C19 17 16 20 12 22 C8 20 5 17 5 12 V6 Z" />
		<path d="M12 8 V16 M8 12 H16" opacity="0.5" />
	{:else if type === 'power'}
		<path d="M2 12 Q12 3 22 12 Q12 21 2 12 Z" />
		<circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
	{:else if type === 'status'}
		<circle cx="12" cy="12" r="8.5" />
		<path d="M12 7.5 V13 M12 16.5 V16.6" />
	{:else if type === 'curse'}
		<path d="M7 10 C7 6 9 4 12 4 C15 4 17 6 17 10 C17 12 16 13 15 14 V17 H9 V14 C8 13 7 12 7 10 Z" />
		<circle cx="10" cy="10" r="1.3" fill="currentColor" stroke="none" />
		<circle cx="14" cy="10" r="1.3" fill="currentColor" stroke="none" />
		<path d="M10 17 V15.5 M12 17 V15.5 M14 17 V15.5" opacity="0.6" />
	{:else}
		<path d="M6 4 H18 V20 H6 Z" />
		<path d="M9 7 H15 M9 10 H15 M9 13 H13" opacity="0.55" />
		<path d="M18 7 C20 7 20 9 18 9" opacity="0.5" />
	{/if}
</svg>

<style>
	svg {
		flex: none;
	}
</style>
