import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const bundle = JSON.parse(readFileSync('generated/mods/fgo/bundle.json', 'utf8'))
const pools = bundle.manifest.cardPool
const nobles = bundle.data.cards.filter((card: { pool: string }) => card.pool === 'noble')

test('manifest character buttons filter Noble Phantasms and survive refreshing the URL', async ({ page, context }) => {
	await context.addCookies([{ name: 'sts2_mod_wiki_locale', value: 'zhs', url: 'http://localhost:4173' }])
	await page.goto('/cards?mod=fgo')
	const noble = page.locator('button[title="宝具"]')
	await expect(noble).toBeVisible()
	await expect(noble.locator('img')).toHaveAttribute('src', pools.noble.char)
	await noble.click()
	await expect(noble).toHaveAttribute('aria-pressed', 'true')
	await expect(page).toHaveURL(/color=noble/)
	const rows = page.locator('.card-row')
	await expect(rows.first()).toBeVisible()
	await expect.poll(() => rows.evaluateAll((nodes) => nodes.every((node) => node.getAttribute('data-color') === '宝具'))).toBe(true)
	await expect(page.getByText(`${nobles.length} 张卡牌，来自 1 个模组`, { exact: true })).toBeVisible()
	await page.reload()
	await expect(noble).toHaveAttribute('aria-pressed', 'true')
	await expect(rows.first()).toHaveAttribute('data-color', '宝具')
	await noble.click()
	await expect(noble).toHaveAttribute('aria-pressed', 'false')
	await expect(page).not.toHaveURL(/color=noble/)
	await page.setViewportSize({ width: 320, height: 844 })
	await expect(noble).toBeVisible()
	const rarity = page.getByRole('heading', { name: '稀有度', exact: true })
	const nobleBounds = await noble.boundingBox()
	const rarityBounds = await rarity.boundingBox()
	expect(rarityBounds!.y).toBeGreaterThanOrEqual(nobleBounds!.y + nobleBounds!.height)
})

test('list and detail pages use the imported frames and energy icons', async ({ page, context }) => {
	await context.addCookies([{ name: 'sts2_mod_wiki_locale', value: 'eng', url: 'http://localhost:4173' }])
	for (const type of ['attack', 'skill', 'power']) {
		await page.goto(`/cards?mod=fgo&color=fgo&type=${type}`)
		const row = page.locator('.card-row').first()
		await expect(row).toBeVisible()
		await expect(row.locator('.card-frame')).toHaveAttribute('src', pools.fgo.cardFrame[type])
		await expect.poll(() => row.locator('.card-frame').evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
		await row.locator('.thumb-link').click()
		await expect(page.locator('.card-infobox .card-frame')).toHaveAttribute('src', pools.fgo.cardFrame[type])
	}
	await page.goto(`/cards/${encodeURIComponent('fgo:' + nobles[0].id)}`)
	await expect(page.locator('.card-infobox')).toBeVisible()
	await expect(page.locator('.card-infobox .card-frame')).toHaveCount(0)
	await expect.poll(() => page.locator('.card-infobox .card-thumb').evaluate((node) => (node as HTMLElement).style.getPropertyValue('--cost-image')))
		.toContain(pools.noble.cardEnergy)
	for (const url of [pools.noble.char, pools.noble.cardEnergy, ...Object.values(pools.fgo.cardFrame)] as string[]) {
		const resource = await page.request.get(url)
		expect(resource.ok(), url).toBe(true)
		expect(resource.headers()['content-type']).toContain('image/')
	}
})
