<script lang="ts">
	import type { MotifName } from '#lib/data/cards';

	let { name, class: className = '' }: { name: MotifName; class?: string } = $props();
</script>

<svg
	class="{className} block"
	viewBox="0 0 120 120"
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if name === 'blade'}
		<path d="M45 77 L86 20 L98 32 L55 85 Z" />
		<path d="M52 80 L91 25" opacity="0.5" />
		<path d="M34 68 L56 90" />
		<path d="M37 91 L27 101" />
		<circle cx="22" cy="106" r="4" />
		<path d="M40 58 L62 80" opacity="0.35" />
	{:else if name === 'flame'}
		<path
			d="M60 12 C67 32 84 40 84 62 C84 83 73 98 60 108 C47 98 36 83 36 62 C36 46 48 43 54 28 C56 39 63 42 67 47 C64 36 61 25 60 12 Z"
		/>
		<path d="M60 52 C63 63 72 68 70 80 C68 90 63 95 60 98 C57 93 51 88 51 79 C51 70 58 66 60 52 Z" opacity="0.55" />
		<path d="M26 34 L31 42 M94 34 L89 42" opacity="0.35" />
	{:else if name === 'crown'}
		<path d="M26 44 L38 22 L50 36 L60 16 L70 36 L82 22 L94 44 V78 H26 Z" />
		<path d="M26 86 H94" opacity="0.6" />
		<circle cx="60" cy="54" r="4" />
		<circle cx="42" cy="60" r="2.5" />
		<circle cx="78" cy="60" r="2.5" />
		<path d="M26 44 L94 44" opacity="0.3" />
	{:else if name === 'star'}
		<path d="M60 10 L69 51 L110 60 L69 69 L60 110 L51 69 L10 60 L51 51 Z" />
		<path d="M60 32 L64 56 L88 60 L64 64 L60 88 L56 64 L32 60 L56 56 Z" opacity="0.45" />
		<circle cx="60" cy="60" r="3" fill="currentColor" stroke="none" />
		<path d="M25 22 L28 30 M95 22 L92 30 M25 98 L28 90 M95 98 L92 90" opacity="0.4" />
	{:else if name === 'moon'}
		<path d="M74 16 A46 46 0 1 0 74 104 A36 36 0 1 1 74 16 Z" />
		<path d="M85 30 L89 40 L99 44 L89 48 L85 58 L81 48 L71 44 L81 40 Z" opacity="0.5" />
		<circle cx="36" cy="28" r="2" fill="currentColor" stroke="none" opacity="0.5" />
	{:else if name === 'skull'}
		<path d="M34 44 C34 25 46 14 60 14 C74 14 86 25 86 44 C86 54 82 60 78 64 V80 H42 V64 C38 60 34 54 34 44 Z" />
		<circle cx="49" cy="48" r="6" />
		<circle cx="71" cy="48" r="6" />
		<path d="M60 56 L55 68 H65 Z" />
		<path d="M47 80 V72 M55 80 V72 M65 80 V72 M73 80 V72" opacity="0.55" />
		<path d="M30 38 L38 42 M90 38 L82 42" opacity="0.35" />
	{:else if name === 'web'}
		<circle cx="60" cy="60" r="18" opacity="0.55" />
		<circle cx="60" cy="60" r="32" opacity="0.4" />
		<circle cx="60" cy="60" r="46" opacity="0.25" />
		<path d="M60 14 V106 M14 60 H106 M28 28 L92 92 M92 28 L28 92" opacity="0.5" />
		<path d="M60 14 L60 60 M60 60 L60 106 M14 60 L60 60 M60 60 L106 60" opacity="0.2" />
	{:else if name === 'orb'}
		<circle cx="60" cy="60" r="42" />
		<circle cx="60" cy="60" r="30" opacity="0.5" />
		<circle cx="60" cy="60" r="18" opacity="0.25" />
		<path d="M66 32 L46 62 H60 L52 88 L76 54 H62 Z" fill="currentColor" fill-opacity="0.25" />
		<circle cx="24" cy="22" r="2.5" fill="currentColor" stroke="none" opacity="0.5" />
		<circle cx="96" cy="98" r="2.5" fill="currentColor" stroke="none" opacity="0.5" />
	{:else if name === 'shard'}
		<path d="M42 94 L52 26 L66 48 L82 18 L92 72 L78 94 Z" />
		<path d="M52 26 L60 66 L92 72 M60 66 L42 94 M60 66 L78 94" opacity="0.45" />
		<path d="M18 44 L24 30 L32 48 L24 58 Z" opacity="0.35" />
	{:else if name === 'gear'}
		<circle cx="60" cy="60" r="30" />
		<circle cx="60" cy="60" r="13" opacity="0.55" />
		<path
			d="M60 18 V30 M60 90 V102 M18 60 H30 M90 60 H102 M30 30 L39 39 M81 81 L90 90 M90 30 L81 39 M39 81 L30 90"
			opacity="0.6"
		/>
		<circle cx="60" cy="60" r="4" fill="currentColor" stroke="none" opacity="0.5" />
	{:else if name === 'eye'}
		<path d="M14 60 Q60 24 106 60 Q60 96 14 60 Z" />
		<circle cx="60" cy="60" r="18" opacity="0.65" />
		<circle cx="60" cy="60" r="7" fill="currentColor" stroke="none" opacity="0.75" />
		<path d="M60 14 V26 M60 94 V106 M24 30 L33 39 M96 30 L87 39" opacity="0.4" />
	{:else if name === 'spiral'}
		<path
			d="M60 60 C60 51 69 51 69 60 C69 73 52 73 52 60 C52 43 77 43 77 60 C77 81 43 81 43 60 C43 35 85 35 85 60 C85 89 35 89 35 60 C35 27 93 27 93 60"
		/>
		<circle cx="60" cy="60" r="3" fill="currentColor" stroke="none" opacity="0.5" />
	{:else if name === 'thorn'}
		<path d="M30 96 C36 72 48 56 66 42 C78 32 88 26 98 24" />
		<path d="M42 74 L30 68 M48 62 L36 54 M56 52 L48 42 M64 44 L60 33 M76 36 L74 26" opacity="0.65" />
		<path d="M30 96 L24 104" opacity="0.4" />
		<circle cx="66" cy="42" r="3" fill="currentColor" stroke="none" opacity="0.5" />
	{:else if name === 'feather'}
		<path d="M28 96 C34 68 54 36 92 22 C96 58 78 82 48 88 C38 90 32 94 28 96 Z" />
		<path d="M28 96 L68 56" opacity="0.7" />
		<path d="M48 76 L44 66 M58 66 L54 55 M68 56 L66 45 M78 46 L78 35" opacity="0.45" />
	{:else if name === 'shield'}
		<path d="M60 12 L96 28 V60 C96 83 80 100 60 109 C40 100 24 83 24 60 V28 Z" />
		<path d="M60 26 V92 M34 44 H86" opacity="0.35" />
		<path d="M60 48 L66 60 L60 72 L54 60 Z" fill="currentColor" fill-opacity="0.2" />
	{/if}
</svg>
