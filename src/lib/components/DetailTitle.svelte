<script lang="ts">
	import { m } from '#lib/paraglide/messages'

	let { name }: { name: string } = $props()
</script>

<h1
	class="mb-3 border-b border-line pb-2 text-[1.8rem] leading-tight font-display"
>
	<span class="text-gold">{name}</span>
	<span class="text-ink"> | {m.game_title()}</span>
</h1>
