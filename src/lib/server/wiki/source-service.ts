import { listSourceOverviewRows, listSourceUpdates, type SourceOverviewRow } from './repository'
import type { WikiSourceUpdateRow } from './types'

export interface SourceSummary {
	sourceId: string
	sourcePath: string
	modId: string | null
	modVersion: string | null
	pageSlug: string
	sectionKey: string
	sourceStatus: string
	sourceHash: string
	currentVersion: number
	hasCommunityDrift: boolean
	lastSyncedAt: string
}

export interface SourceUpdateSummary {
	id: string
	sourceId: string
	sectionId: string
	status: WikiSourceUpdateRow['status']
	baseHash: string
	incomingHash: string
	createdAt: string
	publishedRevisionId: string | null
}

export function summarizeSource(row: SourceOverviewRow): SourceSummary {
	return {
		sourceId: row.id,
		sourcePath: row.source_path,
		modId: row.mod_id,
		modVersion: row.source_mod_version,
		pageSlug: row.slug,
		sectionKey: row.section_key,
		sourceStatus: row.source_status,
		sourceHash: row.source_hash,
		currentVersion: row.version,
		hasCommunityDrift:
			row.current_content !== null && row.current_content !== row.source_content,
		lastSyncedAt: row.last_synced_at
	}
}

export async function getSourceOverview(db: D1Database): Promise<SourceSummary[]> {
	const rows = await listSourceOverviewRows(db)
	return rows.map(summarizeSource)
}

export async function getSourceUpdates(db: D1Database): Promise<SourceUpdateSummary[]> {
	const rows = await listSourceUpdates(db)
	return rows.map((row) => ({
		id: row.id,
		sourceId: row.source_id,
		sectionId: row.section_id,
		status: row.status,
		baseHash: row.base_hash,
		incomingHash: row.incoming_hash,
		createdAt: row.created_at,
		publishedRevisionId: row.published_revision_id
	}))
}
