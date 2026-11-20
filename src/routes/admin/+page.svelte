<script lang="ts">
	import { resolve } from '$app/paths'
	import { onMount } from 'svelte'
	import { getLocale } from '#lib/paraglide/runtime'
	import { wikiUi } from '#lib/wiki-article'

	interface User {
		id: string
		username: string
		email: string | null
		role: 'user' | 'trusted' | 'moderator' | 'admin'
		status: string
		createdAt: string
	}
	interface Invite {
		id: string
		createdBy: string
		createdAt: number
		expiresAt: number
		maxUses: number
		usedCount: number
		revokedAt: number | null
		status: string
	}
	interface Redemption {
		userId: string
		username: string | null
		email: string | null
		createdAt: string
	}

	const ui = wikiUi(getLocale())
	let users = $state<User[]>([])
	let invites = $state<Invite[]>([])
	let query = $state('')
	let count = $state(1)
	let maxUses = $state(1)
	let ttlDays = $state(7)
	let newCodes = $state<string[]>([])
	let usages = $state<Record<string, Redemption[]>>({})
	let busy = $state(false)
	let error = $state('')

	onMount(() => {
		void loadUsers()
		void loadInvites()
	})

	async function api(path: string, init?: RequestInit): Promise<any> {
		const response = await fetch(path, { ...init, cache: 'no-store' })
		if (!response.ok) throw new Error(ui.error)
		return response.json()
	}

	async function loadUsers() {
		try {
			const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''
			users = (await api(`${resolve('/api/admin/users')}${params}`)).users
			error = ''
		} catch { error = ui.adminLoadFailed }
	}

	async function loadInvites() {
		try {
			invites = (await api(resolve('/api/admin/invites'))).invites
			error = ''
		} catch { error = ui.adminLoadFailed }
	}

	async function changeRole(user: User, role: 'user' | 'trusted') {
		if (!confirm(ui.adminRoleConfirm)) return
		busy = true
		try {
			await api(`${resolve('/api/admin/users')}/${encodeURIComponent(user.id)}/role`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ role })
			})
			await loadUsers()
		} catch (cause) { error = cause instanceof Error ? cause.message : ui.error }
		finally { busy = false }
	}

	async function generate() {
		busy = true
		try {
			const result = await api(resolve('/api/admin/invites'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ count, maxUses, ttlDays })
			})
			newCodes = result.invites.map((invite: { code: string }) => invite.code)
			await loadInvites()
			error = ''
		} catch (cause) { error = cause instanceof Error ? cause.message : ui.error }
		finally { busy = false }
	}

	async function revoke(invite: Invite) {
		if (!confirm(ui.adminRevokeConfirm)) return
		busy = true
		try {
			await api(`${resolve('/api/admin/invites')}/${encodeURIComponent(invite.id)}/revoke`, { method: 'POST' })
			await loadInvites()
		} catch (cause) { error = cause instanceof Error ? cause.message : ui.error }
		finally { busy = false }
	}

	async function showUsage(invite: Invite) {
		try {
			const result = await api(`${resolve('/api/admin/invites')}/${encodeURIComponent(invite.id)}`)
			usages = { ...usages, [invite.id]: result.redemptions }
		} catch (cause) { error = cause instanceof Error ? cause.message : ui.error }
	}

	async function copy(code: string) {
		await navigator.clipboard.writeText(code)
	}

	function formatTime(value: number | string) {
		return new Date(value).toLocaleString()
	}
</script>

<svelte:head><title>{ui.admin}</title></svelte:head>

<main class="wrap space-y-8 py-8">
	<h1 class="font-display text-2xl font-bold text-gold">{ui.admin}</h1>
	{#if error}<p role="alert" class="rounded border border-red-500/50 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>{/if}

	<section class="space-y-3 rounded-md border border-line bg-surface p-4">
		<h2 class="text-lg font-semibold text-ink">{ui.adminUsers}</h2>
		<label class="block text-xs text-ink-dim">
			{ui.adminSearch}
			<input class="mt-1 w-full max-w-sm rounded border border-line bg-black/30 p-2 text-sm text-ink" bind:value={query} />
		</label>
		<button class="rounded border border-line px-3 py-1 text-sm text-link" onclick={loadUsers}>{ui.refresh}</button>
		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm">
				<thead class="text-xs text-ink-dim">
					<tr><th class="p-2">Name</th><th class="p-2">Email</th><th class="p-2">{ui.adminRole}</th><th class="p-2">{ui.adminStatus}</th><th class="p-2">{ui.adminJoined}</th><th class="p-2"></th></tr>
				</thead>
				<tbody>
					{#each users as user (user.id)}
						<tr class="border-t border-line">
							<td class="p-2 text-ink">{user.username}</td>
							<td class="p-2 text-ink-dim">{user.email ?? '—'}</td>
							<td class="p-2 font-mono text-link">{user.role}</td>
							<td class="p-2 text-ink-dim">{user.status}</td>
							<td class="p-2 text-ink-dim">{formatTime(user.createdAt)}</td>
							<td class="p-2">
								{#if user.role === 'user' || user.role === 'trusted'}
									<button class="rounded border border-line px-2 py-1 text-xs text-link disabled:opacity-50" disabled={busy}
										onclick={() => changeRole(user, user.role === 'user' ? 'trusted' : 'user')}>
										{user.role === 'user' ? ui.adminToTrusted : ui.adminToUser}
									</button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if users.length === 0}<p class="p-2 text-sm text-ink-dim">{ui.adminNoUsers}</p>{/if}
		</div>
	</section>

	<section class="space-y-3 rounded-md border border-line bg-surface p-4">
		<h2 class="text-lg font-semibold text-ink">{ui.adminInvites}</h2>
		<div class="flex flex-wrap items-end gap-3 text-xs text-ink-dim">
			<label>{ui.adminCount}<input class="ml-1 w-16 rounded border border-line bg-black/30 p-1" type="number" min="1" max="50" bind:value={count} /></label>
			<label>{ui.adminUses}<input class="ml-1 w-16 rounded border border-line bg-black/30 p-1" type="number" min="1" max="100" bind:value={maxUses} /></label>
			<label>{ui.adminDays}<input class="ml-1 w-16 rounded border border-line bg-black/30 p-1" type="number" min="1" max="365" bind:value={ttlDays} /></label>
			<button class="rounded bg-link px-3 py-1 text-sm text-black disabled:opacity-50" disabled={busy} onclick={generate}>{ui.adminGenerate}</button>
		</div>
		{#if newCodes.length > 0}
			<div class="rounded border border-gold/50 bg-black/30 p-3">
				<p class="text-xs text-gold">{ui.adminNewCodes}</p>
				{#each newCodes as code (code)}
					<div class="mt-1 flex items-center gap-2 font-mono text-sm text-ink">
						<span class="break-all">{code}</span>
						<button class="shrink-0 rounded border border-line px-2 py-0.5 text-xs text-link" onclick={() => copy(code)}>{ui.adminCopy}</button>
					</div>
				{/each}
			</div>
		{/if}
		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm">
				<thead class="text-xs text-ink-dim">
					<tr><th class="p-2">ID</th><th class="p-2">{ui.adminStatusLabel}</th><th class="p-2">{ui.adminUses}</th><th class="p-2">Expires</th><th class="p-2"></th></tr>
				</thead>
				<tbody>
					{#each invites as invite (invite.id)}
						<tr class="border-t border-line align-top">
							<td class="max-w-48 break-all p-2 font-mono text-xs text-ink-dim">{invite.id}</td>
							<td class="p-2 text-link">{invite.status}</td>
							<td class="p-2 text-ink">{invite.usedCount} / {invite.maxUses}</td>
							<td class="p-2 text-ink-dim">{formatTime(invite.expiresAt)}</td>
							<td class="p-2">
								<button class="mr-2 rounded border border-line px-2 py-1 text-xs text-link" onclick={() => showUsage(invite)}>{ui.adminUsage}</button>
								{#if invite.status === 'active'}
									<button class="rounded border border-line px-2 py-1 text-xs text-link disabled:opacity-50" disabled={busy} onclick={() => revoke(invite)}>{ui.adminRevoke}</button>
								{/if}
								{#if usages[invite.id]}
									<ul class="mt-2 text-xs text-ink-dim">
										{#each usages[invite.id] as usage (usage.userId)}
											<li>{usage.username ?? usage.email ?? usage.userId} · {formatTime(usage.createdAt)}</li>
										{/each}
									</ul>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if invites.length === 0}<p class="p-2 text-sm text-ink-dim">{ui.adminNoInvites}</p>{/if}
		</div>
	</section>
</main>
