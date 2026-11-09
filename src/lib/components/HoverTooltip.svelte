<script lang="ts">
	let {
		show = false,
		html = '',
		x = 0,
		y = 0,
		registerTip
	}: {
		show?: boolean
		html?: string
		x?: number
		y?: number
		registerTip?: (node: HTMLElement) => void | (() => void)
	} = $props()

	const attach = $derived(registerTip ?? (() => {}))
</script>

{#if show}
	<div
		class="custom-tooltip"
		{@attach attach}
		style:left="{x}px"
		style:top="{y}px"
		role="tooltip"
	>
		{@html html}
	</div>
{/if}
