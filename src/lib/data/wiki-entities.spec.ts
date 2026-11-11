import { describe, expect, it } from 'vitest'
import { WIKI_TERM_NAMES, wikiEntryFor, wikiRelic } from './power-wiki'

describe('inline wiki entity resolution', () => {
	it('referenced cards resolve to their canonical page', () => {
		const bash = wikiEntryFor('Bash')
		expect(bash?.kind).toBe('card')
		expect(bash?.id).toBe('Bash')
		expect(bash?.href).toBe('/cards/Bash')
		expect(bash?.description).toContain('Deal')
		expect(bash?.tooltip).toContain('Bash')
	})

	it('chinese aliases resolve to the same entity', () => {
		expect(wikiEntryFor('痛击')?.id).toBe('Bash')
		expect(wikiEntryFor('狱火')?.id).toBe('Inferno')
	})

	it('tooltip terms become power entries with links when a power exists', () => {
		const vulnerable = wikiEntryFor('Vulnerable')
		expect(vulnerable?.href).toBe('/power/VulnerablePower')
		expect(vulnerable?.tooltip).toContain('Vulnerable')

		const exhaust = wikiEntryFor('Exhaust')
		expect(exhaust?.href).toBeNull()
		expect(exhaust?.tooltip).toContain('Exhaust')
	})

	it('plain card, relic and power names in prose resolve by exact case', () => {
		const inferno = wikiEntryFor('Inferno')
		expect(inferno?.kind).toBe('card')
		expect(inferno?.href).toBe('/cards/Inferno')
		expect(wikiEntryFor('inferno')).toBeNull()

		expect(wikiEntryFor('Serpent Form')?.href).toBe('/cards/SerpentForm')
		expect(wikiEntryFor('Strike Dummy')?.href).toBe('/relic/StrikeDummy')
		expect(wikiEntryFor('Flutter')?.href).toBe('/power/FlutterPower')
		expect(wikiEntryFor('flutter')).toBeNull()
	})

	it('proper nouns need exact case while keywords stay case-insensitive', () => {
		expect(wikiEntryFor('Break')?.id).toBe('Break')
		expect(wikiEntryFor('break')).toBeNull()
		expect(wikiEntryFor('exhaust')?.name).toBe('Exhaust')
		expect(wikiEntryFor('Exhaust')?.name).toBe('Exhaust')
	})

	it('ambiguous or short English names stay out of the matcher', () => {
		expect(WIKI_TERM_NAMES).toContain('bash')
		expect(WIKI_TERM_NAMES).toContain('inferno')
		expect(WIKI_TERM_NAMES).toContain('serpent form')
		expect(WIKI_TERM_NAMES).not.toContain('strike')
		expect(WIKI_TERM_NAMES).not.toContain('defend')
		expect(WIKI_TERM_NAMES).not.toContain('plot')
		expect(WIKI_TERM_NAMES).not.toContain('fade')
	})

	it('relic icon lookups produce a tooltip from game data', () => {
		expect(wikiEntryFor('Strike Dummy')?.tooltip).toContain('Strike Dummy')
		const relic = wikiRelic('PaperPhrog')
		expect(relic?.name).toBe('Paper Phrog')
		expect(relic?.tooltip).toContain('Paper Phrog')
		expect(relic?.aliases).toContain('Paper Phrog')
	})

	it('relic icon markers resolve by id before ambiguous localized names', () => {
		const relic = wikiRelic('StrikeDummy')
		expect(relic?.name).toBe('Strike Dummy')
		expect(relic?.aliases).toContain('Strike Dummy')
	})
})
