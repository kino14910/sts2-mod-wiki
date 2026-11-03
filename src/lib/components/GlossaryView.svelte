<script lang="ts">
	import Motif from './Motif.svelte';
	import {
		behaviorName,
		groupName,
		localizedEntries,
		stackName
	} from '#lib/data/localize';
	import { type GlossaryEntry, type GlossaryKind, glossaryHref } from '#lib/data/glossary';
	import { m } from '#lib/paraglide/messages';

	let {
		kind,
		title,
		lead,
		entries,
		legend = [],
		otherLinks = []
	}: {
		kind: GlossaryKind;
		title: string;
		lead: string;
		entries: GlossaryEntry[];
		legend?: { label: string; text: string }[];
		otherLinks?: { href: string; label: string; count: number }[];
	} = $props();

	let query = $state('');

	let localized = $derived(localizedEntries(entries));

	let filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return localized;
		return localized.filter((entry) =>
			[entry.name, entry.summary, entry.detail ?? '', ...(entry.aliases ?? [])]
				.join(' ')
				.toLowerCase()
				.includes(q)
		);
	});

	let groups = $derived.by(() => {
		const result: { id: string; label: string; entries: GlossaryEntry[] }[] = [];
		for (const entry of filtered) {
			let group = result.find((item) => item.id === entry.group);
			if (!group) {
				group = { id: entry.group, label: groupName(entry.group), entries: [] };
				result.push(group);
			}
			group.entries.push(entry);
		}
		return result;
	});

	let countLabel = $derived(
		query.trim()
			? filtered.length === 1
				? m.glossary_matches_one({ count: filtered.length })
				: m.glossary_matches_many({ count: filtered.length })
			: entries.length === 1
				? m.glossary_entries_one({ count: entries.length })
				: m.glossary_entries_many({ count: entries.length })
	);

	const accent = $derived(
		kind === 'buff'
			? 'oklch(0.87 0.15 144)'
			: kind === 'debuff'
				? 'oklch(0.72 0.19 22)'
				: 'oklch(0.89 0.13 95)'
	);

	function groupId(group: string) {
		return `group-${group.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
	}
</script>

<div class="glossary-page" style:--kind-accent={accent}>
	<section class="page">
		<div class="wrap">
			<nav class="crumbs" aria-label={m.breadcrumb()}>
				<a href="/cards">{m.nav_cards()}</a>
				<span aria-hidden="true">/</span>
				<span>{m.reference()}</span>
				<span aria-hidden="true">/</span>
				<span aria-current="page">{title}</span>
			</nav>

			<header class="page-head">
				<h1 class="display">
					{title}
					<span class="title-sep">|</span>
					<span class="title-sub">{m.reference()}</span>
				</h1>
				<p class="lede">{lead}</p>
			</header>

			<div class="notice">
				<span class="notice-mark" aria-hidden="true">i</span>
				<p>
					<i>{m.glossary_notice()}</i>
				</p>
			</div>

			{#if otherLinks.length || legend.length}
				<div class="reference-bar">
					{#if otherLinks.length}
						<div class="see-also">
							<span class="bar-label">{m.glossary_see_also()}</span>
							{#each otherLinks as link (link.href)}
								<a class="bar-link" href={link.href}>{link.label} <span>{link.count}</span></a>
							{/each}
						</div>
					{/if}

					{#if legend.length}
						<div class="legend">
							{#each legend as item (item.label)}
								<span class="legend-item">
									<strong>{item.label}</strong>
									<span>{item.text}</span>
								</span>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<div class="search-bar">
				<label class="search-field">
					<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
						<circle cx="9" cy="9" r="5.5" />
						<path d="M13 13 L17 17" />
					</svg>
					<input
						type="search"
						placeholder={m.glossary_search({ title: title.toLocaleLowerCase() })}
						aria-label={m.glossary_search({ title: title.toLocaleLowerCase() })}
						bind:value={query}
					/>
				</label>
				<span class="search-count">{countLabel}</span>
				{#if query.trim()}
					<button class="clear" type="button" onclick={() => (query = '')}>{m.glossary_clear()}</button>
				{/if}
			</div>

			{#if groups.length > 1}
				<nav class="contents" aria-label={m.glossary_contents()}>
					{#each groups as group (group.id)}
						<a href="#{groupId(group.id)}">
							{group.label}
							<span>{group.entries.length}</span>
						</a>
					{/each}
				</nav>
			{/if}

			<div class="entries">
				{#if filtered.length}
					{#each groups as group (group.id)}
						<section class="group" aria-labelledby={groupId(group.id)}>
							<div class="group-head">
								<h2 id={groupId(group.id)} class="display">{group.label}</h2>
								<span>{group.entries.length}</span>
								<i aria-hidden="true"></i>
							</div>

							<div class="entry-list">
								{#each group.entries as entry (entry.id)}
									<article class="entry" class:no-icon={kind === 'keyword'} id={entry.id}>
										{#if kind !== 'keyword'}
											<span class="entry-icon" class:has-icon={Boolean(entry.icon)}>
												{#if entry.icon}
													<img src={entry.icon} alt="" loading="lazy" decoding="async" />
												{:else}
													<Motif name={entry.motif ?? 'spiral'} />
												{/if}
											</span>
										{/if}

										<div class="entry-main">
											<div class="entry-head">
												<h3>{entry.name}</h3>
												{#if entry.stack}
													<span class="tag">{stackName(entry.stack)}</span>
												{/if}
												{#if entry.behavior}
													<span class="tag">{behaviorName(entry.behavior)}</span>
												{/if}
												{#if entry.cap}
													<span class="tag">{m.glossary_cap({ value: entry.cap })}</span>
												{/if}
												<a class="anchor" href={glossaryHref(entry)} aria-label={m.glossary_link_to({ name: entry.name })}>
													#
												</a>
											</div>

											<p class="entry-summary">{entry.summary}</p>
											{#if entry.detail}
												<p class="entry-detail">{entry.detail}</p>
											{/if}
											{#if entry.aliases?.length}
												<p class="entry-aliases">
													{m.glossary_also_known({ aliases: entry.aliases.join(', ') })}
												</p>
											{/if}
										</div>
									</article>
								{/each}
							</div>
						</section>
					{/each}
				{:else}
					<div class="empty">
						<span aria-hidden="true">◇</span>
						<h2 class="display">{m.glossary_empty_title()}</h2>
						<p>{m.glossary_empty_body()}</p>
						<button class="button" type="button" onclick={() => (query = '')}>{m.glossary_clear_search()}</button>
					</div>
				{/if}
			</div>
		</div>
	</section>
</div>

<style>
	.page {
		padding: clamp(22px, 3vw, 34px) 0 20px;
	}

	.crumbs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-bottom: 14px;
		font-family: var(--font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.06em;
		color: var(--muted);
	}

	.crumbs a:hover {
		color: var(--gold);
	}

	.crumbs span[aria-current='page'] {
		color: var(--text-dim);
	}

	.page-head {
		padding-bottom: 16px;
		border-bottom: 1px solid var(--line);
	}

	.page-head h1 {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 10px;
		font-size: clamp(1.8rem, 3.2vw, 2.4rem);
		font-weight: 400;
		color: var(--gold);
	}

	.title-sep {
		color: var(--line-bright);
		font-weight: 400;
	}

	.title-sub {
		font-family: var(--font-display);
		font-size: 0.9em;
		font-weight: 400;
		color: var(--text-dim);
	}

	.page-head .lede {
		margin-top: 8px;
		font-size: 0.85rem;
	}

	.notice {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		margin: 14px 0 14px;
		padding: 8px 11px;
		border: 2px solid var(--line-strong);
		border-radius: 6px;
		background: var(--surface-secondary);
		color: var(--text-dim);
	}

	.notice-mark {
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		flex: none;
		border: 1px solid var(--line-strong);
		border-radius: 50%;
		font-family: var(--font-display);
		font-size: 0.8rem;
		color: var(--gold);
	}

	.notice p {
		font-size: 0.78rem;
		line-height: 1.55;
	}

	.reference-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px 24px;
		margin: 10px 0;
	}

	.see-also {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 5px;
	}

	.bar-label {
		margin-right: 3px;
		font-family: var(--font-mono);
		font-size: 0.55rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.bar-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 26px;
		padding: 2px 9px;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--surface);
		font-size: 0.72rem;
		color: var(--text);
		transition: background 0.16s ease, color 0.16s ease, border-color 0.16s ease;
	}

	.bar-link span {
		font-family: var(--font-mono);
		font-size: 0.54rem;
		color: var(--muted);
	}

	.bar-link:hover {
		background: var(--button-hover);
		border-color: var(--accent);
		color: var(--gold);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 5px 14px;
		font-size: 0.65rem;
		color: var(--muted);
	}

	.legend-item {
		display: flex;
		align-items: baseline;
		gap: 5px;
	}

	.legend-item strong {
		font-family: var(--font-mono);
		font-size: 0.54rem;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--kind-accent);
	}

	.search-bar {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 12px;
		padding: 6px;
		border: 2px solid var(--tooltip-border);
		border-radius: 6px;
		background: var(--tooltip-bg);
	}

	.search-field {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		height: 34px;
		padding: 0 10px;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: var(--table);
	}

	.search-field:focus-within {
		border-color: var(--accent);
	}

	.search-field svg {
		width: 14px;
		height: 14px;
		flex: none;
		color: var(--muted);
	}

	.search-field input {
		width: 100%;
		min-width: 0;
		border: 0;
		padding: 0;
		background: transparent;
		box-shadow: none;
		outline: 0;
		font-size: 0.8rem;
		color: var(--text);
	}

	.search-field input::placeholder {
		color: var(--muted);
	}

	.search-count {
		font-size: 0.66rem;
		color: var(--muted);
		white-space: nowrap;
	}

	.clear {
		font-size: 0.65rem;
		color: var(--kind-accent);
		white-space: nowrap;
	}

	.contents {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin: 10px 0 0;
	}

	.contents a {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 27px;
		padding: 2px 10px;
		border: 1px solid transparent;
		border-radius: 3px;
		background: var(--surface);
		font-family: var(--font-display);
		font-size: 0.8rem;
		color: var(--text);
		transition: border-color 0.16s ease, background 0.16s ease, color 0.16s ease;
	}

	.contents a span {
		font-family: var(--font-mono);
		font-size: 0.53rem;
		color: var(--muted);
	}

	.contents a:hover {
		border-color: var(--accent);
		background: var(--button-hover);
		color: var(--gold);
	}

	.entries {
		margin-top: 24px;
	}

	.group {
		scroll-margin-top: calc(var(--header-height) + 14px);
	}

	.group + .group {
		margin-top: 28px;
	}

	.group-head {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin-bottom: 5px;
	}

	.group-head h2 {
		font-size: 1.3rem;
		font-weight: 400;
		color: var(--kind-accent);
	}

	.group-head span {
		font-family: var(--font-mono);
		font-size: 0.54rem;
		color: var(--muted);
	}

	.group-head i {
		flex: 1;
		height: 1px;
		background: var(--line);
	}

	.entry-list {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.entry {
		position: relative;
		display: grid;
		grid-template-columns: 34px minmax(0, 1fr);
		gap: 11px;
		padding: 9px 11px;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--row);
		scroll-margin-top: calc(var(--header-height) + 16px);
		transition: border-color 0.16s ease, background 0.16s ease;
	}

	.entry:hover {
		border-color: var(--accent);
		background: var(--surface-secondary);
	}

	.entry.no-icon {
		grid-template-columns: minmax(0, 1fr);
	}

	.entry:target {
		border-color: var(--kind-accent);
		background: color-mix(in srgb, var(--kind-accent) 7%, var(--row));
		box-shadow: inset 2px 0 0 var(--kind-accent);
	}

	.entry-icon {
		width: 32px;
		height: 32px;
		margin-top: 1px;
		padding: 5px;
		border: 1px solid var(--line-strong);
		border-radius: 50%;
		color: var(--kind-accent);
	}

	.entry-main {
		min-width: 0;
	}

	.entry-head {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
	}

	.entry-head h3 {
		font-family: var(--font-display);
		font-size: 1.02rem;
		font-weight: 600;
		color: var(--text);
	}

	.tag {
		padding: 1px 6px;
		border: 1px solid var(--line);
		border-radius: 3px;
		font-family: var(--font-mono);
		font-size: 0.48rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.anchor {
		margin-left: auto;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--muted);
		opacity: 0;
		transition: opacity 0.16s ease, color 0.16s ease;
	}

	.entry:hover .anchor {
		opacity: 1;
	}

	.anchor:hover {
		color: var(--kind-accent);
	}

	.entry-summary {
		margin-top: 2px;
		font-size: 0.78rem;
		line-height: 1.5;
		color: var(--text-dim);
		text-wrap: pretty;
	}

	.entry-detail {
		margin-top: 4px;
		max-width: 82ch;
		font-size: 0.72rem;
		line-height: 1.55;
		color: var(--muted);
		text-wrap: pretty;
	}

	.entry-aliases {
		margin-top: 4px;
		font-family: var(--font-mono);
		font-size: 0.5rem;
		letter-spacing: 0.04em;
		color: var(--muted);
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 220px;
		padding: 30px;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: var(--row);
		text-align: center;
		color: var(--kind-accent);
	}

	.empty h2 {
		font-size: 1.2rem;
		color: var(--gold);
	}

	.empty p {
		font-size: 0.76rem;
		color: var(--muted);
	}

	@media (max-width: 620px) {
		.page-head h1 {
			font-size: 1.65rem;
		}

		.notice p {
			font-size: 0.73rem;
		}

		.reference-bar {
			flex-direction: column;
			align-items: flex-start;
		}

		.search-bar {
			gap: 7px;
		}

		.search-count {
			display: none;
		}

		.entry {
			grid-template-columns: 28px minmax(0, 1fr);
			gap: 8px;
			padding: 8px 9px;
		}

		.entry-icon {
			width: 27px;
			height: 27px;
			padding: 4px;
		}

		.entry-head h3 {
			font-size: 0.94rem;
		}
	}
	.entry-icon.has-icon {
		padding: 1px;
	}

	.entry-icon img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
</style>
