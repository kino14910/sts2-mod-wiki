<script lang="ts">
	import { MODS } from '#lib/data/mods';
	import { modName } from '#lib/data/localize';
	import { m } from '#lib/paraglide/messages';

	let {
		value = $bindable('all'),
		onchange = () => {}
	}: {
		value?: string;
		onchange?: () => void;
	} = $props();
</script>

<label class="mod-select flex items-center gap-1.75 flex-none max-[860px]:ml-auto">
	<span class="font-mono text-[0.55rem] tracking-widest uppercase text-muted"
		>{m.filter_mod()}</span
	>
	<select bind:value={value} onchange={onchange} aria-label={m.filter_by_mod()}>
		<option value="all">{m.filter_all_mods()}</option>
		{#each MODS as entry (entry.id)}
			<option value={entry.id}>{modName(entry.id)}</option>
		{/each}
	</select>
</label>

<style>
	.mod-select select {
		appearance: none;
		height: 27px;
		max-width: 180px;
		border: 1px solid var(--line);
		border-radius: 4px;
		padding: 0 23px 0 7px;
		background:
			url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='6'%3E%3Cpath d='M1 1 L4.5 4.5 L8 1' stroke='%23d0d8d6' fill='none'/%3E%3C/svg%3E")
				no-repeat right 8px center,
			var(--table);
		box-shadow: none;
		outline: 0;
		font-family: var(--font-display);
		font-size: 0.85rem;
		color: var(--text);
		cursor: pointer;
	}

	.mod-select option {
		background: var(--tooltip-bg);
		color: var(--text);
	}
</style>
