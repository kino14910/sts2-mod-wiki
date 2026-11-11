<script lang="ts">
	import FilterPanel from './FilterPanel.svelte';
	import { m } from '#lib/paraglide/messages';

	let {
		title,
		placeholder,
		value = $bindable(''),
		onclear = () => {},
		oninput = () => {}
	}: {
		title: string;
		placeholder: string;
		value?: string;
		onclear?: () => void;
		oninput?: () => void;
	} = $props();
</script>

<FilterPanel {title}>
	<div class="flex gap-1.75 max-[460px]:flex-col max-[460px]:items-stretch">
		<label
			class="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-sm border border-line bg-table px-2.5 transition-[border-color] duration-180 ease-[ease] focus-within:border-accent"
		>
			<svg
				class="size-3.5 flex-none text-muted"
				viewBox="0 0 20 20"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				aria-hidden="true"
			>
				<circle cx="9" cy="9" r="5.5" />
				<path d="M13 13 L17 17" />
			</svg>
			<input
				class="w-full min-w-0 border-0 bg-transparent p-0 text-[0.95rem] text-ink shadow-none outline-0 placeholder:text-muted focus:shadow-none focus:border-transparent focus:outline-0"
				type="search"
				{placeholder}
				aria-label={placeholder}
				bind:value
				{oninput}
			/>
		</label>
		<button
			class="flex h-9 min-h-9 min-w-4 items-center justify-center gap-1.5 rounded-[3px] bg-surface px-1.5 py-0.75 font-display text-base leading-normal tracking-[0.02em] whitespace-nowrap text-ink transition-all duration-100 ease-in-out select-none [&:hover:not([aria-pressed='true'])]:brightness-[1.2] max-[460px]:w-full"
			type="button"
			onclick={onclear}
		>
			{m.clear_all()}
		</button>
	</div>
</FilterPanel>
