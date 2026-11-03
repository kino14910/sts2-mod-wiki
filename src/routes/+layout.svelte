<script lang="ts">
	import { page } from '$app/state';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import { m } from '#lib/paraglide/messages';
	import type { LayoutProps } from './$types';
	import './layout.css';

	let { children }: LayoutProps = $props();

	let cardsList = $derived(page.route.id === '/cards');
</script>

<a class="skip-link" href="#main-content">{m.skip_to_content()}</a>

<SiteHeader />

<main id="main-content">
	<div class="content-shell">
		<div class="content-frame" class:cards={cardsList}>
			{@render children()}
		</div>
	</div>
</main>

<SiteFooter />

<style>
	.skip-link {
		position: fixed;
		top: 10px;
		left: 10px;
		z-index: 100;
		padding: 10px 16px;
		border-radius: 6px;
		background: var(--gold);
		color: #111;
		font-size: 0.82rem;
		font-weight: 600;
		transform: translateY(-160%);
		transition: transform 0.2s ease;
	}

	.skip-link:focus {
		transform: translateY(0);
	}

	main {
		display: block;
		min-height: 50vh;
	}

	.content-shell {
		max-width: var(--page-max);
		margin: 0 auto;
		padding: clamp(12px, 2vw, 24px) clamp(8px, 1.6vw, 18px) 0;
	}

	.content-frame {
		min-height: 62vh;
		border: clamp(15px, 3vw, 45px) solid transparent;
		border-image: url('/images/site-content-background.webp') 92 fill round round;
		filter: drop-shadow(10px 12px 2px rgba(0, 0, 0, 0.36));
	}

	/* The card list grows/shrinks with filters, so use a steady translucent
	   black backdrop instead of the stone texture. */
	.content-frame.cards {
		border: 0;
		border-image: none;
		border-radius: 10px;
		background: oklch(0 0 0 / 86%);
	}
</style>
