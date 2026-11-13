import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { publicEntityId, registerPublicEntityRefs } from '../../src/lib/entity-identity.ts'
import {
	isSafeSourcePath,
	isValidModVersion,
	isValidPageSlug,
	isValidSectionKey,
	validateWikiContent
} from '../../src/lib/server/wiki/validation.ts'

const projectRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))

const ENTITY_TYPES = new Set(['card', 'relic', 'potion', 'power', 'keyword', 'character'])

function readJson(file) {
	try {
		return JSON.parse(fs.readFileSync(file, 'utf8'))
	} catch (error) {
		throw new Error(`Invalid JSON at ${file}: ${error.message}`)
	}
}

function hashContent(content) {
	return `sha256:${crypto.createHash('sha256').update(content, 'utf8').digest('hex')}`
}

export function scanModWiki(root = projectRoot) {
	const modsRoot = path.join(root, 'static/mods')
	const contentRoot = path.join(root, 'content/wiki')
	const errors = []
	const mods = []
	const pages = []
	const files = []
	const seenPaths = new Set()
	const seenPageKeys = new Set()

	const directories = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : []
	// Use the same identity policy as routes. Generated bundles replace legacy game data.
	const catalog = []
	for (const modId of [...new Set([...directories(path.join(root, 'generated/mods')), ...directories(modsRoot)])]) {
		const bundle = path.join(root, 'generated/mods', modId, 'bundle.json')
		const data = fs.existsSync(bundle) ? readJson(bundle)?.data : null
		for (const [collection, type] of [['cards','card'], ['relics','relic'], ['potions','potion'], ['powers','power'], ['characters','character']]) {
			const legacy = path.join(modsRoot, modId, `${collection}.json`)
			const rows = data ? data[collection] : fs.existsSync(legacy) ? readJson(legacy) : []
			if (Array.isArray(rows)) for (const row of rows) if (typeof row?.id === 'string') catalog.push({ type, id: row.id, modId })
		}
	}
	registerPublicEntityRefs(catalog)
	for (const modId of [...new Set([...directories(contentRoot), ...directories(modsRoot)])].sort()) {
		const modDir = path.join(modsRoot, modId)
		const modManifestPath = path.join(modDir, 'manifest.json')
		const bundlePath = path.join(root, 'generated/mods', modId, 'bundle.json')
		const modernDir = path.join(contentRoot, modId)
		const modern = fs.existsSync(path.join(modernDir, 'manifest.json'))
		const wikiDir = modern ? modernDir : path.join(modDir, 'wiki')
		const wikiManifestPath = path.join(wikiDir, 'manifest.json')
		if (!fs.existsSync(wikiManifestPath)) continue
		const modManifest = fs.existsSync(bundlePath) ? readJson(bundlePath)?.manifest : fs.existsSync(modManifestPath) ? readJson(modManifestPath) : null
		if (modManifest && modManifest.id !== modId) {
			errors.push(`Mod manifest id "${modManifest?.id}" does not match directory "${modId}"`)
			continue
		}
		if (!modManifest && !modern) continue

		const wikiManifest = readJson(wikiManifestPath)
		const modVersion =
			typeof wikiManifest?.version === 'string' ? wikiManifest.version : typeof modManifest?.version === 'string' ? modManifest.version : null
		if (!isValidModVersion(modVersion)) {
			errors.push(`Invalid mod wiki version for ${modId}`)
			continue
		}
		if (!Array.isArray(wikiManifest?.pages)) {
			errors.push(`Missing pages array in ${path.relative(root, wikiManifestPath)}`)
			continue
		}

		mods.push({ id: modId, version: modVersion, wikiManifest: path.relative(root, wikiManifestPath).split(path.sep).join('/') })

		for (const page of wikiManifest.pages) {
			const pageSlug = page?.slug
			if (typeof pageSlug !== 'string' || !isValidPageSlug(pageSlug)) {
				errors.push(`Invalid page slug "${pageSlug}" in mod ${modId}`)
				continue
			}
			const pageKey = `${modId}\u0000${pageSlug}`
			if (seenPageKeys.has(pageKey)) {
				errors.push(`Duplicate page slug "${pageSlug}" in mod ${modId}`)
				continue
			}
			seenPageKeys.add(pageKey)

			let entityType = null
			let entityId = null
			let entityModId = null
			if (page.entity != null) {
				if (!ENTITY_TYPES.has(page.entity.type) || typeof page.entity.id !== 'string' || !page.entity.id ||
					(page.entity.modId !== undefined && typeof page.entity.modId !== 'string')) {
					errors.push(`Invalid entity on page "${pageSlug}" in mod ${modId}`)
					continue
				}
				entityType = page.entity.type
				entityModId = page.entity.modId ?? (page.entity.id.includes(':') ? page.entity.id.slice(0, page.entity.id.indexOf(':')) : modId)
				entityId = publicEntityId({ type: entityType, id: page.entity.id,
					modId: page.entity.modId ?? (page.entity.id.includes(':') ? undefined : modId) })
				if (!entityId) { errors.push(`Invalid entity identity on page "${pageSlug}"`); continue }
			}

			pages.push({
				modId,
				modVersion,
				slug: pageSlug,
				pageType: typeof page.pageType === 'string' ? page.pageType : 'documentation',
				title: typeof page.title === 'string' ? page.title : pageSlug,
				entityType,
				entityId,
				entityModId
			})

			if (!Array.isArray(page.sections)) {
				errors.push(`Missing sections on page "${pageSlug}" in mod ${modId}`)
				continue
			}
			const seenKeys = new Set()
			for (const section of page.sections) {
				const sectionKey = section?.key
				if (typeof sectionKey !== 'string' || !isValidSectionKey(sectionKey)) {
					errors.push(`Invalid section key "${sectionKey}" on page "${pageSlug}"`)
					continue
				}
				if (seenKeys.has(sectionKey)) {
					errors.push(`Duplicate section key "${sectionKey}" on page "${pageSlug}"`)
					continue
				}
				seenKeys.add(sectionKey)

				const sourcePrefix = modern ? `content/wiki/${modId}/` : `static/mods/${modId}/wiki/`
				const sourcePath = `${sourcePrefix}${section.file}`
				if (typeof section.file !== 'string' || !isSafeSourcePath(sourcePath) || !sourcePath.startsWith(sourcePrefix)) {
					errors.push(`Unsafe source path "${section.file}" on page "${pageSlug}"`)
					continue
				}
				if (seenPaths.has(sourcePath)) {
					errors.push(`Source path "${sourcePath}" is bound to more than one section`)
					continue
				}
				seenPaths.add(sourcePath)

				const absolute = path.resolve(root, sourcePath)
				const real = fs.existsSync(absolute) ? fs.realpathSync(absolute) : absolute
				const allowedRoot = fs.realpathSync(wikiDir)
				if (!real.startsWith(allowedRoot + path.sep)) {
					errors.push(`Source path escapes the mod wiki directory: "${sourcePath}"`)
					continue
				}
				if (!fs.existsSync(absolute)) {
					errors.push(`Missing source file "${sourcePath}"`)
					continue
				}

				const content = fs.readFileSync(absolute, 'utf8')
				const contentError = validateWikiContent(content)
				if (contentError) {
					errors.push(`Invalid content in "${sourcePath}": ${contentError}`)
					continue
				}

				files.push({
					modId,
					modVersion,
					pageSlug,
					pageType: pages.at(-1).pageType,
					pageTitle: pages.at(-1).title,
					entityType,
					entityId,
					entityModId,
					sectionKey,
					sectionTitle: typeof section.title === 'string' ? section.title : sectionKey,
					sortOrder: Number.isFinite(section.sortOrder) ? section.sortOrder : 0,
					sourcePath: sourcePath.split(path.sep).join('/'),
					contentHash: hashContent(content),
					content
				})
			}
		}
	}

	return { mods, pages, files, errors }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const result = scanModWiki()
	if (result.errors.length) {
		for (const error of result.errors) console.error(`[mod-wiki] ${error}`)
		process.exit(1)
	}
	console.log(JSON.stringify(result, null, 2))
}
