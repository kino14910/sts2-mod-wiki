<script lang="ts">
	import { COLORS, type CardType, type CardView, type Rarity } from '#lib/data/cards';
	import { keywordPlacement, typeName } from '#lib/data/localize';
	import { CHARACTER_ASSETS } from '#lib/data/mods';
	import { frameTintFilterId } from '#lib/frame-tint';
	import { bbcodeToHtml } from '#lib/text/bbcode';
	import { cardTextToHtml } from '#lib/text/card-text';
	import { cardUiImage } from '#lib/data/card-images'

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

	const BANNER_RARITY: Record<Rarity, string> = {
		basic: 'common',
		common: 'common',
		uncommon: 'uncommon',
		rare: 'rare',
		ancient: 'ancient',
		event: 'event',
		token: 'common',
		curse: 'curse',
		status: 'status',
		quest: 'quest'
	};

	// 原版 GetTitleLabelOutlineColor()：按稀有度取标题描边色
	const TITLE_OUTLINE: Record<Rarity, string> = {
		basic: '#4d4b40',
		common: '#4d4b40',
		token: '#4d4b40',
		ancient: '#4d4b40',
		uncommon: '#005c75',
		rare: '#6b4b00',
		event: '#1b6131',
		curse: '#550b9e',
		status: '#4f522f',
		quest: '#7e3e15'
	};

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

	let color = $derived(COLORS[card.color]);
	let typeLabel = $derived(typeName(card.type));
	let cost = $derived(card.cost === null ? '—' : card.cost);
	let bannerRarity = $derived(BANNER_RARITY[card.rarity]);
	let bannerSrc = $derived(`/images/card_banners/${bannerRarity}.png`);
	let plaqueSrc = $derived(`/images/card_plaques/${bannerRarity}.png`);
	let portraitBorderSrc = $derived(
		`/images/card_portrait_borders/${PORTRAIT_BORDER_TYPE[card.type]}-${bannerRarity}.png`
	);
	let titleOutline = $derived(TYPE_TITLE_OUTLINE[card.type] ?? TITLE_OUTLINE[card.rarity]);
	let characterAssets = $derived(CHARACTER_ASSETS[card.color]);
	let frameSrc = $derived(
		characterAssets?.cardFrame?.[FRAME_TYPE[card.type]] ?? FRAMES[FRAME_TYPE[card.type]]
	);
	let frameFilter = $derived(
		characterAssets?.shader
			? `url(#${frameTintFilterId(card.color)}) drop-shadow(0 10px 20px rgba(0, 0, 0, 0.5))`
			: undefined
	);
	let accent = $derived(characterAssets?.accent ?? color.accent);
	let energyOutline = $derived(characterAssets?.energyOutline ?? color.accent);
	let description = $derived(
		cardTextToHtml(card.text ?? '', {
			upgraded,
			variables: card.variables,
			baseVariables: card.baseVariables,
			sizeUnit: 'cqw',
			energyIconSrc: characterAssets?.textEnergy,
			secondEnergyIconSrc: characterAssets?.secondTextEnergy,
			inCombat
		})
	);
	let keywordLines = $derived(keywordPlacement(card.keywords));
</script>

{#snippet keywordLine(line: string)}
	<p class="desc-keyword">{@html bbcodeToHtml(line, { sizeUnit: 'cqw' })}</p>
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
	class={['card-thumb', className]}
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
	<div class="art-window">
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

	{@render uiImage(frameSrc, 'card-frame', frameFilter)}
	{#if card.rarity !== 'ancient'}
		{@render uiImage(portraitBorderSrc, 'portrait-border')}
	{/if}
	{@render uiImage(bannerSrc, 'title-banner')}
	{#if showText}
		<span class={['thumb-name', { 'is-upgraded': upgraded }]}>{card.name}</span>
	{/if}

	{#if showText}
		<div class="desc">
			<div class="desc-text">
				{#each keywordLines.before as line (line)}
					{@render keywordLine(line)}
				{/each}
				<p class="desc-body">{@html description}</p>
				{#each keywordLines.after as line (line)}
					{@render keywordLine(line)}
				{/each}
			</div>
		</div>
	{/if}

	<span class={['cost', { 'is-x': card.cost === 'X', 'is-empty': card.cost === null }]}>
		{showText ? cost : ''}
	</span>

	{#if card.secondEnergy !== undefined && card.secondEnergy !== null}
		<span class={['energy-star', { 'is-x': card.secondEnergy === 'X' }]}>
			{showText ? (card.secondEnergy === 'X' ? 'X' : card.secondEnergy) : ''}
		</span>
	{/if}

	<div class="type-plaque">
		{@render uiImage(plaqueSrc, 'type-plaque-img')}
		<span class="thumb-type">{showText ? typeLabel : ''}</span>
	</div>
</div>

<style>
	.card-thumb {
		container-type: inline-size;
		position: relative;
		display: block;
		width: 100%;
		aspect-ratio: 598 / 844;
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
		font-family: var(--font-display);
		font-size: clamp(7px, 10.667cqw, 32px);
		font-weight: 700;
		line-height: 1;
		color: #fff6e2;
		/* 原版费用 32px + outline_size 16：描边按字级等比，外侧约 2px */
		-webkit-text-stroke: 0.16em var(--energy-outline);
		paint-order: stroke fill;
	}

	.cost.is-x {
		font-family: var(--font-sans);
		font-style: italic;
		font-size: clamp(6px, 7.333cqw, 22px);
	}

	.cost.is-empty {
		font-size: clamp(5px, 6.4cqw, 19px);
		color: rgba(231, 236, 234, 0.55);
		-webkit-text-stroke-width: 0;
	}

	.thumb-name {
		position: absolute;
		left: 15%;
		top: 1%;
		z-index: 5;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 70%;
		height: 12.796%;
		overflow: hidden;
		font-family: var(--font-display);
		font-size: clamp(7px, 8.667cqw, 26px);
		font-weight: 400;
		/* 原版标题用 kreon_regular + spacing_glyph=1（26px 下即 1px） */
		letter-spacing: 0.0385em;
		line-height: 1.05;
		color: #fff6e2;
		text-align: center;
		text-wrap: balance;
		/* 原版标题 26px + outline_size 12：描边按字级等比，外侧约 2px */
		-webkit-text-stroke: 0.16em var(--title-outline);
		paint-order: stroke fill;
		pointer-events: none;
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
		font-family: var(--font-display);
		/* 原版 DescriptionLabel：21px、MinFontSize 12，卡片宽 300 时 1px = 1/3cqw */
		font-size: clamp(5px, 7cqw, 21px);
		font-weight: 400;
		line-height: 1.2;
		color: #fff6e2;
		text-align: center;
		/* 原版 font_shadow (2, 2)，alpha 0.25098 */
		text-shadow: 0.667cqw 0.667cqw 0 rgba(0, 0, 0, 0.251);
		pointer-events: none;
	}

	.desc-text {
		width: 100%;
		overflow-wrap: break-word;
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
		font-family: var(--font-display);
		font-size: clamp(5px, 5.333cqw, 16px);
		font-weight: 700;
		line-height: 1;
		color: rgba(0, 0, 0, 0.753);
		white-space: nowrap;
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
		font-family: var(--font-display);
		font-size: clamp(5px, 7.333cqw, 22px);
		font-weight: 700;
		line-height: 1;
		color: #fff6e2;
		-webkit-text-stroke: 0.16em #1a5e6b;
		paint-order: stroke fill;
	}

	.energy-star.is-x {
		font-family: var(--font-sans);
		font-style: italic;
		font-size: clamp(5px, 6.667cqw, 20px);
	}
</style>
