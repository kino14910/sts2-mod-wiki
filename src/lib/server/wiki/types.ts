import type { CommentStatus, CommentTargetType } from '#lib/comments'
import type { GameEntity } from '#lib/data/entities'
import type { SourceUpdateStatus } from '#lib/wiki-collaboration'
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
export type { SourceUpdateStatus }

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
	incoming_mod_version?: string | null
	status: SourceUpdateStatus
	reviewed_by: string | null
	review_note: string | null
	created_at: string
	reviewed_at: string | null
	published_revision_id: string | null
}

export interface CommentRow {
	id: string
	target_type: CommentTargetType
	target_id: string
	parent_id: string | null
	author_name: string
	author_token_hash: string
	author_ip_hash: string | null
	content: string
	status: CommentStatus
	created_at: string
	updated_at: string
}

export interface CommentInsert {
	id: string
	targetType: CommentTargetType
	targetId: string
	parentId: string | null
	authorName: string
	authorTokenHash: string
	authorIpHash: string | null
	content: string
}

export interface AuditLogInsert {
	id: string
	actorId: string | null
	action: string
	targetType: string
	targetId: string
	metadata?: unknown
}

/** Data access boundary for comments; business rules live in comment-service. */
export interface CommentStore {
	listTopLevel(input: {
		targetType: CommentTargetType
		targetId: string
		limit: number
		offset: number
	}): Promise<CommentRow[]>
	listReplies(parentIds: string[]): Promise<CommentRow[]>
	countTopLevel(targetType: CommentTargetType, targetId: string): Promise<number>
	findComment(id: string): Promise<CommentRow | null>
	/** Optional server-side existence check for non-entity targets such as wiki_section. */
	targetExists?(targetType: CommentTargetType, targetId: string): Promise<boolean>
	countRecentByToken(tokenHash: string, since: string): Promise<number>
	countRecentByIp(ipHash: string, since: string): Promise<number>
	insertComment(input: CommentInsert): Promise<void>
	updateContent(id: string, tokenHash: string, content: string, expected?: { updatedAt: string; content: string }): Promise<number>
	softDelete(id: string, tokenHash: string): Promise<number>
	insertAuditLog(input: AuditLogInsert): Promise<void>
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
