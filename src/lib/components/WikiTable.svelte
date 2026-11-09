<script lang="ts">
	import type { RelicWikiCell } from '#lib/data/relic-wiki'

	let { columns, rows }: { columns: string[]; rows: RelicWikiCell[][] } = $props()
</script>

<table class="mb-3 w-full border-collapse text-[0.84rem]">
	<thead>
		<tr>
			{#each columns as column (column)}
				<th class="border border-line bg-(--table-header) px-2 py-1 text-left">
					{column}
				</th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each rows as row, rowIndex (rowIndex)}
			<tr>
				{#each row as cell, cellIndex (cellIndex)}
					<td class="border border-line px-2 py-1 align-top">
						{#if cell.text}
							{#if cell.href}
								<a class="text-link hover:text-gold" href={cell.href}>{cell.text}</a>
							{:else}{cell.text}{/if}
						{/if}
						{#if cell.lines}
							<ul class="ml-4 list-disc">
								{#each cell.lines as line (line)}<li>{line}</li>{/each}
							</ul>
						{/if}
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>
