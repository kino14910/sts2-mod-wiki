import { describe, expect, it } from 'vitest'
import type { Role } from '#lib/server/auth/permissions'
import { hasPermission } from '#lib/server/auth/permissions'
import type { Actor } from './access'
import type {
	NewProposal,
	ProposalState,
	ProposalStatusUpdate,
	PublishInput,
	RevisionState,
	SectionState,
	WikiEditStore
} from './collaboration-types'
import { submitSectionEdit } from './edit-service'
import { getRevisionDiff, listSectionHistory, revertToRevision } from './history-service'
import { publishRevision } from './publish-service'
import { getProposal, listProposals, reviewProposal } from './review-service'
import { WikiCollaborationError } from './access'

const NAMES: Record<string, string> = {
	'u-member': 'Member',
	'u-trusted': 'Trusted',
	'u-mod': 'Moderator',
	'u-moderator': 'Moderator',
	'u-admin': 'Admin'
}

const actor = (role: Role, userId?: string): Actor => ({
	userId: userId ?? `u-${role}`,
	username: NAMES[`u-${role}`] ?? role,
	role,
	status: 'active'
})

const section = (id: string, content = 'line one\nline two'): SectionState => ({
	id,
	pageId: 'page-1',
	sectionKey: id,
	contentType: 'markdown',
	sortOrder: 0,
	version: 1,
	currentRevisionId: `rev-${id}-1`,
	currentContent: content,
	updatedAt: '2026-01-01T00:00:00.000Z'
})

interface Memory {
	store: WikiEditStore
	sections: Map<string, SectionState>
	revisions: RevisionState[]
	proposals: ProposalState[]
	audits: { action: string }[]
	flags: { simulateRace: boolean; failPublish: boolean }
}

function memoryStore(...initial: SectionState[]): Memory {
	const sections = new Map(initial.map((row) => [row.id, { ...row }]))
	const revisions: RevisionState[] = initial.map((row) => ({
		id: row.currentRevisionId ?? `rev-${row.id}-1`,
		sectionId: row.id,
		revisionNo: 1,
		parentRevisionId: null,
		content: row.currentContent,
		summary: 'Initial import from mod wiki',
		editorId: null,
		editorName: null,
		sourceType: 'mod_seed',
		sourceReference: 'static/mods/sts2/wiki/index/overview.md',
		createdAt: '2026-01-01T00:00:00.000Z'
	}))
	const proposals: ProposalState[] = []
	const audits: { action: string }[] = []
	const flags = { simulateRace: false, failPublish: false }

	const store: WikiEditStore = {
		async findSection(id) {
			return sections.get(id) ?? null
		},
		async findRevision(id) {
			return revisions.find((row) => row.id === id) ?? null
		},
		async listRevisions(sectionId, limit, offset) {
			return revisions
				.filter((row) => row.sectionId === sectionId)
				.sort((a, b) => b.revisionNo - a.revisionNo)
				.slice(offset, offset + limit)
		},
		async maxRevisionNo(sectionId) {
			return revisions
				.filter((row) => row.sectionId === sectionId)
				.reduce((max, row) => Math.max(max, row.revisionNo), 0)
		},
		async listProposals(filter) {
			return proposals
				.filter(
					(row) =>
						(!filter.status?.length || filter.status.includes(row.status)) &&
						(!filter.sectionId || row.sectionId === filter.sectionId)
				)
				.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
				.slice(filter.offset, filter.offset + filter.limit)
		},
		async findProposal(id) {
			return proposals.find((row) => row.id === id) ?? null
		},
		async insertProposal(input: NewProposal) {
			proposals.push({
				id: input.id,
				sectionId: input.sectionId,
				sectionKey: sections.get(input.sectionId)?.sectionKey ?? input.sectionId,
				baseRevisionId: input.baseRevisionId,
				baseVersion: input.baseVersion,
				proposedContent: input.proposedContent,
				currentContent: sections.get(input.sectionId)?.currentContent ?? '',
				summary: input.summary,
				submittedBy: input.submittedBy,
				submittedByName: NAMES[input.submittedBy] ?? input.submittedBy,
				status: 'pending',
				reviewedBy: null,
				reviewedByName: null,
				reviewNote: null,
				createdAt: input.createdAt,
				reviewedAt: null,
				publishedRevisionId: null
			})
		},
		async setProposalStatus(id, update: ProposalStatusUpdate) {
			const row = proposals.find((item) => item.id === id)
			if (!row) return 0
			if (update.onlyIfStatus && row.status !== update.onlyIfStatus) return 0
			row.status = update.status
			if ('reviewedBy' in update) row.reviewedBy = update.reviewedBy ?? null
			if ('reviewNote' in update) row.reviewNote = update.reviewNote ?? null
			if ('reviewedAt' in update) row.reviewedAt = update.reviewedAt ?? null
			if ('publishedRevisionId' in update)
				row.publishedRevisionId = update.publishedRevisionId ?? null
			return 1
		},
		async publish(input: PublishInput) {
			const target = sections.get(input.sectionId)
			if (!target) return { published: false, version: input.expectedVersion, conflict: true }
			if (flags.simulateRace) {
				flags.simulateRace = false
				target.version += 1
				target.currentContent = 'concurrent writer content'
				target.currentRevisionId = 'rev-concurrent'
			}
			if (flags.failPublish)
				return { published: false, version: target.version, conflict: true }
			if (target.version !== input.expectedVersion)
				return { published: false, version: target.version, conflict: true }

			revisions.push({
				id: input.revisionId,
				sectionId: input.sectionId,
				revisionNo: input.revisionNo,
				parentRevisionId: input.parentRevisionId,
				content: input.content,
				summary: input.summary,
				editorId: input.editorId,
				editorName: input.editorId ? (NAMES[input.editorId] ?? null) : null,
				sourceType: input.sourceType,
				sourceReference: input.sourceReference,
				createdAt: input.createdAt
			})
			target.version += 1
			target.currentRevisionId = input.revisionId
			target.currentContent = input.content
			if (input.proposalId) {
				const proposal = proposals.find((row) => row.id === input.proposalId)
				if (proposal) {
					proposal.status = 'approved'
					proposal.reviewedBy = input.actorId ?? null
					proposal.reviewedAt = input.createdAt
					proposal.publishedRevisionId = input.revisionId
					proposal.reviewNote = input.reviewNote ?? null
				}
			}
			for (const proposal of proposals) {
				if (proposal.sectionId === target.id) proposal.currentContent = target.currentContent
			}
			audits.push({ action: input.action ?? 'wiki.section.publish' })
			return { published: true, version: target.version, conflict: false }
		},
		async insertAuditLog(input) {
			audits.push({ action: input.action })
		}
	}

	return { store, sections, revisions, proposals, audits, flags }
}

const editInput = (sectionId: string, baseVersion: number, content: string, who: Actor | null) => ({
	sectionId,
	baseVersion,
	content,
	summary: 'fix typo',
	actor: who
})

describe('server-side permissions', () => {
	it('member proposals never publish content', async () => {
		const db = memoryStore(section('s1'))
		const result = await submitSectionEdit(
			db.store,
			editInput('s1', 1, 'line one\nline TWO', actor('member'))
		)
		expect(result.kind).toBe('proposed')
		expect(result.revisionId).toBeNull()
		expect(db.sections.get('s1')?.currentContent).toBe('line one\nline two')
		expect(db.sections.get('s1')?.version).toBe(1)
		expect(db.revisions).toHaveLength(1)
		expect(db.proposals[0]?.status).toBe('pending')
		expect(db.proposals[0]?.submittedBy).toBe('u-member')
	})

	it('member cannot use the direct publish permission', () => {
		expect(hasPermission(actor('member'), 'wiki:revision:publish')).toBe(false)
		expect(hasPermission(actor('member'), 'wiki:proposal:create')).toBe(true)
	})

	it('trusted publishes immediately and records the editor', async () => {
		const db = memoryStore(section('s1'))
		const result = await submitSectionEdit(
			db.store,
			editInput('s1', 1, 'line one\nline TWO', actor('trusted'))
		)
		expect(result.kind).toBe('published')
		expect(result.version).toBe(2)
		expect(db.sections.get('s1')?.currentContent).toBe('line one\nline TWO')
		expect(db.revisions.at(-1)).toMatchObject({
			sourceType: 'community',
			editorId: 'u-trusted',
			summary: 'fix typo'
		})
		expect(db.proposals).toHaveLength(0)
	})

	it('rejects anonymous, suspended and forged roles on the server', async () => {
		const db = memoryStore(section('s1'))
		await expect(
			submitSectionEdit(db.store, editInput('s1', 1, 'x', null))
		).rejects.toMatchObject({ status: 401 })
		await expect(
			submitSectionEdit(db.store, {
				...editInput('s1', 1, 'x', actor('trusted')),
				actor: { ...actor('trusted'), status: 'suspended' }
			})
		).rejects.toMatchObject({ status: 403 })
		await expect(
			submitSectionEdit(db.store, {
				...editInput('s1', 1, 'x', actor('member')),
				actor: { ...actor('member'), role: '__hacker__' as Role }
			})
		).rejects.toMatchObject({ status: 403 })
		expect(db.revisions).toHaveLength(1)
	})

	it('only moderators/admins can review or revert', async () => {
		const db = memoryStore(section('s1'))
		const proposal = await submitSectionEdit(
			db.store,
			editInput('s1', 1, 'new content', actor('member'))
		)
		await expect(
			reviewProposal(db.store, {
				proposalId: proposal.proposalId!,
				decision: 'approve',
				actor: actor('member')
			})
		).rejects.toMatchObject({ status: 403 })
		await expect(
			revertToRevision(db.store, {
				sectionId: 's1',
				revisionId: 'rev-s1-1',
				actor: actor('member')
			})
		).rejects.toMatchObject({ status: 403 })
	})
})

describe('independent section editing and optimistic locking', () => {
	it('edits one block without touching another', async () => {
		const db = memoryStore(section('s1'), section('s2', 'other content'))
		await submitSectionEdit(
			db.store,
			editInput('s1', 1, 'updated s1', actor('trusted'))
		)
		expect(db.sections.get('s1')?.currentContent).toBe('updated s1')
		expect(db.sections.get('s2')?.currentContent).toBe('other content')
		expect(db.sections.get('s2')?.version).toBe(1)
		expect(db.revisions.filter((row) => row.sectionId === 's2')).toHaveLength(1)
	})

	it('rejects a stale base version', async () => {
		const db = memoryStore(section('s1'))
		await expect(
			submitSectionEdit(db.store, editInput('s1', 0, 'stale', actor('trusted')))
		).rejects.toMatchObject({ status: 409, code: 'VERSION_CONFLICT' })
		expect(db.revisions).toHaveLength(1)
	})

	it('rejects concurrent publishes without leaving an orphan revision', async () => {
		const db = memoryStore(section('s1'))
		db.flags.simulateRace = true
		await expect(
			submitSectionEdit(db.store, editInput('s1', 1, 'my edit', actor('trusted')))
		).rejects.toMatchObject({ status: 409, code: 'VERSION_CONFLICT' })
		expect(db.revisions).toHaveLength(1)
		expect(db.sections.get('s1')?.currentContent).toBe('concurrent writer content')
	})

	it('keeps data consistent when the publish transaction reports failure', async () => {
		const db = memoryStore(section('s1'))
		db.flags.failPublish = true
		await expect(
			submitSectionEdit(db.store, editInput('s1', 1, 'my edit', actor('trusted')))
		).rejects.toBeInstanceOf(WikiCollaborationError)
		expect(db.revisions).toHaveLength(1)
		expect(db.proposals).toHaveLength(0)
		expect(db.sections.get('s1')?.currentContent).toBe('line one\nline two')
		expect(db.audits).toHaveLength(0)
	})

	it('rejects unchanged and unsafe content', async () => {
		const db = memoryStore(section('s1'))
		await expect(
			submitSectionEdit(
				db.store,
				editInput('s1', 1, 'line one\nline two', actor('trusted'))
			)
		).rejects.toMatchObject({ status: 400, code: 'NO_CHANGES' })
		await expect(
			submitSectionEdit(
				db.store,
				editInput('s1', 1, '<script>alert(1)</script>', actor('trusted'))
			)
		).rejects.toMatchObject({ status: 400, code: 'BAD_CONTENT' })
	})
})

describe('moderation', () => {
	async function pendingProposal(db: Memory) {
		const result = await submitSectionEdit(
			db.store,
			editInput('s1', 1, 'line one\nline THREE', actor('member'))
		)
		return result.proposalId!
	}

	it('lists pending proposals with a correct diff', async () => {
		const db = memoryStore(section('s1'))
		const id = await pendingProposal(db)
		const items = await listProposals(db.store, { status: ['pending'] })
		expect(items).toHaveLength(1)
		expect(items[0]?.diff?.additions).toBe(1)
		expect(items[0]?.diff?.deletions).toBe(1)
		const detail = await getProposal(db.store, id)
		expect(detail?.submittedByName).toBe('Member')
	})

	it('approval publishes the proposal and records reviewer/time/result', async () => {
		const db = memoryStore(section('s1'))
		const id = await pendingProposal(db)
		const reviewed = await reviewProposal(db.store, {
			proposalId: id,
			decision: 'approve',
			note: 'looks good',
			actor: actor('moderator')
		})
		expect(reviewed.status).toBe('approved')
		expect(reviewed.reviewedBy).toBe('u-moderator')
		expect(reviewed.reviewedAt).toBeTruthy()
		expect(reviewed.publishedRevisionId).toBeTruthy()
		expect(db.sections.get('s1')?.currentContent).toBe('line one\nline THREE')
		expect(db.revisions.at(-1)).toMatchObject({
			editorId: 'u-member',
			sourceReference: `proposal:${id}`
		})
	})

	it('rejection never changes published content', async () => {
		const db = memoryStore(section('s1'))
		const id = await pendingProposal(db)
		const reviewed = await reviewProposal(db.store, {
			proposalId: id,
			decision: 'reject',
			note: 'not accurate',
			actor: actor('moderator')
		})
		expect(reviewed.status).toBe('rejected')
		expect(reviewed.reviewNote).toBe('not accurate')
		expect(db.sections.get('s1')?.currentContent).toBe('line one\nline two')
		expect(db.revisions).toHaveLength(1)
	})

	it('turns a stale proposal into a conflict instead of overwriting newer content', async () => {
		const db = memoryStore(section('s1'))
		const id = await pendingProposal(db)
		await publishRevision(db.store, {
			sectionId: 's1',
			expectedVersion: 1,
			content: 'published during review',
			summary: 'another editor',
			editorId: 'u-trusted',
			sourceType: 'community',
			sourceReference: null
		})
		const reviewed = await reviewProposal(db.store, {
			proposalId: id,
			decision: 'approve',
			actor: actor('moderator')
		})
		expect(reviewed.status).toBe('conflict')
		expect(db.sections.get('s1')?.currentContent).toBe('published during review')
		expect(db.revisions).toHaveLength(2)
	})

	it('refuses to review the same proposal twice', async () => {
		const db = memoryStore(section('s1'))
		const id = await pendingProposal(db)
		await reviewProposal(db.store, {
			proposalId: id,
			decision: 'reject',
			actor: actor('moderator')
		})
		await expect(
			reviewProposal(db.store, {
				proposalId: id,
				decision: 'approve',
				actor: actor('moderator')
			})
		).rejects.toMatchObject({ status: 409 })
	})
})

describe('history and rollback', () => {
	async function twoPublishes(db: Memory) {
		await submitSectionEdit(db.store, editInput('s1', 1, 'version two', actor('trusted')))
		await submitSectionEdit(db.store, {
			...editInput('s1', 2, 'version three', actor('trusted')),
			actor: actor('moderator')
		})
	}

	it('records an ordered version chain with editor, time, source and summary', async () => {
		const db = memoryStore(section('s1'))
		await twoPublishes(db)
		const history = await listSectionHistory(db.store, 's1')
		expect(history.map((row) => row.revisionNo)).toEqual([3, 2, 1])
		expect(history[1]).toMatchObject({
			sourceType: 'community',
			editorName: 'Trusted',
			summary: 'fix typo'
		})
		expect(history[1]?.parentRevisionId).toBe('rev-s1-1')
	})

	it('returns a parent-based diff for a historical version', async () => {
		const db = memoryStore(section('s1'))
		await twoPublishes(db)
		const firstNew = db.revisions.find((row) => row.revisionNo === 2)!
		const diff = await getRevisionDiff(db.store, 's1', firstNew.id)
		expect(diff?.parentContent).toBe('line one\nline two')
		expect(diff?.diff.additions).toBe(1)
		expect(diff?.diff.deletions).toBe(2)
		expect(await getRevisionDiff(db.store, 's2', firstNew.id)).toBeNull()
	})

	it('rollback creates a new revision and keeps all history', async () => {
		const db = memoryStore(section('s1'))
		await twoPublishes(db)
		const original = db.revisions.find((row) => row.revisionNo === 1)!
		const before = db.revisions.length
		const result = await revertToRevision(db.store, {
			sectionId: 's1',
			revisionId: original.id,
			actor: actor('moderator')
		})
		expect(result.version).toBe(4)
		expect(db.revisions).toHaveLength(before + 1)
		expect(db.revisions.at(-1)).toMatchObject({
			sourceType: 'rollback',
			sourceReference: original.id,
			content: 'line one\nline two'
		})
		expect(db.revisions.filter((row) => row.revisionNo === 1)).toHaveLength(1)
		expect(db.sections.get('s1')?.currentContent).toBe('line one\nline two')
	})

	it('rollback rejects unchanged content and missing revisions', async () => {
		const db = memoryStore(section('s1'))
		await expect(
			revertToRevision(db.store, {
				sectionId: 's1',
				revisionId: 'rev-s1-1',
				actor: actor('moderator')
			})
		).rejects.toMatchObject({ status: 400 })
		await expect(
			revertToRevision(db.store, {
				sectionId: 's1',
				revisionId: 'missing',
				actor: actor('moderator')
			})
		).rejects.toMatchObject({ status: 404 })
	})
})
