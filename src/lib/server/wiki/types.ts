import type { GameEntity } from '#lib/data/entities'
import type { WikiDocument } from '#lib/wiki-document'
import type {
	EntityRef,
	PageType,
	RevisionSourceType,
	WikiPageRef
} from '#lib/entities'

export type ContentType = 'markdown' | 'table' | 'structured'
export type WikiSource = 'd1' | 'unavailable' | 'none'
export type SourceStatus = 'active' | 'deleted'
export type SourceUpdateStatus = 'pending' | 'approved' | 'rejected' | 'conflict' | 'withdrawn'

export interface WikiPageRow {
	id: string
	mod_id: string | null
	entity_type: string | null
	entity_id: string | null
	slug: string
	page_type: PageType
	created_at: string
}

export interface WikiSectionRow {
	id: string
	page_id: string
	section_key: string
	content_type: ContentType
	sort_order: number
	current_revision_id: string | null
	version: number
	updated_at: string
}

export interface WikiRevisionRow {
	id: string
	section_id: string
	revision_no: number
	parent_revision_id: string | null
	content: string
	summary: string
	editor_id: string | null
	source_type: RevisionSourceType
	source_reference: string | null
	created_at: string
}

export interface WikiSectionSourceRow {
	id: string
	section_id: string
	source_type: string
	source_path: string
	source_hash: string
	source_content: string
	source_mod_version: string | null
	source_status: SourceStatus
	last_synced_at: string
	created_at: string
	updated_at: string
}

export interface WikiSourceUpdateRow {
	id: string
	source_id: string
	section_id: string
	base_content: string
	current_content: string
	incoming_content: string
	base_hash: string
	incoming_hash: string
	status: SourceUpdateStatus
	reviewed_by: string | null
	review_note: string | null
	created_at: string
	reviewed_at: string | null
	published_revision_id: string | null
}

export interface WikiSectionView {
	key: string
	sectionId: string | null
	contentType: ContentType
	sortOrder: number
	content: string
	version: number
	revisionId: string | null
	revisionNo: number | null
	sourceType: RevisionSourceType | null
	sourceReference: string | null
	updatedAt: string | null
	source: 'd1'
}

export interface WikiPageMeta {
	key: string
	pageId: string | null
	slug: string
	modId: string | null
	pageType: PageType
	source: WikiSource
	sectionCount: number
}

export interface WikiPageView {
	page: WikiPageRef
	entity: EntityRef | null
	game: GameEntity | null
	sections: WikiSectionView[]
	document: WikiDocument | null
	meta: WikiPageMeta
}
