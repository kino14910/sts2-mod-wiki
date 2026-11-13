import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test, expect, type BrowserContext, type Page } from '@playwright/test'

// The webServer owns an isolated D1 store and pre-provisions these test-only subjects.
// No mocked HTTP responses and no access to the user's default .wrangler database.
const baseURL = process.env.WIKI_E2E_BASE_URL ?? 'http://localhost:4173'
test.use({ baseURL })
test.describe.configure({ mode: 'serial' })
test.setTimeout(120_000)
const section = (page: Page, key: string) => page.locator(`[data-section-key="${key}"]`)

async function locale(context: BrowserContext) {
	await context.addCookies([{ name: 'sts2_mod_wiki_locale', value: 'eng', url: baseURL }])
}

async function login(context: BrowserContext, subject: string) {
	const response = await context.request.post(`${baseURL}/api/auth/session`, {
		headers: { origin: new URL(baseURL).origin }, data: { subject, username: subject }
	})
	expect(response.status(), `Enable WIKI_DEV_LOGIN and provision ${subject} in the isolated E2E DB`).toBe(200)
	const body = await response.json()
	expect(body.session).toMatchObject({ userId: `user:${subject}`, status: 'active' })
	return body
}

async function head(page: Page, key: string) {
	const node = section(page, key)
	await expect(node).toHaveAttribute('data-section-id', /.+/)
	const id = (await node.getAttribute('data-section-id'))!
	const version = Number(await node.getAttribute('data-version'))
	const response = await page.request.get(`${baseURL}/api/wiki/sections/${encodeURIComponent(id)}/history`)
	expect(response.status()).toBe(200)
	const body = await response.json()
	expect(body.items.length).toBeGreaterThan(0)
	return { id, version, revision: body.items[0] as { id: string; content: string; revisionNo: number } }
}

async function restore(page: Page, key: string, original: { id: string; revision: { id: string; content: string } }) {
	await page.reload()
	const current = await head(page, key)
	if (current.revision.content === original.revision.content) return
	const response = await page.request.post(`${baseURL}/api/wiki/sections/${encodeURIComponent(original.id)}/revert`, {
		headers: { origin: new URL(baseURL).origin },
		data: { revisionId: original.revision.id, baseVersion: current.version, summary: 'Restore E2E fixture' }
	})
	expect(response.status()).toBe(200)
}

test('card article has working anchors, archived language names stay out of the page, and upgrade control is labelled', async ({ page, context }) => {
	await locale(context)
	await page.goto('/cards/Bash')
	await expect(page.getByRole('heading', { name: /^Bash/ })).toBeVisible()
	await expect(page.locator('#Names_in_Other_Languages')).toHaveCount(0)
	await expect(page.locator('#Update_History')).toBeVisible()
	await expect(section(page, 'history').getByRole('table')).toBeVisible()
	await page.locator('#toc').getByRole('link', { name: /Notes/ }).click()
	await expect(page).toHaveURL(/#Notes$/)
	await section(page, 'notes').getByRole('button', { name: 'Copy section link: Notes' }).click()
	await expect(section(page, 'notes').getByRole('status')).toHaveText(/Link copied|Copy this link/)
	await expect(page.locator('#Comments')).toBeAttached()
	const upgrade = page.getByRole('checkbox', { name: /Upgraded/ })
	await expect(upgrade).toBeVisible()
	await upgrade.check()
	await expect(upgrade).toBeChecked()
	await expect(page.locator('.card-infobox')).toContainText('Bash+')
	await page.screenshot({ path: 'output/playwright/bash-desktop-final.png', fullPage: true })
})

test('mobile header keeps account, languages, menu and account panel inside the viewport', async ({ page, context }) => {
	await locale(context)
	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto('/cards/Bash')
	const header = page.locator('.site-header')
	const account = header.locator('#community-account')
	const menu = header.locator('.menu-toggle')
	async function expectInsideViewport() {
		await expect.poll(() => page.evaluate(() => {
			const width = document.documentElement.clientWidth
			const controls = document.querySelectorAll('.header-inner > *, #community-account-panel')
			return document.documentElement.scrollWidth <= width + 1 && [...controls].every((node) => {
				const bounds = node.getBoundingClientRect()
				return bounds.width === 0 || (bounds.left >= -1 && bounds.right <= width + 1)
			})
		})).toBe(true)
	}
	for (const width of [390, 320]) {
		await page.setViewportSize({ width, height: 844 })
		await expect(account).toBeVisible()
		await expect(menu).toBeVisible()
		await expectInsideViewport()
		await expect.poll(() => account.evaluate((node) => {
			const range = document.createRange()
			range.selectNodeContents(node)
			return range.getClientRects().length
		})).toBe(1)
		await menu.click()
		await expect(header.locator('#mobile-menu')).toBeVisible()
		await expectInsideViewport()
		await menu.click()
		await account.click()
		await expect(header.locator('#community-account-panel')).toBeVisible()
		await expectInsideViewport()
		await page.keyboard.press('Escape')
		await expect(header.locator('#community-account-panel')).toHaveCount(0)
	}
	await header.locator('.locale-zh').click()
	await expect(account).toHaveText('登录')
	await expectInsideViewport()
	await page.setViewportSize({ width: 390, height: 844 })
	await page.screenshot({ path: 'output/playwright/bash-mobile-final.png', fullPage: true })
})

test('imported Fgo card loads decoded art and renders English and Chinese base and upgraded descriptions', async ({ page, context }) => {
	// Read the actual import output, without importing the UI renderer or mocking HTTP.
	// Fingerprints, asset paths and values can change when the DLL/PCK is reimported.
	const bundle = JSON.parse(await readFile('generated/mods/fgo/bundle.json', 'utf8')) as {
		data: { cards: { id: string; image: string; localizationId: string; variables: Record<string, number>; upgrade?: { variables?: Record<string, number> } }[] }
		localization: Record<string, Record<string, string>>
	}
	const card = bundle.data.cards.find((entry) => entry.id === 'Strike')
	expect(card, 'The real Fgo import must include the starter Strike card').toBeDefined()
	expect(card!.upgrade?.variables?.Damage).toBeGreaterThan(card!.variables.Damage)
	await locale(context)
	const response = await page.goto(`/cards/${card!.id}`)
	expect(response?.status()).toBe(200)
	await expect(page).toHaveURL(new RegExp(`/cards/fgo(?::|%3A)${card!.id}$`, 'i'))
	await expect(page.locator('.card-article')).toHaveAttribute('data-entity-id', `fgo:${card!.id}`)
	const infobox = page.locator('.card-infobox')
	const description = infobox.locator('.card-desc .desc-body')
	const upgrade = infobox.getByRole('checkbox')
	const art = infobox.locator('img.art-image')
	await expect(art).toHaveAttribute('src', /^\/imported\/fgo\//)
	await expect(art).toHaveAttribute('src', card!.image)
	await expect.poll(() => art.evaluate((image) => {
		const element = image as HTMLImageElement
		return element.complete && element.naturalWidth > 0 && element.naturalHeight > 0
	})).toBe(true)
	const artResponse = await page.request.get((await art.getAttribute('src'))!)
	expect(artResponse.status()).toBe(200)
	expect(artResponse.headers()['content-type']).toMatch(/^image\//)

	for (const language of ['eng', 'zhs', 'eng'] as const) {
		const table = bundle.localization[`localization/${language}/cards.json`]
		const title = table[`${card!.localizationId}.title`]
		const template = table[`${card!.localizationId}.description`]
		expect(title).toBeTruthy()
		expect(template).toContain('{Damage:diff()}')
		await page.locator('.locale-switch button').nth(language === 'eng' ? 0 : 1).click()
		await expect(page.locator('.locale-switch button').nth(language === 'eng' ? 0 : 1)).toHaveAttribute('aria-pressed', 'true')
		await expect(page.getByRole('heading', { level: 1 })).toContainText(title)
		await upgrade.uncheck()
		for (const upgraded of [false, true]) {
			await upgrade.setChecked(upgraded)
			const damage = upgraded ? card!.upgrade!.variables!.Damage : card!.variables.Damage
			await expect(description).toHaveText(template.replaceAll('{Damage:diff()}', String(damage)))
			await expect(description).not.toContainText(/[{}]|\[\/?(?:gold|red|green|b|i|color)(?:=[^\]]*)?\]|\b(?:IfUpgraded|diff\(\)|undefined|NaN)\b/)
			await expect(infobox).toContainText(`${title}${upgraded ? '+' : ''}`)
			await expect.poll(() => art.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
		}
	}
})

test('real TeslaCoil cards have isolated canonical pages, publication, history, comments and list upgrade state', async ({ page, context }) => {
	await locale(context)
	await login(context, 'e2e-moderator')
	const errors: string[] = []
	page.on('pageerror', (error) => errors.push(error.message))
	const ambiguous = await page.request.get('/cards/TeslaCoil', { maxRedirects: 0 })
	expect(ambiguous.status()).toBe(404)
	const legacy = await page.request.get('/cards/Strike?upgraded=1', { maxRedirects: 0 })
	expect(legacy.status()).toBe(307)
	expect(legacy.headers()['cache-control']).toBe('no-store')
	expect(legacy.headers().location).toBe('/cards/fgo%3AStrike?upgraded=1')

	await page.goto('/cards?q=Tesla')
	const baseRow = page.locator('.card-row[data-entity-id="sts2:TeslaCoil"]')
	const modRow = page.locator('.card-row[data-entity-id="fgo:TeslaCoil"]')
	await expect(baseRow).toBeVisible()
	await expect(modRow).toBeVisible()
	await expect(baseRow.locator('a.card-title')).toHaveAttribute('href', '/cards/sts2%3ATeslaCoil')
	await expect(modRow.locator('a.card-title')).toHaveAttribute('href', '/cards/fgo%3ATeslaCoil')
	await baseRow.locator('.upgrade-button').click()
	await expect(baseRow.locator('.upgrade-button')).toHaveAttribute('aria-pressed', 'true')
	await expect(modRow.locator('.upgrade-button')).toHaveAttribute('aria-pressed', 'false')
	await baseRow.locator('a.card-title').click()
	await expect(page.locator('.card-article')).toHaveAttribute('data-mod-id', 'sts2')
	await expect(page.locator('.card-infobox img.art-image')).not.toHaveAttribute('src', /^\/imported\/fgo\//)
	const baseHead = await head(page, 'notes')
	const baseDescription = await page.locator('.card-infobox .card-desc .desc-body').innerText()
	const baseComment = `Base TeslaCoil discussion ${randomUUID()}`
	const modComment = `Fgo TeslaCoil discussion ${randomUUID()}`
	const marker = `Fgo TeslaCoil publication ${randomUUID()}`
	const comments: { id: string; token: string }[] = []
	let modHead: Awaited<ReturnType<typeof head>> | undefined
	let completed = false
	const canonicalPath = (mod: string) => `/cards/${encodeURIComponent(`${mod}:TeslaCoil`)}`

	async function postCardComment(target: string, content: string) {
		const node = page.locator('#Comments')
		await expect(node).toHaveAttribute('data-comment-target-id', target)
		await node.locator('input[name="authorName"]').fill('E2E namespace reader')
		await node.locator('textarea[name="content"]').fill(content)
		const created = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/comments' && response.request().method() === 'POST')
		await node.getByRole('button', { name: /post|submit/i }).click()
		const response = await created
		expect(response.status()).toBe(201)
		const comment = await response.json()
		const token = (await page.evaluate(() => localStorage.getItem('sts2.wiki.comment.token')))!
		comments.push({ id: comment.id, token })
		expect(comment.targetId).toBe(target)
		await expect(node).toContainText(content)
	}

	try {
		await postCardComment('sts2:TeslaCoil', baseComment)
		await page.goto(canonicalPath('fgo'))
		await expect(page.locator('.card-article')).toHaveAttribute('data-entity-key', 'card:fgo:TeslaCoil')
		const art = page.locator('.card-infobox img.art-image')
		await expect(art).toHaveAttribute('src', /^\/imported\/fgo\//)
		await expect.poll(() => art.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
		await expect(page.locator('.card-infobox .card-desc .desc-body')).not.toHaveText(baseDescription)
		await expect(page.locator('.card-infobox .card-desc .desc-body')).not.toContainText(/[{}]|undefined|NaN/)
		modHead = await head(page, 'notes')
		expect(modHead.id).not.toBe(baseHead.id)
		expect(modHead.revision.id).not.toBe(baseHead.revision.id)
		await expect(page.locator('#Comments')).not.toContainText(baseComment)
		await postCardComment('fgo:TeslaCoil', modComment)
		await section(page, 'notes').getByRole('button', { name: 'Edit: Notes', exact: true }).click()
		await section(page, 'notes').getByRole('textbox').first().fill(`${modHead.revision.content}\n\n${marker}\n\n[[card:sts2:TeslaCoil|Base TeslaCoil]]`)
		const edited = page.waitForResponse((response) => response.url().includes('/edits') && response.request().method() === 'POST')
		await section(page, 'notes').getByRole('button', { name: /^Publish$/ }).click()
		const result = await edited
		expect(result.status()).toBe(200)
		await page.reload()
		await expect(section(page, 'notes').locator('.wiki-section-content')).toContainText(marker)
		const modPublished = await head(page, 'notes')
		expect(modPublished.version).toBeGreaterThan(modHead.version)
		expect(modPublished.revision.content).toContain(marker)
		// Follow a real article link to exercise SvelteKit navigation between identical raw IDs.
		await section(page, 'notes').getByRole('link', { name: 'Base TeslaCoil', exact: true }).click()
		await expect(page).toHaveURL(/\/cards\/sts2(?::|%3A)TeslaCoil$/i)
		await expect(page.locator('.card-article')).toHaveAttribute('data-entity-key', 'card:sts2:TeslaCoil')
		const unchanged = await head(page, 'notes')
		expect(unchanged).toEqual(baseHead)
		await expect(section(page, 'notes')).not.toContainText(marker)
		await expect(page.locator('#Comments')).toContainText(baseComment)
		await expect(page.locator('#Comments')).not.toContainText(modComment)
		for (const [target, own, other] of [['sts2:TeslaCoil', baseComment, modComment], ['fgo:TeslaCoil', modComment, baseComment]]) {
			const response = await page.request.get(`/api/comments?${new URLSearchParams({ targetType: 'card', targetId: target })}`)
			expect(response.status()).toBe(200)
			const body = await response.text()
			expect(body).toContain(own)
			expect(body).not.toContain(other)
		}
		expect(errors).toEqual([])
		completed = true
	} finally {
		const cleanupErrors: unknown[] = []
		for (const comment of comments) {
			try {
				const response = await page.request.delete(`/api/comments/${encodeURIComponent(comment.id)}`, {
					headers: { origin: new URL(baseURL).origin, 'x-comment-token': comment.token }
				})
				expect(response.status()).toBe(200)
			} catch (error) { cleanupErrors.push(error) }
		}
		if (modHead) {
			try {
				await page.goto(canonicalPath('fgo'))
				await restore(page, 'notes', modHead)
			} catch (error) { cleanupErrors.push(error) }
		}
		if (cleanupErrors.length) {
			if (completed) throw new AggregateError(cleanupErrors, 'Namespace E2E fixture cleanup failed')
			await test.info().attach('cleanup-errors', { body: cleanupErrors.map(String).join('\n'), contentType: 'text/plain' })
		}
	}
})

test('member proposal, moderator approval, visible publication, history diff and rollback use the real API', async ({ page, context, browser }) => {
	await locale(context)
	await page.goto('/cards/Bash')
	const original = await head(page, 'notes')
	const marker = `E2E proposal ${randomUUID()}`
	await page.locator('#community-account').click()
	await page.getByRole('textbox', { name: 'Account', exact: true }).fill('e2e-member')
	await page.getByRole('textbox', { name: 'Display name' }).fill('e2e-member')
	await page.locator('#community-account-panel').getByRole('button', { name: 'Sign in', exact: true }).click()
	await expect(page.locator('#community-account')).toHaveText(/E2E member|e2e-member/)
	const reviewer = await browser.newContext({ baseURL })
	await locale(reviewer)
	await login(reviewer, 'e2e-moderator')
	const reviewPage = await reviewer.newPage()
	try {
		await section(page, 'notes').getByRole('button', { name: 'Edit: Notes', exact: true }).click()
		await section(page, 'notes').getByRole('textbox').first().fill(`${original.revision.content}\n\n${marker}`)
		const submitted = page.waitForResponse((response) => response.url().includes('/edits') && response.request().method() === 'POST')
		await section(page, 'notes').getByRole('button', { name: /Submit for review/i }).click()
		const result = await (await submitted).json()
		expect(result.kind).toBe('proposed')
		await expect(section(page, 'notes').locator('.wiki-section-content')).not.toContainText(marker)
		const forbidden = await page.request.post(`/api/wiki/proposals/${result.proposalId}`, {
			headers: { origin: new URL(baseURL).origin }, data: { decision: 'approve' }
		})
		expect(forbidden.status()).toBe(403)
		await reviewPage.goto('/cards/Bash')
		const proposal = reviewPage.locator('[data-wiki-moderation] li').filter({ hasText: marker })
		await expect(proposal).toBeVisible()
		const approved = reviewPage.waitForResponse((response) => response.url().includes(`/proposals/${result.proposalId}`) && response.request().method() === 'POST')
		await proposal.getByRole('button', { name: /^Approve$/ }).click()
		expect((await approved).status()).toBe(200)
		await expect(section(reviewPage, 'notes').locator('.wiki-section-content')).toContainText(marker)
		await page.reload()
		await expect(section(page, 'notes').locator('.wiki-section-content')).toContainText(marker)
		await section(reviewPage, 'notes').getByRole('button', { name: 'History', exact: true }).click()
		const history = reviewPage.locator('#Notes-history')
		const originalRow = history.getByRole('listitem').filter({ has: reviewPage.getByText(`v${original.revision.revisionNo}`, { exact: true }) })
		await originalRow.getByRole('button', { name: /diff/i }).click()
		await expect(originalRow.locator('pre')).not.toHaveCount(0)
		reviewPage.once('dialog', (dialog) => dialog.accept())
		await originalRow.getByRole('button', { name: /restore this version/i }).click()
		await expect(section(reviewPage, 'notes').locator('.wiki-section-content')).not.toContainText(marker)
		const restored = await head(reviewPage, 'notes')
		expect(restored.revision.content).toBe(original.revision.content)
		expect(restored.version).toBeGreaterThan(original.version)
	} finally {
		if (!reviewPage.url().includes('/cards/Bash')) await reviewPage.goto('/cards/Bash')
		await restore(reviewPage, 'notes', original)
		await reviewer.close()
	}
})

test('trusted publication preserves a concurrent draft on 409; section discussions and card comments stay separate', async ({ page, context, browser }) => {
	await locale(context)
	await login(context, 'e2e-trusted')
	await page.goto('/cards/Bash')
	const original = await head(page, 'obtaining')
	const tag = randomUUID()
	const published = `E2E published ${tag}`
	const draft = `E2E draft ${tag}`
	const moderator = await browser.newContext({ baseURL })
	await locale(moderator)
	await login(moderator, 'e2e-moderator')
	const other = await moderator.newPage()
	const commentIds: string[] = []
	let commentToken: string | null = null
	let completed = false
	try {
		await section(page, 'obtaining').getByRole('button', { name: 'Edit: Obtaining Bash' }).click()
		await section(page, 'obtaining').getByRole('textbox').first().fill(draft)
		// A different signed-in client publishes after this editor captured its base version.
		const external = await moderator.request.post(`${baseURL}/api/wiki/sections/${encodeURIComponent(original.id)}/edits`, {
			headers: { origin: new URL(baseURL).origin }, data: { content: published, baseVersion: original.version, summary: `Concurrent E2E ${tag}` }
		})
		expect(external.status()).toBe(200)
		await section(page, 'obtaining').getByRole('button', { name: /^Publish$/ }).click()
		await expect(section(page, 'obtaining').getByRole('alert')).toContainText('draft has been kept')
		await expect(section(page, 'obtaining').getByRole('textbox').first()).toHaveValue(draft)
		await section(page, 'obtaining').getByRole('button', { name: 'Keep draft and use latest version' }).click()
		await section(page, 'obtaining').getByRole('button', { name: /^Publish$/ }).click()
		await expect(section(page, 'obtaining').locator('.wiki-section-content')).toHaveText(draft)
		await page.reload()
		await expect(section(page, 'obtaining').locator('.wiki-section-content')).toHaveText(draft)
		await section(page, 'obtaining').getByRole('button', { name: 'Discussion', exact: true }).click()
		const discussion = page.locator('#Obtaining_Bash-discussion')
		await discussion.locator('input[name="authorName"]').fill('E2E reader')
		await discussion.locator('textarea[name="content"]').fill(`Section discussion ${tag}`)
		const commentCreated = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/comments' && response.request().method() === 'POST')
		await discussion.getByRole('button', { name: /post|submit/i }).click()
		const comment = await (await commentCreated).json()
		commentIds.push(comment.id)
		commentToken = await page.evaluate(() => localStorage.getItem('sts2.wiki.comment.token'))
		await expect(discussion).toContainText(`Section discussion ${tag}`)
		await expect(page.locator('#Comments')).not.toContainText(`Section discussion ${tag}`)
		// The article's visible text disappears while editing; identity must survive that transition.
		const commentNode = discussion.locator(`[data-comment-id="${comment.id}"]`)
		await commentNode.getByRole('button', { name: /^Edit$/ }).click()
		await commentNode.locator('textarea').fill(`Edited discussion ${tag}`)
		await commentNode.getByRole('button', { name: /^Save$/ }).click()
		await expect(discussion).toContainText(`Edited discussion ${tag}`)
		page.once('dialog', (dialog) => dialog.accept())
		await commentNode.getByRole('button', { name: /^Delete$/ }).click()
		await expect(discussion).not.toContainText(`Edited discussion ${tag}`)
		commentIds.length = 0
		completed = true
	} finally {
		const cleanupErrors: unknown[] = []
		try {
			// API cleanup retains the captured anonymous ownership token if the page has closed.
			for (const id of commentIds) {
				const response = await moderator.request.delete(`${baseURL}/api/comments/${encodeURIComponent(id)}`, {
					headers: { origin: new URL(baseURL).origin, ...(commentToken ? { 'x-comment-token': commentToken } : {}) }
				})
				expect(response.status()).toBe(200)
			}
		} catch (error) { cleanupErrors.push(error) }
		try {
			await other.goto('/cards/Bash')
			await restore(other, 'obtaining', original)
		} catch (error) { cleanupErrors.push(error) }
		try { await moderator.close() } catch (error) { cleanupErrors.push(error) }
		if (cleanupErrors.length) {
			if (completed) throw new AggregateError(cleanupErrors, 'E2E fixture cleanup failed')
			await test.info().attach('cleanup-errors', { body: cleanupErrors.map(String).join('\n'), contentType: 'text/plain' })
		}
	}
})
