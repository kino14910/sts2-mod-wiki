import { describe, expect, it } from 'vitest'
import { isAllowedEmail } from '#lib/email-domain'

describe('QQ email domain policy', () => {
	it('accepts QQ addresses regardless of letter case', () => {
		expect(isAllowedEmail('reader@qq.com')).toBe(true)
		expect(isAllowedEmail('Reader.1@QQ.COM')).toBe(true)
	})

	it('rejects other domains, subdomains, malformed addresses and non-strings', () => {
		for (const value of [
			'reader@example.com', 'reader@vip.qq.com', 'reader@qq.com.cn',
			'reader@@qq.com', '@qq.com', 'reader @qq.com', ' reader@qq.com',
			'reader@qq.com ', 'reader@ qq.com', 123, null, undefined, {}
		]) expect(isAllowedEmail(value)).toBe(false)
	})
})
