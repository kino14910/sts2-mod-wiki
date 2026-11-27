import { describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-svelte'
import { BASH_SECTIONS } from '#lib/data/card-article-content'
import { BASH_CARD_ARTICLE } from '#lib/data/card-wiki'
import WikiMarkdown from './WikiMarkdown.svelte'

/* 页面上下文不是卡牌页，卡牌链接才会渲染成 <a> 而不是自链接 span。 */
vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/mods/sts2/wiki/overview') } }))

const SAMPLE = `Bash applies [[sts2:Keyword:Vulnerable]].

See [[sts2:Card:Bash]].

| Card | Effect |
|---|---|
| [[sts2:Card:Bash]] | Apply [[sts2:Keyword:Vulnerable]] |

:::details{summary="Interactions"}
[[sts2:Card:Bash]]
:::`

describe('WikiMarkdown', () => {
	it('renders cards and keywords with localized links and hover tips', async () => {
		await render(WikiMarkdown, { md: SAMPLE })
		await expect.element(page.getByRole('link', { name: 'Bash' }).first()).toHaveAttribute('href', '/cards/Bash')
		await expect.element(page.getByRole('link', { name: 'Vulnerable' }).first()).toHaveAttribute('href', '/power/VulnerablePower')

		await page.getByRole('link', { name: 'Vulnerable' }).first().hover()
		await expect.element(page.getByRole('tooltip')).toBeVisible()
		await expect.element(page.getByRole('tooltip')).toHaveTextContent('Vulnerable')
	})

	it('shows the keyword tooltip on keyboard focus', async () => {
		await render(WikiMarkdown, { md: 'Apply [[sts2:Keyword:Vulnerable]].' })
		const link = page.getByRole('link', { name: 'Vulnerable' })
		await link.element().focus()
		await expect.element(page.getByRole('tooltip')).toBeVisible()
	})

	it('renders GFM tables, headings, lists and details containers', async () => {
		const md = `## Obtaining Bash

- first
- second

| Card | Effect |
|---|---|
| Bash | Vulnerable |

:::details{summary="Interactions"}
[[sts2:Card:Bash]]
:::`
		await render(WikiMarkdown, { md })
		await expect.element(page.getByRole('heading', { name: 'Obtaining Bash' })).toBeVisible()
		await expect.element(page.getByRole('region', { name: /table/i })).toBeVisible()
		expect(document.querySelectorAll('[data-wiki-markdown] table th')).toHaveLength(2)
		expect(document.querySelectorAll('[data-wiki-markdown] ul li')).toHaveLength(2)

		const details = document.querySelector<HTMLDetailsElement>('[data-wiki-markdown] details')
		expect(details?.querySelector('summary')?.textContent).toBe('Interactions')
		await page.getByText('Interactions').click()
		expect(details?.open).toBe(true)
		expect(details?.querySelector('a[href="/cards/Bash"]')).not.toBeNull()
	})

	it('keeps code references literal and safely degrades unknown entities', async () => {
		const md = 'Inline `[[sts2:Card:Bash]]`.\n\n```\n[[sts2:Keyword:Vulnerable]]\n```\n\nUnknown [[sts2:Card:MissingCard]].'
		await render(WikiMarkdown, { md })
		const container = document.querySelector('[data-wiki-markdown]') as HTMLElement
		expect(container.querySelectorAll('pre code')[0].textContent).toBe('[[sts2:Keyword:Vulnerable]]\n')
		expect(container.querySelectorAll('p code')[0].textContent).toBe('[[sts2:Card:Bash]]')
		expect(container.querySelectorAll('a')).toHaveLength(0)
		expect(container.querySelector('.wiki-entity-missing')?.textContent).toBe('[[sts2:Card:MissingCard]]')
	})

	it('renders Chinese labels when the locale is zhs', async () => {
		await render(WikiMarkdown, { md: 'See [[sts2:Card:Bash]] and [[sts2:Keyword:Vulnerable]].', locale: 'zhs' })
		await expect.element(page.getByRole('link', { name: '痛击' })).toBeVisible()
		await expect.element(page.getByRole('link', { name: '易伤' })).toBeVisible()
	})

	it('keeps legacy token content working through the page context', async () => {
		await render(WikiMarkdown, {
			props: {
				md: 'Old [[Bash]] token.',
				context: {
					tokens: { Bash: { text: 'Bash', href: '/cards/Bash', icon: '' } },
					tooltips: {}
				}
			}
		})
		await expect.element(page.getByRole('link', { name: 'Bash' })).toHaveAttribute('href', '/cards/Bash')
	})

	it('escapes user HTML instead of executing it', async () => {
		await render(WikiMarkdown, { md: '<script>alert(1)</script>\n\n<b>not bold</b>' })
		const container = document.querySelector('[data-wiki-markdown]') as HTMLElement
		expect(container.querySelector('script')).toBeNull()
		expect(container.querySelector('b')).toBeNull()
		expect(container.textContent).toContain('<script>alert(1)</script>')
	})

	it('drops unsafe link protocols but keeps safe links', async () => {
		await render(WikiMarkdown, { md: '[unsafe](javascript:alert(1)) [safe](https://example.com)' })
		const container = document.querySelector('[data-wiki-markdown]') as HTMLElement
		expect(container.querySelectorAll('a')).toHaveLength(1)
		expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.com')
		expect(container.textContent).toContain('unsafe')
	})

	it('renders the Bash Markdown files with resolved entities', async () => {
		await render(WikiMarkdown, {
			props: {
				md: `${BASH_SECTIONS.overview}\n\n${BASH_SECTIONS.synergies}`,
				context: BASH_CARD_ARTICLE.context
			}
		})
		await expect.element(page.getByRole('link', { name: 'Bash' }).first()).toHaveAttribute('href', '/cards/Bash')
		await expect.element(page.getByRole('link', { name: 'Bully' })).toHaveAttribute('href', '/cards/Bully')
		await expect.element(page.getByRole('link', { name: 'Paper Phrog' })).toHaveAttribute('href', '/relic/PaperPhrog')
		await expect.element(page.getByRole('link', { name: 'Vulnerable' }).first()).toHaveAttribute('href', '/power/VulnerablePower')
		expect(document.querySelectorAll('[data-wiki-markdown] ul ul li')).toHaveLength(8)
	})

	it('renders the Bash history table with line breaks in cells', async () => {
		await render(WikiMarkdown, { md: BASH_SECTIONS.history })
		expect(document.querySelectorAll('[data-wiki-markdown] table')).toHaveLength(1)
		expect(document.querySelectorAll('[data-wiki-markdown] td br').length).toBeGreaterThan(0)
	})
})
