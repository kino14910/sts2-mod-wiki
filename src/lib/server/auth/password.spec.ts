import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('PBKDF2 password hashes', () => {
	it('verifies the matching password and rejects mismatches', async () => {
		const hash = await hashPassword('correct-horse-battery')
		expect(hash).toMatch(/^pbkdf2\$210000\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/)
		expect(hash).not.toContain('correct-horse-battery')
		expect(await verifyPassword('correct-horse-battery', hash)).toBe(true)
		expect(await verifyPassword('wrong-password', hash)).toBe(false)
	})

	it('rejects missing or malformed stored hashes', async () => {
		for (const value of [null, '', 'plaintext', 'pbkdf2$abc$def', 'sha256$1$YWJj$YWJj'])
			expect(await verifyPassword('anything', value)).toBe(false)
	})
})
