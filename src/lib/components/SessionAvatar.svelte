<script lang="ts">
	import type { WikiViewer } from '#lib/wiki-collaboration'

	let { session, class: className = 'size-5' }: {
		session: NonNullable<WikiViewer['session']>
		class?: string
	} = $props()

	// Track the failed URL instead of a boolean so a new avatar retries automatically.
	let failedSrc = $state<string | null>(null)
	let showImage = $derived(session.avatarUrl !== null && failedSrc !== session.avatarUrl)
	let initial = $derived(Array.from(session.username.trim())[0]?.toUpperCase() ?? '?')
</script>

{#if showImage}
	<img
		src={session.avatarUrl}
		alt=""
		referrerpolicy="no-referrer"
		class="{className} shrink-0 rounded-full object-cover"
		onerror={() => (failedSrc = session.avatarUrl)}
	/>
{:else}
	<span aria-hidden="true" class="{className} grid shrink-0 place-items-center rounded-full bg-surface-2 font-bold text-ink">{initial}</span>
{/if}