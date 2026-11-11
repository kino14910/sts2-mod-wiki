<script lang="ts">
	import { termIndex, termPattern } from '#lib/data/localize';
	import type { GlossaryKind, GlossaryLink } from '#lib/data/glossary';

	type Token =
		| { type: 'text'; value: string }
		| { type: 'number'; value: string }
		| { type: 'term'; value: string; link: GlossaryLink };

	const TERM_COLOR: Record<GlossaryKind, string> = {
		keyword: 'text-link',
		power: 'text-positive'
	};

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

<span class={['inline', className]}>
	{#each tokens as token, index (`${token.type}-${index}-${token.value}`)}
		{#if token.type === 'term'}
			<a
				class={[
					'font-medium underline decoration-dotted decoration-1 underline-offset-2 transition-colors hover:decoration-[#fff3bd]',
					TERM_COLOR[token.link.kind]
				]}
				href={token.link.href}
				title="{token.link.name}: {token.link.summary}"
			>{token.value}</a>
		{:else if token.type === 'number'}
			<span class="font-semibold tabular-nums text-gold">{token.value}</span>
		{:else}{token.value}{/if}
	{/each}
</span>
