<script lang="ts">
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<div class="glossary-page">
	<section class="pb-5 pt-[clamp(22px,3vw,34px)]">
		<div class="wrap">
			{@render children()}
		</div>
	</section>
</div>
