<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages';

	const wikiLinks = [
		{
			href: 'https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Cards_List',
			label: m.nav_cards()
		},
		{ href: 'https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Buffs', label: m.nav_buffs() },
		{ href: 'https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Debuffs', label: m.nav_debuffs() },
		{ href: 'https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Keywords', label: m.nav_keywords() }
	];
</script>

<footer class="site-footer">
	<div class="wrap footer-inner">
		<div class="footer-brand">
			<p class="footer-title">{m.site_name()}</p>
			<p>{m.footer_blurb()}</p>
		</div>

		<nav class="footer-nav" aria-label={m.footer_nav()}>
			<a href={resolve('/cards')}>{m.nav_cards()}</a>
			<a href={resolve('/keywords')}>{m.nav_keywords()}</a>
			<a href={resolve('/buffs')}>{m.nav_buffs()}</a>
			<a href={resolve('/debuffs')}>{m.nav_debuffs()}</a>
			<a href={resolve('/tools')}>{m.nav_tools()}</a>
		</nav>

		<div class="footer-wiki">
			<p class="footer-label">{m.wiki_reference()}</p>
			{#each wikiLinks as link (link.href)}
				<a href={link.href} target="_blank" rel="noreferrer">{link.label} ↗</a>
			{/each}
		</div>
	</div>

	<div class="wrap footer-bottom">
		<p>{m.footer_disclaimer()}</p>
		<p class="mono">{m.built_with()}</p>
	</div>
</footer>

<style>
	.site-footer {
		max-width: var(--page-max);
		margin: clamp(24px, 4vw, 48px) auto 24px;
		border: 18px solid transparent;
		border-image: url('/images/tooltip-border.png') 22 fill / 18px / 0 stretch;
		background: transparent;
		filter: drop-shadow(8px 9px 2px rgba(0, 0, 0, 0.36));
	}

	.footer-inner {
		display: grid;
		grid-template-columns: minmax(0, 1.5fr) auto auto;
		gap: clamp(28px, 5vw, 72px);
		padding-top: 34px;
		padding-bottom: 30px;
	}

	.footer-title {
		font-family: var(--font-display);
		font-size: 1.02rem;
		color: var(--gold);
	}

	.footer-brand > p:last-child {
		margin-top: 8px;
		max-width: 42ch;
		color: var(--muted);
		font-size: 0.78rem;
		line-height: 1.6;
	}

	.footer-nav {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.footer-nav a,
	.footer-wiki a {
		color: var(--link);
		font-size: 0.8rem;
		transition: color 0.18s ease;
	}

	.footer-nav a:hover,
	.footer-wiki a:hover {
		color: var(--gold);
	}

	.footer-label {
		margin-bottom: 8px;
		font-family: var(--font-mono);
		font-size: 0.55rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.footer-wiki {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.footer-bottom {
		display: flex;
		justify-content: space-between;
		gap: 20px;
		padding-top: 16px;
		padding-bottom: 22px;
		border-top: 1px solid var(--line);
		font-family: var(--font-mono);
		font-size: 0.55rem;
		letter-spacing: 0.04em;
		color: var(--muted);
	}

	@media (max-width: 760px) {
		.footer-inner {
			grid-template-columns: 1fr 1fr;
			gap: 24px;
		}

		.footer-brand {
			grid-column: 1 / -1;
		}

		.footer-bottom {
			flex-direction: column;
			gap: 6px;
		}
	}
</style>
