<script lang="ts">
	import { colorInfo, rarityInfo, type CardType, type CardView } from '#lib/data/cards';
	import { keywordPlacement, typeName } from '#lib/data/localize';
	import { CHARACTER_ASSETS } from '#lib/data/mods';
	import { frameTintFilterId } from '#lib/frame-tint';
	import GameText from '#lib/components/GameText.svelte';
	import type { GameTextOptions } from '#lib/text/game-text';
	import type { Attachment } from 'svelte/attachments'
	import { cardUiImage } from '#lib/data/card-images'
	import { getLocale } from '#lib/paraglide/runtime'

	const FRAMES: Record<'attack' | 'skill' | 'power' | 'quest', string> = {
		attack: '/images/card_frames/attack.png',
		skill: '/images/card_frames/skill.png',
		power: '/images/card_frames/power.png',
		quest: '/images/card_frames/quest.png'
	};

	const FRAME_TYPE: Record<CardType, keyof typeof FRAMES> = {
		attack: 'attack',
		skill: 'skill',
		power: 'power',
		quest: 'quest',
		status: 'skill',
		curse: 'skill'
	};

	const PORTRAIT_BORDER_TYPE: Record<CardType, 'attack' | 'skill' | 'power'> = {
		attack: 'attack',
		skill: 'skill',
		power: 'power',
		quest: 'skill',
		status: 'skill',
		curse: 'skill'
	};

	const ANCIENT_TEXT_BG: Record<CardType, 'Attack' | 'Skill' | 'Power'> = {
	attack: 'Attack',
	skill: 'Skill',
	power: 'Power',
	quest: 'Skill',
	status: 'Skill',
	curse: 'Skill'
};

	const TITLE_BOX_WIDTH = 210
	const TITLE_MIN_FONT_SIZE = 8
	const TITLE_MAX_FONT_SIZE = 26
	const DESC_MIN_FONT_SIZE = 12
	const DESC_MAX_FONT_SIZE = 21
	const TITLE_ZH_GLYPH_SCALE = 0.95

	function titleFontFamily(useZhFont: boolean) {
		return useZhFont ? '"Noto Sans Mono CJK SC Game"' : '"Kreon Game"'
	}

	function titleTextWidth(
		ctx: CanvasRenderingContext2D,
		text: string,
		fontSize: number,
		useZhFont: boolean
	) {
		ctx.font = `${fontSize}px ${titleFontFamily(useZhFont)}`
		const spacing = useZhFont ? 0 : Math.max(0, [...text].length - 1)
		return ctx.measureText(text).width * (useZhFont ? TITLE_ZH_GLYPH_SCALE : 1) + spacing
	}

	function fittedTitleFontSize(ctx: CanvasRenderingContext2D, text: string, useZhFont: boolean) {
		let min = TITLE_MIN_FONT_SIZE
		let max = TITLE_MAX_FONT_SIZE
		if (titleTextWidth(ctx, text, max, useZhFont) <= TITLE_BOX_WIDTH) return max
		while (min <= max) {
			const middle = min + Math.floor((max - min) / 2)
			if (
				middle === TITLE_MAX_FONT_SIZE ||
				titleTextWidth(ctx, text, middle, useZhFont) > TITLE_BOX_WIDTH
			) {
				max = middle - 1
			} else {
				min = middle + 1
			}
		}
		return Math.min(min, max)
	}

	function cardTitleAutoSize(text: string, useZhFont: boolean): Attachment<HTMLElement> {
		return (node) => {
			const ctx = document.createElement('canvas').getContext('2d')
			let disposed = false
			const apply = (fontSize: number) => {
				if (disposed) return
				const visualSize = fontSize * (useZhFont ? TITLE_ZH_GLYPH_SCALE : 1)
				node.style.setProperty('--title-font-size', `${visualSize / 3}cqw`)
			}
			if (ctx !== null) apply(fittedTitleFontSize(ctx, text, useZhFont))
			document.fonts
				.load(`${TITLE_MAX_FONT_SIZE}px ${titleFontFamily(useZhFont)}`, text)
				.then(() => {
					if (ctx !== null) apply(fittedTitleFontSize(ctx, text, useZhFont))
				})
			return () => {
				disposed = true
			}
		}
	}

	function cardDescriptionAutoSize(): Attachment<HTMLElement> {
		return (node) => {
			let disposed = false
			let frame = 0

			const fit = () => {
				if (disposed) return
				const text = node.querySelector<HTMLElement>('.desc-text')
				if (!text || node.clientWidth === 0 || node.clientHeight === 0) return

				const fits = (fontSize: number) => {
					node.style.setProperty('--desc-font-size', `${fontSize / 3}cqw`)
					return (
						text.scrollHeight <= node.clientHeight + 0.5 &&
						text.scrollWidth <= node.clientWidth + 0.5
					)
				}

				if (fits(DESC_MAX_FONT_SIZE)) return

				let min = DESC_MIN_FONT_SIZE
				let max = DESC_MAX_FONT_SIZE
				let best = DESC_MIN_FONT_SIZE
				while (min <= max) {
					const middle = min + Math.floor((max - min) / 2)
					if (fits(middle)) {
						best = middle
						min = middle + 1
					} else {
						max = middle - 1
					}
				}
				node.style.setProperty('--desc-font-size', `${best / 3}cqw`)
			}

			const schedule = () => {
				cancelAnimationFrame(frame)
				frame = requestAnimationFrame(fit)
			}

			const resizeObserver = new ResizeObserver(schedule)
			resizeObserver.observe(node)
			const mutationObserver = new MutationObserver(schedule)
			mutationObserver.observe(node, { childList: true, characterData: true, subtree: true })
			document.fonts.ready.then(schedule)
			schedule()

			return () => {
				disposed = true
				cancelAnimationFrame(frame)
				resizeObserver.disconnect()
				mutationObserver.disconnect()
			}
		}
	}

	// 原版把诅咒 / 状态 / 任务当作独立稀有度，这里按卡牌类型补上
	const TYPE_TITLE_OUTLINE: Partial<Record<CardType, string>> = {
		curse: '#550b9e',
		status: '#4f522f',
		quest: '#7e3e15'
	};

	let {
		card,
		class: className = '',
		upgraded = false,
		inCombat = false,
		showText = true,
		priority = false,
		useThumb = true
	}: {
		card: CardView
		class?: string
		upgraded?: boolean
		inCombat?: boolean
		showText?: boolean
		priority?: boolean
		useThumb?: boolean
	} = $props()

	let color = $derived(colorInfo(card.color));
	let typeLabel = $derived(typeName(card.type));
	let cost = $derived(card.cost === null ? '—' : card.cost);
	let bannerRarity = $derived(rarityInfo(card.rarity).banner);
	let fullArt = $derived(card.fullArt ?? rarityInfo(card.rarity).fullArt);
	let bannerSrc = $derived(`/images/card_banners/${bannerRarity}.png`);
	let ancientTextBgSrc = $derived(
		`/images/card_frames/ancientTextBg${ANCIENT_TEXT_BG[card.type]}.png`
	);
	let plaqueSrc = $derived(`/images/card_plaques/${bannerRarity}.png`);
	let portraitBorderSrc = $derived(
		`/images/card_portrait_borders/${PORTRAIT_BORDER_TYPE[card.type]}-${bannerRarity}.png`
	);
	let titleOutline = $derived(
		upgraded ? '#1b6131' : (TYPE_TITLE_OUTLINE[card.type] ?? rarityInfo(card.rarity).outline)
	);
	let characterAssets = $derived(CHARACTER_ASSETS[card.color]);
	let frameSrc = $derived.by<string | null>(() => {
		const frames = characterAssets?.cardFrame;
		if (frames === undefined) return FRAMES[FRAME_TYPE[card.type]];
		if (Object.keys(frames).length === 0) return null;
		return frames[card.type] ?? frames[FRAME_TYPE[card.type]] ?? FRAMES[FRAME_TYPE[card.type]];
	});
	let frameFilter = $derived(
		characterAssets?.shader
			? `url(#${frameTintFilterId(card.color)}) drop-shadow(0 10px 20px rgba(0, 0, 0, 0.5))`
			: undefined
	);
	let accent = $derived(characterAssets?.accent ?? color.accent);
	let energyOutline = $derived(characterAssets?.energyOutline ?? color.accent);
	let textOptions = $derived.by<GameTextOptions>(() => ({
		upgraded,
		variables: card.variables,
		baseVariables: card.baseVariables,
		sizeUnit: 'cqw',
		energyIconSrc: characterAssets?.textEnergy,
		secondEnergyIconSrc: characterAssets?.secondTextEnergy,
		inCombat,
		// 缩略图整体位于 <a> 内，内部不能再嵌实体链接
		matchEntities: false
	}));
	let keywordLines = $derived(keywordPlacement(card.keywords));
	let useZhFont = $derived(getLocale() === 'zhs')
	let titleText = $derived(upgraded ? card.name.replace(/\+$/, '') : card.name)

	const keywordOptions: GameTextOptions = { sizeUnit: 'cqw', matchEntities: false };
</script>

{#snippet keywordLine(line: string)}
	<p class="desc-keyword"><GameText text={line} options={keywordOptions} /></p>
{/snippet}

{#snippet uiImage(src: string, className: string, filter?: string)}
	{@const picture = cardUiImage(src)}
	{#if picture}
		<enhanced:img class={className} src={picture} alt="" aria-hidden="true" style:filter={filter} />
	{:else}
		<img class={className} {src} alt="" aria-hidden="true" style:filter={filter} />
	{/if}
{/snippet}

<div
	class={['card-thumb', className, { 'is-full-art': fullArt, 'is-zh': useZhFont }]}
	style:--accent={accent}
	style:--title-outline={titleOutline}
	style:--energy-outline={energyOutline}
	style:--cost-image={characterAssets?.cardEnergy
		? `url('${characterAssets.cardEnergy}')`
		: null}
	style:--star-image={characterAssets?.secondCardEnergy
		? `url('${characterAssets.secondCardEnergy}')`
		: null}
>
	<div class={['art-window', { 'is-full-art': fullArt }]}>
		{#if card.image}
			<picture>
				{#if useThumb && card.thumb}
					<source srcset={card.thumb} type="image/webp" />
				{/if}
				<img
					class="art-image"
					src={card.image}
					alt=""
					loading={priority ? 'eager' : 'lazy'}
					fetchpriority={priority ? 'high' : 'auto'}
					decoding="async"
				/>
			</picture>
		{/if}
	</div>

	{#if frameSrc && !fullArt}
		{@render uiImage(frameSrc, 'card-frame', frameFilter)}
	{/if}
	{#if !fullArt}
		{@render uiImage(portraitBorderSrc, 'portrait-border')}
	{/if}
	{#if fullArt}
		{@render uiImage('/images/card_frames/ancientBorder.png', 'ancient-border')}
		{@render uiImage(ancientTextBgSrc, 'ancient-text-bg')}
	{/if}
	{@render uiImage(bannerSrc, 'title-banner')}
	{#if showText}
		<span
			class={['thumb-name', { 'is-zh': useZhFont, 'is-upgraded': upgraded }]}
			{@attach cardTitleAutoSize(titleText, useZhFont)}
		>{titleText}</span>
	{/if}

	{#if showText}
		<div class="desc" {@attach cardDescriptionAutoSize()}>
			<div class="desc-text">
				{#each keywordLines.before as line (line)}
					{@render keywordLine(line)}
				{/each}
				<p class="desc-body"><GameText text={card.text ?? ''} options={textOptions} /></p>
				{#each keywordLines.after as line (line)}
					{@render keywordLine(line)}
				{/each}
			</div>
		</div>
	{/if}

	<span class={['cost', { 'is-x': card.cost === 'X', 'is-empty': card.cost === null }]}>
		{#if showText}<span class="cost-value">{cost}</span>{/if}
	</span>

	{#if card.secondEnergy !== undefined && card.secondEnergy !== null}
		<span class={['energy-star', { 'is-x': card.secondEnergy === 'X' }]}>
			{#if showText}<span class="energy-star-value">{card.secondEnergy === 'X' ? 'X' : card.secondEnergy}</span>{/if}
		</span>
	{/if}

	<div class="type-plaque">
		{@render uiImage(plaqueSrc, 'type-plaque-img')}
		<span class="thumb-type">{showText ? typeLabel : ''}</span>
	</div>
</div>

<style>
	.card-thumb {
		--font-card: 'Kreon Game', var(--font-display);

		container-type: inline-size;
		position: relative;
		display: block;
		width: 100%;
		aspect-ratio: 598 / 844;
	}

	.card-thumb.is-zh {
		--font-card: 'Noto Sans Mono CJK SC Game', serif;
		--font-italic: 'Source Han Serif SC Game Medium', serif;
	}

	/* picture 包裹层用 contents 让内部 img 仍按 .card-thumb / .art-window 定位与铺满 */
	.card-thumb :global(picture) {
		display: contents;
	}

	.art-window {
		position: absolute;
		left: 8.333%;
		top: 10.19%;
		z-index: 1;
		width: 83.333%;
		height: 45.024%;
		overflow: hidden;
		background:
			radial-gradient(70% 78% at 50% 42%, color-mix(in srgb, var(--accent) 34%, transparent), transparent 70%),
			linear-gradient(160deg, #263238 0%, #12191b 60%, #0b0f10 100%);
	}

	.art-window.is-full-art {
		inset: 0;
		width: 100%;
		height: 100%;
		background: #0b0f13;
		-webkit-mask-image: url('/images/card_frames/ancientGlass.png');
		mask-image: url('/images/card_frames/ancientGlass.png');
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
	}

	.art-image {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.card-frame {
		position: absolute;
		inset: 0;
		z-index: 2;
		display: block;
		width: 100%;
		height: 100%;
		pointer-events: none;
		filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.5));
	}

	.portrait-border {
		position: absolute;
		left: 4.167%;
		top: 11.137%;
		z-index: 3;
		display: block;
		width: 91.667%;
		height: 49.763%;
		object-fit: fill;
		pointer-events: none;
	}

	/* 原版 AncientBorder (-154,-223)-(152,217) / AncientTextBg (-132,-20)-(132,183) @ 300x422 */
	.ancient-border,
	.ancient-text-bg {
		position: absolute;
		display: block;
		object-fit: fill;
		pointer-events: none;
	}

	.ancient-border {
		left: -1.333%;
		top: -2.843%;
		z-index: 2;
		width: 102%;
		height: 104.265%;
	}

	.ancient-text-bg {
		left: 6%;
		top: 45.261%;
		z-index: 3;
		width: 88%;
		height: 48.104%;
	}

	.title-banner {
		position: absolute;
		left: -4.333%;
		top: 0.948%;
		z-index: 4;
		display: block;
		width: 109%;
		height: 19.668%;
		object-fit: cover;
		pointer-events: none;
	}

	.cost {
		position: absolute;
		left: -5.333%;
		top: -3.791%;
		z-index: 5;
		display: grid;
		place-items: center;
		width: 21.333%;
		height: 15.165%;
		background: var(--cost-image, none) center / 100% 100% no-repeat;
		font-family: var(--font-card);
		font-size: clamp(7px, 10.667cqw, 32px);
		font-weight: 700;
		line-height: 1;
		color: #fff6e2;
		/* 原版 EnergyLabel outline_size 16，Godot 实际半径 = 16/4 = 4px：居中描边总宽 8px */
		-webkit-text-stroke: 0.25em var(--energy-outline);
		paint-order: stroke fill;
		text-shadow: 0.667cqw 0.667cqw 0 rgba(0, 0, 0, 0.188);
	}

	/* EnergyLabel 文本框相对图标中心下移 2px */
	.cost-value {
		transform: translateY(0.667cqw);
	}

	.cost.is-x {
		font-family: var(--font-card);
	}

	.cost.is-empty {
		font-size: clamp(5px, 6.4cqw, 19px);
		color: rgba(231, 236, 234, 0.55);
		-webkit-text-stroke-width: 0;
	}

	.thumb-name {
		position: absolute;
		left: 15%;
		top: 1.659%;
		z-index: 5;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 70%;
		height: 12.796%;
		overflow: hidden;
		font-family: 'Kreon Game', Georgia, 'Times New Roman', serif;
		font-size: var(--title-font-size, 8.667cqw);
		font-weight: 400;
		letter-spacing: 0.333cqw;
		line-height: 1;
		color: #fff6e2;
		text-align: center;
		white-space: nowrap;
		/* CSS 描边居中；2cqw 对应 Godot 在 300px 卡宽下的可见外轮廓 */
		-webkit-text-stroke: 2cqw var(--title-outline);
		paint-order: stroke fill;
		filter: drop-shadow(0.667cqw 0.667cqw 0 rgba(0, 0, 0, 0.188235));
		/* Chromium 行盒居中比 Godot 低约 2px；中文再叠加字体 baseline_offset -0.05 */
		transform: translateY(-0.667cqw);
		pointer-events: none;
	}

	.thumb-name.is-zh {
		font-family: 'Noto Sans Mono CJK SC Game', 'Noto Sans Mono CJK SC', sans-serif;
		letter-spacing: 0;
		transform: translateY(calc(-0.667cqw - 0.078em));
	}

	.card-thumb.is-zh .cost {
		font-size: calc(clamp(7px, 10.667cqw, 32px) * 0.95);
	}

	/* 中文主题字体 baseline_offset=-0.05，按字体高度 1.48em 折算成 em */
	.card-thumb.is-zh .cost-value {
		transform: translateY(calc(0.667cqw - 0.078em));
	}

	.card-thumb.is-zh .energy-star-value,
	.card-thumb.is-zh .thumb-type {
		transform: translateY(-0.078em);
	}

	.card-thumb.is-zh .energy-star {
		font-size: calc(clamp(5px, 7.333cqw, 22px) * 0.95);
	}

	.thumb-name.is-upgraded {
		color: #7fff00;
	}

	.desc {
		position: absolute;
		left: 9.333%;
		top: 58.768%;
		z-index: 5;
		display: flex;
		align-items: center;
		width: 81%;
		height: 32.227%;
		overflow: hidden;
		font-family: var(--font-card);
		/* 原版 DescriptionLabel：21px、MinFontSize 12，卡片宽 300 时 1px = 1/3cqw */
		font-size: var(--desc-font-size, 7cqw);
		font-weight: 400;
		line-height: 1.2;
		color: #fff6e2;
		text-align: center;
		/* 原版 font_shadow (2, 2)，alpha 0.25098 */
		text-shadow: 0.667cqw 0.667cqw 0 rgba(0, 0, 0, 0.251);
		pointer-events: none;
	}

	.card-thumb.is-zh .desc {
		font-size: calc(var(--desc-font-size, 7cqw) * 0.95);
	}

	.card-thumb.is-zh .desc-text {
		/* 中文字体行高 1.48em，原版 line_separation=-3（1 游戏像素 = 1/3 cqw） */
		line-height: calc(1.48 * var(--desc-font-size, 7cqw) - 1cqw);
		transform: translateY(-0.078em);
	}

	.desc-text {
		width: 100%;
		overflow-wrap: break-word;
		/* Kreon 行高 1.26em，同样扣掉 line_separation=-3 */
		line-height: calc(1.26 * var(--desc-font-size, 7cqw) - 1cqw);
	}

	.desc-body {
  		white-space: pre-wrap;
	}

	.desc :global(.sts-energy-icon) {
		display: inline-block;
		height: 1.05em;
		width: auto;
		margin: 0 0.03em;
		vertical-align: -0.15em;
	}

	.type-plaque {
		position: absolute;
		left: 50%;
		top: 50.237%;
		z-index: 5;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 20.33%;
		width: max-content;
		height: 8.77%;
		padding: 0 2.84cqw;
		box-sizing: border-box;
		transform: translateX(-50%);
		pointer-events: none;
	}

	.type-plaque img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.thumb-type {
		position: relative;
		font-family: var(--font-card);
		font-size: clamp(5px, 5.333cqw, 16px);
		font-weight: 700;
		line-height: 1;
		color: rgba(0, 0, 0, 0.753);
		white-space: nowrap;
	}

	.card-thumb.is-zh .thumb-type {
		font-size: calc(clamp(5px, 5.333cqw, 16px) * 0.95);
	}

	.energy-star {
		position: absolute;
		left: -12%;
		top: 5.213%;
		z-index: 6;
		display: grid;
		place-items: center;
		width: 19.333%;
		height: 13.744%;
		background: var(--star-image, none) center / 100% 100% no-repeat;
		font-family: var(--font-card);
		font-size: clamp(5px, 7.333cqw, 22px);
		font-weight: 700;
		line-height: 1;
		color: #fff6e2;
		/* 原版 StarLabel outline_size 12，22px 字号下外扩约 3px */
		-webkit-text-stroke: 0.273em #1a5e6b;
		paint-order: stroke fill;
		text-shadow: 0.667cqw 0.667cqw 0 rgba(0, 0, 0, 0.188);
	}

	.energy-star.is-x {
		font-family: var(--font-card);
		font-size: clamp(5px, 7.333cqw, 22px);
	}
</style>
