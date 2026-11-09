<script lang="ts">
	import type { CharacterFilterOption } from '#lib/data/characters';
	import { m } from '#lib/paraglide/messages';
	import FilterPanel from './FilterPanel.svelte';
	import FilterButton from './FilterButton.svelte';

	let {
		options,
		value = $bindable('all'),
		onchange = () => {}
	}: {
		options: CharacterFilterOption[];
		value?: string;
		onchange?: () => void;
	} = $props();

	function toggle(id: string) {
		value = value === id ? 'all' : id;
		onchange();
	}
</script>

<FilterPanel title={m.filter_character()}>
	<div class="flex flex-wrap gap-1.25 h-9">
		{#each options as option (option.id)}
			<FilterButton
				size="lg"
				pressed={value === option.id}
				label={m.filter_character_aria({ name: option.name })}
				title={option.name}
				onclick={() => toggle(option.id)}
			>
				{#if option.image}
					<img
						class="block size-8 object-contain drop-shadow-[0_0_1px_black]"
						src={option.image}
						alt=""
					/>
				{:else}
					<span class="px-1">{option.name}</span>
				{/if}
			</FilterButton>
		{/each}
	</div>
</FilterPanel>
