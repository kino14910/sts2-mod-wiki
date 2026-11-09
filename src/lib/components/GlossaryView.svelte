<script lang="ts">
	import FilterButton from './FilterButton.svelte'
	import FilterPanel from './FilterPanel.svelte'
	import Motif from './Motif.svelte'
	import ReferenceGroup from './ReferenceGroup.svelte'
	import ReferencePage from './ReferencePage.svelte'
	import {
		behaviorName,
		groupName,
		localizedEntries,
		stackName
	} from '#lib/data/localize'
	import {
		type GlossaryEntry,
		type GlossaryKind,
		glossaryHref,
		matchesStackFilter,
		powerHref,
		type StackKind
	} from '#lib/data/glossary'
	import { m } from '#lib/paraglide/messages'

	let {
		kind,
		title,
		lead,
		entries,
		otherLinks = []
	}: {
		kind: GlossaryKind
		title: string
		lead: string
		entries: GlossaryEntry[]
		otherLinks?: { href: string; label: string; count: number }[]
	} = $props()

	let query = $state('')
	let character = $state<'all' | 'original'>('all')
	let mod = $state<string>('all')
	let stacks = $state<StackKind[]>([])

	let stackOptions = $derived<{ id: StackKind; label: string; hint: string }[]>([
		{ id: 'Intensity', label: m.legend_intensity(), hint: m.legend_intensity_text() },
		{ id: 'Duration', label: m.legend_duration(), hint: m.legend_duration_text() },
		{ id: 'Counter', label: m.legend_counter(), hint: m.legend_counter_text() }
	])

	let localized = $derived(localizedEntries(entries))

	let filtered = $derived.by(() => {
		const q = query.trim().toLowerCase()
		return localized.filter((entry) => {
			if (mod !== 'all' && entry.mod !== mod) return false
			if (kind === 'power' && !matchesStackFilter(entry.stack, stacks)) return false
			if (!q) return true
			return [entry.name, entry.summary, entry.detail ?? '', ...(entry.aliases ?? [])]
				.join(' ')
				.toLowerCase()
				.includes(q)
		})
	})

	let groups = $derived.by(() => {
		const result: { id: string; label: string; entries: GlossaryEntry[] }[] = []
		for (const entry of filtered) {
			let group = result.find((item) => item.id === entry.group)
			if (!group) {
				group = { id: entry.group, label: groupName(entry.group), entries: [] }
				result.push(group)
			}
			group.entries.push(entry)
		}
		return result
	})

	let countLabel = $derived(m.showing_results({ count: filtered.length }))

	const KIND_ACCENT: Record<GlossaryKind, string> = {
		power: 'oklch(0.87 0.15 144)',
		keyword: 'oklch(0.89 0.13 95)'
	}

	let accent = $derived(KIND_ACCENT[kind])

	function toggleStack(kind: StackKind) {
		stacks = stacks.includes(kind) ? stacks.filter((item) => item !== kind) : [...stacks, kind]
	}

	function clearAll() {
		query = ''
		character = 'all'
		mod = 'all'
		stacks = []
	}

	function groupId(group: string) {
		return `group-${group.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
	}
</script>

{#snippet tag(text: string)}
	<span
		class="rounded-[3px] border border-line px-1.5 py-px font-mono text-[0.48rem] tracking-wider text-muted uppercase"
	>
		{text}
	</span>
{/snippet}

{#snippet filtersBlock()}
	<FilterPanel title={m.filter_character()}>
		<div class="flex flex-wrap gap-1.25">
			<FilterButton
				pressed={character === 'original'}
				label={m.filter_character_aria({ name: m.filter_original() })}
				title={m.filter_original()}
				onclick={() => (character = character === 'original' ? 'all' : 'original')}
			>
				<img class="block size-6 object-contain" src="/images/icon.png" alt="" />
			</FilterButton>
		</div>
	</FilterPanel>
	{#if kind === 'power'}
		<FilterPanel title={m.power_stack_type()}>
			<div class="flex flex-wrap gap-1.25">
				{#each stackOptions as option (option.id)}
					<FilterButton
						pressed={stacks.includes(option.id)}
						label={m.filter_character_aria({ name: option.label })}
						title={option.hint}
						onclick={() => toggleStack(option.id)}
					>
						{option.label}
					</FilterButton>
				{/each}
			</div>
		</FilterPanel>
	{/if}
{/snippet}

{#snippet groupsBlock()}
	{#each groups as group (group.id)}
		<ReferenceGroup
			id={groupId(group.id)}
			label={group.label}
			count={group.entries.length}
			color={accent}
		>
			<div class="flex flex-col gap-1.25">
				{#each group.entries as entry (entry.id)}
					<article
						class={[
							'group relative grid scroll-mt-[calc(var(--header-height)+16px)] gap-2.75 rounded-[3px] border border-line bg-row px-2.75 py-2.25 transition-[border-color,background-color] duration-160 ease-[ease] [&:hover:not(:target)]:border-accent [&:hover:not(:target)]:bg-surface-2 target:border-(--kind-accent) target:bg-[color-mix(in_srgb,var(--kind-accent)_7%,var(--row))] target:shadow-[inset_2px_0_0_var(--kind-accent)] max-[620px]:gap-2 max-[620px]:px-2.25 max-[620px]:py-2',
							kind === 'keyword'
								? 'grid-cols-1'
								: 'grid-cols-[34px_minmax(0,1fr)] max-[620px]:grid-cols-[28px_minmax(0,1fr)]'
						]}
						id={entry.id}
					>
						{#if kind !== 'keyword'}
							<span
								class={[
									'mt-px size-8 rounded-full border border-line-strong text-(--kind-accent) max-[620px]:size-6.75',
									entry.icon ? 'p-px' : 'p-1.25 max-[620px]:p-1'
								]}
							>
								{#if entry.icon}
									<img
										class="size-full object-contain"
										src={entry.icon}
										alt=""
										loading="lazy"
										decoding="async"
									/>
								{:else}
									<Motif name={entry.motif ?? 'spiral'} />
								{/if}
							</span>
						{/if}

						<div class="min-w-0">
							<div class="flex flex-wrap items-center gap-1.5">
								<h3
									class="font-display text-[1.02rem] font-semibold text-ink max-[620px]:text-[0.94rem]"
								>
									{#if kind === 'power'}
										<a
											class="transition-colors hover:text-gold hover:underline underline-offset-2"
											href={powerHref(entry)}
											aria-label={m.power_detail({ name: entry.name })}
											>{entry.name}</a
										>
									{:else}
										{entry.name}
									{/if}
								</h3>
								{#if kind === 'power'}
									<a
										class="font-mono text-[0.56rem] tracking-[0.04em] text-positive opacity-70 transition-opacity hover:opacity-100"
										href={powerHref(entry)}
									>
										{m.power_detail_short()} →
									</a>
								{/if}
								{#if entry.stack}
									{@render tag(stackName(entry.stack))}
								{/if}
								{#if entry.behavior}
									{@render tag(behaviorName(entry.behavior))}
								{/if}
								{#if entry.cap}
									{@render tag(m.glossary_cap({ value: entry.cap }))}
								{/if}
								<a
									class="ml-auto font-mono text-[0.62rem] text-muted opacity-0 transition-[opacity,color] duration-160 ease-[ease] group-hover:opacity-100 hover:text-(--kind-accent)"
									href={glossaryHref(entry)}
									aria-label={m.glossary_link_to({ name: entry.name })}
								>
									#
								</a>
							</div>

							<p class="mt-0.5 text-[0.78rem] leading-normal text-pretty text-ink-dim">
								{entry.summary}
							</p>
							{#if entry.detail}
								<p class="mt-1 max-w-[82ch] text-[0.72rem] leading-[1.55] text-pretty text-muted">
									{entry.detail}
								</p>
							{/if}
							{#if entry.aliases?.length}
								<p class="mt-1 font-mono text-[0.5rem] tracking-[0.04em] text-muted">
									{m.glossary_also_known({ aliases: entry.aliases.join(', ') })}
								</p>
							{/if}
						</div>
					</article>
				{/each}
			</div>
		</ReferenceGroup>
	{/each}
{/snippet}

<ReferencePage
	{title}
	{lead}
	notice={m.glossary_notice()}
	{accent}
	filtersLabel={m.glossary_filters_label()}
	{countLabel}
	isEmpty={filtered.length === 0}
	onclear={clearAll}
	bind:query
	bind:mod
	filters={filtersBlock}
	groups={groupsBlock}
/>
