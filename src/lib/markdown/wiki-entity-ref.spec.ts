import { describe, expect, it } from 'vitest'
import { resolveWikiEntityReference } from './wiki-entity-ref'
import { parseWikiEntityReference } from './wiki-entity-syntax'

describe('wiki entity references', () => {
	it('parses the complete namespace:EntityType:EntityId syntax', () => {
		expect(parseWikiEntityReference('sts2:Card:Bash')).toEqual({
			namespace: 'sts2',
			entityType: 'Card',
			entityId: 'Bash'
		})
		expect(parseWikiEntityReference('fgo:Card:Strike')?.namespace).toBe('fgo')
	})

	it('rejects abbreviations, missing namespaces and aliases', () => {
		expect(parseWikiEntityReference('Bash')).toBeNull()
		expect(parseWikiEntityReference('Card:Bash')).toBeNull()
		expect(parseWikiEntityReference('sts2:card:Bash')).toBeNull()
		expect(parseWikiEntityReference('sts2:Widget:Bash')).toBeNull()
		expect(parseWikiEntityReference('sts2:Card:')).toBeNull()
		expect(parseWikiEntityReference('STS2:Card:Bash')).toBeNull()
	})

	it('resolves vanilla and Mod cards against the existing catalog', () => {
		expect(resolveWikiEntityReference({ namespace: 'sts2', entityType: 'Card', entityId: 'Bash' }))
			.toEqual({ type: 'card', id: 'Bash', modId: 'sts2' })
		expect(resolveWikiEntityReference({ namespace: 'fgo', entityType: 'Card', entityId: 'Strike' }))
			.toEqual({ type: 'card', id: 'Strike', modId: 'fgo' })
	})

	it('resolves Keywords through the canonical English key without using Chinese names', () => {
		expect(resolveWikiEntityReference({ namespace: 'sts2', entityType: 'Keyword', entityId: 'Vulnerable' }))
			.toEqual({ type: 'power', id: 'VulnerablePower', modId: 'sts2' })
		expect(resolveWikiEntityReference({ namespace: 'sts2', entityType: 'Keyword', entityId: 'VulnerablePower' }))
			.toEqual({ type: 'power', id: 'VulnerablePower', modId: 'sts2' })
		expect(resolveWikiEntityReference({ namespace: 'sts2', entityType: 'Keyword', entityId: '易伤' })).toBeNull()
	})

	it('fails safely for unknown namespaces and ids', () => {
		expect(resolveWikiEntityReference({ namespace: 'unknown', entityType: 'Card', entityId: 'Bash' })).toBeNull()
		expect(resolveWikiEntityReference({ namespace: 'sts2', entityType: 'Card', entityId: 'MissingCard' })).toBeNull()
		expect(resolveWikiEntityReference({ namespace: 'sts2', entityType: 'Keyword', entityId: 'MissingKeyword' })).toBeNull()
	})
})
