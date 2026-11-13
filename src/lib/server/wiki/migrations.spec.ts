import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { sqliteDb } from './testing/sqlite-db'

const connections: ReturnType<typeof sqliteDb>[] = []
afterEach(() => { for (const c of connections.splice(0)) c.close() })
const migration = (name: string) => readFileSync(`migrations/${name}.sql`, 'utf8')
describe('non-destructive collaboration migrations', () => {
	it('preserves authenticated comments, deleted content and replies across the old schema conversion', () => {
		const c = sqliteDb({ migrations: false }); connections.push(c)
		c.sql.exec(migration('0001_wiki_foundation'))
		c.sql.exec(`INSERT INTO users (id,auth_subject,username) VALUES ('alice','alice','Alice');
			INSERT INTO wiki_pages (id,entity_type,entity_id,slug) VALUES ('p','card','Bash','card:Bash');
			INSERT INTO comments (id,page_id,author_id,content,status) VALUES ('parent','p','alice','Original','hidden');
			INSERT INTO comments (id,page_id,parent_id,author_id,content) VALUES ('reply','p','parent','alice','Reply');`)
		c.sql.exec(migration('0003_comments_anonymous')); c.sql.exec(migration('0004_wiki_collaboration')); c.sql.exec(migration('0005_collaboration_integrity'))
		expect(c.sql.prepare('SELECT id,parent_id,content,status FROM comments ORDER BY id').all()).toEqual([
			{ id: 'parent', parent_id: null, content: 'Original', status: 'deleted' },
			{ id: 'reply', parent_id: 'parent', content: 'Reply', status: 'visible' }
		])
		expect(c.sql.prepare("SELECT status FROM comments_authenticated_legacy WHERE id='parent'").get()?.status).toBe('hidden')
		expect(c.sql.prepare('PRAGMA foreign_key_check').all()).toEqual([])
	})
	it('upgrades databases which already applied the original 0003 and preserves anonymous ownership', () => {
		const c = sqliteDb({ migrations: false }); connections.push(c)
		c.sql.exec(migration('0001_wiki_foundation'))
		// Simulate an already-applied original migration, with no authenticated archive.
		c.sql.exec(migration('0003_comments_anonymous').replace('ALTER TABLE comments RENAME TO comments_authenticated_legacy;', 'DROP TABLE comments;'))
		c.sql.exec(`INSERT INTO comments(id,target_type,target_id,author_name,author_token_hash,content) VALUES ('anon','card','Bash','Anon','original-token-hash','Original');`)
		c.sql.exec(migration('0004_wiki_collaboration')); c.sql.exec(migration('0005_collaboration_integrity'))
		c.sql.exec("UPDATE comments SET content='Edited' WHERE id='anon'; UPDATE comments SET status='deleted' WHERE id='anon'")
		expect(c.sql.prepare("SELECT author_token_hash FROM comments WHERE id='anon'").get()?.author_token_hash).toBe('original-token-hash')
		expect(c.sql.prepare("SELECT content,status FROM comment_revisions WHERE comment_id='anon' ORDER BY rowid").all()).toEqual([
			{ content: 'Original', status: 'visible' }, { content: 'Edited', status: 'visible' }, { content: 'Edited', status: 'deleted' }
		])
		expect(c.sql.prepare('PRAGMA foreign_key_check').all()).toEqual([])
	})
})
