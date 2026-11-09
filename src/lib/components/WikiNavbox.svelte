<script lang="ts">
	export interface WikiNavboxItem {
		name: string
		href: string | null
	}

	export interface WikiNavboxRow {
		group?: string
		href?: string
		items: WikiNavboxItem[]
	}

	export interface WikiNavboxGroup {
		label: string
		href?: string | null
		rows: WikiNavboxRow[]
	}

	let {
		title,
		href = undefined,
		templateHref = undefined,
		groups,
		trailing = undefined,
		collapsed = false,
		ariaLabel = title
	}: {
		title: string
		href?: string
		templateHref?: string
		groups: WikiNavboxGroup[]
		trailing?: { label: string; href: string }
		collapsed?: boolean
		ariaLabel?: string
	} = $props()
</script>

{#snippet titleBar()}
	{#if href}
		<a class="text-gold hover:underline" {href}>{title}</a>
	{:else}{title}{/if}
{/snippet}

{#snippet body()}
	<div class="px-3 py-2">
		{#each groups as group, groupIndex (groupIndex)}
			<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1">
				{#if group.href}
					<a class="shrink-0 font-bold text-muted-strong hover:text-gold" href={group.href}
						>{group.label}</a
					>
				{:else}
					<span class="shrink-0 font-bold text-muted-strong">{group.label}</span>
				{/if}
				<div class="flex min-w-0 flex-1 flex-col gap-1">
					{#each group.rows as row, rowIndex (rowIndex)}
						<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
							{#if row.group}
								{#if row.href}
									<a class="shrink-0 text-[0.78rem] text-gold hover:underline" href={row.href}
										>{row.group}</a
									>
								{:else}
									<span class="shrink-0 text-[0.78rem] text-muted">{row.group}</span>
								{/if}
							{/if}
							{#each row.items as item (item.name)}
								{#if item.href}
									<a class="text-link hover:text-gold" href={item.href}>{item.name}</a>
								{:else}
									<span class="font-bold text-ink">{item.name}</span>
								{/if}
							{/each}
						</div>
					{/each}
				</div>
			</div>
		{/each}
		{#if trailing}
			<div class="mt-1 text-right">
				<a class="text-link hover:text-gold" href={trailing.href}>{trailing.label}</a>
			</div>
		{/if}
	</div>
{/snippet}

<nav
	class="clear-both mt-6 rounded-lg border border-line bg-(--table) text-[0.8rem]"
	aria-label={ariaLabel}
>
	{#if collapsed}
		<details>
			<summary class="flex items-center rounded-t-[7px] bg-(--table-header) px-3 py-1">
				<span class="font-bold font-display">{@render titleBar()}</span>
				{#if templateHref}
					<a class="ml-auto text-[0.72rem] font-normal text-link hover:text-gold" href={templateHref}
						>View or edit this template</a
					>
				{/if}
			</summary>
			{@render body()}
		</details>
	{:else}
		<div
			class="rounded-t-[7px] bg-(--table-header) py-1 text-center font-bold font-display"
		>
			{@render titleBar()}
		</div>
		{@render body()}
	{/if}
</nav>
