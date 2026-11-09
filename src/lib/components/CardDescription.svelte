<script lang="ts">
	import type { CardView } from '#lib/data/cards'
	import { entryHref, KEYWORDS, POWERS } from '#lib/data/glossary'
	import { keywordPlacement, termIndex } from '#lib/data/localize'
	import { CHARACTER_ASSETS } from '#lib/data/mods'
	import { WIKI_ENTRIES, cardWikiHref, wikiTerm, type WikiEntry } from '#lib/data/power-wiki'
	import { bbcodeToHtml } from '#lib/text/bbcode'
	import { cardTextToHtml } from '#lib/text/card-text'
	import WikiEntity from '#lib/components/WikiEntity.svelte'

	let {
		card,
		upgraded = false,
		variant = 'article',
		class: className = ''
	}: {
		card: CardView
		upgraded?: boolean
		variant?: 'article' | 'face'
		class?: string
	} = $props()

	const GOLD_SPAN = /<span style="([^"]*color:#EFC851[^"]*)">([^<]*)<\/span>/g
	const GLOSSARY_BY_NAME = new Map(
		[...POWERS, ...KEYWORDS].map((entry) => [entry.name.trim().toLowerCase(), entry] as const)
	)

	function escapeText(value: string) {
		return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
	}

	function decodeText(value: string) {
		return value
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
	}

	type Segment =
		| { type: 'html'; value: string }
		| {
				type: 'term'
				entry: WikiEntry
				text: string
				href: string | null
				icon: string
				tooltip: string
		  }

	let assets = $derived(CHARACTER_ASSETS[card.color])
	let interactive = $derived(variant === 'article')

	let description = $derived(
		cardTextToHtml(card.text ?? '', {
			upgraded,
			variables: card.variables,
			baseVariables: card.baseVariables,
			sizeUnit: 'px',
			energyIconSrc: assets?.textEnergy,
			secondEnergyIconSrc: assets?.secondTextEnergy
		})
	)

	function termSegment(raw: string): Segment | null {
		const text = decodeText(raw)
		const key = text.trim().toLowerCase()
		const entity = WIKI_ENTRIES.get(key)
		const term = wikiTerm(text)
		const glossary = termIndex().get(key)
		const glossaryEntry = term ? GLOSSARY_BY_NAME.get(term.name.toLowerCase()) : undefined
		const glossaryHref = glossary?.href ?? (glossaryEntry ? entryHref(glossaryEntry) : null)
		const cardHref = entity?.kind === 'card' ? cardWikiHref(text) : null
		if (!entity && !term && !glossary && !glossaryEntry && !cardHref) return null

		const tooltip =
			entity?.tooltip ?? term?.tooltip ?? (glossary ? escapeText(glossary.summary) : '')
		return {
			type: 'term',
			entry: {
				name: text,
				kind: cardHref ? 'card' : 'power',
				description: tooltip,
				tooltip
			},
			text,
			href: interactive ? cardHref ?? glossaryHref : null,
			icon: interactive ? term?.icon ?? '' : '',
			tooltip
		}
	}

	let segments = $derived.by<Segment[]>(() => {
		const segs: Segment[] = []
		let last = 0
		for (const match of description.matchAll(GOLD_SPAN)) {
			const start = match.index ?? 0
			if (start > last) segs.push({ type: 'html', value: description.slice(last, start) })
			segs.push(termSegment(match[2]) ?? { type: 'html', value: match[0] })
			last = start + match[0].length
		}
		if (last < description.length) segs.push({ type: 'html', value: description.slice(last) })
		return segs
	})

	let keywordLines = $derived(keywordPlacement(card.keywords))
</script>

<div class={['card-desc', variant === 'face' && 'card-desc-face', className]}>
	{#each keywordLines.before as line (line)}
		<p class="desc-keyword">{@html bbcodeToHtml(line, { sizeUnit: 'px' })}</p>
	{/each}
	<p class="desc-body">{#each segments as seg, i (i)}{#if seg.type === 'html'}{@html seg.value}{:else}<WikiEntity entry={seg.entry} text={seg.text} href={seg.href} icon={seg.icon} tooltip={seg.tooltip} />{/if}{/each}</p>
	{#each keywordLines.after as line (line)}
		<p class="desc-keyword">{@html bbcodeToHtml(line, { sizeUnit: 'px' })}</p>
	{/each}
</div>

<style>
	.card-desc {
		max-width: 82ch;
		font-family: var(--font-game, var(--font-display));
		font-size: 1.125rem;
		line-height: 1.2;
		color: var(--cream, #fff6e2);
		text-wrap: pretty;
	}

	.card-desc.card-desc-face {
		max-width: none;
		font-size: clamp(9px, 5.9cqw, 16px);
		font-weight: 350;
		line-height: 1.15;
		letter-spacing: -0.01rem;
		color: oldlace;
		text-align: center;
		text-shadow: 2px 1px 0 oklch(0.3 0.02 112);
	}

	.desc-body {
		white-space: pre-line;
	}

	.card-desc :global(.sts-energy-icon) {
		display: inline-block;
		height: 1.05em;
		width: auto;
		margin: 0 0.03em;
		vertical-align: -0.15em;
	}

	@media (max-width: 640px) {
		.card-desc:not(.card-desc-face) {
			font-size: 1rem;
		}
	}

	@media (max-width: 420px) {
		.card-desc:not(.card-desc-face) {
			font-size: 0.95rem;
		}
	}
</style>
