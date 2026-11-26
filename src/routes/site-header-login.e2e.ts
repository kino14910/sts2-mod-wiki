import { expect, test, type Route } from '@playwright/test'
import type { WikiViewer } from '#lib/wiki-collaboration'

const anonymous = { session: null, permissions: [] } satisfies WikiViewer
const avatarUrl = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="blue"/></svg>')}`
const member = {
	session: { userId: 'test-member', username: 'Wiki Tester', avatarUrl, role: 'user', status: 'active' },
	permissions: []
} satisfies WikiViewer

const sessionPath = '/api/auth/session'
const loginPath = '/api/auth/login'

test.beforeEach(async ({ context, baseURL }) => {
	await context.addCookies([{ name: 'sts2_mod_wiki_locale', value: 'eng', url: baseURL! }])
})

test('the anonymous layout can sign in and out even when the initial session GET is slow', async ({ page }) => {
	const initialGet = Promise.withResolvers<Route>()
	await page.route(`**${sessionPath}`, (route) => {
		switch (route.request().method()) {
			case 'GET': initialGet.resolve(route); return
			case 'DELETE': return route.fulfill({ status: 204 })
			default: return route.fulfill({ status: 405 })
		}
	})
	await page.route(`**${loginPath}`, (route) => route.fulfill({ json: member }))

	await page.goto('/potions')
	const stale = await initialGet.promise
	const header = page.getByRole('banner')
	const panel = header.getByRole('region', { name: 'Community account', exact: true })
	const signIn = header.getByRole('button', { name: 'Sign in', exact: true })
	const account = header.getByRole('button', { name: member.session.username, exact: true })
	await expect(signIn).toBeVisible()
	await expect(panel).toHaveCount(0)
	await signIn.click()
	const credentials = { email: 'wiki-tester@qq.com', password: 'test-password' }
	await panel.getByLabel('QQ email', { exact: true }).fill(credentials.email)
	await panel.getByLabel('Password', { exact: true }).fill(credentials.password)
	const [login] = await Promise.all([
		page.waitForRequest(loginPath),
		panel.getByRole('button', { name: 'Sign in', exact: true }).click()
	])
	expect(login.method()).toBe('POST')
	expect(login.postDataJSON()).toEqual(credentials)

	await expect(panel.getByRole('status')).toHaveText('Signed in successfully.')
	await expect(account).toBeVisible()
	const avatar = account.locator('img')
	await expect(avatar).toHaveAttribute('src', avatarUrl)
	await expect.poll(() => avatar.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)

	// Release the old anonymous result only after login. Chromium may already have aborted it.
	const staleRequest = stale.request()
	await stale.fulfill({ json: anonymous }).catch(async (error) => {
		await staleRequest.response()
		if (staleRequest.failure()?.errorText !== 'net::ERR_ABORTED') throw error
	})
	await (await staleRequest.response())?.finished()

	const signOut = panel.getByRole('button', { name: 'Sign out', exact: true })
	await expect(signOut).toBeEnabled()
	const [logout] = await Promise.all([page.waitForRequest(sessionPath), signOut.click()])
	expect(logout.method()).toBe('DELETE')
	await expect(panel).toHaveCount(0)
	await expect(signIn).toBeVisible()
	await expect(account).toHaveCount(0)
	await signIn.click()
	await expect(panel.getByLabel('Password', { exact: true })).toHaveValue('')
	await expect(panel.getByRole('status')).toBeEmpty()
})

test('the header restores an existing session on mount without a sign-in notice', async ({ page }) => {
	await page.route(`**${sessionPath}`, (route) => route.fulfill({ json: member }))
	await page.goto('/potions')

	const header = page.getByRole('banner')
	const account = header.getByRole('button', { name: member.session.username, exact: true })
	await expect(account).toBeVisible()
	await expect(account.locator('img')).toHaveAttribute('src', avatarUrl)
	await account.click()
	const panel = header.getByRole('region', { name: 'Community account', exact: true })
	await expect(panel.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
	await expect(panel.getByRole('status')).toBeEmpty()
})
