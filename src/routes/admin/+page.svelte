<script lang="ts">
	import { resolve } from '$app/paths'
	import { onMount } from 'svelte'
	import DiffView from '#lib/components/wiki/DiffView.svelte'
	import { m } from '#lib/paraglide/messages'
	import { getLocale } from '#lib/paraglide/runtime'
	import { wikiUi } from '#lib/wiki-article'
	import type { ProposalView } from '#lib/wiki-collaboration'

	interface User {
		id: string
		username: string
		email: string | null
		role: 'user' | 'trusted' | 'moderator' | 'admin'
		status: string
		createdAt: string
	}
	type AssignableRole = 'user' | 'trusted' | 'moderator'

	const ui = wikiUi(getLocale())
	let users = $state<User[]>([])
	let query = $state('')
	let busy = $state(false)
	let error = $state('')
	let pending = $state<ProposalView[]>([])
	let pendingError = $state('')
	let pendingNotice = $state('')
	let pendingBusy = $state('')
	let reviewNote = $state('')
	let openDiffId = $state('')

	onMount(() => { void loadUsers(); void loadPending() })

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

	async function loadPending() {
		try {
			pending = (await api(`${resolve('/api/wiki/proposals')}?status=pending`)).items
			pendingError = ''
		} catch { pendingError = ui.adminLoadFailed }
	}

	async function review(proposal: ProposalView, decision: 'approve' | 'reject') {
		pendingBusy = proposal.id
		pendingError = ''
		pendingNotice = ''
		try {
			const response = await fetch(`${resolve('/api/wiki/proposals')}/${encodeURIComponent(proposal.id)}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				cache: 'no-store',
				body: JSON.stringify({ decision, note: reviewNote })
			})
			const body = (await response.json().catch(() => null)) as { message?: string; status?: string } | null
			if (!response.ok) throw new Error(body?.message ?? ui.error)
			const conflict = body?.status === 'conflict'
			openDiffId = ''
			await loadPending()
			if (conflict) pendingError = ui.conflict
			else pendingNotice = decision === 'approve' ? m.wiki_review_approved() : m.wiki_review_rejected()
		} catch (cause) {
			pendingError = cause instanceof Error ? cause.message : ui.error
		} finally {
			pendingBusy = ''
		}
	}

	async function changeRole(user: User, select: HTMLSelectElement) {
		const role = select.value as AssignableRole
		if (role === user.role) return
		if (!confirm(ui.adminRoleConfirm)) { select.value = user.role; return }
		busy = true
		try {
			await api(`${resolve('/api/admin/users')}/${encodeURIComponent(user.id)}/role`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ role })
			})
			await loadUsers()
		} catch (cause) {
			select.value = user.role
			error = cause instanceof Error ? cause.message : ui.error
		}
		finally { busy = false }
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
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h2 class="text-lg font-semibold text-ink">{ui.adminPending} ({pending.length})</h2>
			<button class="rounded border border-line px-3 py-1 text-sm text-link" onclick={loadPending}>{ui.refresh}</button>
		</div>
		{#if pendingError}<p role="alert" class="rounded border border-red-500/50 bg-red-950/40 p-3 text-sm text-red-200">{pendingError}</p>{/if}
		{#if pendingNotice}<p role="status" class="rounded border border-emerald-500/50 bg-emerald-950/40 p-3 text-sm text-emerald-200">{pendingNotice}</p>{/if}
		<label class="block text-xs text-ink-dim">
			{m.wiki_review_note()}
			<input class="mt-1 w-full max-w-sm rounded border border-line bg-black/30 p-2 text-sm text-ink" type="text" maxlength="500" bind:value={reviewNote} />
		</label>
		{#if pending.length === 0}
			<p class="text-sm text-ink-dim">{m.wiki_review_empty()}</p>
		{:else}
			<ul class="space-y-3">
				{#each pending as proposal (proposal.id)}
					<li class="rounded border border-line bg-black/20 p-3 text-sm">
						<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
							<span class="font-semibold text-link">{proposal.sectionKey}</span>
							<span class="text-ink">{proposal.submittedByName}</span>
							<time class="text-xs text-ink-dim" datetime={proposal.createdAt}>{formatTime(proposal.createdAt)}</time>
							<span class="text-xs text-ink-dim">v{proposal.baseVersion}</span>
						</div>
						{#if proposal.summary}<p class="mt-1 text-ink-dim">{proposal.summary}</p>{/if}
						{#if proposal.diff}
							<div class="mt-2 flex flex-wrap items-center gap-3">
								<button class="text-xs text-link hover:underline" onclick={() => { openDiffId = openDiffId === proposal.id ? '' : proposal.id }}>
									{openDiffId === proposal.id ? ui.hide : m.wiki_history_diff()}
								</button>
							</div>
							{#if openDiffId === proposal.id}
								<div class="mt-2"><DiffView diff={proposal.diff} /></div>
							{/if}
						{/if}
						<div class="mt-3 flex flex-wrap gap-2">
							<button
								class="rounded border border-line px-3 py-1 text-sm text-link disabled:opacity-50"
								disabled={pendingBusy !== ''}
								onclick={() => review(proposal, 'approve')}
							>
								{m.wiki_review_approve()}
							</button>
							<button
								class="rounded border border-line px-3 py-1 text-sm text-link disabled:opacity-50"
								disabled={pendingBusy !== ''}
								onclick={() => review(proposal, 'reject')}
							>
								{m.wiki_review_reject()}
							</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

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
					<tr><th class="p-2">Name</th><th class="p-2">Email</th><th class="p-2">{ui.adminRole}</th><th class="p-2">{ui.adminStatus}</th><th class="p-2">{ui.adminJoined}</th></tr>
				</thead>
				<tbody>
					{#each users as user (user.id)}
						<tr class="border-t border-line">
							<td class="p-2 text-ink">{user.username}</td>
							<td class="p-2 text-ink-dim">{user.email ?? '—'}</td>
							<td class="p-2">
								{#if user.role === 'admin'}
									<span class="font-mono text-link">admin</span>
								{:else}
									<select
										class="rounded border border-line bg-black/30 px-1.5 py-0.5 text-xs text-ink disabled:opacity-50"
										value={user.role}
										disabled={busy}
										aria-label={ui.adminRole}
										onchange={(event) => changeRole(user, event.currentTarget)}
									>
										<option value="user">{ui.adminRoleUser}</option>
										<option value="trusted">{ui.adminRoleTrusted}</option>
										<option value="moderator">{ui.adminRoleModerator}</option>
									</select>
								{/if}
							</td>
							<td class="p-2 text-ink-dim">{user.status}</td>
							<td class="p-2 text-ink-dim">{formatTime(user.createdAt)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if users.length === 0}<p class="p-2 text-sm text-ink-dim">{ui.adminNoUsers}</p>{/if}
		</div>
	</section>
</main>
