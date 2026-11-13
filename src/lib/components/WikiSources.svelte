<script lang="ts">
	import WikiEntity from '#lib/components/WikiEntity.svelte'
	import WikiText from '#lib/components/WikiText.svelte'
	import type { WikiDetails } from '#lib/data/power-wiki'

	let { details, open = true }: { details: WikiDetails; open?: boolean } = $props()
</script>

<div class="wiki-sources font-display text-[15px] text-[#eeeeee]">
	<details class="wiki-details flex flex-col my-2.5 border-2 border-[#546a73] rounded-md bg-[#0c1013] overflow-hidden group" {open}>
		<summary class="px-3.5 py-1.75 bg-[#19313f] font-semibold cursor-pointer group-open:border-b-2 group-open:border-[#546a73]">{details.summary}</summary>
		<div class="wiki-details-body px-4 pt-1.5 pb-3">
			{#each details.groups as group, index (index)}
				{#if index === 0 || details.groups[index - 1].heading !== group.heading}
					<h3 class="wiki-heading mt-3 mb-0.5 text-[1.3rem] font-semibold text-[#f6da6f]"><span class="mw-headline">{group.heading}</span></h3>
				{/if}
				{#if group.subheading}
					<h4 class="wiki-subheading mt-2.5 mb-0.5 text-[1.05rem] font-semibold text-[#f6da6f]"><span class="mw-headline">{group.subheading}</span></h4>
				{/if}
				<ul class="wiki-list my-0 mb-1.5 pl-5.5 list-disc">
					{#each group.entries as entry (`${group.heading}-${group.subheading}-${entry.kind}-${entry.modId ?? 'sts2'}-${entry.id ?? entry.name}`)}
						<li class="wiki-entry py-px leading-[1.55]">
							<span class="wiki-text text-pretty"><WikiEntity {entry} /> - <WikiText text={entry.wikiText ?? entry.description} /></span>
						</li>
					{/each}
				</ul>
			{/each}
		</div>
	</details>
</div>
