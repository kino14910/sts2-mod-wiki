declare module '*.mjs' {
	export interface ScannedModWikiFile {
		modId: string
		modVersion: string | null
		pageSlug: string
		pageType: string
		pageTitle: string
		entityType: string | null
		entityId: string | null
		sectionKey: string
		sectionTitle: string
		sortOrder: number
		sourcePath: string
		contentHash: string
		content: string
	}

	export interface ScannedModWiki {
		mods: unknown[]
		pages: unknown[]
		files: ScannedModWikiFile[]
		errors: string[]
	}

	export function scanModWiki(root?: string): ScannedModWiki
}
