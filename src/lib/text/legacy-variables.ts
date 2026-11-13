import { parseGameTemplate } from './game-template'

export interface VariableSource {
	modId: string
	source: 'legacy-static' | 'build'
}

/**
 * Old sts2 collection snapshots stored percentMore variables as display percentages.
 * This migration is explicit about provenance and formatter semantics: build values
 * and Mod values are never converted, regardless of their numeric magnitude.
 * The old collection evaluator did not implement percentLess, so it is not migrated.
 */
export function adaptLegacyCollectionVariables(
	template: string,
	variables: Record<string, string | number> = {},
	origin: VariableSource
): Record<string, string | number> {
	if (origin.source !== 'legacy-static' || origin.modId !== 'sts2') return variables
	const names = new Set<string>()
	function visit(text: string) {
		for (const node of parseGameTemplate(text)) {
			if (node.type !== 'variable') continue
			if (node.name && node.args === 'percentMore()') names.add(node.name)
			if (node.args?.includes('{')) visit(node.args)
		}
	}
	visit(template)
	const result = { ...variables }
	for (const name of names) {
		const value = variables[name]
		if (value === undefined) continue
		const text = String(value).trim()
		if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)%?$/.test(text)) {
			throw new Error(`Invalid legacy percentMore variable ${name}: ${text}`)
		}
		result[name] = 1 + Number(text.replace(/%$/, '')) / 100
	}
	return result
}
