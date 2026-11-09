<script lang="ts">
	import WikiText from '#lib/components/WikiText.svelte'
	import HoverTooltip from '#lib/components/HoverTooltip.svelte'
	import { cardWikiHref, type WikiDetails, type WikiEntry } from '#lib/data/power-wiki'

	let { details, open = true }: { details: WikiDetails; open?: boolean } = $props()

	let hovered = $state<WikiEntry | null>(null)
	let tipX = $state(0)
	let tipY = $state(0)
	let tipEl: HTMLElement | undefined = $state()
	let timer: ReturnType<typeof setTimeout> | undefined

	function registerTip(element: HTMLElement) {
		tipEl = element
		return () => {
			if (tipEl === element) tipEl = undefined
		}
	}

	function place(event: MouseEvent) {
		const rect = tipEl?.getBoundingClientRect()
		const width = rect?.width || 390
		const height = rect?.height || 150
		tipX = Math.max(8, Math.min(event.clientX + 15, window.innerWidth - width - 8))
		tipY = Math.max(8, Math.min(event.clientY + 15, window.innerHeight - height - 8))
	}

	function enter(event: MouseEvent, entry: WikiEntry) {
		if (!entry.tooltip) return
		clearTimeout(timer)
		timer = setTimeout(() => {
			hovered = entry
			place(event)
		}, 100)
	}

	function move(event: MouseEvent, entry: WikiEntry) {
		if (!entry.tooltip || hovered !== entry) return
		place(event)
	}

	function leave() {
		clearTimeout(timer)
		hovered = null
	}
</script>

<div class="wiki-sources">
	<details class="wiki-details" {open}>
		<summary>{details.summary}</summary>
		<div class="wiki-details-body">
			{#each details.groups as group, index (index)}
				{#if index === 0 || details.groups[index - 1].heading !== group.heading}
					<h3 class="wiki-heading"><span class="mw-headline">{group.heading}</span></h3>
				{/if}
				{#if group.subheading}
					<h4 class="wiki-subheading"><span class="mw-headline">{group.subheading}</span></h4>
				{/if}
				<ul class="wiki-list">
					{#each group.entries as entry (`${group.heading}-${group.subheading}-${entry.name}`)}
						<li class="wiki-entry">
							<span class="wiki-text"
							>{#if entry.kind === 'card' && cardWikiHref(entry.name)}<a
									href={cardWikiHref(entry.name)}
									onmouseenter={(event) => enter(event, entry)}
									onmousemove={(event) => move(event, entry)}
									onmouseleave={leave}
									>{entry.name}</a
								>{:else}{entry.name}{/if} - <WikiText text={entry.description} /></span
						>
						</li>
					{/each}
				</ul>
			{/each}
		</div>
	</details>

	<HoverTooltip show={!!hovered} html={hovered?.tooltip ?? ''} x={tipX} y={tipY} registerTip={registerTip} />
</div>

<style>
	.wiki-sources {
		font-family: var(--font-display);
		font-size: 15px;
		color: #eeeeee;
	}

	.wiki-details {
		display: flex;
		flex-direction: column;
		margin: 10px 0;
		border: 2px solid #546a73;
		border-radius: 6px;
		background: #0c1013;
		overflow: hidden;
	}

	.wiki-details > summary {
		padding: 7px 14px;
		background: #19313f;
		font-weight: 600;
		cursor: pointer;
	}

	.wiki-details[open] > summary {
		border-bottom: 2px solid #546a73;
	}

	.wiki-details-body {
		padding: 6px 16px 12px;
	}

	.wiki-heading {
		margin: 12px 0 2px;
		font-size: 1.3rem;
		font-weight: 600;
		color: #f6da6f;
	}

	.wiki-subheading {
		margin: 10px 0 2px;
		font-size: 1.05rem;
		font-weight: 600;
		color: #f6da6f;
	}

	.wiki-list {
		margin: 0 0 6px;
		padding-left: 22px;
		list-style: disc;
	}

	.wiki-entry {
		padding: 1px 0;
		line-height: 1.55;
	}

	.wiki-text {
		text-wrap: pretty;
	}
</style>
