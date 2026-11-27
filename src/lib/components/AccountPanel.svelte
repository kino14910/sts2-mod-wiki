<script lang="ts">
	import { resolve } from '$app/paths'
	import { refreshAll } from '$app/navigation'
	import { isAllowedEmail } from '#lib/email-domain'
	import type { wikiUi } from '#lib/wiki-article'
	import type { WikiViewer } from '#lib/wiki-collaboration'
	import SessionAvatar from './SessionAvatar.svelte'

	let { viewer, ui, onCommit, onClose }: {
		viewer: WikiViewer
		ui: ReturnType<typeof wikiUi>
		onCommit: (next: WikiViewer) => void
		onClose: () => void
	} = $props()

	let session = $derived(viewer.session)
	let authMode = $state<'login' | 'register'>('login')
	let email = $state('')
	let password = $state('')
	let username = $state('')
	let authBusy = $state(false)
	let authError = $state('')
	let authNotice = $state('')
	let usernameOpen = $state(false)
	let usernameBusy = $state(false)
	let newUsername = $state('')
	let passwordOpen = $state(false)
	let passwordBusy = $state(false)
	let currentPassword = $state('')
	let newPassword = $state('')
	let confirmPassword = $state('')

	const inputClass = 'mt-1 w-full rounded border border-line bg-black/30 px-2.5 py-1.5 text-sm text-ink transition-colors duration-160 focus:border-link'
	const rowButtonClass = 'flex w-full items-center justify-between gap-2 rounded border border-line bg-surface-2 px-2.5 py-1.5 text-[0.8rem] text-ink-dim transition-colors duration-160 hover:border-line-strong hover:text-ink disabled:opacity-45'
	const submitClass = 'rounded bg-link px-3 py-1.5 text-sm font-semibold text-black transition-[filter,opacity] duration-160 hover:brightness-110 disabled:opacity-45'

	function focusAccountButton() {
		document.getElementById('community-account')?.focus()
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

	function validateCredentials(registering: boolean) {
		if (!isAllowedEmail(email)) { authError = ui.emailInvalid; return false }
		if (password.length < 8) { authError = ui.passwordShort; return false }
		if (registering && (username.trim().length < 2 || username.trim().length > 32)) {
			authError = ui.usernameInvalid
			return false
		}
		return true
	}

	async function responseError(response: Response, signingIn = false) {
		if (signingIn && response.status === 401) return ui.credentialsRejected
		if (signingIn && response.status === 429) return ui.authRateLimited
		const result = await response.json().catch(() => null) as { message?: unknown } | null
		return typeof result?.message === 'string' && result.message.trim() ? result.message : ui.error
	}

	function toggleUsernameForm() {
		usernameOpen = !usernameOpen
		passwordOpen = false
		newUsername = session?.username ?? ''
		authError = ''
		authNotice = ''
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

	function switchMode() {
		authMode = authMode === 'login' ? 'register' : 'login'
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
			onCommit({
				...viewer,
				session: session ? { ...session, username: result.username } : null
			})
			usernameOpen = false
			newUsername = ''
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
			passwordOpen = false
			currentPassword = ''
			newPassword = ''
			confirmPassword = ''
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
				body: JSON.stringify(registering ? { email, password, username } : { email, password })
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
			onCommit(result)
			authNotice = registering ? ui.registered : ui.signedIn
			authMode = 'login'
			password = ''
			username = ''
			// Return focus to the trigger if the focused form control is being removed.
			if (form.contains(document.activeElement) || document.activeElement === document.body) {
				focusAccountButton()
			}
			await refreshPermissions()
		} catch { authError = ui.error }
		finally { authBusy = false }
	}

	async function signOut() {
		if (authBusy) return
		authBusy = true
		authError = ''
		authNotice = ''
		try {
			const response = await fetch(resolve('/api/auth/session'), { method: 'DELETE' })
			if (!response.ok) {
				authError = await responseError(response)
				return
			}
			onCommit({ session: null, permissions: [] })
			email = ''
			password = ''
			username = ''
			if (await refreshPermissions()) onClose()
		} catch { authError = ui.error }
		finally { authBusy = false }
	}
</script>

<div
	id="community-account-panel"
	class="account-panel absolute right-0 top-full z-70 mt-2 max-h-[calc(100dvh-var(--header-height)-1rem)] w-[min(19rem,calc(100vw-1.5rem))] overflow-y-auto rounded-md border-2 border-tooltip-border p-4 [background:color-mix(in_srgb,var(--tooltip-bg)_96%,transparent)] backdrop-blur-md [box-shadow:0_12px_32px_rgba(0,0,0,0.5)] max-[620px]:fixed max-[620px]:right-3 max-[620px]:top-(--header-height)"
	role="region"
	aria-label={ui.account}
>
	<div class="mb-3 flex items-center justify-between gap-2 border-b border-line pb-2.5">
		<span class="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-gold">{ui.account}</span>
		<button
			type="button"
			class="grid size-6 shrink-0 place-items-center rounded text-muted transition-colors duration-160 hover:bg-surface-2 hover:text-ink"
			aria-label={ui.close}
			onclick={onClose}
		>
			<svg class="size-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
				<path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
			</svg>
		</button>
	</div>

	<div role="status" aria-atomic="true">
		{#if authNotice}<p class="mb-3 rounded border border-positive/40 bg-positive/10 px-3 py-2 text-xs text-positive">{authNotice}</p>{/if}
	</div>
	<div role="alert" aria-atomic="true">
		{#if authError}<p class="mb-3 rounded border border-red/50 bg-red/10 px-3 py-2 text-xs font-medium text-red">{authError}</p>{/if}
	</div>

	{#if session}
		<div class="space-y-3">
			<div class="flex items-center gap-2.5">
				<SessionAvatar session={session} class="size-9 text-base" />
				<p class="min-w-0 truncate font-display text-[1rem] font-semibold text-gold [text-shadow:2px_1px_0_rgba(0,0,0,0.45)]">{session.username}</p>
			</div>
			<div class="grid gap-1.5">
				<button type="button" class={rowButtonClass} disabled={usernameBusy} aria-expanded={usernameOpen} onclick={toggleUsernameForm}>
					{ui.changeUsername}
					<span aria-hidden="true" class="font-mono text-xs text-muted">{usernameOpen ? '−' : '+'}</span>
				</button>
				{#if usernameOpen}
					<form class="space-y-2 rounded border border-line bg-black/20 p-2.5" onsubmit={submitUsernameChange} aria-busy={usernameBusy}>
						<label class="block text-xs text-ink-dim">{ui.username}<input class={inputClass} name="newUsername" bind:value={newUsername} required minlength="2" maxlength="32" autocomplete="nickname" /></label>
						<p class="text-[0.68rem] text-muted">{ui.usernameHint}</p>
						<div class="flex items-center gap-3">
							<button type="submit" class={submitClass} disabled={usernameBusy}>{ui.changeUsername}</button>
							<button type="button" class="text-xs text-link transition-colors duration-160 hover:text-gold" onclick={toggleUsernameForm}>{ui.cancel}</button>
						</div>
					</form>
				{/if}
				<button type="button" class={rowButtonClass} disabled={passwordBusy} aria-expanded={passwordOpen} onclick={togglePasswordForm}>
					{ui.changePassword}
					<span aria-hidden="true" class="font-mono text-xs text-muted">{passwordOpen ? '−' : '+'}</span>
				</button>
				{#if passwordOpen}
					<form class="space-y-2 rounded border border-line bg-black/20 p-2.5" onsubmit={submitPasswordChange} aria-busy={passwordBusy}>
						<label class="block text-xs text-ink-dim">{ui.currentPassword}<input class={inputClass} name="currentPassword" type="password" bind:value={currentPassword} required maxlength="128" autocomplete="current-password" /></label>
						<label class="block text-xs text-ink-dim">{ui.newPassword}<input class={inputClass} name="newPassword" type="password" bind:value={newPassword} required minlength="8" maxlength="128" autocomplete="new-password" /></label>
						<label class="block text-xs text-ink-dim">{ui.confirmPassword}<input class={inputClass} name="confirmPassword" type="password" bind:value={confirmPassword} required minlength="8" maxlength="128" autocomplete="new-password" /></label>
						<div class="flex items-center gap-3">
							<button type="submit" class={submitClass} disabled={passwordBusy}>{ui.changePassword}</button>
							<button type="button" class="text-xs text-link transition-colors duration-160 hover:text-gold" onclick={togglePasswordForm}>{ui.cancel}</button>
						</div>
					</form>
				{/if}
			</div>
			<button
				type="button"
				class="w-full rounded border border-red/35 bg-red/10 px-2.5 py-1.5 text-[0.8rem] text-red transition-colors duration-160 hover:bg-red/20 disabled:opacity-45"
				disabled={authBusy || passwordBusy || usernameBusy}
				onclick={signOut}
			>
				{ui.signOut}
			</button>
		</div>
	{:else}
		<form class="space-y-2.5" onsubmit={submitCredentials} aria-busy={authBusy}>
			{#if authMode === 'register'}
				<div>
					<label class="block text-xs text-ink-dim">{ui.username}<input class={inputClass} name="username" bind:value={username} required minlength="2" maxlength="32" autocomplete="nickname" /></label>
					<p class="mt-1 text-[0.68rem] text-muted">{ui.usernameHint}</p>
				</div>
			{/if}
			<div>
				<label class="block text-xs text-ink-dim">{ui.qqEmail}<input class={inputClass} name="email" type="email" bind:value={email} required maxlength="64" pattern="[^@\s]+@[qQ][qQ]\.com" title={ui.emailHint} autocomplete="email" /></label>
				<p class="mt-1 text-[0.68rem] text-muted">{ui.emailHint}</p>
			</div>
			<label class="block text-xs text-ink-dim">{ui.password}<input class={inputClass} name="password" type="password" bind:value={password} required minlength="8" maxlength="128" autocomplete={authMode === 'login' ? 'current-password' : 'new-password'} /></label>
			<button type="submit" class="{submitClass} w-full" disabled={authBusy}>{authMode === 'login' ? ui.signIn : ui.register}</button>
		</form>
		<div class="mt-3 border-t border-line pt-2.5 text-center">
			<button type="button" class="text-xs text-link transition-colors duration-160 hover:text-gold disabled:opacity-45" disabled={authBusy} onclick={switchMode}>
				{authMode === 'login' ? ui.createAccount : ui.haveAccount}
			</button>
		</div>
	{/if}
</div>

<style>
	.account-panel {
		animation: account-panel-in 0.18s var(--ease);
		transform-origin: top right;
		scrollbar-width: thin;
		scrollbar-color: var(--line-strong) transparent;
	}

	.account-panel::-webkit-scrollbar {
		width: 8px;
	}

	.account-panel::-webkit-scrollbar-track {
		background: transparent;
	}

	.account-panel::-webkit-scrollbar-thumb {
		border-radius: 4px;
		background: var(--line-strong);
	}

	.account-panel::-webkit-scrollbar-thumb:hover {
		background: var(--line-bright);
	}

	@keyframes account-panel-in {
		from {
			opacity: 0;
			transform: translateY(-4px) scale(0.98);
		}
	}
</style>