<script lang="ts">
	import WikiEntity from '#lib/components/WikiEntity.svelte'
	import { ICON_PATTERN } from '#lib/text/game-text/icon-syntax'
	import { getLocale } from '#lib/paraglide/runtime'
	import { resolvePowerReference, type PowerEntityRef } from '#lib/data/power-references'
	import {
		WIKI_TERM_NAMES,
		wikiEntity,
		wikiEntryFor,
		wikiRelic,
		wikiTerm,
		type WikiEntry,
		type WikiTerm
	} from '#lib/data/power-wiki'
	import { relicHrefByName, potionImageByName, cardByName, cardById, cardIcon } from '#lib/data/wiki-links'

	let { text }: { text: string } = $props()

	type InlineIcon = {
		kind: 'power' | 'relic' | 'card' | 'potion'
		src: string
		name: string
		label: string
	}

	type Token =
		| { kind: 'text'; value: string }
		| { kind: 'upgraded'; value: string }
		| {
				kind: 'entity'
				value: string
				entry: WikiEntry
				href?: string | null
				tooltip?: string
				icon?: InlineIcon
		  }

	const ENTITY_PATTERN = /\[\[(card|relic|potion|power):([^\]|]+)(?:\|([^\]]+))?\]\]/g

	function escapeRegex(value: string) {
		return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	}

	const TERM_PATTERN = WIKI_TERM_NAMES.length
		? new RegExp(`(?<![\\w])(${WIKI_TERM_NAMES.map(escapeRegex).join('|')})(?![\\w])`, 'gi')
		: null

	function placeholder(name: string, tooltip = ''): WikiEntry {
		return { name, description: '', tooltip, kind: 'power' }
	}

	function compactName(value: string) {
		return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '')
	}

	function captureLabel(value: string, from: number, term: WikiTerm | undefined, entry: WikiEntry) {
		const rest = value.slice(from)
		const start = from + (/^\s*/.exec(rest)?.[0].length ?? 0)
		const tail = value.slice(start)
		if (!tail) return { label: '', next: from }

		const accepted = new Set(
			[term?.name, entry.name, entry.id]
				.filter((name): name is string => !!name)
				.map(compactName)
		)
		const first = tail[0].toLowerCase()
		let label = ''
		for (const name of WIKI_TERM_NAMES) {
			if (!name || name.length <= label.length || name[0].toLowerCase() !== first) continue
			if (tail.slice(0, name.length).toLowerCase() !== name.toLowerCase()) continue
			if (/[a-z0-9_]/i.test(tail.slice(name.length, name.length + 1))) continue
			const candidateTerm = wikiTerm(name)
			const candidateEntry = candidateTerm ? null : wikiEntity(name)
			if (
				!accepted.has(compactName(name)) &&
				!(term && candidateTerm === term) &&
				!(entry.id && candidateEntry?.id === entry.id)
			) continue
			label = tail.slice(0, name.length)
			break
		}
		if (!label) return { label: '', next: from }
		return { label, next: start + label.length }
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

	function inlineIconFor(word: string, entry: WikiEntry, skipTerm = false): InlineIcon | undefined {
		const term = skipTerm ? undefined : wikiTerm(word)
		if (term?.icon) return { kind: 'power', src: '', name: term.icon, label: word }
		if (entry.kind === 'relic') {
			const relic = wikiRelic(entry.name)
			if (relic?.icon) return { kind: 'relic', src: relic.icon, name: '', label: word }
		}
		if (entry.kind === 'potion') {
			const src = potionImageByName(entry.name)
			if (src) return { kind: 'potion', src, name: '', label: word }
		}
		if (entry.kind === 'card') {
			const card = (entry.id ? cardById(entry.id) : undefined) ?? cardByName(entry.name)
			const src = card ? cardIcon(card) : null
			if (src) return { kind: 'card', src, name: '', label: word }
		}
		return undefined
	}

	function splitTerms(value: string): Token[] {
		if (!TERM_PATTERN) return [{ kind: 'text', value }]
		const tokens: Token[] = []
		let last = 0
		for (const match of value.matchAll(TERM_PATTERN)) {
			const start = match.index ?? 0
			if (start > last) tokens.push({ kind: 'text', value: value.slice(last, start) })
			const word = match[0]
			const entry = wikiEntryFor(word)
			if (entry) {
				tokens.push({ kind: 'entity', value: word, entry, icon: inlineIconFor(word, entry) })
			} else {
				tokens.push({ kind: 'text', value: word })
			}
			last = start + word.length
		}
		if (last < value.length) tokens.push({ kind: 'text', value: value.slice(last) })
		return tokens
	}

	function tokenizePlain(value: string): Token[] {
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
					const entry = wikiEntryFor(relic.name) ?? placeholder(relic.name, relic.tooltip)
					base.push({
						kind: 'entity',
						value: label || relic.name,
						entry,
						href: relicHrefByName(relic.name) ?? entry.href ?? null,
						tooltip: relic.tooltip || entry.tooltip,
						icon: { kind: 'relic', src: relic.icon, name: '', label }
					})
					last = label ? next : end
					continue
				}
				base.push({ kind: 'text', value: match[0] })
				last = end
				continue
			}

			const name = isFile ? raw.replace(/^Icon\s*/i, '').trim() : raw
			const short = name.replace(/_.*$/, '')
			const term = wikiTerm(short) ?? wikiTerm(name)
		const entry = wikiEntryFor(short) ?? wikiEntryFor(name) ?? placeholder(name, term?.tooltip)
		const { label, next } = captureLabel(value, end, term, entry)
		const sameLabel = !!label
			base.push({
				kind: 'entity',
				value: sameLabel ? label : name,
				entry,
				tooltip: term?.tooltip ?? entry.tooltip,
				icon: {
					kind: 'power',
					src: '',
					name: term?.icon || (entry.kind === 'power' ? entry.name : ''),
					label: sameLabel ? label : ''
				}
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

	function tokenize(value: string): Token[] {
		const tokens: Token[] = []
		let last = 0
		for (const match of value.matchAll(ENTITY_PATTERN)) {
			const start = match.index ?? 0
			if (start > last) tokens.push(...tokenizePlain(value.slice(last, start)))
			const entry = resolvePowerReference(
				{ type: match[1] as PowerEntityRef['type'], id: match[2].trim() },
				getLocale() === 'zhs' ? 'zhs' : 'eng'
			)
			if (entry) {
				const label = match[3]?.trim() || entry.name
				tokens.push({
					kind: 'entity',
					value: label,
					entry,
					icon: inlineIconFor(label, entry, true)
				})
			} else {
				tokens.push({ kind: 'text', value: match[0] })
			}
			last = start + match[0].length
		}
		if (last < value.length) tokens.push(...tokenizePlain(value.slice(last)))
		return tokens
	}

	let tokens = $derived(tokenize(text))
</script>

{#each tokens as token, index (index)}
	{#if token.kind === 'entity'}
		<WikiEntity
			entry={token.entry}
			text={token.icon ? '' : token.value}
			href={token.href}
			tooltip={token.tooltip}
			icon={token.icon?.name ?? ''}
			iconSrc={token.icon?.src ?? ''}
			iconKind={token.icon?.kind ?? 'power'}
			iconLabel={token.icon?.label ?? ''}
		/>
	{:else if token.kind === 'upgraded'}
		<span class="wiki-upgraded text-[#94ee93]">{token.value}</span>
	{:else}{token.value}{/if}
{/each}
