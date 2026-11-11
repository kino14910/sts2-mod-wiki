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
		{ href: resolve('/powers'), label: m.nav_powers() },
		{ href: resolve('/relics'), label: m.nav_relics() },
		{ href: resolve('/potions'), label: m.nav_potions() },
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

<header class="site-header sticky top-0 z-60 [background:color-mix(in_srgb,var(--tooltip-bg)_88%,transparent)] backdrop-blur-md border-b-2 border-tooltip-border [box-shadow:0_4px_12px_rgba(0,0,0,0.45)]">
	<div class="wrap header-inner h-(--header-height) flex items-center gap-7">
		<a class="brand flex items-center gap-2.5 flex-none text-gold no-underline hover:no-underline" href={resolve('/cards')} aria-label={m.brand_home()}>
			<svg class="brand-mark w-7.75 h-7.75 text-gold filter-[drop-shadow(0_0_10px_rgba(242,219,116,0.15))]" viewBox="0 0 36 36" fill="none" aria-hidden="true">
				<path d="M18 2.5 L31 9.5 V26.5 L18 33.5 L5 26.5 V9.5 Z" stroke="currentColor" stroke-width="1.2" />
				<path d="M18 8 L26 12.5 V23.5 L18 28 L10 23.5 V12.5 Z" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-width="0.9" />
				<path d="M18 12 V24 M14.5 15 L18 12 L21.5 15" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
			</svg>
			<span class="brand-text flex flex-col leading-none">
				<span class="brand-title font-display text-[1.05rem] font-semibold tracking-[0.01em] text-gold">{m.brand_title()} <span class="not-italic">2</span></span>
				<span class="brand-sub mt-1.25 font-mono text-[0.53rem] tracking-[0.16em] uppercase text-link">{m.brand_sub()}</span>
			</span>
		</a>

		<nav class="desktop-nav flex items-center gap-1 ml-auto max-[980px]:hidden" aria-label={m.nav_main()}>
			{#each links as link (link.href)}
				<a class="nav-link no-underline hover:no-underline px-3.5 py-1.5 border-2 border-transparent border-b-0 rounded-t-md font-display text-[0.92rem] font-bold text-ink-dim [text-shadow:2px_1px_0_rgba(0,0,0,0.45)] transition-colors duration-180 hover:bg-[color-mix(in_srgb,var(--surface)_40%,transparent)] hover:text-ink [aria-current='page']:border-tooltip-border [aria-current='page']:bg-surface [aria-current='page']:text-ink" href={link.href} aria-current={active(link.href) ? 'page' : undefined}>
					{link.label}
				</a>
			{/each}
		</nav>

		<a
			class="wiki-link no-underline hover:no-underline inline-flex items-center gap-1.25 px-2.5 py-1.25 border border-line rounded-sm bg-surface-2 text-[0.72rem] text-link whitespace-nowrap transition-colors duration-180 hover:text-ink hover:border-accent max-[980px]:hidden"
			href="https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Main"
			target="_blank"
			rel="noreferrer"
		>
			{m.wiki_reference()}
			<span aria-hidden="true">↗</span>
		</a>

		<div class="locale-switch inline-flex flex-none overflow-hidden rounded-sm border border-tooltip-border bg-surface-2 max-[980px]:ml-auto">
			<button
				type="button"
				class="min-h-7 px-2.25 font-display text-[0.78rem] font-bold text-ink-dim bg-transparent transition-colors duration-160 hover:bg-[color-mix(in_srgb,var(--surface)_45%,transparent)] hover:text-ink [aria-pressed='true']:bg-accent [aria-pressed='true']:text-[oklch(0_0_0)]"
				aria-pressed={locale === 'eng'}
				aria-label={m.language_en()}
				onclick={() => changeLocale('eng')}
			>
				EN
			</button>
			<button
				type="button"
				class="locale-zh min-h-7 px-2.25 font-display text-[0.78rem] font-bold text-ink-dim bg-transparent border-l border-tooltip-border transition-colors duration-160 hover:bg-[color-mix(in_srgb,var(--surface)_45%,transparent)] hover:text-ink [aria-pressed='true']:bg-accent [aria-pressed='true']:text-[oklch(0_0_0)]"
				aria-pressed={locale === 'zhs'}
				aria-label={m.language_zh()}
				onclick={() => changeLocale('zhs')}
				style="font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', system-ui, sans-serif"
			>
				中文
			</button>
		</div>

		<button
			class="menu-toggle w-10 h-9 grid place-items-center content-center gap-1.25 border border-tooltip-border rounded-sm font-style-normal ml-auto max-[980px]:grid max-[980px]:ml-0"
			aria-expanded={open}
			aria-controls="mobile-menu"
			aria-label={open ? m.nav_close() : m.nav_open()}
			onclick={() => (open = !open)}
		>
			<span class={'block h-px w-4 bg-ink-dim transition-transform duration-220 ease-brand ' + (open ? 'translate-y-0.75 rotate-45' : '')}></span>
			<span class={'block h-px w-4 bg-ink-dim transition-transform duration-220 ease-brand ' + (open ? '-translate-y-0.75 -rotate-45' : '')}></span>
		</button>
	</div>

	{#if open}
		<nav id="mobile-menu" class="mobile-nav hidden max-[980px]:grid max-[980px]:p-[6px_clamp(20px,4vw,44px)_16px] max-[980px]:border-t-2 max-[980px]:border-tooltip-border max-[980px]:[background:color-mix(in_srgb,var(--tooltip-bg)_96%,transparent)]" aria-label={m.nav_mobile()}>
			{#each links as link (link.href)}
				<a
					class="flex items-center justify-between px-2 py-2.75 border-b border-line font-display text-[0.98rem] font-bold text-ink-dim no-underline hover:no-underline [aria-current='page']:text-gold [aria-current='page']:bg-[color-mix(in_srgb,var(--surface)_40%,transparent)]"
					href={link.href}
					aria-current={active(link.href) ? 'page' : undefined}
					onclick={() => (open = false)}
				>
					{link.label}
					<span aria-hidden="true" class="font-sans text-[0.8rem] text-muted">→</span>
				</a>
			{/each}
		</nav>
	{/if}
</header>
