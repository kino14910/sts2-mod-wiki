<script lang="ts">
	import { resolve } from '$app/paths'
	import { refreshAll } from '$app/navigation'
	import { isAllowedEmail } from '#lib/email-domain'
	import { onMount } from 'svelte'
	import { page } from '$app/state'
	import { getLocale, setLocale } from '#lib/paraglide/runtime'
	import { m } from '#lib/paraglide/messages'
	import { wikiUi } from '#lib/wiki-article'
	import type { WikiViewer } from '#lib/wiki-collaboration'

	let open = $state(false)
	let accountOpen = $state(false)
	let viewer = $state<WikiViewer>({ session: null, permissions: [] })
	let email = $state('')
	let password = $state('')
	let username = $state('')
	let inviteCode = $state('')
	let authMode = $state<'login' | 'register'>('login')
	let authBusy = $state(false)
	let authError = $state('')
	let authNotice = $state('')
	let ui = $derived(wikiUi(getLocale()))
	let currentViewer = $derived((page.data as { viewer?: WikiViewer }).viewer ?? viewer)
	onMount(() => { void refreshSession() })

	async function refreshSession() {
		try {
			const response = await fetch(resolve('/api/auth/session'), { cache: 'no-store' })
			if (response.ok) viewer = await response.json() as WikiViewer
		} catch { /* Reading remains available without an authentication server. */ }
	}

	function validateCredentials(requireInvite = false) {
		if (!isAllowedEmail(email)) { authError = ui.emailInvalid; return false }
		if (password.length < 8) { authError = ui.passwordShort; return false }
		if (requireInvite && !inviteCode.trim()) { authError = ui.inviteInvalid; return false }
		return true
	}

	async function submitCredentials(
		path: '/api/auth/login' | '/api/auth/register', body: Record<string, string>, requireInvite = false
	) {
		if (authBusy || !validateCredentials(requireInvite)) return
		authBusy = true
		authError = ''
		authNotice = ''
		try {
			const response = await fetch(resolve(path), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			})
			const result = await response.json().catch(() => null) as (WikiViewer & { message?: string }) | null
			if (!response.ok) throw new Error(result?.message ?? ui.error)
			viewer = result!
			await refreshAll()
			accountOpen = false
			authMode = 'login'
			password = ''
			inviteCode = ''
		} catch (cause) { authError = cause instanceof Error ? cause.message : ui.error }
		finally { authBusy = false }
	}

	function authenticate(event?: SubmitEvent) {
		event?.preventDefault()
		void submitCredentials('/api/auth/login', { email, password })
	}

	function register(event?: SubmitEvent) {
		event?.preventDefault()
		void submitCredentials('/api/auth/register', { email, password, username, inviteCode }, true)
	}

	async function signOut() {
		if (authBusy) return
		authBusy = true
		authError = ''
		try {
			const response = await fetch(resolve('/api/auth/session'), { method: 'DELETE' })
			if (!response.ok) throw new Error(ui.error)
			viewer = { session: null, permissions: [] }
			await refreshAll()
			accountOpen = false
		} catch (cause) { authError = cause instanceof Error ? cause.message : ui.error }
		finally { authBusy = false }
	}
	const locale = getLocale()

	const baseLinks = [
		{ href: resolve('/cards'), label: m.nav_cards() },
		{ href: resolve('/keywords'), label: m.nav_keywords() },
		{ href: resolve('/powers'), label: m.nav_powers() },
		{ href: resolve('/relics'), label: m.nav_relics() },
		{ href: resolve('/potions'), label: m.nav_potions() },
		{ href: resolve('/tools'), label: m.nav_tools() }
	]
	let links = $derived(currentViewer.permissions.includes('user:role:manage')
		? [...baseLinks, { href: resolve('/admin'), label: ui.admin }]
		: baseLinks)

	let pathname = $derived(page.url.pathname)

	function active(href: string) {
		const target = new URL(href, page.url.href).pathname
		return pathname === target || pathname.startsWith(`${target}/`)
	}

	function changeLocale(next: 'eng' | 'zhs') {
		if (next !== locale) setLocale(next)
	}
</script>

<svelte:window onkeydown={(event) => {
	if (event.key === 'Escape' && accountOpen) { accountOpen = false; document.getElementById('community-account')?.focus(); }
}} />

<header class="site-header sticky top-0 z-60 [background:color-mix(in_srgb,var(--tooltip-bg)_88%,transparent)] backdrop-blur-md border-b-2 border-tooltip-border [box-shadow:0_4px_12px_rgba(0,0,0,0.45)]">
	<div class="wrap header-inner h-(--header-height) flex min-w-0 items-center gap-7 max-[980px]:gap-2 max-[620px]:px-3">
		<a class="brand flex min-w-0 items-center gap-2.5 flex-none text-gold no-underline hover:no-underline max-[980px]:flex-1 max-[620px]:gap-1.5" href={resolve('/cards')} aria-label={m.brand_home()}>
			<svg class="brand-mark w-7.75 h-7.75 shrink-0 text-gold max-[620px]:size-6 filter-[drop-shadow(0_0_10px_rgba(242,219,116,0.15))]" viewBox="0 0 36 36" fill="none" aria-hidden="true">
				<path d="M18 2.5 L31 9.5 V26.5 L18 33.5 L5 26.5 V9.5 Z" stroke="currentColor" stroke-width="1.2" />
				<path d="M18 8 L26 12.5 V23.5 L18 28 L10 23.5 V12.5 Z" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-width="0.9" />
				<path d="M18 12 V24 M14.5 15 L18 12 L21.5 15" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
			</svg>
			<span class="brand-text flex min-w-0 flex-col leading-none">
				<span class="brand-title truncate font-display text-[1.05rem] font-semibold tracking-[0.01em] text-gold"><span class="max-[620px]:hidden">{m.brand_title()} <span class="not-italic">2</span></span><span class="hidden max-[620px]:inline" aria-hidden="true">STS2</span></span>
				<span class="brand-sub mt-1.25 font-mono text-[0.53rem] tracking-[0.16em] uppercase text-link max-[620px]:hidden">{m.brand_sub()}</span>
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

		<div class="relative ml-auto min-w-0 max-w-40 shrink-0 max-[620px]:max-w-24">
			<button id="community-account" type="button" class="block max-w-full truncate whitespace-nowrap rounded border border-line px-2 py-1 text-xs text-link hover:text-gold"
				aria-label={currentViewer.session?.username ?? ui.signIn} aria-expanded={accountOpen} aria-controls="community-account-panel" onclick={() => (accountOpen = !accountOpen)}>
				{currentViewer.session?.username ?? ui.signIn}
			</button>
			{#if accountOpen}
				<div id="community-account-panel" class="absolute right-0 top-full z-70 mt-2 w-[min(19rem,calc(100vw-1.5rem))] space-y-3 rounded border border-line bg-surface p-4 shadow-xl max-[620px]:fixed max-[620px]:right-3 max-[620px]:top-(--header-height)" role="region" aria-label={ui.account}>
					{#if currentViewer.session}
						<p class="break-words text-sm">{currentViewer.session.username}</p>
						<button class="text-sm text-link" type="button" disabled={authBusy} onclick={signOut}>{ui.signOut}</button>
					{:else}
						<form class="space-y-3" onsubmit={authMode === 'login' ? authenticate : register}>
							{#if authMode === 'register'}
								<label class="block text-xs">{ui.username}<input class="mt-1 w-full rounded border border-line bg-black/30 p-2" name="username" bind:value={username} maxlength="64" autocomplete="nickname" /></label>
							{/if}
							<label class="block text-xs">{ui.qqEmail}<input class="mt-1 w-full rounded border border-line bg-black/30 p-2" name="email" type="email" bind:value={email} required maxlength="64" pattern="[^@\s]+@[qQ][qQ]\.com" title={ui.emailHint} autocomplete="email" /></label>
							<p class="text-xs text-muted">{ui.emailHint}</p>
							<label class="block text-xs">{ui.password}<input class="mt-1 w-full rounded border border-line bg-black/30 p-2" name="password" type="password" bind:value={password} required minlength="8" maxlength="128" autocomplete={authMode === 'login' ? 'current-password' : 'new-password'} /></label>
							{#if authMode === 'register'}
								<label class="block text-xs">{ui.inviteCode}<input class="mt-1 w-full rounded border border-line bg-black/30 p-2 font-mono" name="inviteCode" bind:value={inviteCode} required maxlength="64" autocomplete="off" /></label>
								<p class="text-xs text-muted">{ui.inviteHint}</p>
							{/if}
							<button type="submit" class="rounded bg-link px-3 py-1 text-sm text-black" disabled={authBusy}>{authMode === 'login' ? ui.signIn : ui.register}</button>
						</form>
						{#if authNotice}<p role="status" class="text-xs text-green-300">{authNotice}</p>{/if}
						<button type="button" class="text-xs text-link" onclick={() => { authMode = authMode === 'login' ? 'register' : 'login'; authError = ''; authNotice = ''; inviteCode = '' }}>
							{authMode === 'login' ? ui.createAccount : ui.haveAccount}
						</button>
					{/if}
					{#if authError}<p role="alert" class="text-xs text-red-300">{authError}</p>{/if}
					<button type="button" class="text-xs text-link" onclick={() => (accountOpen = false)}>{ui.close}</button>
				</div>
			{/if}
		</div>
		<div class="locale-switch inline-flex flex-none overflow-hidden rounded-sm border border-tooltip-border bg-surface-2">
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
			class="menu-toggle hidden w-10 h-9 shrink-0 place-items-center content-center gap-1.25 border border-tooltip-border rounded-sm font-style-normal max-[980px]:grid max-[620px]:w-9"
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
