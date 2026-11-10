import { describe, expect, it } from 'vitest'
import {
	isSafeSourcePath,
	isValidModVersion,
	isValidPageSlug,
	isValidSectionKey,
	validateWikiContent
} from './validation'

describe('mod wiki input validation', () => {
	it('accepts safe section keys and slugs', () => {
		expect(isValidSectionKey('overview')).toBe(true)
		expect(isValidSectionKey('effect-analysis')).toBe(true)
		expect(isValidPageSlug('index')).toBe(true)
		expect(isValidPageSlug('characters/nero')).toBe(true)
	})

	it('rejects path traversal and malformed identifiers', () => {
		expect(isValidSectionKey('../overview')).toBe(false)
		expect(isValidSectionKey('Overview')).toBe(false)
		expect(isValidPageSlug('../index')).toBe(false)
		expect(isValidPageSlug('/index')).toBe(false)
		expect(isValidPageSlug('index/')).toBe(false)
	})

	it('only accepts relative markdown paths inside static/mods/{id}/wiki', () => {
		expect(isSafeSourcePath('static/mods/sts2/wiki/index/overview.md')).toBe(true)
		expect(isSafeSourcePath('static/mods/sts2/wiki/characters/nero/strategy.md')).toBe(true)
		expect(isSafeSourcePath('static/mods/sts2/wiki/../../secret.md')).toBe(false)
		expect(isSafeSourcePath('/etc/passwd.md')).toBe(false)
		expect(isSafeSourcePath('static/mods/sts2/wiki/index/overview.txt')).toBe(false)
		expect(isSafeSourcePath('src/lib/secrets.md')).toBe(false)
	})

	it('rejects executable markup and oversized content', () => {
		expect(validateWikiContent('Normal **wiki** text with StS2 Icon Vulnerable.png')).toBeNull()
		expect(validateWikiContent('<script>alert(1)</script>')).not.toBeNull()
		expect(validateWikiContent('{@html userInput}')).not.toBeNull()
		expect(validateWikiContent('[link](javascript:alert(1))')).not.toBeNull()
		expect(validateWikiContent('x'.repeat(100_001))).not.toBeNull()
		expect(validateWikiContent('bad\u0000byte')).not.toBeNull()
	})

	it('validates mod versions', () => {
		expect(isValidModVersion(null)).toBe(true)
		expect(isValidModVersion('1.2.3')).toBe(true)
		expect(isValidModVersion('bad\nversion')).toBe(false)
	})
})
