// Shared between server validation and client components; keep this module free of server imports.

/** 'card' = anonymous card tips; 'wiki_section' = discussion attached to one wiki block. */
export type CommentTargetType = 'card' | 'wiki_section'
export type CommentStatus = 'visible' | 'deleted'

export const MAX_COMMENT_LENGTH = 2000
export const MIN_COMMENT_AUTHOR_NAME_LENGTH = 2
export const MAX_COMMENT_AUTHOR_NAME_LENGTH = 32
export const DEFAULT_COMMENT_PAGE_SIZE = 20
export const MAX_COMMENT_PAGE_SIZE = 50

export interface CommentAuthor {
	name: string
}

export interface CommentView {
	id: string
	targetType: CommentTargetType
	targetId: string
	parentId: string | null
	content: string
	status: CommentStatus
	author: CommentAuthor
	/** True when the request carries the anonymous token that created the comment. */
	owned: boolean
	edited: boolean
	createdAt: string
	updatedAt: string
	replies: CommentView[]
}

export interface CommentPage {
	items: CommentView[]
	page: number
	pageSize: number
	total: number
	hasMore: boolean
}
