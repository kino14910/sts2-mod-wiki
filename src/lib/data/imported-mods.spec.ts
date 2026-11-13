import { describe, expect, it } from 'vitest';
import { contentDigest, importedModuleFiles, validateBundle, type ImportedBundle } from '../../../scripts/imported-mods';

function fixture(): ImportedBundle {
	const fingerprint = 'a'.repeat(64);
	return { schemaVersion: 1, id: 'demo', fingerprint, assetBase: `/imported/demo/${fingerprint}/`,
		manifest: { id: 'demo', name: 'Demo', author: '', blurb: '', dependency: { type: 'other', prefix: '' }, cards: 'cards.json' },
		data: { cards: [{ id: 'Strike', pool: ['demo'], type: 'attack', rarity: 'basic', cost: 1, keywords: [], image: `/imported/demo/${fingerprint}/images/cards/Strike.png` }] },
		localization: { 'localization/eng/cards.json': { 'STRIKE.title': 'Strike', 'STRIKE.description': 'Deal damage.' } },
		assets: {
			'images/ui/energy.png': { resource: 'res://.godot/imported/energy.ctex', sha256: 'b'.repeat(64) },
			'images/cards/Strike.png': { resource: 'res://.godot/imported/strike.ctex', sha256: 'c'.repeat(64) }
		} };
}

describe('normalized artifact adapter', () => {
	it('rejects conflicting localization aliases instead of depending on table enumeration order', () => {
		const bundle = fixture();
		bundle.localization['localization/eng/aliases.json'] = { 'STRIKE.title': 'Another name' };
		expect(() => validateBundle(bundle, 'demo')).toThrow(/Conflicting localization key/);
		bundle.localization['localization/eng/aliases.json']['STRIKE.title'] = 'Strike';
		expect(validateBundle(bundle, 'demo')).toBe(bundle);
	});
	it('uses generated resource URLs without static mod data', () => {
		const bundle = validateBundle(fixture(), 'demo');
		const files = importedModuleFiles(bundle);
		expect(files.icons.map.energy).toBe(bundle.assetBase + 'images/ui/energy.png');
		expect(files.cardImages.strike).toBe(bundle.data.cards[0].image);
		expect(files.localizationFiles['/static/mods/demo/localization/eng/cards.json']['STRIKE.title']).toBe('Strike');
	});
	it('rejects duplicate identities and unsafe asset paths before loading', () => {
		const duplicate = fixture();
		duplicate.data.cards.push({ id: 'Strike' });
		expect(() => validateBundle(duplicate, 'demo')).toThrow(/Duplicate/);
		const unsafe = fixture();
		unsafe.assets['images/../../outside.png'] = { resource: 'x', sha256: 'b'.repeat(64) };
		expect(() => validateBundle(unsafe, 'demo')).toThrow(/Invalid asset/);
	});
	it('rejects records the runtime would otherwise discard and unregistered assets', () => {
		const missing = fixture();
		delete missing.data.cards[0].cost;
		expect(() => validateBundle(missing, 'demo')).toThrow(/Invalid normalized entity/);
		const invalid = fixture();
		invalid.data.cards[0].keywords = ['Imagined'];
		expect(() => validateBundle(invalid, 'demo')).toThrow(/Invalid normalized entity/);
		const asset = fixture();
		delete asset.assets['images/cards/Strike.png'];
		expect(() => validateBundle(asset, 'demo')).toThrow(/Unregistered/);
	});
	it('validates every character artwork slot while accepting display parameters', () => {
		const fields = ['char', 'cardEnergy', 'textEnergy', 'secondCardEnergy', 'secondTextEnergy'] as const;
		for (const field of fields) {
			const bundle = fixture();
			bundle.manifest.cardPool = { demo: { char: bundle.assetBase + 'images/ui/energy.png',
				[field]: bundle.assetBase + 'images/missing.png' } };
			expect(() => validateBundle(bundle, 'demo')).toThrow(/Unregistered imported resource/);
		}
		const bundle = fixture();
		bundle.manifest.cardPool = { demo: { char: bundle.assetBase + 'images/ui/energy.png',
			cardFrame: { attack: bundle.assetBase + 'images/missing.png' } } };
		expect(() => validateBundle(bundle, 'demo')).toThrow(/Unregistered imported resource/);
		bundle.manifest.cardPool = { demo: {
			...Object.fromEntries(fields.map((field) => [field, bundle.assetBase + 'images/ui/energy.png'])),
			labels: { eng: 'Demo', zhs: '演示' },
			cardFrame: { attack: bundle.assetBase + 'images/cards/Strike.png' },
			accent: '#c47e09', energyOutline: '#23517d', shader: { h: 0.1, s: 0.5, v: 1 }
		} };
		expect(validateBundle(bundle, 'demo')).toBe(bundle);
	});
	it('rejects invalid pool labels and preserves an explicit frameless pool', () => {
		const bundle = fixture();
		bundle.manifest.cardPool = { demo: { char: bundle.assetBase + 'images/ui/energy.png',
			labels: { eng: 'Demo' }, cardFrame: {} } };
		const files = importedModuleFiles(validateBundle(bundle, 'demo'));
		expect(files.manifestFiles['/static/mods/demo/manifest.json']).toMatchObject({
			cardPool: { demo: { labels: { eng: 'Demo' }, cardFrame: {} } }
		});
		(bundle.manifest.cardPool as Record<string, unknown>).demo = { char: bundle.assetBase + 'images/ui/energy.png', labels: { zhs: 42 } };
		expect(() => validateBundle(bundle, 'demo')).toThrow(/Invalid normalized mod bundle/);
	});
	it('canonicalizes parsed numbers and object keys with one Node representation', () => {
		const a = fixture();
		const b = fixture();
		a.data.cards[0].variables = JSON.parse('{"10":10,"2":2,"Rate":1e-6,"Tiny":1e-7,"Zero":-0.0,"Max":9007199254740991}');
		b.data.cards[0].variables = { Max: Number.MAX_SAFE_INTEGER, Zero: 0, Tiny: 0.0000001, Rate: 0.000001, 2: 2, 10: 10 };
		a.contentSha256 = 'ignored';
		expect(contentDigest(a)).toBe(contentDigest(b));
		(b.data.cards[0].variables as Record<string, number>).Rate = 0.000002;
		expect(contentDigest(a)).not.toBe(contentDigest(b));
	});
	it('rejects non-finite and unsafe integers even in evidence outside runtime fields', () => {
		for (const value of [Number.MAX_SAFE_INTEGER + 1, -(Number.MAX_SAFE_INTEGER + 1), Infinity, NaN]) {
			const bundle = fixture();
			bundle.data.cards[0].evidence = { values: [value] };
			expect(() => validateBundle(bundle, 'demo')).toThrow(/Non-finite number or unsafe integer/);
			expect(() => contentDigest(bundle)).toThrow(/Non-finite number or unsafe integer/);
		}
	});
});
