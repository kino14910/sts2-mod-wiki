<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages';
</script>

<svelte:head>
	<title>{m.error_meta_title({ status: page.status })}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="pb-5 pt-[clamp(30px,5vw,54px)]">
	<div class="wrap">
		<nav
			class="mb-4.5 flex flex-wrap items-center gap-2 font-mono text-[0.58rem] tracking-[0.06em] text-muted"
			aria-label={m.breadcrumb()}
		>
			<a class="hover:text-gold" href={resolve('/cards')}>{m.nav_cards()}</a>
			<span aria-hidden="true">/</span>
			<span class="text-ink-dim" aria-current="page">{m.error_breadcrumb({ status: page.status })}</span>
		</nav>

		<div
			class="mx-auto max-w-160 rounded-[10px] border-2 border-tooltip-border bg-tooltip-bg p-[clamp(28px,5vw,48px)] text-center shadow-[0_12px_30px_-20px_rgba(0,0,0,0.8)]"
		>
			<p class="display text-[clamp(2.6rem,7vw,4.6rem)] leading-none tracking-[0.06em] text-gold">
				{page.status}
			</p>
			<h1 class="mt-3 text-[clamp(1.4rem,3vw,1.9rem)] text-ink">
				{#if page.status === 404}
					{m.error_not_found()}
				{:else}
					{m.error_generic()}
				{/if}
			</h1>
			<p class="mt-2.5 text-[0.8rem] text-muted">
				{page.error?.message ?? m.error_default_body()}
			</p>
			<div class="mt-5.5 flex justify-center">
				<a class="button button--gold" href={resolve('/cards')}>{m.error_back()}</a>
			</div>
		</div>
	</div>
</section>
