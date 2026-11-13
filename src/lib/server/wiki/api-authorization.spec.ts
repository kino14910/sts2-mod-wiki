import { afterEach, describe, expect, it } from 'vitest'
import { GET as list } from '../../../routes/api/wiki/proposals/+server'
import { GET as detail } from '../../../routes/api/wiki/proposals/[id]/+server'
import { GET as sectionList } from '../../../routes/api/wiki/sections/[id]/proposals/+server'
import { POST as addSection } from '../../../routes/api/wiki/pages/[id]/sections/+server'
import { GET as archives } from '../../../routes/api/admin/wiki/identity-archives/+server'
import { sqliteDb, seedSection } from './testing/sqlite-db'
import { createWikiEditStore } from './collaboration-repository'
import { submitSectionEdit } from './edit-service'

const member = { userId: 'u-member', authSubject: 'member', username: 'Member', role: 'member', status: 'active' } as const
const reviewer = { userId: 'u-mod', authSubject: 'moderator', username: 'Moderator', role: 'moderator', status: 'active' } as const
const admin = { userId: 'u-admin', authSubject: 'admin', username: 'Admin', role: 'admin', status: 'active' } as const
const connections: ReturnType<typeof sqliteDb>[] = []
afterEach(() => { for (const c of connections.splice(0)) c.close() })
function setup() {
	const c = sqliteDb(); connections.push(c); seedSection(c.sql)
	return { ...c, store: createWikiEditStore(c.db) }
}
function event(c: ReturnType<typeof setup>, actor: App.Locals['session'], query = '', id = 's1') {
	return {
		locals: { wikiDb: c.db, session: actor }, params: { id },
		url: new URL('https://wiki.example/api/wiki/proposals' + query)
	} as unknown as Omit<Parameters<typeof detail>[0], 'route'> & { route: { id: never } }
}
async function proposal(c: ReturnType<typeof setup>, actor = member, sectionId = 's1') {
	return submitSectionEdit(c.store, { sectionId, baseVersion: 1, content: 'private draft', actor })
}
async function items(response: Response | Promise<Response>) {
	const body = await (await response).json() as { items: { id: string }[] }
	return body.items
}

describe('proposal API authorization with real SQL', () => {
	it('limits identity archive review to moderators and administrators', async () => {
		const c = setup()
		await expect(archives(event(c, null))).rejects.toMatchObject({ status: 403 })
		await expect(archives(event(c, member))).rejects.toMatchObject({ status: 403 })
		const response = await archives(event(c, reviewer))
		expect(response.headers.get('cache-control')).toBe('no-store')
		expect(await response.json()).toEqual({ pages: [], comments: [], mappings: [] })
	})
	it('denies anonymous and suspended viewers on all draft read endpoints', async () => {
		const c = setup(), p = await proposal(c)
		for (const actor of [null, { ...member, status: 'suspended' as const }]) {
			const status = actor ? 403 : 401
			await expect(list(event(c, actor))).rejects.toMatchObject({ status })
			await expect(sectionList(event(c, actor))).rejects.toMatchObject({ status })
			await expect(detail(event(c, actor, '', p.proposalId!))).rejects.toMatchObject({ status })
		}
	})
	it('limits members to their own drafts while reviewers can inspect the queue', async () => {
		const c = setup(), own = await proposal(c)
		c.sql.exec("INSERT INTO users(id,auth_subject,username,role) VALUES ('other','other','Other','member')")
		const other = { ...member, userId: 'other' }
		const foreign = await submitSectionEdit(c.store, { sectionId: 's1', baseVersion: 1, content: 'other draft', actor: other })
		expect((await items(list(event(c, member)))).map((p) => p.id)).toEqual([own.proposalId])
		expect(await items(sectionList(event(c, member)))).toHaveLength(1)
		await expect(detail(event(c, member, '', foreign.proposalId!))).rejects.toMatchObject({ status: 403 })
		expect(await (await detail(event(c, reviewer, '', foreign.proposalId!))).json()).toMatchObject({ id: foreign.proposalId })
		expect(await items(list(event(c, reviewer)))).toHaveLength(2)
	})
	it('applies page and section filters before returning draft content', async () => {
		const c = setup(); await proposal(c)
		c.sql.exec(`INSERT INTO wiki_pages(id,entity_type,entity_id,slug) VALUES ('page2','card','Other','card:Other');
			INSERT INTO wiki_sections(id,page_id,section_key,version) VALUES ('s2','page2','overview',1);`)
		await proposal(c, member, 's2')
		expect(await items(list(event(c, reviewer, '?pageId=page')))).toHaveLength(1)
		expect(await items(list(event(c, reviewer, '?sectionId=s2')))).toHaveLength(1)
		expect(await items(list(event(c, reviewer, '?pageId=page&sectionId=s2')))).toEqual([])
	})
	it('requires section management permission and preserves existing sections on duplicates', async () => {
		const c = setup()
		const request = () => new Request('https://wiki.example/api/wiki/pages/page/sections', {
			method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'notes' })
		})
		const create = (actor: App.Locals['session']) => addSection({ ...event(c, actor, '', 'page'), request: request() })
		await expect(create(member)).rejects.toMatchObject({ status: 403 })
		await expect(create(null)).rejects.toMatchObject({ status: 401 })
		expect((await create(admin)).status).toBe(201)
		await expect(create(admin)).rejects.toMatchObject({ status: 409 })
		expect(c.sql.prepare("SELECT COUNT(*) AS n FROM wiki_revisions r JOIN wiki_sections s ON s.id=r.section_id WHERE s.page_id='page'").get()?.n).toBe(2)
		expect(c.sql.prepare("SELECT COUNT(*) AS n FROM wiki_audit_logs WHERE action='wiki.section.create'").get()?.n).toBe(1)
		expect((await c.store.findSection('s1'))?.currentContent).toBe('baseline')
		expect(c.sql.prepare('PRAGMA foreign_key_check').all()).toEqual([])
	})
})
