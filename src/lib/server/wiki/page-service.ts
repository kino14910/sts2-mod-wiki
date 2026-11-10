import { findGameEntity } from '#lib/data/entities'
import {
	entityKey,
	isValidEntityRef,
	isValidModId,
	modPageKey,
	type EntityRef,
	type PageType,
	type WikiPageRef
} from '#lib/entities'
import {
	findPageByEntity,
	findPageByModSlug,
	findRevisionsByIds,
	listSectionsByPage
} from './repository'
import { composeSections, documentFromSections } from './sections'
import type {
	WikiPageMeta,
	WikiPageRow,
	WikiPageView,
	WikiSectionView,
	WikiSource
} from './types'

const NO_SECTIONS: WikiSectionView[] = []

async function readSections(
	db: D1Database,
	page: WikiPageRow
): Promise<WikiSectionView[]> {
	const rows = await listSectionsByPage(db, page.id)
	const revisionIds = rows.flatMap((row) =>
		row.current_revision_id ? [row.current_revision_id] : []
	)
	const revisions = await findRevisionsByIds(db, revisionIds)
	return composeSections(rows, revisions)
}

function buildView(
	page: WikiPageRef,
	game: ReturnType<typeof findGameEntity>,
	sections: WikiSectionView[],
	row: WikiPageRow | null,
	source: WikiSource,
	slug: string,
	pageType: PageType,
	modId: string | null
): WikiPageView {
	const meta: WikiPageMeta = {
		key: page.kind === 'entity' ? entityKey(page.ref) : modPageKey(page),
		pageId: row?.id ?? null,
		slug,
		modId,
		pageType,
		source,
		sectionCount: sections.length
	}
	return {
		page,
		entity: page.kind === 'entity' ? page.ref : null,
		game,
		sections,
		document: documentFromSections(sections),
		meta
	}
}

export async function loadWikiPage(
	db: D1Database | null,
	ref: EntityRef
): Promise<WikiPageView> {
	const page: WikiPageRef = { kind: 'entity', ref }
	const game = isValidEntityRef(ref) ? findGameEntity(ref) : null
	const slug = entityKey(ref)
	const modId = game ? game.data.mod ?? null : null

	if (!db) return buildView(page, game, NO_SECTIONS, null, 'unavailable', slug, 'entity', modId)

	try {
		const row = await findPageByEntity(db, ref)
		if (!row) return buildView(page, game, NO_SECTIONS, null, 'none', slug, 'entity', modId)
		const sections = await readSections(db, row)
		return buildView(page, game, sections, row, 'd1', row.slug, row.page_type, row.mod_id)
	} catch (error) {
		console.warn('[wiki] D1 read failed', slug, error)
		return buildView(page, game, NO_SECTIONS, null, 'unavailable', slug, 'entity', modId)
	}
}

export async function loadModWikiPage(
	db: D1Database | null,
	modId: string,
	slug: string
): Promise<WikiPageView> {
	const page: WikiPageRef = { kind: 'mod', modId, slug }
	if (!db || !isValidModId(modId)) {
		return buildView(page, null, NO_SECTIONS, null, 'unavailable', slug, 'mod', modId)
	}

	try {
		const row = await findPageByModSlug(db, modId, slug)
		if (!row) return buildView(page, null, NO_SECTIONS, null, 'none', slug, 'mod', modId)
		const sections = await readSections(db, row)
		return buildView(page, null, sections, row, 'd1', row.slug, row.page_type, row.mod_id)
	} catch (error) {
		console.warn('[wiki] D1 read failed', modPageKey(page), error)
		return buildView(page, null, NO_SECTIONS, null, 'unavailable', slug, 'mod', modId)
	}
}
