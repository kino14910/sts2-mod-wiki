<script lang="ts">
	import { m } from '#lib/paraglide/messages'

	export interface WikiTocItem {
		id: string
		number: string
		label: string
		indent?: boolean
	}

	let { items, collapsible = false }: { items: WikiTocItem[]; collapsible?: boolean } = $props()

	let open = $state(true)
</script>

<nav
	id="toc"
	class="max-w-max rounded-lg bg-[#466864] p-1.5 text-[13px] max-sm:w-full max-sm:float-none"
	aria-label={m.glossary_contents()}
>
	<div
		class="mb-1.5 flex items-center justify-center gap-1.5 rounded-md bg-surface-2 px-2 py-0.75 text-center font-bold text-ink"
	>
		{m.glossary_contents()}
		{#if collapsible}
			<button
				class="text-[0.72rem] font-normal text-link hover:text-gold"
				type="button"
				aria-expanded={open}
				onclick={() => (open = !open)}
			>
				[{open ? 'hide' : 'show'}]
			</button>
		{/if}
	</div>
	{#if open}
		<ul class="rounded-md bg-surface-2 px-2 py-1.25 font-display">
			{#each items as item (item.id)}
				<li class={['py-px', item.indent && 'pl-4']}>
					<a class="text-link hover:text-gold" href={`#${item.id}`}>
						<span class="mr-1 text-ink-dim">{item.number}</span>{item.label}
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</nav>
