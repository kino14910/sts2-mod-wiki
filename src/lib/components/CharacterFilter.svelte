<script lang="ts">
	import type { CharacterFilterOption } from '#lib/data/characters';
	import { displayCharacterOrder } from '#lib/data/characters';
	import { m } from '#lib/paraglide/messages';
	import FilterPanel from './FilterPanel.svelte';
	import FilterButton from './FilterButton.svelte';
	import SortButton from './SortButton.svelte';

	let {
		options,
		value = $bindable('all'),
		sort = $bindable('default'),
		sortable = true,
		onchange = () => {}
	}: {
		options: CharacterFilterOption[];
		value?: string;
		sort?: string;
		sortable?: boolean;
		onchange?: () => void;
	} = $props();

	// 展示层：colorless 固定最前，与默认排序（colorless 置最后）相互独立
	const displayOptions = $derived(displayCharacterOrder(options));

	function toggle(id: string) {
		value = value === id ? 'all' : id;
		onchange();
	}
</script>

<FilterPanel title={m.filter_character()}>
	{#snippet header()}
		{#if sortable}
			<SortButton key="color" label={m.filter_character()} bind:sort {onchange} />
		{/if}
	{/snippet}
	<div class="flex min-h-9 flex-wrap gap-1.25">
		{#each displayOptions as option (option.id)}
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
