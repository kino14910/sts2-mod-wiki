import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CARDS, RELICS, POTIONS, MOD_POWERS, MOD_CHARACTERS, CHARACTER_ASSETS } from './mods';
import { cardCharacterOptions } from './characters';
import type { CardType } from './cards';
import { validateBundle } from '../../../scripts/imported-mods';

describe('real imported catalog integration', () => {
	it('retains every legacy card pool and frame choice in the build-backed presentation', () => {
		const legacy = JSON.parse(fs.readFileSync('static/mods/fgo/manifest.json', 'utf8'));
		const bundle = validateBundle(JSON.parse(fs.readFileSync('generated/mods/fgo/bundle.json', 'utf8')), 'fgo');
		const options = cardCharacterOptions();
		for (const [pool, oldAssets] of Object.entries(legacy.cardPool) as [string, { cardFrame: Record<string, string> }][]) {
			const assets = CHARACTER_ASSETS[pool];
			expect(options.find((option) => option.id === pool)?.image, pool).toBe(assets.char);
			expect(assets.char).toMatch(/^\/imported\/fgo\/[a-f0-9]{64}\//);
			expect(Object.keys(assets.cardFrame ?? {}).sort(), pool).toEqual(Object.keys(oldAssets.cardFrame).sort());
			for (const [type, oldPath] of Object.entries(oldAssets.cardFrame)) {
				expect(assets.cardFrame?.[type as CardType]).toBe(bundle.assetBase + oldPath);
			}
		}
		expect(CHARACTER_ASSETS.noble.cardFrame).toEqual({});
		const nobles = CARDS.filter((card) => card.mod === 'fgo' && card.pool.includes('noble'));
		expect(nobles.length).toBeGreaterThan(0);
		expect(nobles.every((card) => card.color === 'noble')).toBe(true);
		expect(CARDS.filter((card) => card.mod === 'fgo' && card.color === 'noble').map((card) => card.id).sort())
			.toEqual(bundle.data.cards.filter((card) => card.pool === 'noble').map((card) => String(card.id)).sort());
	});
	it('loads every published entity exactly once without silently dropping imported records', () => {
		const bundle = validateBundle(JSON.parse(fs.readFileSync('generated/mods/fgo/bundle.json', 'utf8')), 'fgo');
		for (const [kind, entries] of Object.entries({ cards: CARDS, relics: RELICS, potions: POTIONS, powers: MOD_POWERS, characters: MOD_CHARACTERS })) {
			expect(entries.filter((entry) => entry.mod === 'fgo').map((entry) => entry.id).sort(), kind)
				.toEqual(bundle.data[kind].map((entry) => String(entry.id)).sort());
		}
		const strike = CARDS.find((card) => card.mod === 'fgo' && card.id === 'Strike')!;
		expect(strike.variables?.Damage).toBe(6);
		expect(strike.upgrade?.variables?.Damage).toBe(9);
		expect(strike.image).toMatch(/^\/imported\/fgo\/[a-f0-9]{64}\//);
		expect(strike.thumb).toMatch(/\.webp$/);
	});
});
