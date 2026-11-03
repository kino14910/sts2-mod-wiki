<script lang="ts">
	import { termIndex, termPattern } from '#lib/data/localize';
	import type { GlossaryLink } from '#lib/data/glossary';

	type Token =
		| { type: 'text'; value: string }
		| { type: 'number'; value: string }
		| { type: 'term'; value: string; link: GlossaryLink };

	let { text, class: className = '' }: { text: string; class?: string } = $props();

	let tokens = $derived(tokenize(text));

	function addText(tokens: Token[], chunk: string) {
		if (!chunk) return;
		const parts = chunk.split(/(\d+)/);
		for (const part of parts) {
			if (!part) continue;
			tokens.push({ type: /^\d+$/.test(part) ? 'number' : 'text', value: part });
		}
	}

	function tokenize(value: string): Token[] {
		const result: Token[] = [];
		const pattern = termPattern();
		const indexes = termIndex();
		const regex = new RegExp(pattern.source, pattern.flags);
		let cursor = 0;

		for (const match of value.matchAll(regex)) {
			const index = match.index ?? 0;
			addText(result, value.slice(cursor, index));
			const raw = match[0];
			const link = indexes.get(raw.toLowerCase());
			if (link) {
				result.push({ type: 'term', value: raw, link });
			} else {
				addText(result, raw);
			}
			cursor = index + raw.length;
		}

		addText(result, value.slice(cursor));
		return result;
	}
</script>

<span class="rich-text {className}">
	{#each tokens as token, index (`${token.type}-${index}-${token.value}`)}
		{#if token.type === 'term'}
			<a
				class="term term--{token.link.kind}"
				href={token.link.href}
				title="{token.link.name}: {token.link.summary}"
			>{token.value}</a>
		{:else if token.type === 'number'}
			<span class="number">{token.value}</span>
		{:else}{token.value}{/if}
	{/each}
</span>

<style>
	.rich-text {
		display: inline;
	}

	.term {
		color: var(--term-color, var(--link));
		font-weight: 500;
		text-decoration-line: underline;
		text-decoration-style: dotted;
		text-decoration-thickness: 1px;
		text-underline-offset: 2px;
		transition: color 0.16s ease;
	}

	.term--keyword {
		--term-color: var(--link);
	}

	.term--buff {
		--term-color: var(--green);
	}

	.term--debuff {
		--term-color: oklch(0.75 0.18 22);
	}

	.term:hover {
		color: #fff3bd;
		text-decoration-color: currentColor;
	}

	.number {
		color: var(--gold);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
</style>
