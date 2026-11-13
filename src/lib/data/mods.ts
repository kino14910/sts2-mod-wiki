import { cardImageFiles, cardThumbFiles, dataFiles, localizationFiles, manifestFiles } from 'virtual:mods';
import { COLORS, isBuiltinRarity, registerCardRarities, type Card, type CardRarityDefinition, type CardRarityManifest } from './cards';
import type { CollectionEntry, CollectionKind } from './collections';
import { entryIdFor, resolveContentText, type ContentKind, type LocalizedField } from './mod-dependency';
import type { GlossaryEntry } from './glossary';
import { resolveCollectionText } from '../text/collection-text';
import { stripBBCode } from '../text/bbcode';
import { adaptLegacyCollectionVariables } from '../text/legacy-variables';
import { initializePublicEntityRefs } from '../entity-identity.ts';

/** Runtime adapter for validated import bundles and the separate vanilla offline dataset. */
export type { CharacterAssets, ModManifest, ModPowerData } from './mod-schema';
import { isRecord, isString, isManifest, isCardData, isModPowerData, isCollectionData, isModCharacterData, poolTokens, type CharacterAssets, type ModManifest, type LocalizedModText, type ModCharacterData } from './mod-schema';

interface LoadedMod {
	manifest: ModManifest;
	cards: Card[];
	powers: GlossaryEntry[];
	relics: CollectionEntry[];
	potions: CollectionEntry[];
	characters: Array<ModCharacterData & { mod: string }>;
}

const BASE_MOD_ID = 'sts2';
const BASE_LOCALE = 'eng';

/** locale -> modId -> 合并后的内容本地化键值 */
export const MOD_CONTENT_LOCALES: Record<string, Record<string, Record<string, string>>> = {};

/** locale -> modId -> 模组名称与简介 */
export const MOD_LOCALES: Record<string, Record<string, LocalizedModText>> = {};

/** locale -> card_keywords.json 的扁平键值 */
export const KEYWORD_LOCALES: Record<string, Record<string, string>> = {};

function poolOf(value: unknown): string[] {
	if (!isRecord(value)) return [];
	const fromPool = poolTokens(value);
	if (fromPool) return fromPool;
	const c = value.color;
	if (isString(c)) return [c];
	return [];
}

function cardColorOf(value: unknown, manifest: ModManifest): string {
	if (!isRecord(value)) return 'colorless';
	const poolColors = manifest.cardPool ?? {};
	const c = value.color;
	if (isString(c) && (c in COLORS || c in poolColors)) return c;
	const tokens = poolTokens(value);
	if (tokens) {
		for (const t of tokens) {
			if (t in COLORS || t in poolColors) return t;
		}
	}
	return 'colorless';
}

function loadGlobalLocalization() {
	for (const [path, data] of Object.entries(localizationFiles)) {
		const match = path.match(/^\/static\/localization\/([^/]+)\/([^/]+)$/);
		if (!match || !isRecord(data)) continue;

		const [, locale, file] = match;
		if (file === 'mods.json') {
			MOD_LOCALES[locale] = data as Record<string, LocalizedModText>;
		} else if (file === 'card_keywords.json') {
			KEYWORD_LOCALES[locale] = data as Record<string, string>;
		}
	}
}

function loadModLocalization() {
	for (const [path, data] of Object.entries(localizationFiles)) {
		const match = path.match(/^\/static\/mods\/([^/]+)\/localization\/([^/]+)\/[^/]+$/);
		if (!match || !isRecord(data)) continue;

		const [, modId, locale] = match;
		const texts = (MOD_CONTENT_LOCALES[locale] ??= {})[modId] ??= {};

		for (const [key, value] of Object.entries(data)) {
			if (!isString(value)) continue;
			if (key in texts) {
				console.warn(`[mods] 重复的内容本地化键，后者覆盖前者：${modId}/${locale}/${key}`);
			}
			texts[key] = value;
		}
	}
}

function resolveAsset(modId: string, path: string) {
	return path.startsWith('/') ? path : `/mods/${modId}/${path}`;
}

/** 按前置依赖生成的 Key 读取某个模组内容字段 */
export function modContentText(
	mod: ModManifest,
	kind: ContentKind,
	id: string,
	field: LocalizedField,
	locale: string = BASE_LOCALE
): string | undefined {
	return resolveContentText(
		MOD_CONTENT_LOCALES[locale]?.[mod.id],
		mod.dependency,
		kind,
		id,
		field
	);
}

function loadCards(dir: string, manifest: ModManifest): Card[] {
	const file = manifest.cards;
	if (!file) return [];

	const data = dataFiles[`${dir}/${file}`];
	if (!Array.isArray(data)) {
		console.warn(`[mods] 卡牌数据缺失或格式无效：${dir}/${file}`);
		return [];
	}

	const cards: Card[] = [];

	for (const value of data) {
		if (!isCardData(value)) {
			const id = isRecord(value) && isString(value.id) ? value.id : '?';
			console.warn(`[mods] 已跳过无效卡牌：${dir}/${file}（${id}）`);
			continue;
		}

		const pool = poolOf(value);
		const color = cardColorOf(value, manifest);
		const name = modContentText(manifest, 'card', value.id, 'title');
		const text = modContentText(manifest, 'card', value.id, 'description');
		if (name === undefined || text === undefined) {
			const entryId = manifest.dependency
				? entryIdFor(manifest.dependency, 'card', value.id)
				: '(未声明前置依赖)';
			console.warn(
				`[mods] 卡牌缺少 ${BASE_LOCALE} 本地化文本（${entryId}.title/description），已跳过：${manifest.id}/${value.id}`
			);
			continue;
		}

		const cardKey = value.id.toLowerCase().replace(/[^a-z0-9]/g, '');
		cards.push({
			...value,
			pool,
			color,
			mod: manifest.id,
			image: value.image
				? resolveAsset(manifest.id, value.image)
				: cardImageFiles[manifest.id]?.[cardKey],
			thumb: cardThumbFiles[manifest.id]?.[cardKey],
			name,
			text
		});
	}

	return cards;
}

function loadPowers(dir: string, manifest: ModManifest): GlossaryEntry[] {
	const file = manifest.powers;
	if (!file) return [];

	const data = dataFiles[`${dir}/${file}`];
	if (!Array.isArray(data)) {
		console.warn(`[mods] Buff 数据缺失或格式无效：${dir}/${file}`);
		return [];
	}

	const powers: GlossaryEntry[] = [];

	for (const value of data) {
		if (!isModPowerData(value)) {
			console.warn(`[mods] 已跳过无效 Buff：${dir}/${file}`);
			continue;
		}

		const name = modContentText(manifest, 'power', value.id, 'title');
		const summary = modContentText(manifest, 'power', value.id, 'description');
		if (name === undefined || summary === undefined) {
			const entryId = manifest.dependency
				? entryIdFor(manifest.dependency, 'power', value.id)
				: '(未声明前置依赖)';
			console.warn(
				`[mods] Buff 缺少 ${BASE_LOCALE} 本地化文本（${entryId}.title/description），已跳过：${manifest.id}/${value.id}`
			);
			continue;
		}

		powers.push({
			id: value.id,
			name,
			kind: 'power',
			group: value.group ?? 'Other',
			summary: stripBBCode(summary),
			aliases: value.aliases,
			stack: value.stack,
			behavior: value.behavior,
			cap: value.cap,
			motif: value.motif,
			icon: value.icon ? resolveAsset(manifest.id, value.icon) : undefined,
			enemyOnly: value.enemyOnly,
			mod: manifest.id
		});
	}

	return powers;
}

function loadCollection(
	dir: string,
	manifest: ModManifest,
	kind: CollectionKind
): CollectionEntry[] {
	const file = kind === 'relic' ? manifest.relics : manifest.potions;
	if (!file) return [];

	const data = dataFiles[`${dir}/${file}`];
	if (!Array.isArray(data)) {
		console.warn(`[mods] ${kind === 'relic' ? '遗物' : '药水'}数据缺失或格式无效：${dir}/${file}`);
		return [];
	}

	const entries: CollectionEntry[] = [];

	for (const value of data) {
		if (!isCollectionData(value, kind)) {
			console.warn(`[mods] 已跳过无效${kind === 'relic' ? '遗物' : '药水'}：${dir}/${file}`);
			continue;
		}

		const name = modContentText(manifest, kind, value.id, 'title');
		const template = modContentText(manifest, kind, value.id, 'description');
		if (name === undefined || template === undefined) {
			const entryId = manifest.dependency
				? entryIdFor(manifest.dependency, kind, value.id)
				: '(未声明前置依赖)';
			console.warn(
				`[mods] ${kind === 'relic' ? '遗物' : '药水'}缺少 ${BASE_LOCALE} 本地化文本（${entryId}.title/description），已跳过：${manifest.id}/${value.id}`
			);
			continue;
		}

		const origin = { modId: manifest.id, source: manifest.id === BASE_MOD_ID ? 'legacy-static' : 'build' } as const;
		const variables = adaptLegacyCollectionVariables(template, value.variables, origin);
		const zhTemplate = modContentText(manifest, kind, value.id, 'description', 'zhs') ?? template;
		const variablesZh = value.variablesZh ? adaptLegacyCollectionVariables(zhTemplate, value.variablesZh, origin) : undefined;
		entries.push({
			id: value.id,
			name,
			mod: manifest.id,
			kind,
			rarity: value.rarity,
			character: value.character,
			tags: value.tags,
			text: resolveCollectionText(template, variables),
			image: value.image ? resolveAsset(manifest.id, value.image) : undefined,
			upgraded: value.upgraded,
			ancient: value.ancient,
			variables,
			variablesZh
		});
	}

	return entries;
}

function loadMod(path: string, value: unknown): LoadedMod | undefined {
	const dir = path.slice(0, path.lastIndexOf('/'));
	const folder = dir.slice(dir.lastIndexOf('/') + 1);

	if (!isManifest(value)) {
		console.warn(`[mods] 清单格式无效，已跳过：${path}`);
		return undefined;
	}

	if (folder !== value.id) {
		console.warn(`[mods] 清单 id 与所在目录不一致，已跳过：${path}（id: ${value.id}）`);
		return undefined;
	}

	return {
		manifest: value,
		cards: loadCards(dir, value),
		powers: loadPowers(dir, value),
		relics: loadCollection(dir, value, 'relic'),
		potions: loadCollection(dir, value, 'potion'),
		characters: value.characters && Array.isArray(dataFiles[`${dir}/${value.characters}`])
			? (dataFiles[`${dir}/${value.characters}`] as unknown[]).filter(isModCharacterData).map((row) => ({ ...row, mod: value.id })) : []
	};
}

loadGlobalLocalization();
loadModLocalization();

const loaded: LoadedMod[] = [];

for (const path of Object.keys(manifestFiles).sort()) {
	const mod = loadMod(path, manifestFiles[path]);
	if (!mod) continue;

	if (loaded.some((entry) => entry.manifest.id === mod.manifest.id)) {
		console.warn(`[mods] 重复的模组 id，已跳过：${mod.manifest.id}`);
		continue;
	}

	loaded.push(mod);
}

loaded.sort((a, b) => {
	const aBase = a.manifest.id === BASE_MOD_ID;
	const bBase = b.manifest.id === BASE_MOD_ID;
	if (aBase !== bBase) return aBase ? -1 : 1;
	return a.manifest.id.localeCompare(b.manifest.id);
});

export const MODS: ModManifest[] = loaded.map((entry) => entry.manifest);
export const MOD_BY_ID = new Map(MODS.map((mod) => [mod.id, mod]));
export const CARDS: Card[] = loaded.flatMap((entry) => entry.cards);
export const MOD_POWERS: GlossaryEntry[] = loaded.flatMap((entry) => entry.powers);
export const RELICS: CollectionEntry[] = loaded.flatMap((entry) => entry.relics);
export const POTIONS: CollectionEntry[] = loaded.flatMap((entry) => entry.potions);
export const MOD_CHARACTERS = loaded.flatMap((entry) => entry.characters);

initializePublicEntityRefs([
	...CARDS.map((row) => ({ type: 'card' as const, id: row.id, modId: row.mod })),
	...RELICS.map((row) => ({ type: 'relic' as const, id: row.id, modId: row.mod })),
	...POTIONS.map((row) => ({ type: 'potion' as const, id: row.id, modId: row.mod })),
	...MOD_POWERS.map((row) => ({ type: 'power' as const, id: row.id, modId: row.mod ?? BASE_MOD_ID })),
	...MOD_CHARACTERS.map((row) => ({ type: 'character' as const, id: row.id, modId: row.mod }))
]);

function rarityLabels(modId: string, id: string, def: CardRarityManifest): Record<string, string> {
	const key = def.labelKey ?? `RARITY_${id}.title`
	const labels: Record<string, string> = {}
	for (const [locale, texts] of Object.entries(MOD_CONTENT_LOCALES)) {
		const text = texts[modId]?.[key]
		if (text) labels[locale] = text
	}
	return labels
}

function registerModRarities() {
	const definitions: Record<string, CardRarityDefinition> = Object.create(null)
	for (const entry of loaded) {
		for (const [id, def] of Object.entries(entry.manifest.cardRarities ?? {})) {
			if (id in definitions) continue
			definitions[id] = { ...def, labels: rarityLabels(entry.manifest.id, id, def) }
		}
	}
	for (const card of CARDS) {
		if (isBuiltinRarity(card.rarity) || card.rarity in definitions) continue
		definitions[card.rarity] = { labels: rarityLabels(card.mod, card.rarity, {}) }
	}
	registerCardRarities(definitions)
}

registerModRarities()

/** 颜色 id -> 角色资源；基础游戏优先，其余模组只补充缺失颜色 */
export const CHARACTER_ASSETS: Record<string, CharacterAssets> = {};

for (const entry of loaded) {
	for (const [color, assets] of Object.entries(entry.manifest.cardPool ?? {})) {
		if (color in CHARACTER_ASSETS) continue;
		CHARACTER_ASSETS[color] = {
			labels: assets.labels,
			char: resolveAsset(entry.manifest.id, assets.char),
			cardEnergy: assets.cardEnergy
				? resolveAsset(entry.manifest.id, assets.cardEnergy)
				: undefined,
			textEnergy: assets.textEnergy
				? resolveAsset(entry.manifest.id, assets.textEnergy)
				: undefined,
			secondCardEnergy: assets.secondCardEnergy
				? resolveAsset(entry.manifest.id, assets.secondCardEnergy)
				: undefined,
			secondTextEnergy: assets.secondTextEnergy
				? resolveAsset(entry.manifest.id, assets.secondTextEnergy)
				: undefined,
			accent: assets.accent,
			energyOutline: assets.energyOutline,
			cardFrame: assets.cardFrame
				? Object.fromEntries(
						Object.entries(assets.cardFrame).map(([type, path]) => [
							type,
							resolveAsset(entry.manifest.id, path)
						])
					)
				: undefined,
			shader: assets.shader
		};
	}
}

/** 颜色 id -> 角色筛选图标 */
export const CHARACTER_ICONS: Record<string, string> = Object.fromEntries(
	Object.entries(CHARACTER_ASSETS).map(([color, assets]) => [color, assets.char])
);

/** 无色（其他角色）筛选图标，供卡牌页使用 */
export const COLORLESS_ICON = resolveAsset(BASE_MOD_ID, 'images/energy_colorless.png');
