<script lang="ts">
	import { m } from '#lib/paraglide/messages';

	let {
		key,
		label,
		sort = $bindable('default'),
		onchange = () => {}
	}: {
		key: 'rarity' | 'type' | 'cost' | 'color';
		label: string;
		sort?: string;
		onchange?: () => void;
	} = $props();

	function cycleSort() {
		if (sort === `${key}-asc`) sort = `${key}-desc`;
		else if (sort === `${key}-desc`) sort = 'default';
		else sort = `${key}-asc`;
		onchange();
	}
</script>

<button
	class={[
		'flex items-center justify-center px-0.5 py-0.75 border-2 [border-style:outset] border-[teal_darkslategray_darkslategray_teal] rounded-[5px] bg-[darkslategray] brightness-60 cursor-pointer transition-[filter,border-color] duration-180 ease-[ease] hover:brightness-85',
		{
			'border-gold brightness-100 hover:brightness-100':
				sort.startsWith(`${key}-`)
		}
	]}
	type="button"
	aria-label={m.filter_sort_by({ label })}
	title={m.filter_sort_by({ label })}
	onclick={cycleSort}
>
	<img
		class={[
			'w-4.5 h-auto drop-shadow-[0_0_4px_rgba(242,219,116,0.2)]',
			{ 'transform-[scaleY(-1)]': sort === `${key}-desc` }
		]}
		src="/icons/sort-button.webp"
		alt=""
	/>
</button>
