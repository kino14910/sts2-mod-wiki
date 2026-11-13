import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { indexIconFiles } from './mod-icons.ts';
import { isManifest, isCardData, isCollectionData, isModPowerData, isModCharacterData } from '../src/lib/data/mod-schema.ts';
import { entryIdFor } from '../src/lib/data/mod-dependency.ts';

export interface ImportedBundle {
	schemaVersion: 1;
	id: string;
	fingerprint: string;
	assetBase: string;
	manifest: Record<string, unknown>;
	data: Record<string, Array<Record<string, unknown>>>;
	localization: Record<string, Record<string, string>>;
	assets: Record<string, { resource: string; sha256: string }>;
	cardThumbnails?: Record<string, string>;
	contentSha256?: string;
	source?: { config: string };
}

const safeRelative = (value: string) =>
	value.length > 0 && !/[\\:]/.test(value) && value.split('/').every((part) => part && part !== '.' && part !== '..');

/** Fail the build on broken imported data instead of silently dropping entities. */
export function validateBundle(value: unknown, id: string): ImportedBundle {
	validateNumbers(value);
	const bundle = value as ImportedBundle;
	if (!bundle || bundle.schemaVersion !== 1 || bundle.id !== id ||
		!/^[-a-z0-9]+$/.test(id) || !/^[a-f0-9]{64}$/.test(bundle.fingerprint) ||
		bundle.assetBase !== `/imported/${id}/${bundle.fingerprint}/` || bundle.manifest?.id !== id || !isManifest(bundle.manifest) ||
		!bundle.data || !bundle.localization || !bundle.assets) {
		throw new Error(`Invalid normalized mod bundle: ${id}`);
	}
	for (const [kind, rows] of Object.entries(bundle.data)) {
		if (!['cards', 'powers', 'relics', 'potions', 'characters'].includes(kind) || !Array.isArray(rows)) {
			throw new Error(`Invalid entity collection: ${id}/${kind}`);
		}
		const ids = new Set<string>();
		for (const row of rows) {
			if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id)) {
				throw new Error(`Duplicate or invalid entity: ${id}/${kind}/${row?.id}`);
			}
			ids.add(row.id);
			const valid = kind === 'cards' ? isCardData(row) : kind === 'powers' ? isModPowerData(row)
				: kind === 'relics' ? isCollectionData(row, 'relic') : kind === 'potions' ? isCollectionData(row, 'potion') : isModCharacterData(row);
			if (!valid) throw new Error(`Invalid normalized entity: ${id}/${kind}/${row.id}`);
		}
	}
	for (const [file, table] of Object.entries(bundle.localization)) {
		if (!safeRelative(file) || !/^localization\/[^/]+\/[^/]+\.json$/.test(file) ||
			!table || Array.isArray(table) || Object.values(table).some((text) => typeof text !== 'string')) {
			throw new Error(`Invalid localization table: ${id}/${file}`);
		}
	}
	const textsByLocale = new Map<string, Map<string, string>>();
	for (const [file, table] of Object.entries(bundle.localization)) {
		const locale = file.split('/')[1];
		const texts = textsByLocale.get(locale) ?? new Map<string, string>();
		for (const [key, text] of Object.entries(table)) {
			if (texts.has(key) && texts.get(key) !== text) throw new Error(`Conflicting localization key: ${id}/${locale}/${key}`);
			texts.set(key, text);
		}
		textsByLocale.set(locale, texts);
	}
	for (const [file, asset] of Object.entries(bundle.assets)) {
		if (!safeRelative(file) || !file.startsWith('images/') || !/^[a-f0-9]{64}$/.test(asset.sha256)) {
			throw new Error(`Invalid asset: ${id}/${file}`);
		}
	}
	const checkAsset = (value: unknown) => {
		if (typeof value !== 'string' || !value.startsWith(bundle.assetBase) || !(value.slice(bundle.assetBase.length) in bundle.assets)) {
			throw new Error(`Unregistered imported resource: ${id}/${value}`);
		}
	};
	for (const rows of Object.values(bundle.data)) for (const row of rows) {
		for (const field of ['image', 'icon']) if (row[field] !== undefined) checkAsset(row[field]);
	}
	for (const url of Object.values(bundle.cardThumbnails ?? {})) checkAsset(url);
	for (const assets of Object.values(bundle.manifest.cardPool ?? {})) {
		for (const field of ['char', 'cardEnergy', 'textEnergy', 'secondCardEnergy', 'secondTextEnergy'] as const) {
			if (assets[field] !== undefined) checkAsset(assets[field]);
		}
		for (const url of Object.values(assets.cardFrame ?? {})) checkAsset(url);
	}
	const baseTexts = Object.assign({}, ...Object.entries(bundle.localization)
		.filter(([file]) => file.startsWith('localization/eng/')).map(([, table]) => table));
	const kinds = { cards: 'card', powers: 'power', relics: 'relic', potions: 'potion' } as const;
	for (const [kind, singular] of Object.entries(kinds)) for (const row of bundle.data[kind] ?? []) {
		const key = entryIdFor(bundle.manifest.dependency!, singular, String(row.id));
		for (const field of ['title', 'description']) if (typeof baseTexts[`${key}.${field}`] !== 'string') {
			throw new Error(`Missing base localization: ${id}/${key}.${field}`);
		}
	}
	return bundle;
}

function validateNumbers(value: unknown, location = '$'): void {
	if (typeof value === 'number' && (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))) {
		throw new Error(`Non-finite number or unsafe integer at ${location}: ${value}`);
	}
	if (value && typeof value === 'object') {
		for (const [key, item] of Object.entries(value)) validateNumbers(item, `${location}.${key}`);
	}
}

function canonical(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonical);
	if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, canonical(v)]));
	return value;
}

export function contentDigest(bundle: ImportedBundle) {
	const { contentSha256: _digest, ...content } = bundle;
	validateNumbers(content);
	return crypto.createHash('sha256').update(JSON.stringify(canonical(content))).digest('hex');
}

export function verifyBundleFiles(bundle: ImportedBundle, publicRoot: string, configFile: string) {
	const hash = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
	if (bundle.contentSha256 !== contentDigest(bundle)) throw new Error(`Imported bundle checksum mismatch: ${bundle.id}`);
	if (bundle.source?.config !== hash(configFile)) throw new Error(`Mod configuration changed: ${bundle.id}; run pnpm mod:import again.`);
	for (const [name, asset] of Object.entries(bundle.assets)) {
		const file = path.join(publicRoot, bundle.assetBase.slice(1), name);
		if (!fs.existsSync(file) || hash(file) !== asset.sha256) throw new Error(`Missing or corrupt imported resource: ${file}; run pnpm mod:import again.`);
	}
}

export function readImportedMods(root: string, configRoot: string): ImportedBundle[] {
	const configured = fs.existsSync(configRoot)
		? fs.readdirSync(configRoot).filter((name) => name.endsWith('.json')).map((name) => name.slice(0, -5))
		: [];
	return configured.sort().map((id) => {
		const filename = path.join(root, id, 'bundle.json');
		if (!fs.existsSync(filename)) throw new Error(`Missing imported mod ${id}. Run pnpm mod:import --mod ${id} --build <DLL/PCK directory>.`);
		const bundle = validateBundle(JSON.parse(fs.readFileSync(filename, 'utf8')), id);
		verifyBundleFiles(bundle, path.resolve(root, '../../static'), path.join(configRoot, `${id}.json`));
		return bundle;
	});
}

export function importedModuleFiles(bundle: ImportedBundle) {
	// Logical file keys retain the loader contract; public identities are assigned by the catalog.
	// No runtime module reads static/mods for an imported mod.
	const root = `/static/mods/${bundle.id}`;
	// Evidence, source expressions and diagnostics remain in the normalized bundle.
	// Browser data carries only the fields used to render and identify entities.
	const runtimeFields = new Set(['id', 'pool', 'type', 'rarity', 'cost', 'secondEnergy', 'variables', 'keywords',
		'fullArt', 'upgrade', 'image', 'icon', 'group', 'stack', 'behavior', 'cap', 'motif', 'enemyOnly', 'aliases',
		'character', 'tags', 'upgraded', 'ancient', 'variablesZh', 'startingHp', 'startingGold', 'maxEnergy',
		'startingDeck', 'startingRelics', 'startingPotions', 'localizationId']);
	const runtimeData = Object.fromEntries(Object.entries(bundle.data).map(([kind, rows]) => [kind,
		rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => runtimeFields.has(key))))]));
	const cardImages: Record<string, string> = {};
	for (const row of bundle.data.cards ?? []) {
		if (typeof row.image === 'string') cardImages[String(row.id).toLowerCase().replace(/[^a-z0-9]/g, '')] = row.image;
	}
	const icons = indexIconFiles(bundle.id, Object.keys(bundle.assets)
		.filter((file) => !file.startsWith('images/cards/'))
		.map((file) => ({ relative: file.slice('images/'.length), url: bundle.assetBase + file })));
	return {
		manifestFiles: { [`${root}/manifest.json`]: bundle.manifest },
		dataFiles: Object.fromEntries(Object.entries(runtimeData).map(([kind, rows]) => [`${root}/${kind}.json`, rows])),
		localizationFiles: Object.fromEntries(Object.entries(bundle.localization).map(([file, table]) => [`${root}/${file}`, table])),
		cardImages,
		cardThumbnails: Object.fromEntries(Object.entries(bundle.cardThumbnails ?? {})
			.map(([id, url]) => [id.toLowerCase().replace(/[^a-z0-9]/g, ''), url])),
		icons
	};
}
