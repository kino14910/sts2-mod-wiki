import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scanModWiki } from '../../../../scripts/mod-wiki/scan.mjs'

const roots: string[] = []

function makeRoot() {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sts2-mod-wiki-scan-'))
	roots.push(root)
	return root
}

function write(root: string, relative: string, content: string) {
	const target = path.join(root, relative)
	fs.mkdirSync(path.dirname(target), { recursive: true })
	fs.writeFileSync(target, content, 'utf8')
}

function addMod(
	root: string,
	modId: string,
	options: { file?: string; content?: string; gameId?: string } = {}
) {
	const file = options.file ?? 'index/overview.md'
	write(root, `static/mods/${modId}/manifest.json`, JSON.stringify({ id: options.gameId ?? modId }))
	write(
		root,
		`static/mods/${modId}/wiki/manifest.json`,
		JSON.stringify({
			version: '1.0.0',
			pages: [{ slug: 'index', title: 'Overview', sections: [{ key: 'overview', file }] }]
		})
	)
	write(root, `static/mods/${modId}/wiki/${file}`, options.content ?? '# Hello\n\nWiki text.')
}

afterEach(() => {
	for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

describe('mod wiki scanner', () => {
	it('scans multiple mods without colliding on identical file names', () => {
		const root = makeRoot()
		addMod(root, 'fgo')
		addMod(root, 'base')
		const result = scanModWiki(root)
		expect(result.errors).toEqual([])
		expect(result.mods).toHaveLength(2)
		expect(result.pages).toHaveLength(2)
		expect(result.files).toHaveLength(2)
		expect(new Set(result.files.map((file) => file.sourcePath)).size).toBe(2)
		expect(result.files[0].contentHash).toMatch(/^sha256:[a-f0-9]{64}$/)
	})

	it('derives page and section identity from the manifest, not the file path', () => {
		const root = makeRoot()
		addMod(root, 'fgo', { file: 'characters/nero/overview.md' })
		const result = scanModWiki(root)
		expect(result.errors).toEqual([])
		expect(result.files[0].pageSlug).toBe('index')
		expect(result.files[0].sectionKey).toBe('overview')
		expect(result.files[0].sourcePath).toBe('static/mods/fgo/wiki/characters/nero/overview.md')
	})

	it('maps an optional game entity onto a mod page', () => {
		const root = makeRoot()
		write(root, 'static/mods/fgo/manifest.json', JSON.stringify({ id: 'fgo' }))
		write(
			root,
			'static/mods/fgo/wiki/manifest.json',
			JSON.stringify({
				pages: [
					{
						slug: 'characters/nero',
						entity: { type: 'character', id: 'NeroBride' },
						sections: [{ key: 'overview', file: 'characters/nero/overview.md' }]
					}
				]
			})
		)
		write(root, 'static/mods/fgo/wiki/characters/nero/overview.md', '# Nero')
		const result = scanModWiki(root)
		expect(result.errors).toEqual([])
		expect(result.files[0].entityType).toBe('character')
		expect(result.files[0].entityId).toBe('fgo:NeroBride')
	})

	it('preserves explicit cross-mod prefixes and canonicalizes a unique vanilla prefix', () => {
		const root = makeRoot(); addMod(root, 'fgo')
		write(root, 'static/mods/sts2/cards.json', JSON.stringify([{ id: 'Bash' }, { id: 'TeslaCoil' }]))
		write(root, 'static/mods/fgo/cards.json', JSON.stringify([{ id: 'TeslaCoil' }]))
		write(root, 'static/mods/fgo/wiki/manifest.json', JSON.stringify({ pages: [
			{ slug: 'vanilla', entity: { type: 'card', id: 'sts2:Bash' }, sections: [{ key: 'overview', file: 'vanilla.md' }] },
			{ slug: 'collision', entity: { type: 'card', id: 'sts2:TeslaCoil' }, sections: [{ key: 'overview', file: 'collision.md' }] },
			{ slug: 'other', entity: { type: 'card', id: 'other:Shared' }, sections: [{ key: 'overview', file: 'other.md' }] },
			{ slug: 'scoped', entity: { type: 'card', id: 'Shared', modId: 'other' }, sections: [{ key: 'overview', file: 'scoped.md' }] }
		] }))
		for (const file of ['vanilla', 'collision', 'other', 'scoped']) write(root, `static/mods/fgo/wiki/${file}.md`, '# Article')
		const result = scanModWiki(root)
		expect(result.errors).toEqual([])
		expect(result.files.map((f) => f.entityId)).toEqual(['Bash', 'sts2:TeslaCoil', 'other:Shared', 'other:Shared'])
	})

	it('rejects conflicting explicit namespace inputs and malformed prefixes', () => {
		const root = makeRoot(); addMod(root, 'fgo')
		for (const entity of [
			{ type: 'card', id: 'sts2:Bash', modId: 'fgo' },
			{ type: 'card', id: 'other:bad:scope' },
			{ type: 'card', id: 'Bash', modId: 123 }
		]) {
			write(root, 'static/mods/fgo/wiki/manifest.json', JSON.stringify({ pages: [
				{ slug: 'index', entity, sections: [{ key: 'overview', file: 'index/overview.md' }] }
			] }))
			const result = scanModWiki(root)
			expect(result.errors.length).toBeGreaterThan(0)
			expect(result.files).toHaveLength(0)
		}
	})

	it('rejects path traversal and unsafe markup before any database write', () => {
		const root = makeRoot()
		addMod(root, 'fgo', { file: '../../secrets.md', content: '<script>alert(1)</script>' })
		const result = scanModWiki(root)
		expect(result.errors.length).toBeGreaterThan(0)
		expect(result.files).toHaveLength(0)
	})

	it('rejects a mod whose manifest id does not match its directory', () => {
		const root = makeRoot()
		addMod(root, 'fgo', { gameId: 'wrong' })
		expect(scanModWiki(root).errors.length).toBeGreaterThan(0)
	})

	it('rejects duplicate section keys and duplicate source paths', () => {
		const root = makeRoot()
		write(root, 'static/mods/fgo/manifest.json', JSON.stringify({ id: 'fgo' }))
		write(
			root,
			'static/mods/fgo/wiki/manifest.json',
			JSON.stringify({
				pages: [
					{
						slug: 'index',
						sections: [
							{ key: 'overview', file: 'a.md' },
							{ key: 'overview', file: 'b.md' }
						]
					}
				]
			})
		)
		write(root, 'static/mods/fgo/wiki/a.md', '# A')
		write(root, 'static/mods/fgo/wiki/b.md', '# B')
		expect(scanModWiki(root).errors.length).toBeGreaterThan(0)
	})
})
