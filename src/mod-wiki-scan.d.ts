declare module '*.mjs' {
	export interface ScannedModWikiFile {
		modId: string
		modVersion: string | null
		pageSlug: string
		pageType: string
		pageTitle: string
		entityType: string | null
		entityId: string | null
		entityModId?: string | null
		sectionKey: string
		sectionTitle: string
		sortOrder: number
		sourcePath: string
		contentHash: string
		content: string
	}

	export interface ScannedModWiki {
		mods: { id: string; version: string | null; wikiManifest: string }[]
		pages: unknown[]
		files: ScannedModWikiFile[]
		errors: string[]
	}

	export function scanModWiki(root?: string): ScannedModWiki
	export function syncModWiki(db: D1Database, scan: ScannedModWiki, options?: {
		dryRun?: boolean; emitSql?: boolean; assumeFresh?: boolean
	}): Promise<{ plan: { source: string; case: string; reason: string }[]; statements: string[] }>
}
