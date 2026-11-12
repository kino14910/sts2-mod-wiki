import { insertAuditLog, maxRevisionNo } from './repository'
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
			await db
				.prepare(
					`INSERT INTO wiki_edit_proposals
					(id, section_id, base_revision_id, base_version, proposed_content, summary, submitted_by, status, created_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
				)
				.bind(
					input.id,
					input.sectionId,
					input.baseRevisionId,
					input.baseVersion,
					input.proposedContent,
					input.summary,
					input.submittedBy,
					input.createdAt
				)
				.run()
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
			const result = await db.prepare(sql).bind(...params).run()
			return Number(result.meta?.changes ?? 0)
		},

		async publish(input: PublishInput): Promise<PublishResult> {
			const statements: D1PreparedStatement[] = [
				// 1. Only create the revision when the caller still holds the expected version.
				statement(
					db,
					`INSERT INTO wiki_revisions
					(id, section_id, revision_no, parent_revision_id, content, summary, editor_id, source_type, source_reference, created_at)
					SELECT ?, ?, (SELECT COALESCE(MAX(revision_no), 0) + 1 FROM wiki_revisions WHERE section_id = ?), ?, ?, ?, ?, ?, ?, ?
					WHERE EXISTS (SELECT 1 FROM wiki_sections WHERE id = ? AND version = ?)`,
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
						input.sectionId,
						input.expectedVersion
					]
				),
				// 2. Conditional link is the optimistic lock. If step 1 skipped, the FK on
				//    current_revision_id fails and D1 rolls the entire batch back.
				statement(
					db,
					`UPDATE wiki_sections SET current_revision_id = ?, version = version + 1, updated_at = ?
					WHERE id = ? AND version = ?`,
					[input.revisionId, input.createdAt, input.sectionId, input.expectedVersion]
				)
			]

			if (input.proposalId) {
				statements.push(
					statement(
						db,
						`UPDATE wiki_edit_proposals
						SET status = 'approved', reviewed_by = ?, review_note = ?, reviewed_at = ?, published_revision_id = ?
						WHERE id = ? AND status = 'pending' AND base_version = ?`,
						[
							input.actorId ?? null,
							input.reviewNote ?? null,
							input.createdAt,
							input.revisionId,
							input.proposalId,
							input.expectedVersion
						]
					)
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
							proposalId: input.proposalId ?? null
						}),
						input.sectionId,
						input.revisionId,
						input.expectedVersion + 1
					]
				)
			)

			await db.batch(statements)

			// Verification by identity is more reliable than per-statement `meta.changes`.
			const linked = await db
				.prepare('SELECT version FROM wiki_sections WHERE id = ? AND current_revision_id = ? LIMIT 1')
				.bind(input.sectionId, input.revisionId)
				.first<{ version: number }>()
			if (linked && Number(linked.version) === input.expectedVersion + 1) {
				return { published: true, version: Number(linked.version), conflict: false }
			}

			// A concurrent writer won: remove the unlinked revision (never referenced by any
			// section) so history only ever contains published versions.
			await db
				.prepare(
					'DELETE FROM wiki_revisions WHERE id = ? AND NOT EXISTS (SELECT 1 FROM wiki_sections WHERE current_revision_id = ?)'
				)
				.bind(input.revisionId, input.revisionId)
				.run()
			return { published: false, version: input.expectedVersion, conflict: true }
		},

		insertAuditLog(input): Promise<void> {
			return insertAuditLog(db, input)
		}
	}
}
