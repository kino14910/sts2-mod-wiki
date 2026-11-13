<script lang="ts">
	export interface WikiNavboxItem {
		name: string
		href: string | null
		key?: string
	}

	export interface WikiNavboxRow {
		group?: string
		href?: string
		items: WikiNavboxItem[]
	}

	export interface WikiNavboxGroup {
		label: string
		key?: string
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

	let sections = $derived.by(() => {
		let rowIndex = 0
		return groups.map((group) => {
			const rows = group.rows.map((row) => ({ ...row, striped: rowIndex++ % 2 === 1 }))
			return { ...group, rows, hasSubgroups: rows.some((row) => row.group) }
		})
	})
</script>

{#snippet pills(items: WikiNavboxItem[])}
	<ul class="nb-pills">
		{#each items as item (item.key ?? item.href ?? item.name)}
			<li class={{ selflink: !item.href }}>
				{#if item.href}
					<a href={item.href}>{item.name}</a>
				{:else}
					<span class="nb-selflink">{item.name}</span>
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

<nav class="nb" aria-label={ariaLabel}>
	<details class="nb-details" open={!collapsed}>
		<summary class="nb-title">
			<span class="nb-meta">
				{#if templateHref}
					<a
						href={templateHref}
						title="View or edit this template"
						aria-label="View or edit this template"
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
							<path d="M7 7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1" />
							<path d="M20.385 6.585a2.1 2.1 0 0 0-2.97-2.97l-8.415 8.385v3h3l8.385-8.415z" />
							<path d="M16 5l3 3" />
						</svg>
					</a>
				{/if}
			</span>
			{#if href}
				<a class="nb-title-link" {href}>{title}</a>
			{:else}
				<span class="nb-title-link">{title}</span>
			{/if}
			<svg
				class="nb-chevron"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M6 9l6 6 6-6" />
			</svg>
		</summary>

		<div class="nb-body">
			{#each sections as section (section.key ?? section.label)}
				<div class="nb-group">
					{#if section.href}
						<a href={section.href}>{section.label}</a>
					{:else}
						<span>{section.label}</span>
					{/if}
				</div>
				<div class="nb-listbox">
					{#if section.hasSubgroups}
						<div class="nb-subgrid">
							{#each section.rows as row, index (index)}
								<div class="nb-subgroup">
									{#if row.href}
										<a href={row.href}>{row.group}</a>
									{:else}
										<span>{row.group}</span>
									{/if}
								</div>
								<div class={['nb-list', { striped: row.striped }]}>
									{@render pills(row.items)}
								</div>
							{/each}
						</div>
					{:else}
						{#each section.rows as row, index (index)}
							<div class={['nb-list', { striped: row.striped }]}>
								{@render pills(row.items)}
							</div>
						{/each}
					{/if}
				</div>
			{/each}
			{#if trailing}
				<div class="nb-trailing">
					<a href={trailing.href}>{trailing.label}</a>
				</div>
			{/if}
		</div>
	</details>
</nav>

<style>
	.nb {
		--nb-accent: #8ccdbe;
		--nb-text: #eeeeee;
		--nb-link: #85d2e4;
		margin: 0.5em auto;
		padding: 4px;
		display: flex;
		flex-direction: column;
		gap: 3px;
		border: 2px solid rgb(140 205 190 / 50%);
		border-radius: 10px;
		background: #172429;
		color: var(--nb-text);
		font-size: 12px;
		line-height: 1.5;
		clear: both;
	}

	.nb-details {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}

	.nb-title {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 1.5em;
		padding: 0.5em calc(1.5em + 0.5rem);
		border-radius: 4px;
		background: var(--nb-accent);
		color: #000;
		font-size: 15px;
		font-weight: 700;
		text-align: center;
		cursor: pointer;
		list-style: none;
	}

	.nb-title::-webkit-details-marker {
		display: none;
	}

	.nb-title::marker {
		content: '';
	}

	.nb-title-link {
		color: #000;
		text-decoration: underline;
	}

	.nb-title-link:hover {
		color: #2d4f8a;
	}

	.nb-meta {
		position: absolute;
		left: 0.5rem;
		top: 50%;
		width: 0.9em;
		height: 0.9em;
		transform: translateY(-50%);
	}

	.nb-meta a {
		display: block;
		width: 100%;
		height: 100%;
		color: #000;
	}

	.nb-meta svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	.nb-chevron {
		position: absolute;
		right: 0.5rem;
		top: 50%;
		width: 1.1em;
		height: 1.1em;
		color: #000;
		transform: translateY(-50%);
		transition: transform 120ms ease;
	}

	.nb-details[open] .nb-chevron {
		transform: translateY(-50%) rotate(180deg);
	}

	.nb-body {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 3px;
		min-width: 0;
	}

	.nb-group,
	.nb-subgroup {
		display: flex;
		align-items: center;
		padding: 0.25em 0.5em;
		background: rgb(140 205 190 / 20%);
		font-weight: 700;
		text-align: left;
		white-space: nowrap;
	}

	.nb-group a,
	.nb-group span,
	.nb-subgroup a,
	.nb-subgroup span {
		color: var(--nb-text);
		text-decoration: none;
	}

	.nb-group a:hover,
	.nb-subgroup a:hover {
		text-decoration: underline;
	}

	.nb-listbox {
		min-width: 0;
	}

	.nb-subgrid {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 3px;
	}

	.nb-list {
		min-width: 0;
		padding: 0.25em 0;
	}

	.nb-list.striped {
		background: rgb(238 238 238 / 3%);
	}

	.nb-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3em;
		margin: 0;
		padding: 0 0.25em;
		list-style: none;
	}

	.nb-pills li {
		display: flex;
		align-items: center;
		padding: 0.25em 0.75em;
		border-radius: 3px;
		background: rgb(238 238 238 / 5%);
	}

	.nb-pills li.selflink {
		background: rgb(140 205 190 / 15%);
	}

	.nb-pills a {
		color: var(--nb-link);
		text-decoration: none;
	}

	.nb-pills a:hover {
		text-decoration: underline;
	}

	.nb-selflink {
		color: #fff;
		font-weight: 700;
	}

	.nb-trailing {
		grid-column: 1 / -1;
		padding: 0.1em 0.4em;
		text-align: right;
	}

	.nb-trailing a {
		color: var(--nb-link);
		text-decoration: none;
	}

	.nb-trailing a:hover {
		text-decoration: underline;
	}

	@media (max-width: 720px) {
		.nb-body,
		.nb-subgrid {
			grid-template-columns: minmax(0, 1fr);
		}

		.nb-subgrid {
			padding-left: 1rem;
		}
	}
</style>
