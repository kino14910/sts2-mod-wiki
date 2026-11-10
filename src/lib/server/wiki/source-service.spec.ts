import { describe, expect, it } from 'vitest'
import { summarizeSource } from './source-service'
import type { SourceOverviewRow } from './repository'

const row: SourceOverviewRow = {
	id: 'source-1',
	section_id: 'section-1',
	source_type: 'mod',
	source_path: 'static/mods/sts2/wiki/index/overview.md',
	source_hash: 'sha256:base',
	source_content: 'upstream content',
	source_mod_version: '1.0.0',
	source_status: 'active',
	last_synced_at: '2026-01-01T00:00:00.000Z',
	created_at: '2026-01-01T00:00:00.000Z',
	updated_at: '2026-01-01T00:00:00.000Z',
	section_key: 'overview',
	page_id: 'page-1',
	slug: 'index',
	mod_id: 'sts2',
	version: 1,
	current_revision_id: 'revision-1',
	current_content: 'upstream content'
}

describe('source overview business rules', () => {
	it('reports no drift while published content matches the upstream snapshot', () => {
		const summary = summarizeSource(row)
		expect(summary.hasCommunityDrift).toBe(false)
		expect(summary.sourcePath).toBe(row.source_path)
		expect(summary.currentVersion).toBe(1)
	})

	it('detects community edits that diverge from the upstream snapshot', () => {
		expect(summarizeSource({ ...row, current_content: 'community edit' }).hasCommunityDrift).toBe(
			true
		)
	})

	it('does not claim drift when no formal revision is published', () => {
		expect(summarizeSource({ ...row, current_content: null }).hasCommunityDrift).toBe(false)
	})
})
