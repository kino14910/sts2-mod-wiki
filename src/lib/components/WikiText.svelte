<script lang="ts">
	import WikiIcon from '#lib/components/WikiIcon.svelte'
	import WikiEntity from '#lib/components/WikiEntity.svelte'
	import WikiTerm from '#lib/components/WikiTerm.svelte'
	import {
		WIKI_TERM_NAMES,
		cardWikiHref,
		wikiEntity,
		wikiRelic,
		wikiTerm,
		type WikiEntry
	} from '#lib/data/power-wiki'

	let { text }: { text: string } = $props()

	type Token = {
		kind: 'text' | 'icon' | 'relic' | 'upgraded' | 'entity' | 'term'
		value: string
		label?: string
		icon?: string
		entry?: WikiEntry
		href?: string | null
		tooltip?: string
	}

	const ICON_PATTERN =
		/StS2 (Icon ?[A-Za-z0-9 ]+|[A-Za-z][A-Za-z0-9]*?)\.png|§ICON_([^§]+)§|\((\d+)\)/g

	function escapeRegex(value: string): string {
		return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	}

	const TERM_PATTERN = WIKI_TERM_NAMES.length
		? new RegExp(`(?<![\\w])(${WIKI_TERM_NAMES.map(escapeRegex).join('|')})(?![\\w])`, 'gi')
		: null

	function captureLabel(value: string, from: number): { label: string; next: number } {
		const match = value.slice(from).match(/^\s*([\p{L}]+)/u)
		if (!match) return { label: '', next: from }
		return { label: match[1], next: from + match[0].length }
	}

	function captureAlias(value: string, from: number, aliases: string[]) {
		const leading = /^\s*/.exec(value.slice(from))?.[0] ?? ''
		const start = from + leading.length
		for (const alias of aliases) {
			if (!alias) continue
			if (value.slice(start, start + alias.length).toLowerCase() === alias.toLowerCase()) {
				return { label: value.slice(start, start + alias.length), next: start + alias.length }
			}
		}
		return { label: '', next: from }
	}

	function splitTerms(value: string): Token[] {
		if (!TERM_PATTERN) return [{ kind: 'text', value }]
		const tokens: Token[] = []
		let last = 0
		for (const match of value.matchAll(TERM_PATTERN)) {
			const start = match.index ?? 0
			if (start > last) tokens.push({ kind: 'text', value: value.slice(last, start) })
			const word = match[0]
			const entry = wikiEntity(word)
			const term = wikiTerm(word)
			if (entry)
				tokens.push({
					kind: 'entity',
					value: word,
					entry,
					href: entry.kind === 'card' ? cardWikiHref(word) : null
				})
			else if (term) tokens.push({ kind: 'term', value: word, tooltip: term.tooltip })
			else tokens.push({ kind: 'text', value: word })
			last = start + word.length
		}
		if (last < value.length) tokens.push({ kind: 'text', value: value.slice(last) })
		return tokens
	}

	function tokenize(value: string): Token[] {
		const base: Token[] = []
		let last = 0
		for (const match of value.matchAll(ICON_PATTERN)) {
			const start = match.index ?? 0
			const end = start + match[0].length
			if (start > last) base.push({ kind: 'text', value: value.slice(last, start) })
			if (match[3]) {
				base.push({ kind: 'text', value: '(' })
				base.push({ kind: 'upgraded', value: match[3] })
				base.push({ kind: 'text', value: ')' })
				last = end
				continue
			}
			const isFile = match[1] !== undefined
			const raw = (match[1] ?? match[2] ?? '').trim()
			if (isFile && !/^Icon/i.test(raw)) {
			const relic = wikiRelic(raw)
			if (relic) {
				const { label, next } = captureAlias(value, end, relic.aliases)
				base.push({ kind: 'relic', value: raw, icon: relic.icon, label, tooltip: relic.tooltip })
				last = label ? next : end
				continue
			}
				base.push({ kind: 'text', value: match[0] })
				last = end
				continue
			}
			const name = isFile ? raw.replace(/^Icon\s*/i, '').trim() : raw
			const term = wikiTerm(name.replace(/_.*$/, '')) ?? wikiTerm(name)
			const { label, next } = captureLabel(value, end)
			const sameLabel = !!term && !!label && wikiTerm(label) === term
			base.push({
				kind: 'icon',
				value: term?.icon ?? '',
				label: sameLabel ? label : '',
				tooltip: term?.tooltip ?? ''
			})
			last = sameLabel ? next : end
		}
		if (last < value.length) base.push({ kind: 'text', value: value.slice(last) })

		const result: Token[] = []
		for (const token of base) {
			if (token.kind === 'text') result.push(...splitTerms(token.value))
			else result.push(token)
		}
		return result
	}

	let tokens = $derived(tokenize(text))
</script>

{#each tokens as token, index (index)}{#if token.kind === 'icon'}<WikiTerm tooltip={token.tooltip ?? ''}><WikiIcon kind="power" name={token.value} label={token.label ?? ''} /></WikiTerm>{:else if token.kind === 'relic'}<WikiTerm tooltip={token.tooltip ?? ''}><WikiIcon kind="relic" name={token.value} src={token.icon ?? ''} label={token.label ?? ''} /></WikiTerm>{:else if token.kind === 'term'}<WikiTerm tooltip={token.tooltip ?? ''}>{token.value}</WikiTerm>{:else if token.kind === 'entity'}<WikiEntity entry={token.entry!} text={token.value} href={token.href} />{:else if token.kind === 'upgraded'}<span class="wiki-upgraded">{token.value}</span>{:else}{token.value}{/if}{/each}

<style>
	.wiki-upgraded {
		color: #94ee93;
	}
</style>
