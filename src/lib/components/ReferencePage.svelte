<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import Filter from './Filter.svelte';
	import FilterSearch from './FilterSearch.svelte';
	import ModSelect from './ModSelect.svelte';
	import { m } from '#lib/paraglide/messages';

	let {
		title,
		lead,
		notice,
		accent,
		filtersLabel,
		countLabel,
		isEmpty,
		onclear,
		query = $bindable(''),
		mod = $bindable('all'),
		aboveFilters,
		filters,
		groups
	}: {
		title: string;
		lead: string;
		notice: string;
		accent: string;
		filtersLabel: string;
		countLabel: string;
		isEmpty: boolean;
		onclear: () => void;
		query?: string;
		mod?: string;
		aboveFilters?: Snippet;
		filters: Snippet;
		groups: Snippet;
	} = $props();
</script>

<div class="glossary-page" style:--kind-accent={accent}>
	<section class="pt-[clamp(22px,3vw,34px)] pb-5">
		<div class="wrap">
			<nav
				class="mb-3.5 flex flex-wrap items-center gap-2 font-mono text-[0.58rem] tracking-[0.06em] text-muted"
				aria-label={m.breadcrumb()}
			>
				<a class="hover:text-gold" href={resolve('/cards')}>{m.nav_cards()}</a>
				<span aria-hidden="true">/</span>
				<span>{m.reference()}</span>
				<span aria-hidden="true">/</span>
				<span class="text-ink-dim" aria-current="page">{title}</span>
			</nav>

			<header class="border-b border-line pb-4">
				<h1
					class="display flex flex-wrap items-baseline gap-2.5 text-[clamp(1.8rem,3.2vw,2.4rem)] font-normal text-gold max-[620px]:text-[1.65rem]"
				>
					{title}
					<span class="font-normal text-line-bright">|</span>
					<span class="font-display text-[0.9em] font-normal text-ink-dim">{m.reference()}</span>
				</h1>
				<p class="mt-2 text-[0.85rem]">{lead}</p>
			</header>

			<div
				class="my-3.5 flex items-start gap-2.5 rounded-md border-2 border-line-strong bg-surface-2 px-2.75 py-2 text-ink-dim"
			>
				<span
					class="grid size-5 flex-none place-items-center rounded-full border border-line-strong font-display text-[0.8rem] text-gold"
					aria-hidden="true">i</span
				>
				<p class="text-[0.78rem] leading-[1.55] max-[620px]:text-[0.73rem]">
					<i>{notice}</i>
				</p>
			</div>

			{@render aboveFilters?.()}

			<Filter class="mt-3" label={filtersLabel}>
				{#snippet result()}
					<span class="whitespace-nowrap text-ink-dim">{countLabel}</span>

					<ModSelect bind:value={mod} />
				{/snippet}

				<FilterSearch
					bind:value={query}
					title={m.filter_search()}
					placeholder={m.glossary_search({ title: title.toLocaleLowerCase() })}
					onclear={onclear}
				/>

				{@render filters()}
			</Filter>

			<div class="mt-6">
				{#if isEmpty}
					<div
						class="flex min-h-55 flex-col items-center justify-center gap-2 rounded border border-line bg-row p-7.5 text-center text-(--kind-accent)"
					>
						<span aria-hidden="true">◇</span>
						<h2 class="display text-[1.2rem] text-gold">{m.glossary_empty_title()}</h2>
						<p class="text-[0.76rem] text-muted">{m.glossary_empty_body()}</p>
						<button class="button" type="button" onclick={onclear}>{m.clear_all()}</button>
					</div>
				{:else}
					{@render groups()}
				{/if}
			</div>
		</div>
	</section>
</div>
