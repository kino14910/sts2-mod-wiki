<script lang="ts">
	import type { Snippet } from "svelte";
	import { page } from "$app/state";
	import { entityHref, type EntityRef } from "#lib/entities";
	import { findGameEntity } from "#lib/data/entities";
	import HoverTooltip from "#lib/components/HoverTooltip.svelte";
	import EntityTooltip from "#lib/components/EntityTooltip.svelte";
	import WikiIcon from "#lib/components/WikiIcon.svelte";
	import { cardWikiHref, type WikiEntry } from "#lib/data/power-wiki";
	import { isSelfLink } from "#lib/data/wiki-links";
	import { resolveIconSrc } from "#lib/data/icon-registry";

	let {
		entry,
		ref,
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
		ref?: EntityRef;
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
		return {
			name: text ?? "",
			kind:
				ref.type === "card" ||
				ref.type === "relic" ||
				ref.type === "potion"
					? ref.type
					: "power",
			id: ref.id,
			description: "",
			tooltip: tooltip ?? "",
			href: href ?? entityHref(ref),
		};
	});

	let label = $derived(text ?? resolved?.name ?? "");
	let link = $derived(
		href !== undefined
			? href
			: (resolved?.href ??
					(resolved?.kind === "card" ? cardWikiHref(label) : null)),
	);
	let tip = $derived(tooltip ?? resolved?.tooltip);

	let entityRef = $derived.by<EntityRef | null>(() => {
		if (ref) return ref;
		if (
			resolved &&
			(resolved.kind === "card" || resolved.kind === "relic" || resolved.kind === "potion") &&
			resolved.id
		) {
			return { type: resolved.kind, id: resolved.id };
		}
		return null;
	});
	let entity = $derived(entityRef ? findGameEntity(entityRef) : null);
	let isEntityKind = $derived(
		!!entity && (entity.kind === "card" || entity.kind === "relic" || entity.kind === "potion")
	);
	let useEntityTip = $derived(isEntityKind);

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
			const ref: EntityRef = { type: kind, id: resolved.id ?? "" };
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
