<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getLocale, setLocale } from '#lib/paraglide/runtime';
	import { m } from '#lib/paraglide/messages';

	let open = $state(false);
	const locale = getLocale();

	const links = [
		{ href: resolve('/cards'), label: m.nav_cards() },
		{ href: resolve('/keywords'), label: m.nav_keywords() },
		{ href: resolve('/buffs'), label: m.nav_buffs() },
		{ href: resolve('/debuffs'), label: m.nav_debuffs() },
		{ href: resolve('/tools'), label: m.nav_tools() }
	];

	let pathname = $derived(page.url.pathname);

	function active(href: string) {
		const target = new URL(href, page.url.href).pathname;
		return pathname === target || pathname.startsWith(`${target}/`);
	}

	function changeLocale(next: 'eng' | 'zhs') {
		if (next !== locale) setLocale(next);
	}
</script>

<header class="site-header">
	<div class="wrap header-inner">
		<a class="brand" href={resolve('/cards')} aria-label={m.brand_home()}>
			<svg class="brand-mark" viewBox="0 0 36 36" fill="none" aria-hidden="true">
				<path d="M18 2.5 L31 9.5 V26.5 L18 33.5 L5 26.5 V9.5 Z" stroke="currentColor" stroke-width="1.2" />
				<path d="M18 8 L26 12.5 V23.5 L18 28 L10 23.5 V12.5 Z" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-width="0.9" />
				<path d="M18 12 V24 M14.5 15 L18 12 L21.5 15" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
			</svg>
			<span class="brand-text">
				<span class="brand-title">{m.brand_title()} <em>2</em></span>
				<span class="brand-sub">{m.brand_sub()}</span>
			</span>
		</a>

		<nav class="desktop-nav" aria-label={m.nav_main()}>
			{#each links as link (link.href)}
				<a class="nav-link" href={link.href} aria-current={active(link.href) ? 'page' : undefined}>
					{link.label}
				</a>
			{/each}
		</nav>

		<a
			class="wiki-link"
			href="https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Cards_List"
			target="_blank"
			rel="noreferrer"
		>
			{m.wiki_reference()}
			<span aria-hidden="true">↗</span>
		</a>

		<div class="locale-switch" role="group" aria-label={m.language()}>
			<button
				type="button"
				aria-pressed={locale === 'eng'}
				aria-label={m.language_en()}
				onclick={() => changeLocale('eng')}
			>
				EN
			</button>
			<button
				type="button"
				aria-pressed={locale === 'zhs'}
				aria-label={m.language_zh()}
				onclick={() => changeLocale('zhs')}
			>
				中文
			</button>
		</div>

		<button
			class="menu-toggle"
			aria-expanded={open}
			aria-controls="mobile-menu"
			aria-label={open ? m.nav_close() : m.nav_open()}
			onclick={() => (open = !open)}
		>
			<span class:open></span>
			<span class:open></span>
		</button>
	</div>

	{#if open}
		<nav id="mobile-menu" class="mobile-nav" aria-label={m.nav_mobile()}>
			{#each links as link (link.href)}
				<a
					href={link.href}
					aria-current={active(link.href) ? 'page' : undefined}
					onclick={() => (open = false)}
				>
					{link.label}
					<span aria-hidden="true">→</span>
				</a>
			{/each}
		</nav>
	{/if}
</header>

<style>
	.site-header {
		position: sticky;
		top: 0;
		z-index: 60;
		background: color-mix(in srgb, var(--tooltip-bg) 88%, transparent);
		backdrop-filter: blur(12px);
		border-bottom: 2px solid var(--tooltip-border);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
	}

	.header-inner {
		height: var(--header-height);
		display: flex;
		align-items: center;
		gap: 28px;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		flex: none;
		color: var(--gold);
	}

	.brand-mark {
		width: 31px;
		height: 31px;
		color: var(--gold);
		filter: drop-shadow(0 0 10px rgba(242, 219, 116, 0.15));
	}

	.brand-text {
		display: flex;
		flex-direction: column;
		line-height: 1;
	}

	.brand-title {
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		color: var(--gold);
	}

	.brand-title em {
		font-style: normal;
		color: var(--gold);
	}

	.brand-sub {
		margin-top: 5px;
		font-family: var(--font-mono);
		font-size: 0.53rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--link);
	}

	.desktop-nav {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-left: auto;
	}

	.nav-link {
		padding: 6px 14px;
		border: 2px solid transparent;
		border-bottom: 0;
		border-radius: 6px 6px 0 0;
		font-family: var(--font-display);
		font-size: 0.92rem;
		font-weight: 700;
		color: var(--text-dim);
		text-shadow: 2px 1px 0 rgba(0, 0, 0, 0.45);
		transition:
			background 0.18s ease,
			border-color 0.18s ease,
			color 0.18s ease;
	}

	.nav-link:hover {
		background: color-mix(in srgb, var(--surface) 40%, transparent);
		color: var(--text);
	}

	.nav-link[aria-current='page'] {
		border-color: var(--tooltip-border);
		background: var(--surface);
		color: var(--text);
	}

	.wiki-link {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 5px 10px;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: var(--surface-secondary);
		font-size: 0.72rem;
		color: var(--link);
		white-space: nowrap;
		transition: color 0.18s ease, border-color 0.18s ease;
	}

	.wiki-link:hover {
		color: var(--text);
		border-color: var(--accent);
	}

	.locale-switch {
		display: inline-flex;
		flex: none;
		border: 1px solid var(--tooltip-border);
		border-radius: 4px;
		overflow: hidden;
		background: var(--surface-secondary);
	}

	.locale-switch button {
		min-height: 28px;
		padding: 0 9px;
		font-family: var(--font-display);
		font-size: 0.78rem;
		font-weight: 700;
		color: var(--text-dim);
		background: transparent;
		transition:
			background 0.16s ease,
			color 0.16s ease;
	}

	.locale-switch button + button {
		border-left: 1px solid var(--tooltip-border);
	}

	.locale-switch button:hover {
		background: color-mix(in srgb, var(--surface) 45%, transparent);
		color: var(--text);
	}

	.locale-switch button[aria-pressed='true'] {
		background: var(--accent);
		color: oklch(0 0 0);
	}

	.menu-toggle {
		display: none;
		width: 40px;
		height: 36px;
		place-items: center;
		align-content: center;
		gap: 5px;
		border: 1px solid var(--tooltip-border);
		border-radius: 4px;
		font-style: normal;
		margin-left: auto;
	}

	.menu-toggle span {
		display: block;
		width: 16px;
		height: 1px;
		background: var(--text-dim);
		transition: transform 0.22s var(--ease);
	}

	.menu-toggle span.open:first-child {
		transform: translateY(3px) rotate(45deg);
	}

	.menu-toggle span.open:last-child {
		transform: translateY(-3px) rotate(-45deg);
	}

	.mobile-nav {
		display: none;
	}

	@media (max-width: 980px) {
		.desktop-nav,
		.wiki-link {
			display: none;
		}

		.locale-switch {
			margin-left: auto;
		}

		.menu-toggle {
			display: grid;
			margin-left: 0;
		}

		.mobile-nav {
			display: grid;
			padding: 6px clamp(20px, 4vw, 44px) 16px;
			border-top: 2px solid var(--tooltip-border);
			background: color-mix(in srgb, var(--tooltip-bg) 96%, transparent);
		}

		.mobile-nav a {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 11px 8px;
			border-bottom: 1px solid var(--line);
			font-family: var(--font-display);
			font-size: 0.98rem;
			font-weight: 700;
			color: var(--text-dim);
		}

		.mobile-nav a[aria-current='page'] {
			color: var(--gold);
			background: color-mix(in srgb, var(--surface) 40%, transparent);
		}

		.mobile-nav a span {
			font-family: var(--font-sans);
			font-size: 0.8rem;
			color: var(--muted);
		}
	}
</style>
