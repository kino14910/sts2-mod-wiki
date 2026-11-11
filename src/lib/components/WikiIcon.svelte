<script lang="ts">
	let {
		src = '',
		label = ''
	}: {
		src?: string
		label?: string
	} = $props()
</script>

<span class="wiki-icon-link">
	{#if src}<img
			class="wiki-icon-img inline h-[1.35em] w-auto mx-[0.08em] align-[-0.32em] filter-[drop-shadow(0_0_1px_black)]"
			{src}
			alt=""
			width="20"
			height="20"
			loading="lazy"
			decoding="async"
		/>{/if}{#if label}<span class="wiki-icon-label ml-[0.1em] font-bold">{label}</span>{/if}
</span>
