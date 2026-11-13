<script lang="ts">
	import type { Snippet } from "svelte";
	import { page } from "$app/state";
	import { entityHref } from "#lib/entities";
	import { findGameEntity, type ScopedEntityRef } from "#lib/data/entities";
	import { resolvePowerReference } from "#lib/data/power-references";
	import { getLocale } from "#lib/paraglide/runtime";
	import HoverTooltip from "#lib/components/HoverTooltip.svelte";
	import EntityTooltip from "#lib/components/EntityTooltip.svelte";
	import WikiIcon from "#lib/components/WikiIcon.svelte";
	import { cardWikiHref, type WikiEntry } from "#lib/data/power-wiki";
	import { cardIcon, isSelfLink } from "#lib/data/wiki-links";
	import { resolveIconSrc } from "#lib/data/icon-registry";

	let {
		entry,
		ref,
		locale,
		text,
		href,
		tooltip,
		icon = "",
		iconSrc = "",
		iconKind = "power",
		iconLabel = "",
		children,
	}: {
		entry?: WikiEntry;
		ref?: ScopedEntityRef;
		locale?: string;
		text?: string;
		href?: string | null;
		tooltip?: string;
		icon?: string;
		iconSrc?: string;
		iconKind?: "power" | "relic" | "card" | "potion";
		iconLabel?: string;
		children?: Snippet;
	} = $props();

	let resolved = $derived.by<WikiEntry | null>(() => {
		if (entry) return entry;
		if (!ref) return null;
		return resolvePowerReference(ref, locale ?? getLocale());
	});

	let label = $derived(text ?? resolved?.name ?? "");
	let tip = $derived(tooltip ?? resolved?.tooltip);

	let entityRef = $derived.by<ScopedEntityRef | null>(() => {
		if (ref) return ref;
		if (
			resolved &&
			resolved.id
		) {
			return { type: resolved.kind, id: resolved.id, modId: resolved.modId };
		}
		return null;
	});
	let entity = $derived(entityRef ? findGameEntity(entityRef) : null);
	let link = $derived(href === null ? null : entity ? entityHref({
		type: entity.kind, id: entity.data.id, modId: entity.data.mod ?? 'sts2'
	}) : ref ? null : href ?? resolved?.href ?? (resolved?.kind === "card" ? cardWikiHref(label) : null));
	let isEntityKind = $derived(
		!!entity && (entity.kind === "card" || entity.kind === "relic" || entity.kind === "potion")
	);
	let useEntityTip = $derived(isEntityKind && (!locale || locale === getLocale()));

	let hovered = $state(false);
	let tipX = $state(0);
	let tipY = $state(0);
	let tipEl: HTMLElement | undefined = $state();
	let timer: ReturnType<typeof setTimeout> | undefined;

	let iconInfo = $derived.by(
		(): {
			kind: "power" | "relic" | "card" | "potion";
			src: string | null;
			name: string;
		} => {
			if (iconSrc) return { kind: iconKind, src: iconSrc, name: "" };
			if (entity) {
				const src = entity.kind === "card" ? cardIcon(entity.data)
					: entity.kind === "relic" || entity.kind === "potion" ? entity.data.image : entity.data.icon;
				return { kind: entity.kind === "keyword" ? "power" : entity.kind, src: src ?? null, name: "" };
			}
			if (icon)
				return {
					kind: "power",
					src: resolveIconSrc({
						kind: "entity",
						ref: { type: "power", id: "" },
						name: icon,
					}),
					name: icon,
				};
			if (!resolved) return { kind: "power", src: null, name: "" };
			const kind = resolved.kind;
			const ref: ScopedEntityRef = { type: kind, id: resolved.id ?? "", modId: resolved.modId };
			const name = kind === "card" ? label : resolved.name;
			return {
				kind,
				src: resolveIconSrc({ kind: "entity", ref, name }),
				name: kind === "card" ? "" : resolved.name,
			};
		},
	);

	let showIcon = $derived(!!iconInfo.src || !!iconLabel);
	let current = $derived(isSelfLink(page.url.pathname, link));

	function registerTip(element: HTMLElement) {
		tipEl = element;
		return () => {
			if (tipEl === element) tipEl = undefined;
		};
	}

	function place(event: MouseEvent) {
		const rect = tipEl?.getBoundingClientRect();
		const width = rect?.width || 420;
		const height = rect?.height || 160;
		tipX = Math.max(
			8,
			Math.min(event.clientX + 15, window.innerWidth - width - 8),
		);
		tipY = Math.max(
			8,
			Math.min(event.clientY + 15, window.innerHeight - height - 8),
		);
	}

	function enter(event: MouseEvent) {
		if (!tip) return;
		clearTimeout(timer);
		timer = setTimeout(() => {
			hovered = true;
			place(event);
		}, 100);
	}

	function move(event: MouseEvent) {
		if (hovered) place(event);
	}

	function leave() {
		clearTimeout(timer);
		hovered = false;
	}
</script>

{#snippet content()}{#if showIcon}<WikiIcon
			src={iconInfo.src ?? ""}
			label={iconLabel}
		/>{/if}{#if children}{@render children()}{:else}{label}{/if}{/snippet}

{#if link && !current}<a
		class="wiki-card-link text-[#85d2e4] hover:underline [text-underline-thickness:1px] underline-offset-2"
		href={link}
		onmouseenter={enter}
		onmousemove={move}
		onmouseleave={leave}>{@render content()}</a
	>{:else}<span
		class="wiki-card-link wiki-term"
		role="note"
		aria-current={current ? "page" : undefined}
		onmouseenter={enter}
		onmousemove={move}
		onmouseleave={leave}>{@render content()}</span
	>{/if}{#snippet entityTip()}{#if entity}<EntityTooltip {entity} />{/if}{/snippet}<HoverTooltip
	show={hovered && (useEntityTip || !!tip)}
	html={useEntityTip ? "" : tip}
	x={tipX}
	y={tipY}
	{registerTip}
	content={useEntityTip ? entityTip : undefined}
/>
