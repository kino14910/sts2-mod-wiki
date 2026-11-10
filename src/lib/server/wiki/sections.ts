import { parseWikiDocument, type WikiDocument } from '#lib/wiki-document'
import type { WikiRevisionRow, WikiSectionRow, WikiSectionView } from './types'

export const DOCUMENT_SECTION_KEY = 'document'

export const CANONICAL_SECTION_KEYS = [
	'overview',
	'effect-analysis',
	'mechanics',
	'strategy',
	'synergies',
	'history'
] as const

export function composeSections(
	rows: WikiSectionRow[],
	revisions: Map<string, WikiRevisionRow>
): WikiSectionView[] {
	return rows.map((row) => {
		const revision = row.current_revision_id
			? revisions.get(row.current_revision_id)
			: undefined
		return {
			key: row.section_key,
			sectionId: row.id,
			contentType: row.content_type,
			sortOrder: row.sort_order,
			content: revision?.content ?? '',
			version: row.version,
			revisionId: row.current_revision_id,
			revisionNo: revision?.revision_no ?? null,
			sourceType: revision?.source_type ?? null,
			sourceReference: revision?.source_reference ?? null,
			updatedAt: revision?.created_at ?? row.updated_at,
			source: 'd1'
		}
	})
}

export function documentFromSections(sections: WikiSectionView[]): WikiDocument | null {
	const section = sections.find((item) => item.key === DOCUMENT_SECTION_KEY)
	if (!section?.content) return null
	try {
		return parseWikiDocument(JSON.parse(section.content))
	} catch {
		return null
	}
}
