import { afterEach, describe, expect, it } from 'vitest'
import { refreshCardSeedSections } from './card-seed-refresh'
import { sqliteDb } from './testing/sqlite-db'

const connections: ReturnType<typeof sqliteDb>[] = []
afterEach(() => { for (const connection of connections.splice(0)) connection.close() })

interface SetupOptions {
	sourceType?: string
	reference?: string | null
	content?: string
	contentType?: string
	entityId?: string
	pending?: boolean
}

function setup(options: SetupOptions = {}) {
	const {
		sourceType = 'mod_seed',
		reference = 'wiki-seed:card:sts2:Bash:overview',
		content = 'old seed',
		contentType = 'markdown',
		entityId = 'sts2:Bash',
		pending = false
	} = options
	const connection = sqliteDb()
	connections.push(connection)
	connection.sql.prepare(`INSERT INTO wiki_pages (id, entity_type, entity_id, slug)
		VALUES ('page', 'card', ?, ?)`).run(entityId, `card:${entityId}`)
	connection.sql.prepare(`INSERT INTO wiki_sections
		(id, page_id, section_key, content_type, sort_order, version)
		VALUES ('s1', 'page', 'overview', ?, 0, 1)`).run(contentType)
	connection.sql.prepare(`INSERT INTO wiki_revisions
		(id, section_id, revision_no, content, summary, source_type, source_reference)
		VALUES ('r1', 's1', 1, ?, '', ?, ?)`).run(content, sourceType, reference)
	connection.sql.exec(`UPDATE wiki_sections SET current_revision_id = 'r1' WHERE id = 's1'`)
	if (pending) {
		connection.sql.exec(`INSERT INTO users (id, auth_subject, username, email, role)
			VALUES ('u-member', 'member', 'Member', 'member@qq.com', 'member');
			INSERT INTO wiki_edit_proposals (id, section_id, base_revision_id, base_version, proposed_content, submitted_by)
			VALUES ('proposal', 's1', 'r1', 1, 'draft', 'u-member');`)
	}
	return connection
}

function sectionRow(sql: ReturnType<typeof sqliteDb>['sql']) {
	return sql.prepare(`SELECT s.version, s.current_revision_id, r.content, r.source_type, r.source_reference,
		r.parent_revision_id, r.revision_no
		FROM wiki_sections s JOIN wiki_revisions r ON r.id = s.current_revision_id WHERE s.id = 's1'`)
		.get() as {
			version: number
			current_revision_id: string
			content: string
			source_type: string
			source_reference: string | null
			parent_revision_id: string | null
			revision_no: number
		}
}

describe('card seed refresh', () => {
	it('updates an untouched seed revision and records an audit entry', async () => {
		const connection = setup()
		const result = await refreshCardSeedSections(connection.db, {
			modId: 'sts2',
			cardId: 'Bash',
			sections: { overview: 'new seed' }
		})
		expect(result.pageId).toBe('page')
		expect(result.entityId).toBe('sts2:Bash')
		expect(result.items).toEqual([
			{ key: 'overview', sectionId: 's1', status: 'updated', fromVersion: 1, toVersion: 2 }
		])
		expect(sectionRow(connection.sql)).toMatchObject({
			version: 2,
			content: 'new seed',
			source_type: 'mod_update',
			source_reference: 'wiki-seed:card:sts2:Bash:overview',
			parent_revision_id: 'r1',
			revision_no: 2
		})
		const audit = connection.sql.prepare(`SELECT action, target_type, target_id FROM wiki_audit_logs`).get()
		expect(audit).toMatchObject({ action: 'card_seed_refresh', target_type: 'card_seed', target_id: 's1' })
	})

	it('never replaces community or moderator revisions', async () => {
		const connection = setup({ sourceType: 'community', reference: null, content: 'community text' })
		const result = await refreshCardSeedSections(connection.db, {
			modId: 'sts2',
			cardId: 'Bash',
			sections: { overview: 'new seed' }
		})
		expect(result.items[0]).toMatchObject({ status: 'edited' })
		expect(sectionRow(connection.sql)).toMatchObject({ version: 1, content: 'community text', source_type: 'community' })
	})

	it('skips sections with pending proposals', async () => {
		const connection = setup({ pending: true })
		const result = await refreshCardSeedSections(connection.db, {
			modId: 'sts2',
			cardId: 'Bash',
			sections: { overview: 'new seed' }
		})
		expect(result.items[0]).toMatchObject({ status: 'pending' })
		expect(sectionRow(connection.sql)).toMatchObject({ version: 1, content: 'old seed' })
	})

	it('writes nothing during a dry run', async () => {
		const connection = setup()
		const result = await refreshCardSeedSections(connection.db, {
			modId: 'sts2',
			cardId: 'Bash',
			sections: { overview: 'new seed' },
			dryRun: true
		})
		expect(result.items[0]).toMatchObject({ status: 'would-update', fromVersion: 1, toVersion: 2 })
		expect(sectionRow(connection.sql)).toMatchObject({ version: 1, content: 'old seed', current_revision_id: 'r1' })
		expect(connection.sql.prepare('SELECT COUNT(*) AS count FROM wiki_audit_logs').get()).toMatchObject({ count: 0 })
	})

	it('is repeatable: unchanged content is a no-op and refreshed seeds keep updating', async () => {
		const connection = setup()
		const options = { modId: 'sts2', cardId: 'Bash' }
		expect((await refreshCardSeedSections(connection.db, { ...options, sections: { overview: 'seed A' } })).items[0])
			.toMatchObject({ status: 'updated', toVersion: 2 })
		expect((await refreshCardSeedSections(connection.db, { ...options, sections: { overview: 'seed A' } })).items[0])
			.toMatchObject({ status: 'unchanged', fromVersion: 2, toVersion: 2 })
		expect((await refreshCardSeedSections(connection.db, { ...options, sections: { overview: 'seed B' } })).items[0])
			.toMatchObject({ status: 'updated', fromVersion: 2, toVersion: 3 })
		expect(sectionRow(connection.sql)).toMatchObject({ version: 3, content: 'seed B', source_type: 'mod_update' })
	})

	it('detects a concurrent edit and leaves the newer revision in place', async () => {
		const connection = setup()
		connection.state.beforeBatch = () => {
			connection.sql.exec(`INSERT INTO wiki_revisions
				(id, section_id, revision_no, parent_revision_id, content, summary, source_type)
				VALUES ('r2', 's1', 2, 'r1', 'concurrent', '', 'community');
				UPDATE wiki_sections SET version = 2, current_revision_id = 'r2' WHERE id = 's1';`)
		}
		const result = await refreshCardSeedSections(connection.db, {
			modId: 'sts2',
			cardId: 'Bash',
			sections: { overview: 'new seed' }
		})
		expect(result.items[0]).toMatchObject({ status: 'conflict' })
		expect(sectionRow(connection.sql)).toMatchObject({ version: 2, content: 'concurrent', source_type: 'community' })
	})

	it('reports missing pages and non-markdown sections without writing', async () => {
		const empty = sqliteDb()
		connections.push(empty)
		expect(await refreshCardSeedSections(empty.db, {
			modId: 'sts2',
			cardId: 'Bash',
			sections: { overview: 'new seed' }
		})).toMatchObject({ pageId: null, items: [{ key: 'overview', status: 'missing' }] })

		const structured = setup({ contentType: 'structured' })
		const result = await refreshCardSeedSections(structured.db, {
			modId: 'sts2',
			cardId: 'Bash',
			sections: { overview: 'new seed' }
		})
		expect(result.items[0]).toMatchObject({ status: 'unsupported' })
	})

	it('finds legacy bare entity ids as well as scoped ids', async () => {
		const connection = setup({ entityId: 'Bash' })
		const result = await refreshCardSeedSections(connection.db, {
			modId: 'sts2',
			cardId: 'Bash',
			sections: { overview: 'new seed' }
		})
		expect(result).toMatchObject({ entityId: 'Bash', items: [{ status: 'updated' }] })
	})
})
