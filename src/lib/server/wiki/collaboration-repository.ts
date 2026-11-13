import { insertAuditLog, maxRevisionNo } from './repository'
import { WikiCollaborationError } from './access'
import type {
	NewProposal,
	ProposalState,
	ProposalStatusUpdate,
	PublishInput,
	PublishResult,
	RevisionState,
	SectionState,
	WikiEditStore
} from './collaboration-types'

// D1 returns raw column names, so every column is aliased to the camelCase store contract.
const SECTION_SELECT = `
	SELECT s.id AS id, s.page_id AS pageId, s.section_key AS sectionKey,
		s.content_type AS contentType, s.sort_order AS sortOrder, s.version AS version,
		EXISTS (SELECT 1 FROM wiki_identity_archives a WHERE a.page_id = s.page_id) AS identityArchived,
		s.current_revision_id AS currentRevisionId,
		COALESCE(r.content, '') AS currentContent, s.updated_at AS updatedAt
	FROM wiki_sections s
	LEFT JOIN wiki_revisions r ON r.id = s.current_revision_id`

const REVISION_COLUMNS = `
	r.id AS id, r.section_id AS sectionId, r.revision_no AS revisionNo,
	r.parent_revision_id AS parentRevisionId, r.content AS content, r.summary AS summary,
	r.editor_id AS editorId, u.username AS editorName, r.source_type AS sourceType,
	r.source_reference AS sourceReference, r.created_at AS createdAt`

const PROPOSAL_COLUMNS = `
	p.id AS id, p.section_id AS sectionId, s.section_key AS sectionKey,
	p.base_revision_id AS baseRevisionId, p.base_version AS baseVersion,
	p.proposed_content AS proposedContent,
	COALESCE(cur.content, '') AS currentContent, p.summary AS summary,
	p.submitted_by AS submittedBy, su.username AS submittedByName, p.status AS status,
	p.reviewed_by AS reviewedBy, ru.username AS reviewedByName, p.review_note AS reviewNote,
	p.created_at AS createdAt, p.reviewed_at AS reviewedAt,
	p.published_revision_id AS publishedRevisionId`

const PROPOSAL_JOINS = `
	FROM wiki_edit_proposals p
	JOIN wiki_sections s ON s.id = p.section_id
	LEFT JOIN wiki_revisions cur ON cur.id = s.current_revision_id
	LEFT JOIN users su ON su.id = p.submitted_by
	LEFT JOIN users ru ON ru.id = p.reviewed_by`

function statement(db: D1Database, sql: string, params: unknown[]): D1PreparedStatement {
	// D1 rejects `undefined` bind values (unlike better-sqlite3); optional fields must be NULL.
	return db.prepare(sql).bind(...params.map((value) => (value === undefined ? null : value))) as D1PreparedStatement
}

/**
 * D1 implementation of the collaboration store. Publishing uses a single `batch` (one
 * transaction): every statement is guarded by the section version, so a concurrent publish
 * turns the whole batch into a no-op instead of partially writing history.
 */
export function createWikiEditStore(db: D1Database): WikiEditStore {
	return {
		async findSection(sectionId): Promise<SectionState | null> {
			return db
				.prepare(`${SECTION_SELECT} WHERE s.id = ? LIMIT 1`)
				.bind(sectionId)
				.first<SectionState>()
		},

		async findRevision(revisionId): Promise<RevisionState | null> {
			return db
				.prepare(
					`SELECT ${REVISION_COLUMNS} FROM wiki_revisions r LEFT JOIN users u ON u.id = r.editor_id WHERE r.id = ? LIMIT 1`
				)
				.bind(revisionId)
				.first<RevisionState>()
		},

		async listRevisions(sectionId, limit, offset): Promise<RevisionState[]> {
			const { results } = await db
				.prepare(
					`SELECT ${REVISION_COLUMNS} FROM wiki_revisions r LEFT JOIN users u ON u.id = r.editor_id
					WHERE r.section_id = ? ORDER BY r.revision_no DESC LIMIT ? OFFSET ?`
				)
				.bind(sectionId, limit, offset)
				.all<RevisionState>()
			return results
		},

		maxRevisionNo(sectionId): Promise<number> {
			return maxRevisionNo(db, sectionId)
		},

		async listProposals(filter): Promise<ProposalState[]> {
			const where: string[] = []
			const params: unknown[] = []
			if (filter.status?.length) {
				where.push(`p.status IN (${filter.status.map(() => '?').join(', ')})`)
				params.push(...filter.status)
			}
			if (filter.sectionId) {
				where.push('p.section_id = ?')
				params.push(filter.sectionId)
			}
			if (filter.submittedBy) {
				where.push('p.submitted_by = ?')
				params.push(filter.submittedBy)
			}
			if (filter.pageId) {
				where.push('s.page_id = ?')
				params.push(filter.pageId)
			}
			const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
			const { results } = await db
				.prepare(
					`SELECT ${PROPOSAL_COLUMNS} ${PROPOSAL_JOINS} ${clause}
					ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`
				)
				.bind(...params, filter.limit, filter.offset)
				.all<ProposalState>()
			return results
		},

		async findProposal(proposalId): Promise<ProposalState | null> {
			return db
				.prepare(`SELECT ${PROPOSAL_COLUMNS} ${PROPOSAL_JOINS} WHERE p.id = ? LIMIT 1`)
				.bind(proposalId)
				.first<ProposalState>()
		},

		async insertProposal(input: NewProposal): Promise<void> {
			const insert = db.prepare(
					`INSERT INTO wiki_edit_proposals
					(id, section_id, base_revision_id, base_version, proposed_content, summary, submitted_by, status, created_at)
					SELECT ?, ?, ?, ?, ?, ?, ?, 'pending', ?
					WHERE EXISTS (SELECT 1 FROM wiki_sections WHERE id = ? AND version = ? AND current_revision_id IS ?
					AND NOT EXISTS (SELECT 1 FROM wiki_identity_archives a WHERE a.page_id = wiki_sections.page_id))`
				)
				.bind(
					input.id,
					input.sectionId,
					input.baseRevisionId,
					input.baseVersion,
					input.proposedContent,
					input.summary,
					input.submittedBy,
					input.createdAt,
					input.sectionId, input.baseVersion, input.baseRevisionId
				)
			const results = await db.batch([
				insert,
				statement(db,
					`INSERT INTO wiki_audit_logs (id, actor_id, action, target_type, target_id, metadata_json)
					 SELECT ?, ?, 'wiki.proposal.create', 'wiki_section', ?, ?
					 WHERE EXISTS (SELECT 1 FROM wiki_edit_proposals WHERE id = ?)`,
					[crypto.randomUUID(), input.submittedBy, input.sectionId,
					 JSON.stringify({ proposalId: input.id, baseVersion: input.baseVersion }), input.id])
			])
			if (Number(results[0].meta?.changes ?? 0) !== 1)
				throw new WikiCollaborationError(409, 'Section changed while submitting the proposal', 'VERSION_CONFLICT')
		},

		async setProposalStatus(proposalId, update: ProposalStatusUpdate): Promise<number> {
			const sets = ['status = ?']
			const params: unknown[] = [update.status]
			const optional: [keyof ProposalStatusUpdate, string][] = [
				['reviewedBy', 'reviewed_by'],
				['reviewNote', 'review_note'],
				['reviewedAt', 'reviewed_at'],
				['publishedRevisionId', 'published_revision_id']
			]
			for (const [key, column] of optional) {
				if (!(key in update)) continue
				sets.push(`${column} = ?`)
				params.push((update[key] as string | null | undefined) ?? null)
			}
			let sql = `UPDATE wiki_edit_proposals SET ${sets.join(', ')} WHERE id = ?`
			params.push(proposalId)
			if (update.onlyIfStatus) {
				sql += ' AND status = ?'
				params.push(update.onlyIfStatus)
			}
			if (!update.audit) {
				const result = await db.prepare(sql).bind(...params).run()
				return Number(result.meta?.changes ?? 0)
			}
			const results = await db.batch([
				statement(db, sql, params),
				statement(db,
					`INSERT INTO wiki_audit_logs (id, actor_id, action, target_type, target_id, metadata_json)
					 SELECT ?, ?, ?, 'wiki_proposal', ?, ? WHERE changes() = 1`,
					[crypto.randomUUID(), update.audit.actorId, update.audit.action, proposalId,
					 JSON.stringify(update.audit.metadata ?? {})])
			])
			return Number(results[0].meta?.changes ?? 0)
		},

		async publish(input: PublishInput): Promise<PublishResult> {
			const guards = [`EXISTS (SELECT 1 FROM wiki_sections WHERE id = ? AND version = ? AND current_revision_id IS ?
				AND NOT EXISTS (SELECT 1 FROM wiki_identity_archives a WHERE a.page_id = wiki_sections.page_id))`]
			const guardParams: unknown[] = [input.sectionId, input.expectedVersion, input.parentRevisionId]
			if (input.proposalId) {
				guards.push(`EXISTS (SELECT 1 FROM wiki_edit_proposals
					WHERE id = ? AND section_id = ? AND status = 'pending'
					AND base_version = ? AND base_revision_id IS ?)`)
				guardParams.push(input.proposalId, input.sectionId, input.expectedVersion, input.parentRevisionId)
			}
			if (input.sourceUpdate) {
				guards.push(`EXISTS (SELECT 1 FROM wiki_source_updates u
					JOIN wiki_section_sources src ON src.id = u.source_id
					WHERE u.id = ? AND u.source_id = ? AND u.section_id = ?
					AND u.status IN ('pending', 'conflict') AND u.base_hash = ? AND u.incoming_hash = ?
					AND src.source_hash = u.base_hash AND src.source_status = 'active')`)
				guardParams.push(input.sourceUpdate.id, input.sourceUpdate.sourceId, input.sectionId,
					input.sourceUpdate.baseHash, input.sourceUpdate.incomingHash)
			}
			const statements: D1PreparedStatement[] = [
				// 1. Only create the revision when the caller still holds the expected version.
				statement(
					db,
					`INSERT INTO wiki_revisions
					(id, section_id, revision_no, parent_revision_id, content, summary, editor_id, source_type, source_reference, created_at)
					SELECT ?, ?, (SELECT COALESCE(MAX(revision_no), 0) + 1 FROM wiki_revisions WHERE section_id = ?), ?, ?, ?, ?, ?, ?, ?
					WHERE ${guards.join(' AND ')}`,
					[
						input.revisionId,
						input.sectionId,
						input.sectionId,
						input.parentRevisionId,
						input.content,
						input.summary,
						input.editorId,
						input.sourceType,
						input.sourceReference,
						input.createdAt,
						...guardParams
					]
				),
				// A skipped insert must also skip the link; zero-row CAS is a normal conflict.
				statement(
					db,
					`UPDATE wiki_sections SET current_revision_id = ?, version = version + 1, updated_at = ?
					WHERE id = ? AND version = ? AND EXISTS (SELECT 1 FROM wiki_revisions WHERE id = ?)`,
					[input.revisionId, input.createdAt, input.sectionId, input.expectedVersion, input.revisionId]
				)
			]

			if (input.proposalId) {
				statements.push(
					statement(
						db,
						`UPDATE wiki_edit_proposals
						SET status = 'approved', reviewed_by = ?, review_note = ?, reviewed_at = ?, published_revision_id = ?
						WHERE id = ? AND status = 'pending' AND base_version = ?
						AND EXISTS (SELECT 1 FROM wiki_revisions WHERE id = ?)`,
						[
							input.actorId ?? null,
							input.reviewNote ?? null,
							input.createdAt,
							input.revisionId,
							input.proposalId,
							input.expectedVersion,
							input.revisionId
						]
					)
				)
			}
			if (input.sourceUpdate) {
				const source = input.sourceUpdate
				statements.push(
					statement(db, `UPDATE wiki_section_sources
						SET source_hash = ?, source_content = ?, source_mod_version = ?, source_status = 'active',
						last_synced_at = ?, updated_at = ? WHERE id = ?
						AND EXISTS (SELECT 1 FROM wiki_revisions WHERE id = ?)`,
						[source.incomingHash, input.content, source.modVersion, input.createdAt, input.createdAt,
						 source.sourceId, input.revisionId]),
					statement(db, `UPDATE wiki_source_updates SET status = 'approved', reviewed_by = ?,
						review_note = ?, reviewed_at = ?, published_revision_id = ? WHERE id = ?
						AND EXISTS (SELECT 1 FROM wiki_revisions WHERE id = ?)`,
						[input.actorId, input.reviewNote, input.createdAt, input.revisionId, source.id, input.revisionId])
				)
			}

			// 4. Audit only when the publish actually landed.
			statements.push(
				statement(
					db,
					`INSERT INTO wiki_audit_logs (id, actor_id, action, target_type, target_id, metadata_json)
					SELECT ?, ?, ?, ?, ?, ?
					WHERE EXISTS (
						SELECT 1 FROM wiki_sections
						WHERE id = ? AND current_revision_id = ? AND version = ?
					)`,
					[
						crypto.randomUUID(),
						input.actorId ?? null,
						input.action ?? 'wiki.section.publish',
						'wiki_section',
						input.sectionId,
						JSON.stringify({
							revisionId: input.revisionId,
							revisionNo: input.revisionNo,
							sourceType: input.sourceType,
							sourceReference: input.sourceReference,
							proposalId: input.proposalId ?? null,
							sourceUpdateId: input.sourceUpdate?.id ?? null
						}),
						input.sectionId,
						input.revisionId,
						input.expectedVersion + 1
					]
				)
			)

			// Use the result of our transaction. A later head cannot invalidate this publication.
			const results = await db.batch(statements)
			const published = Number(results[0].meta?.changes ?? 0) === 1
			return { published, version: input.expectedVersion + (published ? 1 : 0), conflict: !published }
		},

		insertAuditLog(input): Promise<void> {
			return insertAuditLog(db, input)
		}
	}
}
