import { afterEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-svelte'
import { m } from '#lib/paraglide/messages'
import WikiSectionEditor from './WikiSectionEditor.svelte'

afterEach(() => { vi.unstubAllGlobals() })

describe('section editor concurrency', () => {
	it('keeps the opening version and the draft after props refresh and a real conflict response', async () => {
		const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ message: 'Section changed' }), { status: 409, headers: { 'content-type': 'application/json' } }))
		vi.stubGlobal('fetch', request)
		const onRefresh = vi.fn()
		const onSaved = vi.fn()
		const section = { key: 'notes', sectionId: 'notes-id', version: 1, content: 'Original text', contentType: 'markdown' }
		const view = await render(WikiSectionEditor, {
			section, snapshot: { sectionId: 'notes-id', version: 1, content: 'Original text' },
			canPublish: true, onRefresh, onSaved, onCancel: vi.fn()
		})
		const editor = page.getByRole('textbox', { name: m.wiki_edit_content_label() })
		await editor.fill('My unsaved draft')
		await view.rerender({ section: { ...section, version: 2, content: 'Someone else published' } })
		await expect.element(editor).toHaveValue('My unsaved draft')
		await page.getByRole('button', { name: m.wiki_edit_publish(), exact: true }).click()
		await expect.element(page.getByRole('alert')).toHaveTextContent(/draft|草稿/)
		expect(JSON.parse(request.mock.calls[0][1]!.body as string)).toMatchObject({ baseVersion: 1, content: 'My unsaved draft' })
		await expect.element(editor).toHaveValue('My unsaved draft')
		expect(onSaved).not.toHaveBeenCalled()
		expect(onRefresh).toHaveBeenCalledOnce()
		await page.getByRole('button', { name: /Keep draft and use latest version|保留草稿/ }).click()
		await expect.element(editor).toHaveValue('My unsaved draft')
		request.mockResolvedValueOnce(new Response(JSON.stringify({ kind: 'published', sectionId: 'notes-id', version: 3, revisionId: 'r3', proposalId: null }), { headers: { 'content-type': 'application/json' } }))
		await page.getByRole('button', { name: m.wiki_edit_publish(), exact: true }).click()
		await expect.poll(() => onSaved.mock.calls.length).toBe(1)
		expect(JSON.parse(request.mock.calls[1][1]!.body as string)).toMatchObject({ baseVersion: 2, content: 'My unsaved draft' })
		expect(onSaved).toHaveBeenCalledOnce()
	})
})
