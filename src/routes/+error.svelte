<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages';
</script>

<svelte:head>
	<title>{m.error_meta_title({ status: page.status })}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="page">
	<div class="wrap">
		<nav class="crumbs" aria-label={m.breadcrumb()}>
			<a href={resolve('/cards')}>{m.nav_cards()}</a>
			<span aria-hidden="true">/</span>
			<span aria-current="page">{m.error_breadcrumb({ status: page.status })}</span>
		</nav>

		<div class="error-panel">
			<p class="error-code display">{page.status}</p>
			<h1 class="display">
				{#if page.status === 404}
					{m.error_not_found()}
				{:else}
					{m.error_generic()}
				{/if}
			</h1>
			<p class="error-copy">
				{page.error?.message ?? m.error_default_body()}
			</p>
			<div class="error-actions">
				<a class="button button--gold" href={resolve('/cards')}>{m.error_back()}</a>
			</div>
		</div>
	</div>
</section>

<style>
	.page {
		padding: clamp(30px, 5vw, 54px) 0 20px;
	}

	.crumbs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-bottom: 18px;
		font-family: var(--font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.06em;
		color: var(--muted);
	}

	.crumbs a:hover {
		color: var(--gold);
	}

	.crumbs span[aria-current='page'] {
		color: var(--text-dim);
	}

	.error-panel {
		margin: 0 auto;
		max-width: 640px;
		padding: clamp(28px, 5vw, 48px);
		border: 2px solid var(--tooltip-border);
		border-radius: 10px;
		background: var(--tooltip-bg);
		text-align: center;
		box-shadow: 0 12px 30px -20px rgba(0, 0, 0, 0.8);
	}

	.error-code {
		font-size: clamp(2.6rem, 7vw, 4.6rem);
		line-height: 1;
		color: var(--gold);
		letter-spacing: 0.06em;
	}

	.error-panel h1 {
		margin-top: 12px;
		font-size: clamp(1.4rem, 3vw, 1.9rem);
		color: var(--text);
	}

	.error-copy {
		margin-top: 10px;
		font-size: 0.8rem;
		color: var(--muted);
	}

	.error-actions {
		display: flex;
		justify-content: center;
		margin-top: 22px;
	}
</style>
