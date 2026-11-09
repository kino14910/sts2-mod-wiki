<script lang="ts">
	let {
		id,
		title,
		level = 2
	}: { id: string; title: string; level?: 2 | 3 } = $props()
</script>

{#if level === 2}
	<h2
		{id}
		class="mb-2 mt-5 border-b border-line pb-1 text-[1.5em] font-normal text-gold font-display"
	>
		{title}
	</h2>
{:else}
	<h3 {id} class="mb-2 mt-4 text-[1.2em] font-normal text-gold font-display">
		{title}
	</h3>
{/if}
