import { parseWikiDocument } from '#lib/wiki-document'
import { WikiCollaborationError } from './access'
import type { SectionState } from './collaboration-types'
import { validateWikiContent } from './validation'

/** Format validation is shared by edits, approval, rollback and source publication. */
export function validateSectionContent(section: Pick<SectionState, 'contentType' | 'sectionKey' | 'identityArchived'>, content: string): void {
	if (section.identityArchived) throw new WikiCollaborationError(409, 'Legacy identity is archived pending attribution review', 'IDENTITY_ARCHIVED')
	const issue = validateWikiContent(content)
	if (issue) throw new WikiCollaborationError(400, issue, 'BAD_CONTENT')
	if (section.contentType === 'markdown') return
	let value: unknown
	try { value = JSON.parse(content) } catch {
		throw new WikiCollaborationError(400, 'Structured content must be valid JSON', 'BAD_CONTENT')
	}
	if (section.sectionKey === 'document' && !parseWikiDocument(value))
		throw new WikiCollaborationError(400, 'Invalid wiki document', 'BAD_CONTENT')
	if (section.contentType === 'table') {
		const table = value as { columns?: unknown; rows?: unknown } | null
		if (!table || !Array.isArray(table.columns) || !table.columns.every((c) => typeof c === 'string') ||
			!Array.isArray(table.rows) || !table.rows.every(Array.isArray))
			throw new WikiCollaborationError(400, 'Invalid wiki table', 'BAD_CONTENT')
	}
}
