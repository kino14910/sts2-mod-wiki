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

	const anonymousViewer: WikiViewer = { session: null, permissions: [] }
	let open = $state(false)
	let accountOpen = $state(false)
	let viewer = $state.raw<WikiViewer>()
	let initialSessionRequest: AbortController | undefined
	let avatarFailed = $state(false)
	let email = $state('')
	let password = $state('')
	let username = $state('')
	let inviteCode = $state('')
	let authMode = $state<'login' | 'register'>('login')
	let authBusy = $state(false)
	let authError = $state('')
	let authNotice = $state('')
	let passwordOpen = $state(false)
	let passwordBusy = $state(false)
	let currentPassword = $state('')
	let newPassword = $state('')
	let confirmPassword = $state('')
	let usernameOpen = $state(false)
	let usernameBusy = $state(false)
	let newUsername = $state('')
	let ui = $derived(wikiUi(getLocale()))
	let currentViewer: WikiViewer = $derived(viewer ?? page.data.viewer ?? anonymousViewer)
	let session = $derived(currentViewer.session)
	let avatarKey = $derived(JSON.stringify([session?.userId, session?.avatarUrl]))

	onMount(() => {
		// Keep the SSR viewer as a fallback, but don't follow page data after hydration.
		viewer = page.data.viewer ?? anonymousViewer
		const request = new AbortController()
		initialSessionRequest = request
		void refreshSession(request.signal)
		return () => request.abort()
	})

	function updateViewer(next: WikiViewer) {
		if (next.session?.userId !== session?.userId || next.session?.avatarUrl !== session?.avatarUrl) {
			avatarFailed = false
		}
		viewer = next
	}

	function commitViewer(next: WikiViewer) {
		// A GET started before this mutation must not restore the old session.
		initialSessionRequest?.abort()
		updateViewer(next)
	}

	async function refreshSession(signal: AbortSignal) {
		try {
			const response = await fetch(resolve('/api/auth/session'), { cache: 'no-store', signal })
			if (!response.ok) return
			const result = await response.json() as WikiViewer
			if (!signal.aborted) updateViewer(result)
		} catch { /* Reading remains available without an authentication server. */ }
	}

	async function refreshPermissions() {
		try {
			await refreshAll()
			return true
		} catch {
			authError = ui.permissionsRefreshFailed
			return false
		}
	}

	function focusAccountButton() {
		document.getElementById('community-account')?.focus()
	}

	function closeAccount() {
		accountOpen = false
		resetPasswordForm()
		resetUsernameForm()
		focusAccountButton()
	}

	function validateCredentials(requireInvite: boolean) {
		if (!isAllowedEmail(email)) { authError = ui.emailInvalid; return false }
		if (password.length < 8) { authError = ui.passwordShort; return false }
		if (requireInvite && (username.trim().length < 2 || username.trim().length > 32)) {
			authError = ui.usernameInvalid
			return false
		}
		if (requireInvite && !inviteCode.trim()) { authError = ui.inviteInvalid; return false }
		return true
	}

	async function responseError(response: Response, signingIn = false) {
		if (signingIn && response.status === 401) return ui.credentialsRejected
		if (signingIn && response.status === 429) return ui.authRateLimited
		const result = await response.json().catch(() => null) as { message?: unknown } | null
		return typeof result?.message === 'string' && result.message.trim() ? result.message : ui.error
	}

	function resetPasswordForm() {
		passwordOpen = false
		passwordBusy = false
		currentPassword = ''
		newPassword = ''
		confirmPassword = ''
	}

	function togglePasswordForm() {
		passwordOpen = !passwordOpen
		usernameOpen = false
		currentPassword = ''
		newPassword = ''
		confirmPassword = ''
		authError = ''
		authNotice = ''
	}

	function resetUsernameForm() {
		usernameOpen = false
		usernameBusy = false
		newUsername = ''
	}

	function toggleUsernameForm() {
		usernameOpen = !usernameOpen
		passwordOpen = false
		newUsername = session?.username ?? ''
		authError = ''
		authNotice = ''
	}

	async function submitUsernameChange(event: SubmitEvent) {
		event.preventDefault()
		if (usernameBusy) return
		authError = ''
		authNotice = ''
		const next = newUsername.replace(/\s+/g, ' ').trim()
		if (next.length < 2 || next.length > 32) { authError = ui.usernameInvalid; return }
		usernameBusy = true
		try {
			const response = await fetch(resolve('/api/auth/username'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ username: next })
			})
			if (!response.ok) {
				authError = response.status === 409 ? ui.usernameTaken : await responseError(response)
				return
			}
			const result = await response.json() as { username?: unknown }
			if (typeof result.username !== 'string') { authError = ui.error; return }
			commitViewer({
				...currentViewer,
				session: session ? { ...session, username: result.username } : null
			})
			resetUsernameForm()
			authNotice = ui.usernameChanged
			await refreshPermissions()
		} catch { authError = ui.error }
		finally { usernameBusy = false }
	}

	async function submitPasswordChange(event: SubmitEvent) {
		event.preventDefault()
		if (passwordBusy) return
		authError = ''
		authNotice = ''
		if (newPassword.length < 8) { authError = ui.passwordShort; return }
		if (newPassword !== confirmPassword) { authError = ui.passwordMismatch; return }
		passwordBusy = true
		try {
			const response = await fetch(resolve('/api/auth/password'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ currentPassword, newPassword })
			})
			if (!response.ok) {
				authError = response.status === 401 ? ui.passwordWrong
					: response.status === 429 ? ui.authRateLimited
					: await responseError(response)
				return
			}
			resetPasswordForm()
			authNotice = ui.passwordChanged
		} catch { authError = ui.error }
		finally { passwordBusy = false }
	}

	async function submitCredentials(event: SubmitEvent) {
		event.preventDefault()
		const form = event.currentTarget as HTMLFormElement
		if (authBusy) return
		authError = ''
		authNotice = ''
		const registering = authMode === 'register'
		if (!validateCredentials(registering)) return
		authBusy = true
		try {
			const response = await fetch(resolve(registering ? '/api/auth/register' : '/api/auth/login'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(registering ? { email, password, username, inviteCode } : { email, password })
			})
			if (!response.ok) {
				authError = await responseError(response, !registering)
				return
			}
			const result = await response.json() as WikiViewer | null
			if (!result?.session || !Array.isArray(result.permissions)) {
				authError = ui.error
				return
			}
			commitViewer(result)
			authNotice = registering ? ui.registered : ui.signedIn
			authMode = 'login'
			password = ''
			username = ''
			inviteCode = ''
			resetPasswordForm()
			resetUsernameForm()
			// Return focus to the trigger if the focused form control is being removed.
			if (accountOpen && (form.contains(document.activeElement) || document.activeElement === document.body)) {
				focusAccountButton()
			}
			await refreshPermissions()
		} catch { authError = ui.error }
		finally { authBusy = false }
	}

	async function signOut(event: MouseEvent) {
		if (authBusy) return
		const button = event.currentTarget
		authBusy = true
		authError = ''
		authNotice = ''
		try {
			const response = await fetch(resolve('/api/auth/session'), { method: 'DELETE' })
			if (!response.ok) {
				authError = await responseError(response)
				return
			}
			commitViewer(anonymousViewer)
			authMode = 'login'
			email = ''
			password = ''
			username = ''
			inviteCode = ''
			resetPasswordForm()
			resetUsernameForm()
			if (accountOpen && (document.activeElement === document.body || document.activeElement === button)) focusAccountButton()
			if (await refreshPermissions() && accountOpen) closeAccount()
		} catch { authError = ui.error }
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
	if (event.key === 'Escape' && accountOpen) closeAccount()
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
			<button id="community-account" type="button" class="flex max-w-full items-center gap-1.5 whitespace-nowrap rounded border border-line px-2 py-1 text-xs text-link hover:text-gold"
				aria-label={session?.username ?? ui.signIn} aria-expanded={accountOpen} aria-controls={accountOpen ? 'community-account-panel' : undefined} onclick={() => (accountOpen = !accountOpen)}>
				{#if session}
					{#key avatarKey}
						{#if session.avatarUrl && !avatarFailed}
							<img src={session.avatarUrl} alt="" referrerpolicy="no-referrer" class="size-5 shrink-0 rounded-full object-cover" onerror={() => (avatarFailed = true)} />
						{:else}
							<span aria-hidden="true" class="grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 font-bold text-ink">{Array.from(session.username.trim())[0]?.toUpperCase() ?? '?'}</span>
						{/if}
					{/key}
					<span class="truncate">{session.username}</span>
				{:else}
					{ui.signIn}
				{/if}
			</button>
			{#if accountOpen}
				<div id="community-account-panel" class="absolute right-0 top-full z-70 mt-2 max-h-[calc(100dvh-var(--header-height)-1rem)] w-[min(19rem,calc(100vw-1.5rem))] overflow-y-auto rounded border border-line bg-surface p-4 shadow-xl max-[620px]:fixed max-[620px]:right-3 max-[620px]:top-(--header-height)" role="region" aria-label={ui.account}>
					<div class="sticky top-0 z-10 bg-surface">
						<div role="status" aria-atomic="true">
							{#if authNotice}<p class="mb-3 rounded border border-green-300/40 bg-green-950/40 px-3 py-2 text-sm text-green-300">{authNotice}</p>{/if}
						</div>
						<div role="alert" aria-atomic="true">
							{#if authError}<p class="mb-3 rounded border border-red-300/50 bg-red-950/40 px-3 py-2 text-sm font-medium text-red-300">{authError}</p>{/if}
						</div>
					</div>
					<div class="space-y-3">
						{#if session}
							<p class="break-words text-sm">{session.username}</p>
							<div class="flex flex-wrap items-center gap-3 text-sm">
								<button class="text-link" type="button" disabled={usernameBusy} onclick={toggleUsernameForm}>{ui.changeUsername}</button>
								<button class="text-link" type="button" disabled={passwordBusy} onclick={togglePasswordForm}>{ui.changePassword}</button>
								<button class="text-link" type="button" disabled={authBusy || passwordBusy || usernameBusy} onclick={signOut}>{ui.signOut}</button>
							</div>
							{#if usernameOpen}
								<form class="space-y-2" onsubmit={submitUsernameChange}>
									<label class="block text-xs">{ui.username}<input class="mt-1 w-full rounded border border-line bg-black/30 p-2" name="newUsername" bind:value={newUsername} required minlength="2" maxlength="32" autocomplete="nickname" /></label>
									<p class="text-xs text-muted">{ui.usernameHint}</p>
									<div class="flex items-center gap-3">
										<button type="submit" class="rounded bg-link px-3 py-1 text-sm text-black" disabled={usernameBusy}>{ui.changeUsername}</button>
										<button type="button" class="text-xs text-link" onclick={toggleUsernameForm}>{ui.cancel}</button>
									</div>
								</form>
							{/if}
							{#if passwordOpen}
								<form class="space-y-2" onsubmit={submitPasswordChange}>
									<label class="block text-xs">{ui.currentPassword}<input class="mt-1 w-full rounded border border-line bg-black/30 p-2" name="currentPassword" type="password" bind:value={currentPassword} required maxlength="128" autocomplete="current-password" /></label>
									<label class="block text-xs">{ui.newPassword}<input class="mt-1 w-full rounded border border-line bg-black/30 p-2" name="newPassword" type="password" bind:value={newPassword} required minlength="8" maxlength="128" autocomplete="new-password" /></label>
									<label class="block text-xs">{ui.confirmPassword}<input class="mt-1 w-full rounded border border-line bg-black/30 p-2" name="confirmPassword" type="password" bind:value={confirmPassword} required minlength="8" maxlength="128" autocomplete="new-password" /></label>
									<div class="flex items-center gap-3">
										<button type="submit" class="rounded bg-link px-3 py-1 text-sm text-black" disabled={passwordBusy}>{ui.changePassword}</button>
										<button type="button" class="text-xs text-link" onclick={togglePasswordForm}>{ui.cancel}</button>
									</div>
								</form>
							{/if}
						{:else}
							<form class="space-y-3" onsubmit={submitCredentials}>
								{#if authMode === 'register'}
									<label class="block text-xs">{ui.username}<input class="mt-1 w-full rounded border border-line bg-black/30 p-2" name="username" bind:value={username} required minlength="2" maxlength="32" autocomplete="nickname" /></label>
									<p class="text-xs text-muted">{ui.usernameHint}</p>
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
							<button type="button" class="text-xs text-link" disabled={authBusy} onclick={() => { authMode = authMode === 'login' ? 'register' : 'login'; authError = ''; authNotice = ''; inviteCode = '' }}>
								{authMode === 'login' ? ui.createAccount : ui.haveAccount}
							</button>
						{/if}
						<button type="button" class="text-xs text-link" onclick={closeAccount}>{ui.close}</button>
					</div>
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
