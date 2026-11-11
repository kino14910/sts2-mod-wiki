<script lang="ts">
	import type { Snippet } from 'svelte'

	let {
		name,
		value,
		children
	}: {
		name: string
		value: string
		children?: Snippet
	} = $props()
</script>

<span class="game-variable" data-variable={name}>{#if children}{@render children()}{:else}{value || `{${name}}`}{/if}</span>
