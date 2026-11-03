<script lang="ts">
	import type { LayoutProps } from './$types';
	import './tools.css';

	let { children }: LayoutProps = $props();
</script>

<div class="tool-shell wrap">
	{@render children()}
</div>
