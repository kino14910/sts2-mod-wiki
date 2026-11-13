import { afterEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-svelte'
import WikiHeading from './WikiHeading.svelte'

afterEach(() => { vi.restoreAllMocks() })

describe('wiki heading actions', () => {
	it('copies the current page with a stable section anchor and retains heading semantics', async () => {
		const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
		await render(WikiHeading, { id: 'Obtaining_Bash', title: 'Obtaining Bash', level: 3 })
		await expect.element(page.getByRole('heading', { name: 'Obtaining Bash', level: 3 })).toBeVisible()
		await page.getByRole('button', { name: /Copy section link|复制章节链接/ }).click()
		await expect.poll(() => write.mock.calls.length).toBe(1)
		expect(new URL(write.mock.calls[0][0]).hash).toBe('#Obtaining_Bash')
		await expect.element(page.getByRole('status')).toHaveTextContent(/copied|已复制/)
	})
	it('offers a selectable link when clipboard access is unavailable', async () => {
		vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Permission denied'))
		await render(WikiHeading, { id: 'Notes', title: 'Notes' })
		await page.getByRole('button', { name: /Copy section link|复制章节链接/ }).click()
		await expect.element(page.getByRole('textbox')).toHaveValue(new URL('#Notes', window.location.href).href)
	})
})
