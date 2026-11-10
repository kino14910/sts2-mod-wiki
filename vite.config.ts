import fs from 'node:fs';
import path from 'node:path';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { enhancedImages } from '@sveltejs/enhanced-img';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import type { Plugin } from 'vite';

/**
 * 扫描各模组的 images/cards 目录，按归一化卡 id 生成 PNG 原图与 WebP 缩略图 URL。
 */
function collectCardArt(modsDir: string) {
	const images: Record<string, Record<string, string>> = {};
	const thumbs: Record<string, Record<string, string>> = {};
	if (!fs.existsSync(modsDir)) return { images, thumbs };

	const put = (map: Record<string, string>, key: string, url: string) => {
		const existing = map[key];
		if (!existing) {
			map[key] = url;
			return;
		}
		if (existing.includes('/beta/') && !url.includes('/beta/')) map[key] = url;
	};

	for (const entry of fs.readdirSync(modsDir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;

		const cardsImgDir = path.join(modsDir, entry.name, 'images', 'cards');
		if (!fs.existsSync(cardsImgDir)) continue;

		const imageMap: Record<string, string> = {};
		const thumbMap: Record<string, string> = {};
		const walk = (dir: string) => {
			for (const file of fs.readdirSync(dir, { withFileTypes: true })) {
				const full = path.join(dir, file.name);
				if (file.isDirectory()) {
					walk(full);
					continue;
				}
				const ext = path.extname(file.name).toLowerCase();
				if (ext !== '.png' && ext !== '.webp') continue;

				const key = path.parse(file.name).name.toLowerCase().replace(/[^a-z0-9]/g, '');
				const rel = path.relative(cardsImgDir, full).split(path.sep).join('/');
				const url = `/mods/${entry.name}/images/cards/${rel}`;
				put(ext === '.png' ? imageMap : thumbMap, key, url);
			}
		};
		walk(cardsImgDir);
		images[entry.name] = imageMap;
		thumbs[entry.name] = thumbMap;
	}

	return { images, thumbs };
}

/**
 * static/mods 是纯数据层，属于 public 目录，不能被 JS 直接 import；
 * 这里在开发与构建时读取清单及其声明的 JSON，注入 virtual:mods 供统一加载层使用。
 */
function modDataPlugin(): Plugin {
	const modsDir = path.resolve('static/mods');
	const localeDir = path.resolve('static/localization');
	const LOCALE_FILES = ['card_keywords.json', 'mods.json'];

	function readJson(file: string) {
		try {
			return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
		} catch (error) {
			console.warn(`[mods] 无法读取 ${file}：${error}`);
			return null;
		}
	}

	return {
		name: 'sts2-mod-data',
		resolveId(id) {
			if (id === 'virtual:mods') return '\0virtual:mods';
			return null;
		},
		load(id) {
			if (id !== '\0virtual:mods') return null;

			const manifestFiles: Record<string, unknown> = {};
			const dataFiles: Record<string, unknown> = {};
			const localizationFiles: Record<string, unknown> = {};
			const { images: cardImageFiles, thumbs: cardThumbFiles } = collectCardArt(modsDir);

			if (fs.existsSync(localeDir)) {
				for (const entry of fs.readdirSync(localeDir, { withFileTypes: true })) {
					if (!entry.isDirectory()) continue;

					for (const file of LOCALE_FILES) {
						const filePath = path.join(localeDir, entry.name, file);
						if (!fs.existsSync(filePath)) continue;
						localizationFiles[`/static/localization/${entry.name}/${file}`] = readJson(filePath);
					}
				}
			}

			for (const entry of fs.existsSync(modsDir) ? fs.readdirSync(modsDir, { withFileTypes: true }) : []) {
				if (!entry.isDirectory()) continue;

				const manifestPath = path.join(modsDir, entry.name, 'manifest.json');
				if (!fs.existsSync(manifestPath)) continue;

				const manifest = readJson(manifestPath);
				manifestFiles[`/static/mods/${entry.name}/manifest.json`] = manifest;

				const localizationPath = path.join(modsDir, entry.name, 'localization');
				if (fs.existsSync(localizationPath)) {
					for (const localeEntry of fs.readdirSync(localizationPath, {
						withFileTypes: true
					})) {
						if (!localeEntry.isDirectory()) continue;

						const localePath = path.join(localizationPath, localeEntry.name);
						for (const file of fs.readdirSync(localePath, { withFileTypes: true })) {
							if (!file.isFile() || !file.name.endsWith('.json')) continue;

							localizationFiles[
								`/static/mods/${entry.name}/localization/${localeEntry.name}/${file.name}`
							] = readJson(path.join(localePath, file.name));
						}
					}
				}

				if (typeof manifest !== 'object' || manifest === null) continue;

				const { cards, powers, relics, potions } = manifest as {
					cards?: unknown;
					powers?: unknown;
					relics?: unknown;
					potions?: unknown;
				};

				for (const file of [cards, powers, relics, potions]) {
					if (typeof file !== 'string') continue;

					const filePath = path.join(modsDir, entry.name, file);
					if (!fs.existsSync(filePath)) continue;

					dataFiles[`/static/mods/${entry.name}/${file}`] = readJson(filePath);
				}
			}

			return [
				`export const manifestFiles = ${JSON.stringify(manifestFiles)};`,
				`export const dataFiles = ${JSON.stringify(dataFiles)};`,
				`export const localizationFiles = ${JSON.stringify(localizationFiles)};`,
				`export const cardImageFiles = ${JSON.stringify(cardImageFiles)};`,
				`export const cardThumbFiles = ${JSON.stringify(cardThumbFiles)};`
			].join('\n');
		},
		configureServer(server) {
			server.watcher.add(modsDir);
			server.watcher.add(localeDir);
		},
		handleHotUpdate({ file, server }) {
			const normalized = file.replaceAll('\\', '/');
			const watched = [modsDir, localeDir].map((dir) => dir.replaceAll('\\', '/'));
			const isTracked =
				watched.some((dir) => normalized.startsWith(dir)) &&
				(normalized.endsWith('.json') ||
					/\/images\/cards\/.*\.(png|webp)$/.test(normalized));
			if (!isTracked) {
				return;
			}

			const mod = server.moduleGraph.getModuleById('\0virtual:mods');
			if (!mod) return;

			server.moduleGraph.invalidateModule(mod);
			return [mod];
		}
	};
}

export default defineConfig({
	plugins: [
		modDataPlugin(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			strategy: ['cookie', 'preferredLanguage', 'baseLocale'],
			cookieName: 'sts2_mod_wiki_locale'
		}),
		enhancedImages(),
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			prerender: {
				handleHttpError: ({ status, path, message }) => {
					if (status === 404 && path.startsWith('/mods/')) return
					throw new Error(message)
				}
			},
			adapter: adapter()
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
