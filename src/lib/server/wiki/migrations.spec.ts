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
	it('widens comment targets to relics without losing replies or revision history', () => {
		const c = sqliteDb({ migrations: false }); connections.push(c)
		for (const name of ['0001_wiki_foundation', '0003_comments_anonymous', '0004_wiki_collaboration', '0005_collaboration_integrity', '0006_entity_identity', '0007_identity_data_epoch'])
			c.sql.exec(migration(name))
		c.sql.exec(`INSERT INTO comments (id,target_type,target_id,author_name,author_token_hash,content)
				VALUES ('parent','card','Bash','Alice','token-hash','Original'),
				('reply','card','Bash','Bob','other-hash','Reply');
			UPDATE comments SET parent_id='parent' WHERE id='reply'`)
		c.sql.exec(migration('0012_relic_comment_target'))
		expect(c.sql.prepare('SELECT id,parent_id,content FROM comments ORDER BY id').all()).toEqual([
			{ id: 'parent', parent_id: null, content: 'Original' },
			{ id: 'reply', parent_id: 'parent', content: 'Reply' }
		])
		c.sql.exec("INSERT INTO comments (id,target_type,target_id,author_name,author_token_hash,content) VALUES ('relic','relic','PaperFrog','Alice','token-hash','Relic tip')")
		c.sql.exec("UPDATE comments SET content='Edited tip' WHERE id='relic'")
		expect(c.sql.prepare("SELECT comment_id,content FROM comment_revisions WHERE comment_id='relic' ORDER BY created_at").all())
			.toEqual([{ comment_id: 'relic', content: 'Relic tip' }, { comment_id: 'relic', content: 'Edited tip' }])
		expect(c.sql.prepare('PRAGMA foreign_key_check').all()).toEqual([])
	})
	it('adds comment author accounts while keeping anonymous comments intact', () => {
		const c = sqliteDb({ migrations: false }); connections.push(c)
		for (const name of ['0001_wiki_foundation', '0003_comments_anonymous', '0004_wiki_collaboration', '0005_collaboration_integrity', '0006_entity_identity', '0007_identity_data_epoch', '0012_relic_comment_target'])
			c.sql.exec(migration(name))
		c.sql.exec(`INSERT INTO users (id,auth_subject,username) VALUES ('alice','alice@qq.com','Alice');
			INSERT INTO comments (id,target_type,target_id,author_name,author_token_hash,content)
			VALUES ('anonymous','card','Bash','Anonymous','token-hash','Old tip');`)
		c.sql.exec(migration('0013_comment_authors'))
		expect(c.sql.prepare('SELECT author_user_id,author_avatar_url FROM comments WHERE id=?').get('anonymous'))
			.toEqual({ author_user_id: null, author_avatar_url: null })
		c.sql.exec(`INSERT INTO comments (id,target_type,target_id,author_name,author_user_id,author_avatar_url,author_token_hash,content)
			VALUES ('signed','card','Bash','Alice','alice','https://q.qlogo.cn/avatar','another-hash','Account tip')`)
		expect(c.sql.prepare('SELECT author_user_id,author_avatar_url FROM comments WHERE id=?').get('signed'))
			.toEqual({ author_user_id: 'alice', author_avatar_url: 'https://q.qlogo.cn/avatar' })
		expect(c.sql.prepare('PRAGMA foreign_key_check').all()).toEqual([])
	})
	it('adds QQ email and password columns without changing existing accounts', () => {
		const c = sqliteDb({ migrations: false }); connections.push(c)
		c.sql.exec(migration('0001_wiki_foundation'))
		c.sql.exec("INSERT INTO users (id,auth_subject,username,role) VALUES ('alice','alice','Alice','admin')")
		c.sql.exec(migration('0008_user_email')); c.sql.exec(migration('0009_email_password'))
		expect(c.sql.prepare('SELECT id,auth_subject,role,email,password_hash FROM users').get()).toEqual({
			id: 'alice', auth_subject: 'alice', role: 'admin', email: null, password_hash: null
		})
		c.sql.exec("INSERT INTO users (id,auth_subject,username,email,password_hash) VALUES ('bob','bob@qq.com','Bob','bob@qq.com','pbkdf2$hash')")
		expect(c.sql.prepare("SELECT email,password_hash FROM users WHERE id='bob'").get()).toEqual({
			email: 'bob@qq.com', password_hash: 'pbkdf2$hash'
		})
		expect(() => c.sql.exec("INSERT INTO users (id,auth_subject,username,email) VALUES ('clone','clone@qq.com','Clone','bob@qq.com')")).toThrow()
		expect(c.sql.prepare('PRAGMA foreign_key_check').all()).toEqual([])
	})
	it('adds the shared auth rate limit table without rewriting existing accounts', () => {
		const c = sqliteDb({ migrations: false }); connections.push(c)
		c.sql.exec(migration('0001_wiki_foundation'))
		c.sql.exec("INSERT INTO users (id,auth_subject,username,role) VALUES ('alice','alice@qq.com','Alice','member')")
		c.sql.exec(migration('0011_auth_rate_limits'))
		expect(c.sql.prepare('SELECT role FROM users WHERE id = ?').get('alice')).toEqual({ role: 'member' })
		c.sql.exec("INSERT INTO auth_rate_limits (key, attempts, window_start) VALUES ('register:ip', 1, 1000)")
		expect(c.sql.prepare('SELECT key, attempts FROM auth_rate_limits').get()).toEqual({ key: 'register:ip', attempts: 1 })
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
