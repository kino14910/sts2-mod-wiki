export const MAX_WIKI_CONTENT_LENGTH = 100_000
export const MAX_SOURCE_PATH_LENGTH = 300
export const MAX_SECTION_KEY_LENGTH = 64
export const MAX_PAGE_SLUG_LENGTH = 191

const SECTION_KEY = /^[a-z0-9][a-z0-9-]*$/
const SLUG_SEGMENT = /^[a-zA-Z0-9._-]+$/
const FORBIDDEN_MARKUP = /<\s*(script|style|iframe|object|embed|svelte:|link|meta)\b|javascript:|\{@html|\{#each|\{#if|\{@render/is

export function isValidSectionKey(value: string): boolean {
	return (
		value.length > 0 &&
		value.length <= MAX_SECTION_KEY_LENGTH &&
		SECTION_KEY.test(value)
	)
}

export function isValidPageSlug(value: string): boolean {
	if (value.length === 0 || value.length > MAX_PAGE_SLUG_LENGTH) return false
	if (value.startsWith('/') || value.endsWith('/') || value.includes('..')) return false
	return value.split('/').every((segment) => segment.length > 0 && SLUG_SEGMENT.test(segment))
}

export function isSafeSourcePath(value: string): boolean {
	if (value.length === 0 || value.length > MAX_SOURCE_PATH_LENGTH) return false
	if (value.startsWith('/') || value.includes('\\') || value.includes('..')) return false
	if (!value.endsWith('.md')) return false
	const match = /^(?:static\/mods\/([^/]+)\/wiki|content\/wiki\/([^/]+))\/(.+)$/.exec(value)
	if (!match) return false
	return /^[a-z0-9][a-z0-9._-]*$/.test(match[1] ?? match[2]) && isValidPageSlug(match[3].replace(/\.md$/, ''))
}

export function validateWikiContent(value: string): string | null {
	if (typeof value !== 'string') return 'content must be a string'
	if (value.length > MAX_WIKI_CONTENT_LENGTH) return 'content exceeds maximum length'
	if (value.includes('\u0000')) return 'content contains a null byte'
	if (FORBIDDEN_MARKUP.test(value)) return 'content contains executable markup'
	return null
}

export function isValidModVersion(value: string | null): boolean {
	return value === null || (value.length > 0 && value.length <= 64 && !/[\u0000-\u001f]/.test(value))
}
